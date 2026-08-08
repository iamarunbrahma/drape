import { describe, it, expect } from 'vitest'
import { deltaE2000, deltaEHex, describeDeltaE } from './deltae'
import type { Lab } from './space'

const lab = (L: number, a: number, b: number): Lab => ({ L, a, b })

// Reference pairs from Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference
// Formula", Table 1. These are the standard conformance cases and deliberately
// include the hue-wraparound and blue-region discontinuities that trip up naive
// implementations.
const REFERENCE: Array<[Lab, Lab, number]> = [
  [lab(50, 2.6772, -79.7751), lab(50, 0, -82.7485), 2.0425],
  [lab(50, 3.1571, -77.2803), lab(50, 0, -82.7485), 2.8615],
  [lab(50, 2.8361, -74.02), lab(50, 0, -82.7485), 3.4412],
  [lab(50, -1.3802, -84.2814), lab(50, 0, -82.7485), 1.0],
  [lab(50, -0.9009, -85.5211), lab(50, 0, -82.7485), 1.0],
  [lab(50, 0, 0), lab(50, -1, 2), 2.3669],
  [lab(50, -1, 2), lab(50, 0, 0), 2.3669],
  [lab(50, 2.49, -0.001), lab(50, -2.49, 0.0009), 7.1792],
  [lab(50, 2.49, -0.001), lab(50, -2.49, 0.0011), 7.2195],
  [lab(50, -0.001, 2.49), lab(50, 0.0009, -2.49), 4.8045],
  [lab(50, -0.001, 2.49), lab(50, 0.0011, -2.49), 4.7461],
  [lab(50, 2.5, 0), lab(50, 0, -2.5), 4.3065],
  [lab(50, 2.5, 0), lab(73, 25, -18), 27.1492],
  [lab(50, 2.5, 0), lab(61, -5, 29), 22.8977],
  [lab(50, 2.5, 0), lab(56, -27, -3), 31.903],
  [lab(50, 2.5, 0), lab(58, 24, 15), 19.4535],
  [lab(50, 2.5, 0), lab(50, 3.1736, 0.5854), 1.0],
  [lab(50, 2.5, 0), lab(50, 3.2972, 0), 1.0],
  [lab(50, 2.5, 0), lab(50, 1.8634, 0.5757), 1.0],
  [lab(60.2574, -34.0099, 36.2677), lab(60.4626, -34.1751, 39.4387), 1.2644],
  [lab(63.0109, -31.0961, -5.8663), lab(62.8187, -29.7946, -4.0864), 1.263],
  [lab(61.2901, 3.7196, -5.3901), lab(61.4292, 2.248, -4.962), 1.8731],
  [lab(35.0831, -44.1164, 3.7933), lab(35.0232, -40.0716, 1.5901), 1.8645],
  [lab(22.7233, 20.0904, -46.694), lab(23.0331, 14.973, -42.5619), 2.0373],
  [lab(36.4612, 47.858, 18.3852), lab(36.2715, 50.5065, 21.2231), 1.4146],
  [lab(90.8027, -2.0831, 1.441), lab(91.1528, -1.6435, 0.0447), 1.4441],
  [lab(90.9257, -0.5406, -0.9208), lab(88.6381, -0.8985, -0.7239), 1.5381],
  [lab(6.7747, -0.2908, -2.4247), lab(5.8714, -0.0985, -2.2286), 0.6377],
  [lab(2.0776, 0.0795, -1.135), lab(0.9033, -0.0636, -0.5514), 0.9082],
]

describe('CIEDE2000 conformance (Sharma et al. 2005)', () => {
  for (const [a, b, expected] of REFERENCE) {
    it(`ΔE(${a.L},${a.a},${a.b} → ${b.L},${b.a},${b.b}) = ${expected}`, () => {
      expect(deltaE2000(a, b)).toBeCloseTo(expected, 4)
    })
  }
})

describe('basic properties', () => {
  it('is zero for identical colors', () => {
    expect(deltaE2000(lab(50, 2.5, 0), lab(50, 2.5, 0))).toBe(0)
    expect(deltaEHex('#1f5f5b', '#1f5f5b')).toBe(0)
  })

  it('is symmetric', () => {
    const a = lab(50, 2.6772, -79.7751)
    const b = lab(50, 0, -82.7485)
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 10)
  })

  it('ranks a near shade below a clashing one', () => {
    const teal = '#1f5f5b'
    const nearTeal = deltaEHex(teal, '#22635f')
    const pink = deltaEHex(teal, '#f4c7de')
    expect(nearTeal).toBeLessThan(pink)
    expect(nearTeal).toBeLessThan(5)
  })
})

describe('describeDeltaE', () => {
  it('maps distances onto perceptibility bands', () => {
    expect(describeDeltaE(0.4)).toBe('an exact match')
    expect(describeDeltaE(1.8)).toBe('indistinguishable by eye')
    expect(describeDeltaE(3.2)).toBe('very close')
    expect(describeDeltaE(40)).toBe('a different color')
  })
})
