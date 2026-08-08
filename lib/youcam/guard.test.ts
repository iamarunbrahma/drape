import { describe, it, expect, vi, afterEach } from 'vitest'
import { overDemoLimit, clientIp } from './guard'

const req = (headers: Record<string, string> = {}) => new Request('https://drape.test/api/analyze', { headers })
const creds = { apiKey: 'k', secretKey: 's' }

// A fresh IP per test, because the limiter's window is module state that outlives one case.
let n = 0
const freshIp = () => `203.0.113.${++n}`

afterEach(() => vi.unstubAllEnvs())

describe('clientIp', () => {
  it('prefers the header a proxy in front of Vercel cannot overwrite', () => {
    expect(clientIp(req({ 'x-vercel-forwarded-for': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1')
  })

  it('takes the client from the front of a forwarding chain', () => {
    expect(clientIp(req({ 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }))).toBe('3.3.3.3')
  })

  // Every caller without a forwarding header shares this one bucket, which is exactly why
  // the limiter below refuses to run where those headers are absent.
  it('falls back to a single shared bucket when nothing identifies the caller', () => {
    expect(clientIp(req())).toBe('unknown')
  })
})

describe('overDemoLimit', () => {
  it('still protects the shared demo in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const ip = freshIp()
    const hit = () => overDemoLimit(req({ 'x-forwarded-for': ip }), undefined, 3, 60_000)
    expect([hit(), hit(), hit()]).toEqual([false, false, false])
    expect(hit()).toBe(true)
  })

  it(`counts each caller separately, so one visitor cannot spend everyone else's allowance`, () => {
    vi.stubEnv('NODE_ENV', 'production')
    const loud = freshIp()
    const quiet = freshIp()
    for (let i = 0; i < 4; i++) overDemoLimit(req({ 'x-forwarded-for': loud }), undefined, 3, 60_000)
    expect(overDemoLimit(req({ 'x-forwarded-for': loud }), undefined, 3, 60_000)).toBe(true)
    expect(overDemoLimit(req({ 'x-forwarded-for': quiet }), undefined, 3, 60_000)).toBe(false)
  })

  // Their units, their call. Throttling them protects nothing.
  it('never limits a caller who brought their own key', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const ip = freshIp()
    for (let i = 0; i < 10; i++) {
      expect(overDemoLimit(req({ 'x-forwarded-for': ip }), creds, 3, 60_000)).toBe(false)
    }
  })

  // The bug this replaced: locally nothing sets a forwarding header, so a developer's own
  // testing and their next upload shared one allowance, and the app refused a first click.
  it('does not limit outside production, where every caller looks like the same one', () => {
    vi.stubEnv('NODE_ENV', 'development')
    for (let i = 0; i < 20; i++) {
      expect(overDemoLimit(req(), undefined, 3, 60_000)).toBe(false)
    }
  })
})
