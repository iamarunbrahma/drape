import type { Garment } from './catalog'

/** Colorway codes still on sale for one product, or null if we could not reach it. */
export type ProductStock = Set<string> | null

/**
 * Which catalog ids to mark unavailable, given what we managed to learn about each product.
 *
 * The rule that matters is what happens when we learn nothing. A product we could not
 * reach is left alone rather than assumed sold out, so an outage or a rate limit at the
 * retailer degrades to "no annotations" instead of striking every garment off the page.
 * We are not the shop, and a third party being down is not evidence about their stock.
 */
export function unavailableIds(catalog: Garment[], stock: Map<string, ProductStock>): string[] {
  return catalog
    .filter((g) => {
      const codes = stock.get(productOf(g.id))
      return codes ? !codes.has(g.colorCode) : false
    })
    .map((g) => g.id)
}

/** Catalog ids look like `uniqlo-470143-12`; the middle part is the product. */
export function productOf(catalogId: string): string {
  return catalogId.split('-')[1]
}
