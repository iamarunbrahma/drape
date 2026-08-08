import { describe, expect, it } from 'vitest'
import { unavailableIds, productOf, type ProductStock } from './availability'
import { CATALOG, matchGarments, nearestGarment, type Garment } from './catalog'
import { getPalette } from './color/palettes'

const g = (id: string, colorCode: string): Garment => ({ ...CATALOG[0], id, colorCode })

const SHIRT_RED = g('uniqlo-470143-12', '12')
const SHIRT_PINK = g('uniqlo-470143-03', '03')
const OTHER = g('uniqlo-455365-68', '68')

describe('availability', () => {
  it('reads the product out of a catalog id', () => {
    expect(productOf('uniqlo-470143-12')).toBe('470143')
  })

  it('marks a colorway the retailer no longer lists', () => {
    const stock = new Map<string, ProductStock>([['470143', new Set(['12'])]])
    expect(unavailableIds([SHIRT_RED, SHIRT_PINK], stock)).toEqual(['uniqlo-470143-03'])
  })

  // The whole point of the design: never let a retailer's outage empty our shelves.
  it('leaves a product alone when we could not reach it', () => {
    const stock = new Map<string, ProductStock>([['470143', null]])
    expect(unavailableIds([SHIRT_RED, SHIRT_PINK], stock)).toEqual([])
  })

  it('leaves everything alone when the whole upstream is down', () => {
    const stock = new Map<string, ProductStock>()
    expect(unavailableIds([SHIRT_RED, SHIRT_PINK, OTHER], stock)).toEqual([])
  })

  it('fails open per product, not all or nothing', () => {
    const stock = new Map<string, ProductStock>([
      ['470143', new Set<string>()], // reached, nothing on sale
      ['455365', null], // unreachable
    ])
    expect(unavailableIds([SHIRT_RED, SHIRT_PINK, OTHER], stock)).toEqual([
      'uniqlo-470143-12',
      'uniqlo-470143-03',
    ])
  })
})

describe('excluding sold-out garments', () => {
  const palette = getPalette('True Spring')

  it('backfills so the grid stays full instead of going short', () => {
    const full = matchGarments(palette, 'female', 8)
    const dropped = new Set(full.slice(0, 3).map((g) => g.id))
    const filtered = matchGarments(palette, 'female', 8, dropped)

    expect(full).toHaveLength(8)
    expect(filtered).toHaveLength(8)
    expect(filtered.some((g) => dropped.has(g.id))).toBe(false)
  })

  it('sends the shop link to the next closest garment still on sale', () => {
    const hex = palette.colors.find((c) => c.name === 'Warm Pink')!.hex
    const first = nearestGarment(hex, 'female')!
    const next = nearestGarment(hex, 'female', new Set([first.garment.id]))!

    expect(next.garment.id).not.toBe(first.garment.id)
    expect(next.deltaE).toBeGreaterThanOrEqual(first.deltaE)
  })

  // Failing open has to survive all the way to what is rendered, not just the endpoint.
  it('shows the ordinary matches when the stock check told us nothing', () => {
    expect(matchGarments(palette, 'female', 8, new Set())).toEqual(matchGarments(palette, 'female', 8))
  })
})
