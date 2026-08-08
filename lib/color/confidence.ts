// How sure is this read? Two things make a season call shaky:
//
//   1. the measurement sits close to one of the engine's decision boundaries, and
//   2. the photo itself was poor, which shifts the measured skin color.
//
// Both are knowable before we show a verdict, so we show them instead of hiding them.
// Pure and deterministic, like the rest of lib/color.

import { hexToLab, labChroma, ita } from './space'
import { THRESHOLDS, CHROMA_RELIABLE, skinHue, type Axis } from './season'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

/** The subset of YouCam's face_quality that actually affects measured color. */
export interface PhotoQuality {
  lighting?: string
  frontal?: string
  area?: string
}

export interface AxisCertainty {
  axis: Axis
  /** the measured value on this axis */
  value: number
  /** distance to the nearest decision boundary, in the axis's own units */
  margin: number
  /** 0 to 1, where 1 means comfortably far from any boundary */
  certainty: number
  /** the boundary this reading is closest to */
  nearestBoundary: number
  /** the user set this axis by hand, so it is no longer in doubt */
  userSet: boolean
}

export interface Confidence {
  level: ConfidenceLevel
  /** 0 to 100 */
  score: number
  axes: AxisCertainty[]
  /** the axis least worth trusting */
  weakest: Axis
  /** plain-language explanations, most important first */
  reasons: string[]
}

/**
 * Margin at which an axis is considered fully settled, in that axis's units.
 * Capped at half the width of the narrowest band on each axis, otherwise a reading
 * sitting dead centre in a narrow band could never reach full certainty:
 * undertone's neutral band is 10 degrees wide (42..52) and clarity's true band is 3.
 */
const SETTLED = { undertone: 5, depth: 8, clarity: 1.5 } as const

/** Multipliers applied when YouCam flags the photo. Lighting hurts color most. */
const QUALITY_PENALTY = { lighting: 0.7, frontal: 0.85, area: 0.85 } as const

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function axisCertainty(
  axis: Axis,
  value: number,
  boundaries: readonly number[],
  reliability = 1,
): AxisCertainty {
  let nearestBoundary = boundaries[0]
  let margin = Math.abs(value - boundaries[0])
  for (const b of boundaries.slice(1)) {
    const d = Math.abs(value - b)
    if (d < margin) {
      margin = d
      nearestBoundary = b
    }
  }
  const certainty = clamp01(margin / SETTLED[axis]) * reliability
  return { axis, value, margin, certainty, nearestBoundary, userSet: false }
}

const AXIS_LABEL: Record<Axis, string> = {
  undertone: 'Undertone',
  depth: 'Depth',
  clarity: 'Clarity',
}

const AXIS_METRIC: Record<Axis, string> = {
  undertone: 'hue angle',
  depth: 'ITA',
  clarity: 'chroma',
}

const isGood = (v?: string) => v === undefined || v === 'good'

export function scoreConfidence(
  skinToneHex: string,
  quality: PhotoQuality = {},
  eyeHex?: string,
  /** axes the user has set by hand; these stop counting against confidence */
  corrected: readonly Axis[] = [],
): Confidence {
  const lab = hexToLab(skinToneHex)
  const chroma = labChroma(lab)
  const { HUE_COOL, HUE_WARM, ITA_LIGHT, ITA_DEEP, CHROMA_BRIGHT, CHROMA_SOFT } = THRESHOLDS

  // Hue is scale-invariant, which is what makes it fair across skin depths, but it also
  // gets noisy as the reading approaches grey. Discount the undertone axis accordingly.
  const hueReliability = clamp01(chroma / CHROMA_RELIABLE)

  const axes: AxisCertainty[] = [
    axisCertainty('undertone', skinHue(lab), [HUE_COOL, HUE_WARM], hueReliability),
    axisCertainty('depth', ita(lab), [ITA_DEEP, ITA_LIGHT]),
    axisCertainty('clarity', chroma, [CHROMA_SOFT, CHROMA_BRIGHT]),
  ].map((a) =>
    corrected.includes(a.axis) ? { ...a, certainty: 1, userSet: true } : a,
  )

  const certainties = axes.map((a) => a.certainty)
  const weakestAxis = axes.reduce((a, b) => (b.certainty < a.certainty ? b : a))
  const mean = certainties.reduce((s, c) => s + c, 0) / certainties.length
  // Weight the weakest axis heavily: one shaky axis can flip the whole season.
  const measurement = 0.5 * weakestAxis.certainty + 0.5 * mean

  let quality_factor = 1
  const reasons: string[] = []

  if (weakestAxis.certainty < 0.85) {
    reasons.push(
      `${AXIS_LABEL[weakestAxis.axis]} is the least certain part of this read. Your ` +
        `${AXIS_METRIC[weakestAxis.axis]} is ${weakestAxis.value.toFixed(1)}, only ` +
        `${weakestAxis.margin.toFixed(1)} from the boundary at ${weakestAxis.nearestBoundary}.`,
    )
  }
  if (!isGood(quality.lighting)) {
    quality_factor *= QUALITY_PENALTY.lighting
    reasons.push('The lighting in this photo was flagged as uneven, which shifts measured skin color.')
  }
  if (!isGood(quality.frontal)) {
    quality_factor *= QUALITY_PENALTY.frontal
    reasons.push('Your face is not fully front-on, so some of the skin sample is in shadow.')
  }
  if (!isGood(quality.area)) {
    quality_factor *= QUALITY_PENALTY.area
    reasons.push('Your face fills only a small part of the frame, so there is less skin to sample.')
  }
  if (hueReliability < 1) {
    reasons.push(
      `Your skin reads close to neutral grey (chroma ${chroma.toFixed(1)}), so the hue angle ` +
        'behind the undertone call is less stable than usual.',
    )
  }
  if (!eyeHex) {
    reasons.push('No eye color was returned, so clarity is judged on skin chroma alone.')
  }
  const userSet = axes.filter((a) => a.userSet).map((a) => a.axis)
  if (userSet.length > 0) {
    reasons.push(
      `You set ${userSet.join(' and ')} by hand, so ${userSet.length > 1 ? 'they no longer count' : 'it no longer counts'} against this score.`,
    )
  }

  const score = Math.round(100 * measurement * quality_factor)
  const level: ConfidenceLevel = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low'

  if (reasons.length === 0) {
    reasons.push('Every axis sits well clear of its boundary and the photo passed all quality checks.')
  }

  return { level, score, axes, weakest: weakestAxis.axis, reasons }
}
