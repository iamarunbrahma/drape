import { describe, it, expect } from 'vitest'
import { fetchRetry, withBudget } from './client'

// Nothing answers here and nothing rejects either, so every attempt runs to its own
// timeout. That is the shape of the bad case: not an error we can react to, but silence.
const BLACKHOLE = 'http://10.255.255.1/never'

async function elapsed(fn: () => Promise<unknown>): Promise<number> {
  const t0 = Date.now()
  try {
    await fn()
  } catch {
    // Failure is the expected outcome; the test is about how long it takes to admit it.
  }
  return Date.now() - t0
}

describe('fetchRetry under a request budget', () => {
  // The ladder is generous per call and a request makes several of them. Five tries at a
  // 20s timeout plus backoff is 122s of patience for one fetch, against a handler that is
  // killed at 60s. Left unbounded the platform cuts the request off mid-flight and the
  // caller gets a blank 504 instead of a reason.
  it('gives up at the deadline rather than running the whole ladder', async () => {
    const ms = await elapsed(() => withBudget(3_000, () => fetchRetry(BLACKHOLE, {}, 5, 20_000)))
    expect(ms).toBeLessThan(5_000)
  }, 30_000)

  it('never waits past the budget even when a single attempt would', async () => {
    // One attempt alone is allowed 20s here, so honouring the 2s budget means the attempt
    // itself was clamped, not merely the number of retries.
    const ms = await elapsed(() => withBudget(2_000, () => fetchRetry(BLACKHOLE, {}, 1, 20_000)))
    expect(ms).toBeLessThan(4_000)
  }, 30_000)

  it('leaves the ladder alone when no budget is set', async () => {
    // Scripts and one-off calls run outside a request and should keep retrying as before.
    const ms = await elapsed(() => fetchRetry(BLACKHOLE, {}, 2, 1_000))
    expect(ms).toBeGreaterThan(2_000)
  }, 30_000)
})
