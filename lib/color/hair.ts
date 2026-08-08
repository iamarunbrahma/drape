import type { Palette, Swatch } from './palettes'
import { deltaEHex } from './deltae'

// YouCam's skin-tone analysis returns the wearer's hair color alongside skin, eyes and
// lips, and until now we read three of those four and quietly dropped the fourth. Hair is
// an axis of seasonal analysis in its own right, so this is what closes that loop: compare
// the measured hair against the shades the season actually calls for.

/**
 * Beyond this the measured hair is outside the season's range. It is looser than the
 * garment threshold on purpose: hair reads as a mass under variable light, not as a flat
 * swatch, so holding it to a fabric-grade tolerance would call almost everyone wrong.
 */
export const HAIR_MAX_DELTA_E = 22

export interface HairAdvice {
  /** the shade in this season's range that the wearer's hair is already closest to */
  nearest: Swatch
  deltaE: number
  /** whether the hair they have already sits in the season's range */
  inRange: boolean
  verdict: string
}

export function hairAdvice(measuredHex: string, palette: Palette): HairAdvice {
  let nearest = palette.hair[0]
  let deltaE = deltaEHex(measuredHex, nearest.hex)
  for (const shade of palette.hair) {
    const d = deltaEHex(measuredHex, shade.hex)
    if (d < deltaE) {
      deltaE = d
      nearest = shade
    }
  }
  const inRange = deltaE <= HAIR_MAX_DELTA_E
  return {
    nearest,
    deltaE,
    inRange,
    verdict: inRange
      ? `Your hair already sits in your season's range, closest to ${nearest.name}.`
      : `Your hair reads outside your season's range. ${nearest.name} is the nearest shade in it.`,
  }
}
