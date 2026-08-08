import 'server-only'
import { getUnits, BAD_CREDENTIALS, type Creds } from './client'

// Protects the owner's YouCam units from public drain/abuse.
// - Budget guard: refuse owner-funded live calls once the balance drops below RESERVE.
// - Rate limit: best-effort per-IP sliding window (defense-in-depth on serverless).
// BYOK requests (tester's own creds) bypass the budget guard — they spend their own units.

/**
 * Keep at least this many of the owner's units back.
 *
 * A complete visit costs about 36: twenty for the tone analysis, two each for the hero and
 * clash try-ons, twelve for the skin report. The reserve therefore has to sit below what a
 * visit needs, or the guard stops a visit halfway and leaves a season on screen with no
 * pictures under it, which is worse than a clean refusal at the door. At four, a visitor
 * gets the whole flow and a couple of extra taps before the demo politely runs dry.
 */
const RESERVE = 4

let cache: { units: number; at: number } | null = null

/**
 * Can we afford this particular call?
 *
 * `cost` matters: the reserve alone is not enough, because the calls differ by twenty-fold.
 * A flat reserve of four let a twenty-unit analysis start on a nine-unit balance, YouCam
 * refused it for CreditInsufficiency, and the app reported "try a clear, front-facing,
 * well-lit photo" — blaming the wearer's photograph for our billing. Each route now states
 * what it is about to spend, and we refuse before starting rather than after failing.
 */
export async function budgetOk(creds?: Creds, cost = 0): Promise<{ ok: boolean; units: number }> {
  if (creds) return { ok: true, units: Infinity } // BYOK: tester's own units
  const now = Date.now()
  if (!cache || now - cache.at > 25_000) {
    try {
      cache = { units: await getUnits(), at: now }
    } catch {
      // if the balance check fails, fail open (don't block a real judge on a transient error)
      return { ok: true, units: -1 }
    }
  }
  return { ok: cache.units >= RESERVE + cost, units: cache.units }
}

/** Optimistically decrement the cached balance after a spend, so bursts within the cache window still trip the guard. */
export function noteSpend(cost: number) {
  if (cache) cache.units = Math.max(0, cache.units - cost)
}

const hits = new Map<string, number[]>()

export function rateLimited(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
  if (arr.length >= max) {
    hits.set(ip, arr)
    return true
  }
  arr.push(now)
  hits.set(ip, arr)
  if (hits.size > 5000) hits.clear() // crude memory bound
  return false
}

export function clientIp(req: Request): string {
  const h = req.headers
  // `x-vercel-forwarded-for` first: it is identical to `x-forwarded-for` but cannot be
  // overwritten by a proxy sitting in front of Vercel. If that header is lost, every
  // caller collapses into the single 'unknown' bucket below and the whole deployment
  // shares one allowance, which is the failure this ordering exists to avoid.
  return (
    h.get('x-vercel-forwarded-for')?.split(',')[0] ||
    h.get('x-forwarded-for')?.split(',')[0] ||
    h.get('x-real-ip') ||
    'unknown'
  ).trim()
}

/**
 * Whether this request should count against the shared demo's allowance.
 *
 * The limit exists to stop one visitor draining the units everyone else is trying the
 * demo with. Two callers are therefore not what it guards against, and were being
 * blocked anyway:
 *
 * - Anyone running the app locally. No proxy sets a forwarding header, so every local
 *   request keys to the same 'unknown' bucket: a developer's own testing and their next
 *   click share one allowance of twelve, and the app starts refusing a first upload.
 * - Anyone who brought their own key. They are spending their own units, so throttling
 *   them protects nothing and punishes the one group doing us a favour.
 */
export function overDemoLimit(req: Request, creds: Creds | undefined, max: number, windowMs: number): boolean {
  if (creds) return false
  if (process.env.NODE_ENV !== 'production') return false
  return rateLimited(clientIp(req), max, windowMs)
}

/**
 * Parse a multipart body without letting a malformed request become a 500.
 *
 * `Request.formData()` throws when the Content-Type is missing or wrong, and that
 * exception otherwise falls through to the generic catch and is reported as a server
 * fault. A body we cannot parse is the caller's mistake, so it deserves a 400.
 * Returns null when the request is not a form we can read.
 */
export async function readFormData(req: Request): Promise<FormData | null> {
  const contentType = req.headers.get('content-type') ?? ''
  if (!/^(multipart\/form-data|application\/x-www-form-urlencoded)\b/i.test(contentType)) {
    return null
  }
  try {
    return await req.formData()
  } catch {
    return null
  }
}

/** Optional BYOK creds from request headers. Both must be present to take effect. */
export function bringYourOwnKey(req: Request): Creds | undefined {
  const apiKey = req.headers.get('x-yc-key')?.trim()
  const secretKey = req.headers.get('x-yc-secret')?.trim()
  return apiKey && secretKey ? { apiKey, secretKey } : undefined
}

/** Turns a thrown error into a JSON body, with a readable message where we have one. */
/**
 * `message` is what to do about it; `detail` is what actually happened.
 *
 * Both are shown. A friendly sentence on its own hides the cause, and a raw upstream
 * string on its own leaves you nowhere to go. Reporting only the friendly half is how
 * "your account is out of credits" came to be displayed as "try a clearer photo".
 */
export function errorBody(e: unknown): { ok: false; error: string; message?: string; detail?: string } {
  const detail = e instanceof Error ? e.message : 'server_error'
  if (detail === BAD_CREDENTIALS) {
    return { ok: false, error: detail, message: "That key pair didn't work. Check the API key and secret key from your YouCam console." }
  }
  // A balance can empty between the check and the call, so the same truth is told twice.
  if (/CreditInsufficiency|enough credits/i.test(detail)) {
    return { ok: false, error: 'demo_limit', message: DEMO_LIMIT_MESSAGE, detail: upstream(detail) }
  }
  return { ok: false, error: detail, detail: upstream(detail) }
}

/** Pull YouCam's own sentence out of the wrapper we threw it in. */
function upstream(raw: string): string {
  const m = raw.match(/"error"\s*:\s*"([^"]+)"/)
  return m ? m[1] : raw
}

export const DEMO_LIMIT_MESSAGE =
  "The shared live demo has reached its usage limit for now. Try a sample face (instant & free), or add your own YouCam key below to keep going on your units."
