import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import crypto from 'node:crypto'

// Server-only YouCam (Perfect Corp) S2S client. Owns auth, file upload, and the
// async task lifecycle. Supports optional per-request credentials (BYOK).

const HOST = 'https://yce-api-01.perfectcorp.com'

export interface Creds { apiKey: string; secretKey: string }

function envCreds(): Creds {
  const apiKey = process.env.YOUCAM_API_KEY
  const secretKey = process.env.YOUCAM_SECRET_KEY
  if (!apiKey || !secretKey) throw new Error('Missing YOUCAM_API_KEY / YOUCAM_SECRET_KEY')
  return { apiKey, secretKey }
}

function toPem(b64: string): string {
  return `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----\n`
}

/** Thrown when a caller's own credentials are malformed, rather than merely rejected. */
export const BAD_CREDENTIALS = 'bad_credentials'

/** RSA(PKCS#1 v1.5)-encrypt "client_id=..&timestamp=.." with the secret (public) key. */
function makeIdToken(c: Creds): string {
  const payload = `client_id=${c.apiKey}&timestamp=${Date.now()}`
  try {
    return crypto
      .publicEncrypt({ key: toPem(c.secretKey), padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(payload, 'utf8'))
      .toString('base64')
  } catch {
    // A pasted key that is not a valid RSA public key fails here, deep in OpenSSL, with
    // something like "asn1 encoding routines::too long". Not a useful thing to show.
    throw new Error(BAD_CREDENTIALS)
  }
}

/**
 * How long the current request still has, as an ambient deadline.
 *
 * The retry ladder below is generous per call, and a single request makes several of them:
 * auth, register, upload, submit, then a status poll every 2.5s. Counted per call it looks
 * reasonable; added up against a 60s serverless limit it is not. Five tries at a 20s
 * timeout plus backoff is 122s of patience for one fetch, which is twice the budget the
 * whole handler gets, so a run of bad luck was cut off mid-flight with nothing to show.
 *
 * Rather than thread a deadline through six signatures, the route states its budget once
 * and everything underneath inherits it. Outside a budget the deadline is absent and the
 * ladder behaves exactly as it always did, which keeps scripts and tests unchanged.
 */
const budget = new AsyncLocalStorage<number>()

/** Run `fn` under a wall-clock budget that every YouCam call beneath it will respect. */
export function withBudget<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  return budget.run(Date.now() + ms, fn)
}

/** Milliseconds left in the current budget, or Infinity when none was set. */
function timeLeft(): number {
  const deadline = budget.getStore()
  return deadline === undefined ? Infinity : deadline - Date.now()
}

export async function fetchRetry(url: string, opts: RequestInit = {}, tries = 5, timeoutMs = 20000): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    const left = timeLeft()
    if (left <= 0) break
    try {
      const controller = new AbortController()
      // Never wait past the budget: a 20s attempt with 3s left is 17s of certain waste.
      const t = setTimeout(() => controller.abort(), Math.min(timeoutMs, left))
      const r = await fetch(url, { ...opts, signal: controller.signal })
      clearTimeout(t)
      return r
    } catch (e) {
      lastErr = e
      // Backing off past the deadline just burns the remainder before giving up anyway.
      const backoff = 1500 * (i + 1)
      if (backoff >= timeLeft()) break
      await new Promise((res) => setTimeout(res, backoff))
    }
  }
  // Say which of the two happened. Out of budget is our own clock running out, and the
  // wording matters: callers key on "timed out" to report a slow read as exactly that,
  // whereas the raw AbortError underneath reaches the wearer as "This operation was
  // aborted", which explains nothing and blames nobody.
  if (timeLeft() <= 0) throw new Error(`YouCam timed out: out of budget calling ${url.slice(0, 80)}`)
  throw lastErr ?? new Error(`YouCam timed out: ${url.slice(0, 80)}`)
}

// token cache keyed by apiKey
const tokenCache = new Map<string, { token: string; exp: number }>()

