import type { ToneColors, SkinReport } from '@/lib/types'
import { classifySeason, type Season } from '@/lib/color/season'
import { getPalette } from '@/lib/color/palettes'
import skinData from './skin.data.json'

// Pre-computed sample faces. Their season/palette is derived client-side from `tone`
// (the color engine is pure), and their try-on images and skin reports are pre-generated
// from real YouCam responses, so a judge gets the full experience, including the Skin
// Analysis report, instantly and with ZERO API units.

const SKIN = skinData as Record<string, { concerns: SkinReport['concerns']; skinType?: string }>

export interface SampleData {
  id: string
  label: string
  image: string
  tone: ToneColors
  /** colors used for the your-color-vs-clash comparison (both pre-generated) */
  measuredSeason: Season
  heroHex: string
  clashHex: string
  /** hex -> pre-generated try-on image path */
  tryons: Record<string, string>
  /** hex -> pre-generated hair-color image path, for this season's hair shades */
  hairShots: Record<string, string>
  /** a real skin-analysis response, captured once and shipped */
  skin: SkinReport
}

const FACES = [
  { id: 'deep', label: 'Deep', tone: { skin_color: '#6e4b34', eye_color: '#1e110d', lip_color: '#5a352b', eyebrow_color: '#543931', hair_color: '#2c2018' } },
  { id: 'medium', label: 'Medium', tone: { skin_color: '#ac876c', eye_color: '#42240e', lip_color: '#ad5755', eyebrow_color: '#3a2418', hair_color: '#241610' } },
  { id: 'light', label: 'Light', tone: { skin_color: '#be9c82', eye_color: '#4f4030', lip_color: '#cf857a', eyebrow_color: '#6b5540', hair_color: '#3a2a20' } },
] satisfies Array<{ id: string; label: string; tone: ToneColors }>

/**
 * Every color a sample's own season can ask for has a pre-generated render: the hero, the
 * clashing color, and all ten palette swatches, so the whole palette is tappable.
 *
 * These are derived from the palette rather than listed by hand, because when they were
 * listed by hand the two drifted: the comparison labelled "in your color" was showing a
 * shade that was no longer the palette's hero, and seven of ten swatches had no render so
 * the picker quietly dropped them. `scripts/render-samples.ts` bakes this same set, and
 * `samples.test.ts` fails if any of it is missing from disk.
 */
function baked(id: string, tone: ToneColors) {
  const measuredSeason = classifySeason({ skinToneHex: tone.skin_color, eyeHex: tone.eye_color }).season
  const palette = getPalette(measuredSeason)
  const hexes = [...new Set([palette.hero.hex, ...palette.colors.map((c) => c.hex), palette.clash.hex])]
  return {
    measuredSeason,
    heroHex: palette.hero.hex,
    clashHex: palette.clash.hex,
    tryons: Object.fromEntries(hexes.map((h) => [h.toLowerCase(), `/samples/precomputed/${id}/${h.slice(1).toLowerCase()}.jpg`])),
    hairShots: Object.fromEntries(
      palette.hair.map((h) => [h.hex.toLowerCase(), `/samples/hair/${id}/${h.hex.slice(1).toLowerCase()}.jpg`]),
    ),
  }
}

export const SAMPLES: SampleData[] = FACES.map((face) => ({
  ...face,
  image: `/samples/${face.id}.jpg`,
  ...baked(face.id, face.tone),
  skin: { ok: true, ...SKIN[face.id] },
}))
