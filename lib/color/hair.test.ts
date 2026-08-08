import { describe, expect, it } from 'vitest'
import { ALL_SEASONS, getPalette } from './palettes'
import { hexToLab, labHue } from './space'
import { deltaEHex } from './deltae'

// The hair shades are domain data, so they are held to the engine rather than to my eye:
// a warm season's hair has to actually measure warm, a deep season's has to measure dark,
// and no season may offer two shades a person could not tell apart.

const hue = (hex: string) => {
  const h = labHue(hexToLab(hex))
  return h > 180 ? h - 360 : h
}
const lightness = (hex: string) => hexToLab(hex).L

/** Icy Platinum is a deliberate Bright Winter outlier: the season's whole point is contrast. */
const CONTRAST_SHADES = new Set(['Icy Platinum'])

describe('hair shades', () => {
  for (const season of ALL_SEASONS) {
    const palette = getPalette(season)
    const shades = palette.hair

    it(`${season} offers three distinguishable shades`, () => {
      expect(shades).toHaveLength(3)
      for (let i = 0; i < shades.length; i++) {
        for (let j = i + 1; j < shades.length; j++) {
          expect(deltaEHex(shades[i].hex, shades[j].hex), `${shades[i].name} vs ${shades[j].name}`)
            .toBeGreaterThan(3)
        }
      }
    })

    if (season.includes('Spring') || season.includes('Autumn')) {
      it(`${season} hair is warm, like the season`, () => {
        for (const s of shades) expect(hue(s.hex), s.name).toBeGreaterThan(30)
      })
    }

    if (season.startsWith('Deep') || season.startsWith('True Winter') || season.startsWith('Bright Winter')) {
      it(`${season} hair is dark, like the season`, () => {
        for (const s of shades) {
          if (CONTRAST_SHADES.has(s.name)) continue
          expect(lightness(s.hex), s.name).toBeLessThan(35)
        }
      })
    }

    if (season.startsWith('Light')) {
      it(`${season} hair is light, like the season`, () => {
        for (const s of shades) expect(lightness(s.hex), s.name).toBeGreaterThan(50)
      })
    }
  }
})