async function accessToken(creds?: Creds): Promise<string> {
  const c = creds ?? envCreds()
  const cached = tokenCache.get(c.apiKey)
  if (cached && cached.exp > Date.now() + 60_000) return cached.token
  const r = await fetchRetry(`${HOST}/s2s/v1.0/client/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: c.apiKey, id_token: makeIdToken(c) }),
  })
  const j = await r.json()
  const token = j?.result?.access_token
  if (!token) throw new Error(`YouCam auth failed: ${JSON.stringify(j).slice(0, 200)}`)
  tokenCache.set(c.apiKey, { token, exp: Date.now() + 110 * 60_000 })
  return token
}

async function api<T = unknown>(
  path: string,
  { method = 'GET', body, creds }: { method?: string; body?: unknown; creds?: Creds } = {},
): Promise<{ status: number; json: T }> {
  const token = await accessToken(creds)
  const r = await fetchRetry(`${HOST}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json: T
  try {
    json = JSON.parse(text) as T
  } catch {
    throw new Error(`YouCam ${path} non-JSON (${r.status}): ${text.slice(0, 200)}`)
  }
  return { status: r.status, json }
}

interface FileRegistration {
  data: { files: { file_id: string; requests: { method: string; url: string; headers: Record<string, string> }[] }[] }
}

export async function uploadFile(feature: string, bytes: Buffer, creds?: Creds, contentType = 'image/jpeg', fileName = 'image.jpg'): Promise<string> {
  const { json } = await api<FileRegistration>(`/s2s/v2.0/file/${feature}`, {
    method: 'POST',
    creds,
    body: { files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }] },
  })
  const f = json.data.files[0]
  const put = f.requests[0]
  const r = await fetchRetry(put.url, { method: put.method, headers: put.headers, body: new Uint8Array(bytes) })
  if (!r.ok) throw new Error(`YouCam upload PUT failed: ${r.status}`)
  return f.file_id
}

export interface TaskResult {
  task_status: 'success' | 'error' | 'running' | 'processing' | 'pending' | 'queued'
  error: string | null
  results: unknown
}

/**
 * Tasks outlive the request that started them.
 *
 * Units are charged when a task is created, not when its result is collected, and giving
 * up on a slow read neither cancels it nor refunds it. YouCam carries on regardless; the
 * only thing a timeout ends is our willingness to wait. So a retry that uploads the same
 * photo again pays a second time for work already in flight, and the first answer lands
 * in a request nobody is listening to.
 *
 * When a caller supplies a resumeKey we keep the task id past the timeout, so the next
 * attempt polls the task already running instead of opening another. A read that YouCam
 * finished at forty seconds is then collected by the retry for nothing.
 *
 * Best-effort on purpose: this is instance memory, so a warm serverless instance catches
 * the resume and a cold one starts over. Guaranteeing it means a shared store, which is
 * more machinery than this warrants, and the worst case is only what we already pay.
 */
const RESUMABLE = new Map<string, { taskId: string; at: number }>()
const RESUME_TTL_MS = 10 * 60_000

/** The task id still worth polling for this key, if one is. */
export function resumableTask(key: string): string | undefined {
  const hit = RESUMABLE.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > RESUME_TTL_MS) {
    RESUMABLE.delete(key)
    return undefined
  }
  return hit.taskId
}

export async function runTask(
  feature: string,
  /** A thunk defers the upload, so a resumed task never re-sends the photo. */
  body: Record<string, unknown> | (() => Promise<Record<string, unknown>>),
  creds?: Creds,
  timeoutMs = 90_000,
  resumeKey?: string,
): Promise<TaskResult> {
  let taskId = resumeKey ? resumableTask(resumeKey) : undefined
  if (!taskId) {
    const payload = typeof body === 'function' ? await body() : body
    const submit = await api<{ data?: { task_id?: string } }>(`/s2s/v2.0/task/${feature}`, { method: 'POST', body: payload, creds })
    taskId = submit.json?.data?.task_id
    if (!taskId) throw new Error(`YouCam ${feature} submit failed: ${JSON.stringify(submit.json).slice(0, 300)}`)
  }
  if (resumeKey) RESUMABLE.set(resumeKey, { taskId, at: Date.now() })

  const deadline = Date.now() + timeoutMs
  const busy = new Set(['running', 'processing', 'pending', 'queued'])
  while (Date.now() < deadline) {
    const { json } = await api<{ data: TaskResult }>(`/s2s/v2.0/task/${feature}/${taskId}`, { creds })
    const status = json?.data?.task_status
    // Settled for good: nothing left to resume, and holding the id would serve this same
    // answer to a genuinely new attempt with the same photo.
    if (status && !busy.has(status)) {
      if (resumeKey) RESUMABLE.delete(resumeKey)
      return json.data
    }
    await new Promise((res) => setTimeout(res, 2500))
  }
  // Deliberately keep the entry: still running is exactly the case resuming is for.
  throw new Error(`YouCam ${feature} timed out`)
}

export async function getUnits(creds?: Creds): Promise<number> {
  const { json } = await api<{ results?: { amount: number }[] }>(`/s2s/v1.0/client/credit`, { creds })
  return (json.results ?? []).reduce((s, x) => s + (x.amount ?? 0), 0)
}
