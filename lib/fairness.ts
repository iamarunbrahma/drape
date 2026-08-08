// The evenness check behind docs/fairness.md and /fairness.
//
// Everything here is computed live from the same pure engine the product uses, so the
// page cannot drift from the code. Nothing is baked in.

import { hexToLab, labChroma, ita, type Lab } from './color/space'
import { classifyUndertone, skinHue, type Undertone } from './color/season'

/**
 * The Monk Skin Tone Scale (Ellis Monk / Google, 2022): a 10-shade reference built so
 * systems can be evaluated across the full range of human skin, rather than the
 * light-skewed Fitzpatrick set. https://skintone.google
 */
export const MST_SCALE = [
  '#f6ede4', '#f3e7db', '#f7ead0', '#eadaba', '#d7bd96',
  '#a07e56', '#825c43', '#604134', '#3a312a', '#292420',
] as const

/**
 * The rule Drape used to ship: threshold the CIELAB b* magnitude.
 * Kept so the page can show what was actually wrong with it.
 */
export function undertoneByBStar(lab: Lab): Undertone {
  if (lab.b >= 16) return 'warm'
  if (lab.b <= 9) return 'cool'
  return 'neutral'
}

export interface ToneRow {
  step: number
  hex: string
  lightness: number
  bStar: number
  chroma: number
  hue: number
  ita: number
  /** what the old b* magnitude rule said */
  oldRule: Undertone
  /** what the current hue-angle rule says */
  newRule: Undertone
  /** the old rule disagreed with the hue angle here */
  regression: boolean
}

export function fairnessTable(): ToneRow[] {
  return MST_SCALE.map((hex, i) => {
    const lab = hexToLab(hex)
    const oldRule = undertoneByBStar(lab)
    const newRule = classifyUndertone(hex)
    return {
      step: i + 1,
      hex,
      lightness: lab.L,
      bStar: lab.b,
      chroma: labChroma(lab),
      hue: skinHue(lab),
      ita: ita(lab),
      oldRule,
      newRule,
      regression: oldRule !== newRule,
    }
  })
}

/** How many of the ten reference tones each rule labels as each undertone. */
export function spread(rows: ToneRow[], which: 'oldRule' | 'newRule'): Record<Undertone, number> {
  const out: Record<Undertone, number> = { warm: 0, cool: 0, neutral: 0 }
  for (const r of rows) out[r[which]]++
  return out
}
