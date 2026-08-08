import { analyzeSkin } from '@/lib/youcam/skin'
import { errorBody, budgetOk, noteSpend, overDemoLimit, bringYourOwnKey, readFormData, DEMO_LIMIT_MESSAGE } from '@/lib/youcam/guard'

/**
 * What a skin report costs, from Perfect Corp's own table: 9-12 concerns is 14 units for
 * SD and 20 for HD. We ask for eleven, every action is an `hd_` one, and the image is
 * upscaled past 1080px to satisfy them, so this is the HD rate.
 *
 * We had it at 12, which is not a rate on the table at all. Under-declaring in a budget
 * guard is the dangerous direction: it lets a call start that the balance cannot cover,
 * and the failure then gets blamed on the photo. Over-declaring only refuses slightly
 * early, so where there is doubt this takes the higher number.
 */
const SKIN_COST = 20

import { withBudget } from '@/lib/youcam/client'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

async function handle(req: Request) {
  try {
    const creds = bringYourOwnKey(req)
    if (overDemoLimit(req, creds, 12, 60 * 60_000)) return Response.json({ ok: false, error: 'rate_limited' }, { status: 200 })
    const budget = await budgetOk(creds, SKIN_COST)
    if (!budget.ok) {
      return Response.json(
        { ok: false, error: 'demo_limit', message: DEMO_LIMIT_MESSAGE, detail: `${budget.units} units left on the shared demo; this call needs ${SKIN_COST}.` },
        { status: 200 },
      )
    }

    const form = await readFormData(req)
    if (!form) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 })
    const file = form.get('image')
    if (!(file instanceof Blob)) return Response.json({ ok: false, error: 'no_image' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())
    const report = await analyzeSkin(bytes, creds)
    noteSpend(SKIN_COST)
    return Response.json(report)
  } catch (e) {
    return Response.json(errorBody(e), { status: 500 })
  }
}

/**
 * The handler's share of its own limit. Everything YouCam-facing inherits this, so the
 * retries and polls underneath stop rather than being killed mid-flight by the platform,
 * which is the difference between a reported failure and a blank 504. The few seconds
 * held back cover reading the body and writing the response.
 */
const BUDGET_MS = (maxDuration - 5) * 1000

export async function POST(req: Request) {
  return withBudget(BUDGET_MS, () => handle(req))
}
