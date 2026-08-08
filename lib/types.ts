import type { SeasonResult } from '@/lib/color/season'
import type { Palette } from '@/lib/color/palettes'

export type { SeasonResult, Palette }
export type { Swatch } from '@/lib/color/palettes'

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

export interface AnalyzeOk {
  ok: true
  tone: ToneColors
  faceQuality: FaceQuality
  season: SeasonResult
  palette: Palette
  clothFileId: string
}
export interface AnalyzeErr {
  ok: false
  error: string
  /** what to do about it */
  message?: string
  /** what actually happened, in the API's own words */
  detail?: string
  faceQuality?: FaceQuality
}
export type AnalyzeResult = AnalyzeOk | AnalyzeErr

export interface TryOnResult {
  ok: boolean
  error?: string
  imageUrl?: string
}

export interface SkinConcern { key: string; label: string; score: number }
export interface SkinReport {
  ok: boolean
  error?: string
  concerns?: SkinConcern[]
  skinType?: string
}

/**
 * Why a try-on could not be rendered, in words a person can act on.
 *
 * The cloth endpoint is fussier about framing than the tone analysis is: it wants to see a
 * body to dress, and rejects a tight head crop with `error_pose`. That failure used to
 * surface as a shimmer that never resolved, which reads as a hang rather than an answer.
 */
export const TRYON_HINTS: Record<string, string> = {
  error_pose:
    'This photo is framed too close for the try-on. One showing your head and shoulders, squared to the camera, works best.',
  error_editing_failed:
    'The try-on could not render this shade on this photo. Another shade often works, or try a photo with more of your top in frame.',
  no_result_url: 'The try-on came back empty. Try again in a moment.',
}

export const TRYON_FALLBACK = 'The try-on could not be rendered for this photo.'

/** Friendly guidance for the capture step, keyed by YouCam error codes. */
export const FACE_HINTS: Record<string, string> = {
  analysis_timeout:
    'The read did not come back in time. It may still be finishing.',
  error_no_face: "We couldn't find a face. Make sure your face is centered and visible.",
  error_face_not_forward_facing: 'Look straight at the camera. Turn to face forward.',
  error_face_angle_upward: 'Tilt your chin down a little and face the camera.',
  error_face_angle_downward: 'Lift your chin a little and face the camera.',
  error_face_angle_leftward: 'Turn slightly right so you face the camera.',
  error_face_angle_rightward: 'Turn slightly left so you face the camera.',
  error_face_position_too_small: 'Move closer. Your face should fill most of the frame.',
  error_below_min_image_size: 'That image is a little small. Try a higher-resolution photo.',
  analysis_failed: 'Analysis failed. Try a clear, front-facing, well-lit photo.',
}
