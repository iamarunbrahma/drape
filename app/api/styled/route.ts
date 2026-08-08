import { styledLook, styleForSeason, type ScarfStyle } from '@/lib/youcam/tryon'
import type { Season } from '@/lib/color/season'
import { errorBody, budgetOk, noteSpend, overDemoLimit, bringYourOwnKey, readFormData, DEMO_LIMIT_MESSAGE } from '@/lib/youcam/guard'

import { withBudget } from '@/lib/youcam/client'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

async function handle(req: Request) {
  try {
    const creds = bringYourOwnKey(req)
    if (overDemoLimit(req, creds, 8, 60 * 60_000)) return Response.json({ ok: false, error: 'rate_limited' }, { status: 200 })
    const budget = await budgetOk(creds, 2)
    if (!budget.ok) {
      return Response.json(
        { ok: false, error: 'demo_limit', message: DEMO_LIMIT_MESSAGE, detail: `${budget.units} units left on the shared demo; this call needs 2.` },
        { status: 200 },
      )
    }

    const form = await readFormData(req)
    if (!form) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 })
    const file = form.get('image')
    const gender = (form.get('gender') as string) === 'male' ? 'male' : 'female'
    // The season picks the editorial register. It is the only handle this endpoint
    // actually respects; see styledLook for why no color is passed.
    const season = form.get('season') as Season | null
    const style: ScarfStyle = season ? styleForSeason(season) : 'random'
    if (!(file instanceof Blob)) return Response.json({ ok: false, error: 'no_image' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())

    const result = await styledLook(bytes, gender, style, creds)
    noteSpend(2)
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
