import { checkStock } from '@/lib/stock'

// Which catalog colorways can still actually be bought.
//
// The measured colors never go stale (Uniqlo's "Pink 12" is #fa90a4 for good), so this
// re-checks availability only, which is 69 API calls rather than ~700 swatch downloads.
// A day after the catalog was built, 41 of 353 colorways had already stopped selling.
//
// Cached for a day by Next's Data Cache, both per upstream fetch and for this whole
// response, so the calls happen once for the entire site rather than once per visitor.
// A cron job would need somewhere to write the result; this needs no infrastructure.

export const revalidate = 86400

export async function GET() {
  const { unavailable, reached, total } = await checkStock()
  return Response.json({
    ok: true,
    unavailable: [...unavailable],
    checkedProducts: reached,
    totalProducts: total,
  })
}
