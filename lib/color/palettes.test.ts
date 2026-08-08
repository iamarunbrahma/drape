import { describe, it, expect } from 'vitest'
import { getPalette, ALL_SEASONS } from './palettes'
import { deltaEHex } from './deltae'
import { hexToLab } from './space'
import { MAX_DELTA_E as CATALOG_MAX_DELTA_E } from '@/lib/catalog'

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * A palette offers ten choices, so it has to contain ten *distinguishable* choices. This
 * got away from us: True Spring shipped a turquoise and an aqua 2.8 apart, and Deep Winter
 * a royal blue and a cobalt 1.1 apart, which our own `describeDeltaE` calls indistinguishable
 * by eye. On screen they read as one swatch printed twice.
 *
 * Six is the floor, rather than something wider, because the muted seasons are meant to be
 * closely related. Soft Summer's whole character is greyed-down neighbours, and forcing
 * those apart would break the season instead of fixing it.
 */
const MIN_SEPARATION = 6

describe('palettes', () => {
  it('has all 12 seasons', () => {
    expect(ALL_SEASONS).toHaveLength(12)
  })

  for (const season of ALL_SEASONS) {
    it(`${season} palette is complete and valid`, () => {
      const p = getPalette(season)
      expect(p.colors.length).toBeGreaterThanOrEqual(8)
      for (const c of [...p.colors, ...p.neutrals, p.hero, p.clash]) {
        expect(c.hex, `${season} / ${c.name}`).toMatch(HEX)
        expect(c.name.length).toBeGreaterThan(0)
      }
      expect(p.why.length).toBeGreaterThan(30)
      expect(p.tagline.length).toBeGreaterThan(3)
      expect(p.parent).toBe(
        season.includes('Spring') ? 'Spring'
          : season.includes('Summer') ? 'Summer'
            : season.includes('Autumn') ? 'Autumn' : 'Winter',
      )
    })

    it(`${season} colors are all distinguishable from each other`, () => {
      const { colors } = getPalette(season)
      const tooClose: string[] = []
      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          const d = deltaEHex(colors[i].hex, colors[j].hex)
          if (d < MIN_SEPARATION) tooClose.push(`${colors[i].name} vs ${colors[j].name} (ΔE ${d.toFixed(1)})`)
        }
      }
      expect(tooClose).toEqual([])
      expect(new Set(colors.map((c) => c.name)).size).toBe(colors.length)
    })

    // The comparison shot only lands if the clashing color is obviously the wrong one. The
    // bound is the catalog's own cutoff: `matchGarments` will not show a garment beyond
    // ΔE 15, so anything inside that would qualify as a match to the palette it is meant
    // to be the foil for.
    it(`${season} clash color is further away than any garment we would call a match`, () => {
      const p = getPalette(season)
      const nearest = Math.min(...p.colors.map((c) => deltaEHex(p.clash.hex, c.hex)))
      expect(nearest).toBeGreaterThan(CATALOG_MAX_DELTA_E)
    })

    it(`${season} hero is one of its own colors`, () => {
      const p = getPalette(season)
      expect(p.colors.map((c) => c.hex.toLowerCase())).toContain(p.hero.hex.toLowerCase())
    })
  }
})

/**
 * The reveal tells the wearer their neutrals are "a pale, a mid, and the deepest tone this
 * season carries". That is a claim about the data, so it is checked against the data.
 *
 * An earlier draft also said they were all kept warm or cool with the season. They are not:
 * True Spring's Warm Navy measures hue -73 and Bright Spring's True Navy -68, both plainly
 * blue, which is correct for seasonal analysis but made the sentence false. The copy lost
 * the claim rather than the palettes losing their navies.
 */
describe('neutrals', () => {
  for (const season of ALL_SEASONS) {
    it(`${season} offers a pale, a mid and a deep neutral`, () => {
      const { neutrals } = getPalette(season)
      expect(neutrals).toHaveLength(3)
      const ls = neutrals.map((n) => hexToLab(n.hex).L)
      expect(Math.max(...ls), 'the pale one').toBeGreaterThan(85)
      expect(Math.max(...ls) - Math.min(...ls), 'spread from pale to deep').toBeGreaterThan(15)
    })
  }
})

/**
 * No two seasons may prescribe the same color.
 *
 * Adjacent seasons are meant to be neighbours; that is what makes this a twelve-season
 * system rather than twelve unrelated palettes, and True Spring sits next to Bright Spring
 * by design. What is not defensible is two seasons naming a shade a person could not tell
 * apart: fifteen pairs were under ΔE 5, the worst being Light Summer's Powder Blue and Deep
 * Winter's Icy Blue at 1.7, from opposite ends of the system. Each was moved further into
 * its own season's character rather than split down the middle, so the seasons separated by
 * becoming more themselves. `scripts/separate-palettes.ts` finds the smallest such moves.
 */
const CROSS_SEASON_MIN = 5

describe('seasons are distinguishable from each other', () => {
  it('no color appears in two seasons', () => {
    const clashes: string[] = []
    for (let i = 0; i < ALL_SEASONS.length; i++) {
      for (let j = i + 1; j < ALL_SEASONS.length; j++) {
        for (const a of getPalette(ALL_SEASONS[i]).colors) {
          for (const b of getPalette(ALL_SEASONS[j]).colors) {
            const d = deltaEHex(a.hex, b.hex)
            if (d < CROSS_SEASON_MIN) {
              clashes.push(`${ALL_SEASONS[i]} ${a.name} vs ${ALL_SEASONS[j]} ${b.name} (ΔE ${d.toFixed(1)})`)
            }
          }
        }
      }
    }
    expect(clashes).toEqual([])
  })

  // Clarity is the axis that separates the three seasons inside a family, so each family's
  // bright end must actually measure more colorful than its muted end.
  it('each family runs from its most muted season to its brightest', () => {
    const meanChroma = (season: (typeof ALL_SEASONS)[number]) => {
      const cs = getPalette(season).colors.map((c) => {
        const { a, b } = hexToLab(c.hex)
        return Math.hypot(a, b)
      })
      return cs.reduce((x, y) => x + y, 0) / cs.length
    }
    expect(meanChroma('Light Spring')).toBeLessThan(meanChroma('True Spring'))
    expect(meanChroma('True Spring')).toBeLessThan(meanChroma('Bright Spring'))
    expect(meanChroma('Soft Summer')).toBeLessThan(meanChroma('True Summer'))
    expect(meanChroma('Soft Autumn')).toBeLessThan(meanChroma('True Autumn'))
    expect(meanChroma('Deep Winter')).toBeLessThan(meanChroma('True Winter'))
    expect(meanChroma('True Winter')).toBeLessThan(meanChroma('Bright Winter'))
  })
})
