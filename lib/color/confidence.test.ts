import { describe, it, expect } from 'vitest'
import { scoreConfidence } from './confidence'
import { classifySeason } from './season'

// Metrics below are the engine's own measurements, verified against these hexes:
//   #6e4b34  hue=58.7  ITA=-37.05  chroma=22.95   (deep warm)
//   #bd9a80  hue=63.6  ITA= 40.98  chroma=20.73   (YouCam's documented sample)
//   #292420  hue=67.2  ITA=-84.30  chroma= 3.80   (Monk Skin Tone 10, near-neutral)

describe('boundary distance drives certainty', () => {
  it('flags the axis closest to a decision boundary as weakest', () => {
    // chroma 22.95 is 1.45 from the bright boundary at 21.5; the other axes are further out
    expect(scoreConfidence('#6e4b34').weakest).toBe('clarity')
  })

  it('a near-neutral skin makes undertone the least certain axis', () => {
    // MST 10: hue is clear of both boundaries, but chroma 3.8 makes the angle itself shaky
    const c = scoreConfidence('#292420')
    expect(c.weakest).toBe('undertone')
    expect(c.axes.find((a) => a.axis === 'undertone')!.certainty).toBeLessThan(0.6)
    expect(c.reasons.some((r) => r.includes('neutral grey'))).toBe(true)
  })

  it('chroma only discounts undertone, not the other axes', () => {
    const c = scoreConfidence('#292420')
    expect(c.axes.find((a) => a.axis === 'depth')!.certainty).toBe(1)
    expect(c.axes.find((a) => a.axis === 'clarity')!.certainty).toBe(1)
  })

  it('a reading sitting on a boundary scores low and says so', () => {
    // ITA 40.98 is 0.02 from the light boundary at 41: this call is a coin flip
    const c = scoreConfidence('#bd9a80')
    expect(c.weakest).toBe('depth')
    expect(c.level).toBe('low')
    expect(c.reasons[0]).toContain('Depth')
    expect(c.reasons[0]).toContain('41')
  })

  it('reports the margin and nearest boundary per axis', () => {
    const depth = scoreConfidence('#bd9a80').axes.find((a) => a.axis === 'depth')!
    expect(depth.nearestBoundary).toBe(41)
    expect(depth.margin).toBeLessThan(0.1)
    expect(depth.certainty).toBeLessThan(0.05)
  })
})

describe('photo quality penalties', () => {
  it('poor lighting lowers the score', () => {
    const good = scoreConfidence('#6e4b34', { lighting: 'good', frontal: 'good', area: 'good' })
    const bad = scoreConfidence('#6e4b34', { lighting: 'notgood', frontal: 'good', area: 'good' })
    expect(bad.score).toBeLessThan(good.score)
    expect(bad.reasons.some((r) => r.includes('lighting'))).toBe(true)
  })

  it('penalties compound across quality flags', () => {
    const one = scoreConfidence('#6e4b34', { lighting: 'notgood' })
    const all = scoreConfidence('#6e4b34', { lighting: 'notgood', frontal: 'notgood', area: 'notgood' })
    expect(all.score).toBeLessThan(one.score)
  })

  it('a clean read on a clean photo scores high with no caveats', () => {
    // far from every boundary: b*=3.72, ITA=-77.66, chroma=7.38
    const c = scoreConfidence('#5a4a48', { lighting: 'good', frontal: 'good', area: 'good' }, '#1e110d')
    expect(c.level).toBe('high')
    expect(c.score).toBeGreaterThanOrEqual(90)
    expect(c.reasons).toHaveLength(1)
  })

  it('notes when eye color is missing', () => {
    expect(scoreConfidence('#5a4a48').reasons.some((r) => r.includes('eye color'))).toBe(true)
  })
})

describe('user corrections', () => {
  it('an override changes the season and is recorded', () => {
    const measured = classifySeason({ skinToneHex: '#6e4b34', eyeHex: '#1e110d' })
    expect(measured.season).toBe('Deep Autumn')
    expect(measured.corrected).toEqual([])

    const fixed = classifySeason({ skinToneHex: '#6e4b34', eyeHex: '#1e110d' }, { undertone: 'cool' })
    expect(fixed.undertone).toBe('cool')
    expect(fixed.parent).toBe('Winter')
    expect(fixed.corrected).toEqual(['undertone'])
  })

  it('an override matching the measured value is not counted as a correction', () => {
    const r = classifySeason({ skinToneHex: '#6e4b34', eyeHex: '#1e110d' }, { undertone: 'warm' })
    expect(r.corrected).toEqual([])
    expect(r.season).toBe('Deep Autumn')
  })

  it('overrides leave the raw measurements untouched', () => {
    const a = classifySeason({ skinToneHex: '#6e4b34' })
    const b = classifySeason({ skinToneHex: '#6e4b34' }, { depth: 'light' })
    expect(b.ita).toBeCloseTo(a.ita, 6)
    expect(b.chroma).toBeCloseTo(a.chroma, 6)
  })
})

describe('corrected axes stop counting against confidence', () => {
  it('setting the weak axis by hand raises the score and explains why', () => {
    const before = scoreConfidence('#bd9a80')            // ITA sits 0.02 from the boundary
    const after = scoreConfidence('#bd9a80', {}, undefined, ['depth'])
    expect(before.level).toBe('low')
    expect(after.score).toBeGreaterThan(before.score)
    expect(after.axes.find((a) => a.axis === 'depth')!.userSet).toBe(true)
    expect(after.axes.find((a) => a.axis === 'depth')!.certainty).toBe(1)
    expect(after.reasons.some((r) => r.includes('You set depth by hand'))).toBe(true)
  })

  it('a corrected axis is never reported as the weakest', () => {
    expect(scoreConfidence('#bd9a80').weakest).toBe('depth')
    expect(scoreConfidence('#bd9a80', {}, undefined, ['depth']).weakest).not.toBe('depth')
  })

  it('poor photo quality still counts even after a correction', () => {
    const clean = scoreConfidence('#bd9a80', {}, undefined, ['depth'])
    const dim = scoreConfidence('#bd9a80', { lighting: 'notgood' }, undefined, ['depth'])
    expect(dim.score).toBeLessThan(clean.score)
  })
})
