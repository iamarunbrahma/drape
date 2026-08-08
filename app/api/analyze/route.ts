import { analyzeTone } from '@/lib/youcam/skin'
import { uploadPersonForCloth } from '@/lib/youcam/tryon'
import { classifySeason } from '@/lib/color/season'
import { getPalette } from '@/lib/color/palettes'
import { errorBody, budgetOk, noteSpend, overDemoLimit, bringYourOwnKey, readFormData, DEMO_LIMIT_MESSAGE } from '@/lib/youcam/guard'

import { withBudget } from '@/lib/youcam/client'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

async function handle(req: Request) {
  try {
    const creds = bringYourOwnKey(req)
    if (overDemoLimit(req, creds, 12, 60 * 60_000)) {
      return Response.json({ ok: false, error: 'rate_limited', message: 'Too many requests — please slow down.' }, { status: 200 })
    }
    const budget = await budgetOk(creds, 20)
    if (!budget.ok) {
      return Response.json(
        { ok: false, error: 'demo_limit', message: DEMO_LIMIT_MESSAGE, detail: `${budget.units} units left on the shared demo; this call needs 20.` },
        { status: 200 },
      )
    }

    const form = await readFormData(req)
    if (!form) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 })
    const file = form.get('image')
    if (!(file instanceof Blob)) return Response.json({ ok: false, error: 'no_image' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())

    const tone = await analyzeTone(bytes, creds)
    noteSpend(20) // skin-tone-analysis
    if (!tone.ok || !tone.color?.skin_color) {
      // The code carries the guidance via FACE_HINTS; the detail says it in YouCam's own
      // terms, so a read that fails for an unmapped reason is still legible.
      return Response.json(
        { ok: false, error: tone.error ?? 'analysis_failed', detail: tone.error, faceQuality: tone.faceQuality },
        { status: 200 },
      )
    }

    const result = classifySeason({ skinToneHex: tone.color.skin_color, eyeHex: tone.color.eye_color })
    const palette = getPalette(result.season)
    const clothFileId = await uploadPersonForCloth(bytes, creds)

    return Response.json({ ok: true, tone: tone.color, faceQuality: tone.faceQuality, season: result, palette, clothFileId })
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
