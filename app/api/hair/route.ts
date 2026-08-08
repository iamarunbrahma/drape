import { tryHairColor } from '@/lib/youcam/tryon'
import { errorBody, budgetOk, noteSpend, overDemoLimit, bringYourOwnKey, readFormData, DEMO_LIMIT_MESSAGE } from '@/lib/youcam/guard'

import { withBudget } from '@/lib/youcam/client'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const HEX = /^#[0-9a-f]{6}$/i

async function handle(req: Request) {
  try {
    const creds = bringYourOwnKey(req)
    if (overDemoLimit(req, creds, 20, 60 * 60_000)) return Response.json({ ok: false, error: 'rate_limited' }, { status: 200 })
    const budget = await budgetOk(creds, 1)
    if (!budget.ok) {
      return Response.json(
        { ok: false, error: 'demo_limit', message: DEMO_LIMIT_MESSAGE, detail: `${budget.units} units left on the shared demo; this call needs 1.` },
        { status: 200 },
      )
    }

    const form = await readFormData(req)
    if (!form) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 })
    const file = form.get('image')
    const hex = form.get('hex')
    if (!(file instanceof Blob)) return Response.json({ ok: false, error: 'no_image' }, { status: 400 })
    if (typeof hex !== 'string' || !HEX.test(hex)) return Response.json({ ok: false, error: 'bad_hex' }, { status: 400 })

    const result = await tryHairColor(Buffer.from(await file.arrayBuffer()), hex, creds)
    noteSpend(1) // hair-color
    return Response.json(result)
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
