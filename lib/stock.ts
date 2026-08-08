import 'server-only'
import { CATALOG } from './catalog'
import { unavailableIds, productOf, type ProductStock } from './availability'

// Live availability, shared by the /api/availability route and the MCP server.
//
// It lived only in the route to begin with, which meant the website hid sold-out
// colorways while `find_garments` over MCP still recommended them: its top result for a
// True Spring reader was a pink sweatshirt Uniqlo had stopped selling. An agent acting on
// that sends someone to a page they cannot buy from, which is worse than the website
// getting it wrong, because nobody is looking at it.

const DAY = 86400

const API = 'https://www.uniqlo.com/us/api/commerce/v5/en'
const UA = { 'User-Agent': 'Mozilla/5.0' }

interface L2 {
  l2Id: string
  color: { displayCode: string }
  sales?: boolean
}

/** Colorway display codes with at least one size still on sale, or null if unreachable. */
async function sellableCodes(goods: string): Promise<ProductStock> {
  try {
    const r = await fetch(`${API}/products/E${goods}-000/price-groups/00/l2s`, {
      headers: UA,
      next: { revalidate: DAY },
    })
    if (!r.ok) return null
    const j = (await r.json()) as {
      result?: { l2s?: L2[]; stocks?: Record<string, { quantity?: number }> }
    }
    const l2s = j.result?.l2s
    if (!l2s?.length) return null
    const stocks = j.result?.stocks ?? {}
    const codes = new Set<string>()
    for (const l2 of l2s) {
      const qty = stocks[l2.l2Id]?.quantity
      // A missing quantity means in stock: the flag is the reliable signal, and reading
      // absent data as "sold out" would hide things people can actually buy.
      if (l2.sales && (qty === undefined || qty > 0)) codes.add(l2.color.displayCode)
    }
    return codes
  } catch {
    return null
  }
}

/** Short-lived process memo so one request does not re-walk 69 cache entries per call. */
let memo: { at: number; ids: Set<string> } | null = null
const MEMO_MS = 60 * 60 * 1000

export interface StockCheck {
  unavailable: Set<string>
  reached: number
  total: number
}

export async function checkStock(): Promise<StockCheck> {
  const products = [...new Set(CATALOG.map((g) => productOf(g.id)))]
  if (memo && Date.now() - memo.at < MEMO_MS) {
    return { unavailable: memo.ids, reached: products.length, total: products.length }
  }
  const checked = await Promise.all(products.map(async (g) => [g, await sellableCodes(g)] as const))
  const ids = new Set(unavailableIds(CATALOG, new Map(checked)))
  memo = { at: Date.now(), ids }
  return {
    unavailable: ids,
    reached: checked.filter(([, codes]) => codes !== null).length,
    total: products.length,
  }
}
