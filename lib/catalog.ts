// Matching real garments to a palette by measured color.
//
// The colors in catalog.data.json are measured from Uniqlo's own fabric swatch images
// by scripts/build-catalog.mjs. We did not choose them, so a close ΔE is real evidence
// that the garment suits the palette rather than a number we arranged in advance.

import data from './catalog.data.json'
import { deltaEHex, describeDeltaE } from './color/deltae'
import type { Palette, Swatch } from './color/palettes'

export interface Garment {
  id: string
  retailer: string
  name: string
  /** the retailer's own name for this colorway */
  colorName: string
  colorCode: string
  category: string
  gender: 'female' | 'male'
  /** measured from the retailer's swatch image, not asserted */
  measuredHex: string
  swatchUrl: string
  imageUrl: string
  productUrl: string
}

export interface GarmentMatch extends Garment {
  /** CIEDE2000 distance to the closest color in the palette */
  deltaE: number
  nearest: Swatch
  /** plain-language reading of deltaE */
  verdict: string
}

export const CATALOG = data.items as Garment[]
export const CATALOG_SOURCE = data.source
export const CATALOG_METHOD = data.method
export const CATALOG_MEASURED_AT = data.measuredAt

export interface Product {
  goods: string
  retailer: string
  name: string
  gender: 'female' | 'male'
  colorways: Garment[]
}

/** The catalog regrouped as products, so a retailer page can show one item's colorways. */
export function products(gender: 'female' | 'male'): Product[] {
  const by = new Map<string, Product>()
  for (const g of CATALOG) {
    if (g.gender !== gender) continue
    const goods = g.id.split('-')[1]
    let p = by.get(goods)
    if (!p) {
      p = { goods, retailer: g.retailer, name: g.name, gender: g.gender, colorways: [] }
      by.set(goods, p)
    }
    p.colorways.push(g)
  }
  return [...by.values()].sort((a, b) => b.colorways.length - a.colorways.length)
}

/**
 * Score every garment given against a palette and sort closest first.
 * Unlike matchGarments this filters nothing: a product page has to show the colorways
 * the retailer actually stocks, including the ones that will not suit you.
 */
export function rankAgainstPalette(garments: Garment[], palette: Palette): GarmentMatch[] {
  const targets = [palette.hero, ...palette.colors]
  return garments
    .map((g) => {
      const { swatch, deltaE } = nearestSwatch(g.measuredHex, targets)
      return { ...g, deltaE, nearest: swatch, verdict: describeDeltaE(deltaE) }
    })
    .sort((a, b) => a.deltaE - b.deltaE)
}

/** The closest palette color to a garment, by perceptual distance. */
function nearestSwatch(hex: string, swatches: Swatch[]): { swatch: Swatch; deltaE: number } {
  let best = swatches[0]
  let bestD = deltaEHex(hex, swatches[0].hex)
  for (const s of swatches.slice(1)) {
    const d = deltaEHex(hex, s.hex)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return { swatch: best, deltaE: bestD }
}

/** At most this many garments may match the same palette color. */
const PER_SWATCH_CAP = 2

/**
 * Beyond this distance a garment is not really "your color" any more, and showing it
 * under a match heading would be the same overclaim we set out to remove. Better to
 * return four honest matches than eight padded ones.
 */
export const MAX_DELTA_E = 15

/**
 * Rank the catalog against a palette, closest first.
 *
 * Palette neutrals are not targets: a retailer's whites and greys sit close to almost
 * any neutral, so including them fills the grid with five off-whites and buries the
 * colors that actually make the case. The per-swatch cap does the same job for strong
 * colors, keeping the result varied enough to be worth looking at.
 */
export function matchGarments(
  palette: Palette,
  gender: 'female' | 'male' = 'female',
  limit = 8,
  exclude?: ReadonlySet<string>,
): GarmentMatch[] {
  const targets = [palette.hero, ...palette.colors]
  // Excluded before the limit, not after, so dropping sold-out colorways backfills with
  // the next best ones rather than leaving a short grid.
  const ranked = CATALOG.filter((g) => g.gender === gender && !exclude?.has(g.id))
    .map((g) => {
      const { swatch, deltaE } = nearestSwatch(g.measuredHex, targets)
      return { ...g, deltaE, nearest: swatch, verdict: describeDeltaE(deltaE) }
    })
    .filter((g) => g.deltaE <= MAX_DELTA_E)
    .sort((a, b) => a.deltaE - b.deltaE)

  const used = new Map<string, number>()
  const picked: GarmentMatch[] = []
  for (const g of ranked) {
    if (picked.length >= limit) break
    const n = used.get(g.nearest.hex) ?? 0
    if (n >= PER_SWATCH_CAP) continue
    used.set(g.nearest.hex, n + 1)
    picked.push(g)
  }
  return picked
}

export interface ColorMatch {
  garment: Garment
  deltaE: number
  verdict: string
}

/**
 * The catalog garment whose measured color is closest to one specific shade.
 *
 * The try-on's shop button used to be a Google Shopping query built from the swatch's
 * name and the wearer's gender, so "Coral" became a search for "coral women's top" and
 * whatever came back was a keyword guess. We have 353 garments whose colors were measured
 * off the retailer's own swatch images, so the button can point at an actual product that
 * is actually this color. Returns null past MAX_DELTA_E rather than pretending.
 */
export function nearestGarment(
  hex: string,
  gender: 'female' | 'male' = 'female',
  exclude?: ReadonlySet<string>,
): ColorMatch | null {
  let best: ColorMatch | null = null
  for (const garment of CATALOG) {
    if (garment.gender !== gender || exclude?.has(garment.id)) continue
    const deltaE = deltaEHex(hex, garment.measuredHex)
    if (!best || deltaE < best.deltaE) best = { garment, deltaE, verdict: describeDeltaE(deltaE) }
  }
  return best && best.deltaE <= MAX_DELTA_E ? best : null
}
