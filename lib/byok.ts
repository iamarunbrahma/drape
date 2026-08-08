'use client'

// Optional Bring-Your-Own-Key: testers can paste their own YouCam credentials so the
// shared demo's units aren't spent. Stored locally, sent as headers on API calls.

const KEY = 'drape_byok'

export interface Byok { apiKey: string; secretKey: string }

export function getByok(): Byok | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const b = JSON.parse(raw) as Byok
    return b.apiKey && b.secretKey ? b : null
  } catch {
    return null
  }
}

// The key box appears in more than one place, so saving in one has to light up the other.
const listeners = new Set<() => void>()

export function subscribeByok(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Whether a key is stored. A boolean so `useSyncExternalStore` can compare snapshots. */
export function hasByok(): boolean {
  return getByok() !== null
}

export function setByok(b: Byok | null) {
  if (typeof window === 'undefined') return
  if (b && b.apiKey && b.secretKey) localStorage.setItem(KEY, JSON.stringify(b))
  else localStorage.removeItem(KEY)
  listeners.forEach((fn) => fn())
}

/** Headers to attach to every YouCam-backed fetch. */
export function ycHeaders(): Record<string, string> {
  const b = getByok()
  return b ? { 'x-yc-key': b.apiKey, 'x-yc-secret': b.secretKey } : {}
}

/**
 * Every YouCam-backed POST, with an end to it.
 *
 * A bare `fetch` has no timeout, so when an upstream task stalls the spinner simply runs
 * until the tab is closed. This happens: the tone read has been seen hanging on a photo
 * that answered in six seconds on the next attempt. The window sits a little above the
 * routes' own 60s budget, so a merely slow server still gets to reply, and anything past
 * that is reported rather than waited on.
 */
export const YC_TIMEOUT_MS = 70_000

export function ycPost(url: string, body: BodyInit, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { ...ycHeaders(), ...headers },
    body,
    signal: AbortSignal.timeout(YC_TIMEOUT_MS),
  })
}

/** True when a caught error is our own timeout rather than a failure upstream. */
export function isTimeout(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'TimeoutError'
}
