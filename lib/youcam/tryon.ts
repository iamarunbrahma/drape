import 'server-only'
import { uploadFile, runTask, type Creds } from './client'
import { recolorTee } from '@/lib/garment/recolor'
import { BASE_SCARF_JPEG_B64 } from '@/lib/garment/base-scarf'
import type { Season } from '@/lib/color/season'

export type GarmentCategory = 'upper_body' | 'lower_body' | 'full_body'

/**
 * Which generation of the AI Clothes endpoint to call.
 *
 * v3 is far more robust on tightly cropped portraits: on our medium sample, a head-and-
 * shoulders shot with only a sliver of collar to repaint, `cloth` returned
 * `error_editing_failed` on 15 consecutive attempts for a color v3 rendered first try.
 *
 * It is not the default because it is also more generative: it re-renders the face,
 * visibly smoothing skin and hair. The whole claim here is that these are *your* colors on
 * *your* photo, so v2 stays in the live path, where it is both color-faithful and leaves
 * the person alone, and v3 is reserved for photos v2 cannot render at all.
 */
export type ClothFeature = 'cloth' | 'cloth-v3'
export const CLOTH_FEATURE: ClothFeature = 'cloth'

/** Upload a person photo for cloth try-on; returns a reusable file_id. */
export async function uploadPersonForCloth(bytes: Buffer, creds?: Creds, feature: ClothFeature = CLOTH_FEATURE): Promise<string> {
  return uploadFile(feature, bytes, creds)
}

export interface TryOnResult {
  ok: boolean
  error?: string
  imageUrl?: string
}

/**
 * Try a garment in an exact `hex` color on the person: recolor the base tee to that
 * color, then run YouCam cloth try-on (color-faithful). Returns an image URL.
 */
export async function tryOnColor(
  personClothFileId: string,
  hex: string,
  category: GarmentCategory = 'upper_body',
  creds?: Creds,
  feature: ClothFeature = CLOTH_FEATURE,
): Promise<TryOnResult> {
  const garment = await recolorTee(hex)
  const refId = await uploadFile(feature, garment, creds)
  const res = await runTask(feature, { src_file_id: personClothFileId, ref_file_id: refId, garment_category: category }, creds)
  if (res.task_status !== 'success') return { ok: false, error: res.error || 'tryon_failed' }
  const url = (res.results as { url?: string })?.url
  return url ? { ok: true, imageUrl: url } : { ok: false, error: 'no_result_url' }
}

export type ScarfStyle =
  | 'random' | 'style_french_elegance' | 'style_light_luxury'
  | 'style_cottagecore' | 'style_modern_chic' | 'style_bohemian'

const SCARF_REF = Buffer.from(BASE_SCARF_JPEG_B64, 'base64')

/**
 * Which editorial register suits a season. Clarity mostly decides it: bright seasons can
 * carry a polished, high-gloss look, soft seasons want something gentler, and the deep
 * seasons take the sharpest one. Without this the styling was `random`, which meant the
 * one place the app is generative was the one place the analysis did not reach.
 */
const SEASON_STYLE: Record<Season, ScarfStyle> = {
  'Light Spring': 'style_cottagecore',
  'True Spring': 'style_bohemian',
  'Bright Spring': 'style_light_luxury',
  'Light Summer': 'style_cottagecore',
  'True Summer': 'style_french_elegance',
  'Soft Summer': 'style_french_elegance',
  'Soft Autumn': 'style_cottagecore',
  'True Autumn': 'style_bohemian',
  'Deep Autumn': 'style_modern_chic',
  'Deep Winter': 'style_modern_chic',
  'True Winter': 'style_french_elegance',
  'Bright Winter': 'style_light_luxury',
}

export function styleForSeason(season: Season): ScarfStyle {
  return SEASON_STYLE[season] ?? 'random'
}

/**
 * "Your styled look" — a generative editorial styling using the scarf endpoint. Produces
 * a full styled scene (does NOT preserve exact palette color — it's aspirational styling).
 *
 * It deliberately does NOT take a color. We tried tinting the reference image to the shade
 * being worn: asking for Warm Pink returned an olive jacket, asking for Clear Blue returned
 * a lilac sweater and a grey coat. The endpoint takes its cue from `style` and ignores the
 * reference's color, so plumbing one through would only imply a link that is not there.
 */
export async function styledLook(
  personBytes: Buffer,
  gender: 'female' | 'male',
  style: ScarfStyle = 'random',
  creds?: Creds,
): Promise<TryOnResult> {
  const [src, ref] = await Promise.all([uploadFile('scarf', personBytes, creds), uploadFile('scarf', SCARF_REF, creds)])
  const res = await runTask('scarf', { src_file_id: src, ref_file_id: ref, gender, style }, creds)
  if (res.task_status !== 'success') return { ok: false, error: res.error || 'styled_failed' }
  const url = (res.results as { url?: string })?.url
  return url ? { ok: true, imageUrl: url } : { ok: false, error: 'no_result_url' }
}

/**
 * Recolor the wearer's hair to an exact hex with YouCam's hair-color VTO.
 *
 * Unlike the scarf endpoint, this one really does honour the color it is given: it takes a
 * hex directly rather than inferring one from a reference image, so a palette shade lands
 * as that shade. It is also the cheapest feature we call, at one unit.
 */
export async function tryHairColor(
  personBytes: Buffer,
  hex: string,
  creds?: Creds,
  intensity = 80,
): Promise<TryOnResult> {
  const src = await uploadFile('hair-color', personBytes, creds)
  const res = await runTask(
    'hair-color',
    { src_file_id: src, pattern: { name: 'full' }, palettes: [{ color: hex, color_intensity: intensity }] },
    creds,
  )
  if (res.task_status !== 'success') return { ok: false, error: res.error || 'hair_failed' }
  const url = (res.results as { url?: string })?.url
  return url ? { ok: true, imageUrl: url } : { ok: false, error: 'no_result_url' }
}
