// Nudges palette colors until no two are confusable, then prints the edits to apply.
//
// Hand-tuning this thrashes: moving a color away from one neighbour lands it on another,
// because 120 swatches across 12 seasons is a crowded space. So each stuck color is
// searched over a small grid in LCh, keeping its hue and taking the smallest move that
// clears every constraint. Hue is held because hue is what makes a color that color; only
// lightness and chroma give, which is exactly how seasons differ anyway.

import { ALL_SEASONS, getPalette, type Swatch } from '@/lib/color/palettes'
import { deltaEHex } from '@/lib/color/deltae'
import { hexToLab, rgbToHex, type Lab } from '@/lib/color/space'

/** The inverse of rgbToLab, matching its D65 white point exactly. Build-time only. */
function labToHex({ L, a, b }: Lab): string {
  const fy = (L + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787)
  const x = inv(fx) * 0.95047
  const y = inv(fy)
  const z = inv(fz) * 1.08883
  const rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
  const gl = x * -0.969266 + y * 1.8760108 + z * 0.041556
  const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252
  const enc = (c: number) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055
    return Math.round(Math.max(0, Math.min(1, v)) * 255)
  }
  return rgbToHex({ r: enc(rl), g: enc(gl), b: enc(bl) })
}

const WITHIN = 6
const CROSS = 5

const toLch = (hex: string) => {
  const { L, a, b } = hexToLab(hex)
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) }
}
const fromLch = ({ L, C, h }: { L: number; C: number; h: number }) =>
  labToHex({ L: Math.max(0, Math.min(100, L)), a: C * Math.cos(h), b: C * Math.sin(h) })

type Entry = { season: string; idx: number; sw: Swatch }
const all: Entry[] = []
const palettes = new Map(ALL_SEASONS.map((s) => [s, getPalette(s).colors.map((c) => ({ ...c }))]))
for (const [season, colors] of palettes) colors.forEach((sw, idx) => all.push({ season, idx, sw }))

/** Smallest distance from `hex` to anything it must stay clear of. */
function clearance(hex: string, self: Entry): number {
  let worst = Infinity
  for (const o of all) {
    if (o.season === self.season && o.idx === self.idx) continue
    const need = o.season === self.season ? WITHIN : CROSS
    const d = deltaEHex(hex, o.sw.hex)
    worst = Math.min(worst, d - need)
  }
  return worst
}

const changes: [string, string, string, string][] = []
for (let round = 0; round < 8; round++) {
  const stuck = all.filter((e) => clearance(e.sw.hex, e) < 0)
  if (!stuck.length) break
  // Fix the single worst offender per round so each move is re-evaluated against the rest.
  stuck.sort((a, b) => clearance(a.sw.hex, a) - clearance(b.sw.hex, b))
  const e = stuck[0]
  const base = toLch(e.sw.hex)
  let best = { hex: e.sw.hex, gain: clearance(e.sw.hex, e), move: Infinity }
  for (let dL = -14; dL <= 14; dL += 2)
    for (let dC = -18; dC <= 18; dC += 2) {
      const hex = fromLch({ L: base.L + dL, C: Math.max(0, base.C + dC), h: base.h })
      const gain = clearance(hex, e)
      const move = Math.hypot(dL, dC)
      if (gain >= 0 && (best.gain < 0 || move < best.move)) best = { hex, gain, move }
    }
  if (best.hex === e.sw.hex) { console.log(`could not clear ${e.season} ${e.sw.name}`); break }
  changes.push([e.season, e.sw.name, e.sw.hex, best.hex])
  e.sw.hex = best.hex
}

console.log(`${changes.length} colors moved:`)
for (const [s, n, from, to] of changes) console.log(`  ${s.padEnd(14)} ${n.padEnd(18)} ${from} -> ${to}`)
