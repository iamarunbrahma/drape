// The Drape season engine: skin (+ optional eye) color -> 12-season classification.
// Grounded in CIELAB hue (undertone), ITA° (depth), and chroma/contrast (clarity).
// Calibrated against real skin_color values returned by YouCam skin-tone-analysis.

import { hexToLab, labHue, labChroma, ita, type Lab } from './space'

export type Undertone = 'warm' | 'cool' | 'neutral'
export type Depth = 'light' | 'medium' | 'deep'
export type Clarity = 'bright' | 'true' | 'soft'

export type Season =
  | 'Light Spring' | 'True Spring' | 'Bright Spring'
  | 'Light Summer' | 'True Summer' | 'Soft Summer'
  | 'Soft Autumn' | 'True Autumn' | 'Deep Autumn'
  | 'Deep Winter' | 'True Winter' | 'Bright Winter'

export type ParentSeason = 'Spring' | 'Summer' | 'Autumn' | 'Winter'

export interface SkinInput {
  skinToneHex: string
  eyeHex?: string
  hairHex?: string
}

export type Axis = 'undertone' | 'depth' | 'clarity'

/** Any value a single axis can take. */
export type AxisValue = Undertone | Depth | Clarity

/** A user override for one axis, applied on top of the measured read. */
export interface SeasonOverrides {
  undertone?: Undertone
  depth?: Depth
  clarity?: Clarity
}

export interface SeasonResult {
  season: Season
  parent: ParentSeason
  undertone: Undertone
  depth: Depth
  clarity: Clarity
  // raw metrics (surfaced for the "why these colors" explanation)
  hue: number
  ita: number
  chroma: number
  lightness: number
  /** axes the user corrected by hand; empty when the read is untouched */
  corrected: Axis[]
}

// --- thresholds (calibrated to real skin_color data) ---
//
// Undertone comes from the CIELAB HUE ANGLE, not from the b* magnitude.
//
// We used to threshold b* directly, on the reasoning that warm skin is more golden.
// That is a magnitude, and chroma collapses at both very light and very deep skin, so a
// fixed b* cut reads deep skin as "cool" purely because its numbers are small. Measured
// against the Monk Skin Tone Scale, the b* rule mislabels MST 1, 2, 9 and 10: MST 10 sits
// at hue 67 degrees, plainly golden, but b* is only 3.5. The hue angle is scale-invariant
// and stays stable across the full range. The measurements are rendered live at /fairness
// and locked by lib/color/fairness.test.ts.
const HUE_COOL = 42 // hue <= cool (pink/red)
const HUE_WARM = 52 // hue >= warm (golden/yellow)
const ITA_LIGHT = 41 // >= light
const ITA_DEEP = 12 // <= deep
const CHROMA_BRIGHT = 21.5 // >= bright
const CHROMA_SOFT = 18.5 // < soft

/**
 * Below this chroma the hue angle gets numerically shaky: a single 8-bit step can swing
 * it several degrees. We still classify, but confidence reports the axis as unreliable
 * rather than silently pretending a near-grey has a readable undertone.
 */
export const CHROMA_RELIABLE = 8

/** The decision boundaries, exported so confidence can measure distance to them. */
export const THRESHOLDS = { HUE_COOL, HUE_WARM, ITA_LIGHT, ITA_DEEP, CHROMA_BRIGHT, CHROMA_SOFT } as const

/**
 * Hue on a skin-friendly axis. Human skin lives roughly in 0..110 degrees; a very rosy
 * or magenta reading can wrap past 360, so fold anything above 180 to negative. That
 * keeps magenta firmly on the cool side instead of scoring it as extremely warm.
 */
export function skinHue(lab: Lab): number {
  const h = labHue(lab)
  return h > 180 ? h - 360 : h
}

export function classifyUndertone(hex: string): Undertone {
  const h = skinHue(hexToLab(hex))
  if (h >= HUE_WARM) return 'warm'
  if (h <= HUE_COOL) return 'cool'
  return 'neutral'
}

function classifyDepth(lab: Lab): Depth {
  const i = ita(lab)
  if (i >= ITA_LIGHT) return 'light'
  if (i <= ITA_DEEP) return 'deep'
  return 'medium'
}

function classifyClarity(lab: Lab, eyeHex?: string): Clarity {
  const c = labChroma(lab)
  // Eye-skin lightness contrast sharpens the clarity call when eye color is available.
  let contrast = 0
  if (eyeHex) contrast = Math.abs(lab.L - hexToLab(eyeHex).L)
  if (c >= CHROMA_BRIGHT || contrast >= 52) return 'bright'
  if (c < CHROMA_SOFT || (eyeHex ? contrast < 30 : false)) return 'soft'
  return 'true'
}

function pickSeason(undertone: Undertone, depth: Depth, clarity: Clarity, warmLean: boolean): Season {
  const spring = (): Season =>
    depth === 'light' && clarity === 'soft' ? 'Light Spring'
      : clarity === 'bright' ? 'Bright Spring'
        : 'True Spring'
  const summer = (): Season =>
    depth === 'light' ? 'Light Summer'
      : clarity === 'soft' ? 'Soft Summer'
        : 'True Summer'
  const autumn = (): Season =>
    depth === 'deep' ? 'Deep Autumn'
      : clarity === 'soft' ? 'Soft Autumn'
        : 'True Autumn'
  const winter = (): Season =>
    depth === 'deep' && clarity !== 'bright' ? 'Deep Winter'
      : clarity === 'bright' ? 'Bright Winter'
        : 'True Winter'

  if (undertone === 'warm') {
    if (depth === 'light') return spring()
    return autumn() // medium & deep warm -> Autumn family
  }
  if (undertone === 'cool') {
    if (depth === 'deep') return winter()
    if (depth === 'light') return summer()
    return clarity === 'bright' ? winter() : summer() // medium cool
  }
  // neutral: lean by hue proximity + clarity
  if (depth === 'light') return warmLean ? spring() : summer()
  if (depth === 'deep') return warmLean && clarity !== 'bright' ? autumn() : winter()
  return clarity === 'bright' ? (warmLean ? spring() : winter()) : (warmLean ? autumn() : summer())
}

const PARENT: Record<Season, ParentSeason> = {
  'Light Spring': 'Spring', 'True Spring': 'Spring', 'Bright Spring': 'Spring',
  'Light Summer': 'Summer', 'True Summer': 'Summer', 'Soft Summer': 'Summer',
  'Soft Autumn': 'Autumn', 'True Autumn': 'Autumn', 'Deep Autumn': 'Autumn',
  'Deep Winter': 'Winter', 'True Winter': 'Winter', 'Bright Winter': 'Winter',
}

export function classifySeason(input: SkinInput, overrides: SeasonOverrides = {}): SeasonResult {
  const lab = hexToLab(input.skinToneHex)
  const hue = labHue(lab)
  const measured = {
    undertone: classifyUndertone(input.skinToneHex),
    depth: classifyDepth(lab),
    clarity: classifyClarity(lab, input.eyeHex),
  }
  const undertone = overrides.undertone ?? measured.undertone
  const depth = overrides.depth ?? measured.depth
  const clarity = overrides.clarity ?? measured.clarity
  const corrected = (['undertone', 'depth', 'clarity'] as const).filter(
    (axis) => overrides[axis] !== undefined && overrides[axis] !== measured[axis],
  )
  const season = pickSeason(undertone, depth, clarity, hue > 50)
  return {
    season,
    parent: PARENT[season],
    undertone,
    depth,
    clarity,
    hue,
    ita: ita(lab),
    chroma: labChroma(lab),
    lightness: lab.L,
    corrected,
  }
}
