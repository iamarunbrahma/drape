// CIEDE2000 perceptual color difference.
//
// Plain CIELAB euclidean distance overstates differences in the blue region and
// understates them for near-neutrals, so "is this garment actually your color?"
// needs the 2000 revision. Implemented from Sharma, Wu & Dalal (2005) and checked
// against that paper's 34-pair reference table in deltae.test.ts.

import { hexToLab, type Lab } from './space'

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

/** Perceptual distance between two CIELAB colors. 0 is identical; ~2.3 is a just-noticeable difference. */
export function deltaE2000(a: Lab, b: Lab, kL = 1, kC = 1, kH = 1): number {
  const C1 = Math.hypot(a.a, a.b)
  const C2 = Math.hypot(b.a, b.b)
  const Cbar = (C1 + C2) / 2

  const Cbar7 = Cbar ** 7
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)))

  const a1p = (1 + G) * a.a
  const a2p = (1 + G) * b.a
  const C1p = Math.hypot(a1p, a.b)
  const C2p = Math.hypot(a2p, b.b)

  const hp = (bb: number, ap: number) => {
    if (bb === 0 && ap === 0) return 0
    const h = Math.atan2(bb, ap) * DEG
    return h >= 0 ? h : h + 360
  }
  const h1p = hp(a.b, a1p)
  const h2p = hp(b.b, a2p)

  const dLp = b.L - a.L
  const dCp = C2p - C1p

  let dhp: number
  if (C1p * C2p === 0) dhp = 0
  else {
    const diff = h2p - h1p
    if (Math.abs(diff) <= 180) dhp = diff
    else if (diff > 180) dhp = diff - 360
    else dhp = diff + 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD)

  const Lbarp = (a.L + b.L) / 2
  const Cbarp = (C1p + C2p) / 2

  let hbarp: number
  if (C1p * C2p === 0) hbarp = h1p + h2p
  else {
    const sum = h1p + h2p
    const diff = Math.abs(h1p - h2p)
    if (diff <= 180) hbarp = sum / 2
    else if (sum < 360) hbarp = (sum + 360) / 2
    else hbarp = (sum - 360) / 2
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * RAD) +
    0.24 * Math.cos(2 * hbarp * RAD) +
    0.32 * Math.cos((3 * hbarp + 6) * RAD) -
    0.2 * Math.cos((4 * hbarp - 63) * RAD)

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2))
  const Cbarp7 = Cbarp ** 7
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7))
  const RT = -RC * Math.sin(2 * dTheta * RAD)

  const Lbarp50 = (Lbarp - 50) ** 2
  const SL = 1 + (0.015 * Lbarp50) / Math.sqrt(20 + Lbarp50)
  const SC = 1 + 0.045 * Cbarp
  const SH = 1 + 0.015 * Cbarp * T

  const tL = dLp / (kL * SL)
  const tC = dCp / (kC * SC)
  const tH = dHp / (kH * SH)

  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH)
}

/** Convenience wrapper for the common "compare two hex colors" case. */
export function deltaEHex(hex1: string, hex2: string): number {
  return deltaE2000(hexToLab(hex1), hexToLab(hex2))
}

/**
 * How a ΔE reads to a person. Thresholds follow the usual perceptibility bands:
 * under 1 is invisible, under ~2.3 is a just-noticeable difference.
 */
export function describeDeltaE(dE: number): string {
  if (dE < 1) return 'an exact match'
  if (dE < 2.3) return 'indistinguishable by eye'
  if (dE < 5) return 'very close'
  if (dE < 10) return 'close'
  if (dE < 25) return 'in the same family'
  return 'a different color'
}
