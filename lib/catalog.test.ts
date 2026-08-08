import { describe, it, expect } from 'vitest'
import { CATALOG, matchGarments } from './catalog'
import { getPalette, ALL_SEASONS } from './color/palettes'
import { deltaEHex } from './color/deltae'

describe('catalog data integrity', () => {
  it('every garment has a measured hex and a real product link', () => {
    expect(CATALOG.length).toBeGreaterThan(40)
    for (const g of CATALOG) {
      expect(g.measuredHex).toMatch(/^#[0-9a-f]{6}$/)
      expect(g.productUrl).toMatch(/^https:\/\/www\.uniqlo\.com\//)
      expect(g.swatchUrl).toMatch(/^https:\/\/image\.uniqlo\.com\//)
      expect(['female', 'male']).toContain(g.gender)
    }
  })

  it('covers both genders', () => {
    expect(CATALOG.some((g) => g.gender === 'male')).toBe(true)
    expect(CATALOG.some((g) => g.gender === 'female')).toBe(true)
  })
})

describe('matching', () => {
  it('returns results sorted by ascending deltaE', () => {
    const m = matchGarments(getPalette('Deep Autumn'), 'male', 8)
    expect(m.length).toBe(8)
    for (let i = 1; i < m.length; i++) {
      expect(m[i].deltaE).toBeGreaterThanOrEqual(m[i - 1].deltaE)
    }
  })

  it('reports the palette color it actually matched against', () => {
    const palette = getPalette('Deep Autumn')
    const targets = [palette.hero, ...palette.colors].map((s) => s.hex)
    for (const g of matchGarments(palette, 'male', 5)) {
      expect(targets).toContain(g.nearest.hex)
      // the reported distance must be the real distance to that swatch
      expect(g.deltaE).toBeCloseTo(deltaEHex(g.measuredHex, g.nearest.hex), 10)
    }
  })

  it('only returns garments for the requested gender', () => {
    expect(matchGarments(getPalette('True Summer'), 'male', 10).every((g) => g.gender === 'male')).toBe(true)
    expect(matchGarments(getPalette('True Summer'), 'female', 10).every((g) => g.gender === 'female')).toBe(true)
  })

  it('different seasons surface different garments', () => {
    const autumn = matchGarments(getPalette('Deep Autumn'), 'female', 6).map((g) => g.id)
    const summer = matchGarments(getPalette('True Summer'), 'female', 6).map((g) => g.id)
    expect(autumn).not.toEqual(summer)
  })

  it('the top match is genuinely close, not just the least bad', () => {
    for (const season of ['Deep Autumn', 'True Summer', 'Bright Winter'] as const) {
      const top = matchGarments(getPalette(season), 'female', 1)[0]
      expect(top.deltaE).toBeLessThan(15)
    }
  })
})

describe('variety', () => {
  it('caps how many garments can match the same palette color', () => {
    for (const season of ['Bright Winter', 'Deep Autumn', 'True Summer'] as const) {
      const counts = new Map<string, number>()
      for (const g of matchGarments(getPalette(season), 'female', 8)) {
        counts.set(g.nearest.hex, (counts.get(g.nearest.hex) ?? 0) + 1)
      }
      for (const n of counts.values()) expect(n).toBeLessThanOrEqual(2)
    }
  })

  it('Bright Winter is no longer all off-whites', () => {
    const names = new Set(matchGarments(getPalette('Bright Winter'), 'female', 8).map((g) => g.nearest.name))
    expect(names.size).toBeGreaterThanOrEqual(4)
  })
})

describe('retailer metadata', () => {
  it('every garment carries the retailer name for its colorway', () => {
    for (const g of CATALOG) {
      expect(g.colorName.length).toBeGreaterThan(0)
      expect(g.name.length).toBeGreaterThan(0)
    }
  })

  /**
   * Every season has to return enough garments that the grid reads as a result rather than
   * an error, but the floor is four rather than the eight we ask for, because coverage is a
   * fact about the retailer and not about the palette.
   *
   * Bright Spring is the thinnest, and honestly so: six of its ten colors have no garment
   * within ΔE 15, because electric turquoise and lime are not things a basics retailer
   * stocks. The fix for that is a second retailer, not a duller palette. Bending the colors
   * toward the inventory would invert the whole argument, which is that the palette is
   * measured first and the clothes are matched to it second.
   */
  it('every season returns enough garments for the grid to read as a result', () => {
    for (const s of ALL_SEASONS) {
      for (const g of ['female', 'male'] as const) {
        expect(matchGarments(getPalette(s), g, 8).length, `${s} / ${g}`).toBeGreaterThanOrEqual(4)
      }
    }
  })
})
