import 'server-only'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { unzipSync } from 'fflate'
import { uploadFile, runTask, type Creds, type TaskResult } from './client'

export interface ToneColors {
  skin_color: string
  lip_color: string
  eye_color: string
  eyebrow_color: string
  hair_color: string
  eye_color_name?: string
  hair_color_name?: string
}
export interface FaceQuality {
  has_face: boolean
  area: string
  frontal: string
  lighting: string
  faceangle: string
}
export interface ToneResult {
  ok: boolean
  error?: string
  color?: ToneColors
  faceQuality?: FaceQuality
}

/** Upload a selfie and run skin-tone-analysis -> skin/lip/eye/hair colors + face quality. */
/**
 * Two attempts have to fit inside the route's 60s budget, so each gets a share rather than
 * the 90s default. Left at the default, a slow read plus the crop retry could run to three
 * minutes against a limit of one, and the caller would be cut off mid-poll with nothing to
 * show for it.
 */
const TONE_ATTEMPT_MS = 22_000

/**
 * A read that never lands is its own outcome, not a crash.
 *
 * Letting the timeout throw sent it to the route's catch-all, where someone watching a
 * spinner was told "something went wrong" with no hint that waiting longer would not help.
 */
async function attempt(run: () => Promise<TaskResult>): Promise<TaskResult> {
  try {
    return await run()
  } catch (e) {
    if (e instanceof Error && /timed out/.test(e.message)) {
      return { task_status: 'error', error: 'analysis_timeout' } as TaskResult
    }
    throw e
  }
}

export async function analyzeTone(bytes: Buffer, creds?: Creds): Promise<ToneResult> {
  // Keyed by the photo itself, so the retry after a timeout resumes that read rather than
  // paying for a second one. The upload is deferred inside the thunk: a resumed task
  // already has its file and should not be sent the image again.
  const runOn = (buf: Buffer) =>
    runTask(
      'skin-tone-analysis',
      async () => ({ src_file_id: await uploadFile('skin-tone-analysis', buf, creds) }),
      creds,
      TONE_ATTEMPT_MS,
      `skin-tone-analysis:${createHash('sha256').update(buf).digest('hex').slice(0, 16)}`,
    )

  // The two APIs want opposite things from one photograph. This one rejects a face that
  // does not fill the frame; the cloth try-on rejects a crop with no body to dress. A
  // head-and-shoulders shot is the only framing that can serve both, and it is what we ask
  // for, so when the face reads as too small we retry on a crop rather than telling the
  // wearer to reframe into the shot that breaks the other half. `analyzeSkin` already did
  // this; without it here our own sample faces failed the guidance we print above them.
  let res = await attempt(() => runOn(bytes))
  if (res.task_status !== 'success' && /face_too_small|position_too_small/.test(res.error ?? '')) {
    res = await attempt(async () => runOn(await faceCrop(bytes)))
  }
  if (res.task_status !== 'success') return { ok: false, error: res.error || 'analysis_failed' }
  const r = res.results as { color?: ToneColors; face_quality?: FaceQuality }
  return { ok: true, color: r.color, faceQuality: r.face_quality }
}

export interface SkinConcern { key: string; label: string; score: number }
export interface SkinReport {
  ok: boolean
  error?: string
  concerns?: SkinConcern[]
  skinType?: string
}

const CONCERN_LABELS: Record<string, string> = {
  hd_moisture: 'Moisture', hd_radiance: 'Radiance', hd_firmness: 'Firmness',
  hd_texture: 'Texture', hd_redness: 'Redness', hd_oiliness: 'Oiliness',
  hd_acne: 'Acne', hd_age_spot: 'Even tone', hd_dark_circle: 'Dark circles',
  hd_pore: 'Pores', hd_wrinkle: 'Wrinkles',
}

/** Upload a selfie and run skin-analysis; returns per-concern ui_scores (0-100, higher=better). */
/** Upscale so both sides clear the hd_ minimum (>=1080px). */
async function forSkin(buf: Buffer): Promise<Buffer> {
  return sharp(buf).resize({ width: 1280, height: 1280, fit: 'outside', withoutEnlargement: false }).jpeg({ quality: 92 }).toBuffer()
}

/** Crop to the upper-center (where a portrait face sits) so the face fills more of the frame. */
async function faceCrop(buf: Buffer): Promise<Buffer> {
  const m = await sharp(buf).metadata()
  const W = m.width ?? 1000
  const H = m.height ?? 1000
  const side = Math.round(Math.min(W * 0.72, H * 0.46))
  const left = Math.round((W - side) / 2)
  const top = Math.round(H * 0.08)
  return sharp(buf).extract({ left, top, width: side, height: Math.min(side, H - top) }).toBuffer()
}

export async function analyzeSkin(bytes: Buffer, creds?: Creds): Promise<SkinReport> {
  const actions = Object.keys(CONCERN_LABELS)

  // Try the full frame; if the face is too small (upper-body framing), retry on a face crop.
  const runOn = async (buf: Buffer) => {
    const fileId = await uploadFile('skin-analysis', await forSkin(buf), creds)
    return runTask('skin-analysis', { src_file_id: fileId, dst_actions: actions }, creds)
  }
  let res = await attempt(() => runOn(bytes))
  if (res.task_status !== 'success' && /face_too_small|position_too_small/.test(res.error ?? '')) {
    res = await attempt(async () => runOn(await faceCrop(bytes)))
  }
  if (res.task_status !== 'success') return { ok: false, error: res.error || 'analysis_failed' }
  const url = (res.results as { url?: string })?.url
  if (!url) return { ok: false, error: 'no_result_url' }
  const zip = new Uint8Array(await (await fetch(url)).arrayBuffer())
  const files = unzipSync(zip)
  const scoreKey = Object.keys(files).find((k) => k.endsWith('score_info.json'))
  if (!scoreKey) return { ok: false, error: 'no_scores' }
  const info = JSON.parse(new TextDecoder().decode(files[scoreKey])) as Record<string, unknown>

  const uiScore = (v: unknown): number | undefined => {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (typeof o.ui_score === 'number') return o.ui_score
      if (o.whole && typeof (o.whole as Record<string, unknown>).ui_score === 'number') {
        return (o.whole as { ui_score: number }).ui_score
      }
      // regional (pore): average sub-scores
      const subs = Object.values(o).filter((x) => x && typeof x === 'object' && 'ui_score' in (x as object)) as { ui_score: number }[]
      if (subs.length) return Math.round(subs.reduce((s, x) => s + x.ui_score, 0) / subs.length)
    }
    return undefined
  }

  const concerns: SkinConcern[] = []
  for (const [key, label] of Object.entries(CONCERN_LABELS)) {
    const s = uiScore(info[key])
    if (typeof s === 'number') concerns.push({ key, label, score: s })
  }
  const st = info['hd_skin_type'] as { whole?: { skin_type?: string } } | undefined
  return { ok: true, concerns, skinType: st?.whole?.skin_type }
}
