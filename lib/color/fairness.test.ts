import { describe, it, expect } from 'vitest'
import { hexToLab, labChroma, ita } from './space'
import { classifyUndertone, classifySeason } from './season'
import { scoreConfidence } from './confidence'

// The Monk Skin Tone Scale (Ellis Monk / Google, 2022) is a 10-shade reference scale
// built specifically so systems can be checked across the full range of human skin
// rather than the light-skewed Fitzpatrick set. We use it as an evenness fixture:
// the engine must not change its mind about undertone just because skin gets darker.
// https://skintone.google
const MST = [
  '#f6ede4', '#f3e7db', '#f7ead0', '#eadaba', '#d7bd96',
  '#a07e56', '#825c43', '#604134', '#3a312a', '#292420',
] as const

/**
 * The rule this engine used to ship: threshold the b* magnitude directly.
 * Kept here as the thing we are measuring against, not as dead code.
 */
function undertoneByBStar(hex: string): 'warm' | 'cool' | 'neutral' {
  const b = hexToLab(hex).b
  if (b >= 16) return 'warm'
  if (b <= 9) return 'cool'
  return 'neutral'
}

describe('the b* magnitude rule we replaced', () => {
  it('mislabels the lightest and darkest MST tones as cool', () => {
    // All four of these are plainly golden by hue angle (74.5, 74.2, 65.7, 67.2 degrees),
    // yet their b* is small simply because chroma collapses at the ends of the scale.
    for (const hex of ['#f6ede4', '#f3e7db', '#3a312a', '#292420']) {
      expect(undertoneByBStar(hex)).toBe('cool')
    }
  })

  it('is unstable across the scale, flipping warm and cool with depth', () => {
    const labels = MST.map(undertoneByBStar)
    expect(new Set(labels).size).toBeGreaterThan(2) // warm, cool AND neutral all appear
    expect(labels.filter((l) => l === 'cool').length).toBe(4)
  })
})

describe('hue angle is stable across skin depth', () => {
  it('reads the whole Monk scale consistently', () => {
    const labels = MST.map(classifyUndertone)
    // MST 8 genuinely sits in the neutral band (hue 48.8); everything else is golden.
    expect(labels.filter((l) => l === 'warm').length).toBe(9)
    expect(labels.filter((l) => l === 'cool').length).toBe(0)
    expect(labels[7]).toBe('neutral')
  })

  it('never calls a deep tone cool just because it is dark', () => {
    for (const hex of ['#3a312a', '#292420', '#604134', '#825c43']) {
      expect(classifyUndertone(hex)).not.toBe('cool')
    }
  })

  it('still separates genuinely cool skin', () => {
    for (const hex of ['#e8c4c0', '#5a4a48', '#d8b9b5']) {
      expect(classifyUndertone(hex)).toBe('cool')
    }
  })

  it('folds magenta past the hue wraparound onto the cool side', () => {
    // a rosy reading that wraps past 360 must not score as extremely warm
    expect(classifyUndertone('#e0b8cc')).toBe('cool')
  })
})

describe('depth tracks the scale', () => {
  it('ITA decreases monotonically from MST 1 to MST 10', () => {
    const itas = MST.map((h) => ita(hexToLab(h)))
    for (let i = 1; i < itas.length; i++) {
      expect(itas[i]).toBeLessThan(itas[i - 1])
    }
  })

  it('assigns a season to every tone on the scale', () => {
    for (const hex of MST) {
      expect(classifySeason({ skinToneHex: hex }).season).toBeTruthy()
    }
  })
})

describe('honesty about the ends of the scale', () => {
  it('reports lower undertone certainty where chroma is small', () => {
    // the near-neutral ends are exactly where a hue angle is least trustworthy
    const ends = ['#f6ede4', '#292420'].map((h) => scoreConfidence(h))
    const middle = scoreConfidence('#a07e56')
    for (const e of ends) {
      const u = e.axes.find((a) => a.axis === 'undertone')!
      expect(u.certainty).toBeLessThan(middle.axes.find((a) => a.axis === 'undertone')!.certainty)
    }
  })

  it('does not hand out high confidence uniformly across the scale', () => {
    const scores = MST.map((h) => scoreConfidence(h).score)
    expect(Math.min(...scores)).toBeLessThan(Math.max(...scores))
    // but no tone is left completely unusable
    expect(Math.min(...scores)).toBeGreaterThan(20)
  })
})

describe('chroma reference values', () => {
  it('confirms chroma really does collapse at both ends', () => {
    const chromas = MST.map((h) => labChroma(hexToLab(h)))
    expect(chromas[0]).toBeLessThan(8) // MST 1
    expect(chromas[9]).toBeLessThan(8) // MST 10
    expect(Math.max(...chromas)).toBeGreaterThan(25) // mid scale
  })
})
