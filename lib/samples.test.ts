import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { SAMPLES } from './samples'
import { classifySeason } from './color/season'
import { getPalette } from './color/palettes'

const PUBLIC = path.resolve(import.meta.dirname, '..', 'public')

// The sample path is what a first-time visitor and a judge see, and it is served entirely
// from disk. A promised try-on with no file behind it is a broken image; a palette color
// with no promised try-on is a swatch the picker silently drops. Both happened.
describe('sample try-on renders', () => {
  for (const sample of SAMPLES) {
    describe(sample.label, () => {
      const palette = getPalette(classifySeason({ skinToneHex: sample.tone.skin_color, eyeHex: sample.tone.eye_color }).season)

      it('has a render for every palette color, plus the hero and the clash', () => {
        const promised = new Set(Object.keys(sample.tryons))
        for (const hex of [palette.hero.hex, ...palette.colors.map((c) => c.hex), palette.clash.hex]) {
          expect(promised, hex).toContain(hex.toLowerCase())
        }
      })

      it('points the comparison at the palette hero and clash, not a stale copy', () => {
        expect(sample.heroHex).toBe(palette.hero.hex)
        expect(sample.clashHex).toBe(palette.clash.hex)
      })

      it('has every promised image on disk', () => {
        const missing = Object.entries(sample.tryons)
          .filter(([, url]) => !existsSync(path.join(PUBLIC, url)))
          .map(([hex]) => hex)
        expect(missing).toEqual([])
      })

      it('has the face photo on disk', () => {
        expect(existsSync(path.join(PUBLIC, sample.image))).toBe(true)
      })
    })
  }
})
