// Pure color-space utilities. No I/O. The foundation of the Drape engine.

export interface Rgb { r: number; g: number; b: number }
export interface Lab { L: number; a: number; b: number }

/** Parse "#rrggbb" or "rrggbb" (also short "#rgb") into 0-255 RGB. */
export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) throw new Error(`invalid hex: ${hex}`)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** sRGB channel (0-255) -> linear light (0-1). */
function srgbToLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** RGB (0-255, sRGB) -> CIELAB (D65). */
export function rgbToLab(rgb: Rgb): Lab {
  const rl = srgbToLinear(rgb.r)
  const gl = srgbToLinear(rgb.g)
  const bl = srgbToLinear(rgb.b)
  // linear sRGB -> XYZ (D65)
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041
  // normalize by D65 white point
  const xn = x / 0.95047
  const yn = y / 1.0
  const zn = z / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(xn)
  const fy = f(yn)
  const fz = f(zn)
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex))
}

/** CIELAB hue angle in degrees [0,360). For skin this lands ~40-70°. */
export function labHue({ a, b }: Lab): number {
  const deg = (Math.atan2(b, a) * 180) / Math.PI
  return (deg + 360) % 360
}

/** CIELAB chroma (colorfulness). */
export function labChroma({ a, b }: Lab): number {
  return Math.hypot(a, b)
}

/**
 * Individual Typology Angle (ITA°) — the dermatology-standard skin-depth metric.
 * Higher = lighter skin. ITA = atan2(L*-50, b*) in degrees.
 */
export function ita(lab: Lab): number {
  return (Math.atan2(lab.L - 50, lab.b) * 180) / Math.PI
}
