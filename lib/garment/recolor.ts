import 'server-only'
import sharp from 'sharp'
import { hexToRgb } from '@/lib/color/space'
import { BASE_TEE_JPEG_B64 } from './base-tee'

const BASE = Buffer.from(BASE_TEE_JPEG_B64, 'base64')

/**
 * Recolor a light garment image to `hex` while preserving fabric shading, via a multiply
 * blend (white -> target color, shadows stay dark). Returns JPEG bytes.
 */
export async function recolorGarment(base: Buffer, hex: string): Promise<Buffer> {
  const { r, g, b } = hexToRgb(hex)
  const meta = await sharp(base).metadata()
  const width = meta.width ?? 768
  const height = meta.height ?? 768
  return sharp(base)
    .composite([{ input: { create: { width, height, channels: 3, background: { r, g, b } } }, blend: 'multiply' }])
    .jpeg({ quality: 88 })
    .toBuffer()
}

/**
 * Recolor the clean white base tee. This is what makes the try-on show the user's EXACT
 * palette color.
 */
export function recolorTee(hex: string): Promise<Buffer> {
  return recolorGarment(BASE, hex)
}
