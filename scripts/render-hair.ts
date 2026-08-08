// Pre-renders each sample face in its season's hair shades.
//
// Same reasoning as render-samples: the sample path has to stay free and instant, so what
// a judge sees is baked rather than called. Hair-color is one unit a shade, so all three
// faces cost nine.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/render-hair.ts [id...]

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { SAMPLES } from '@/lib/samples'
import { classifySeason } from '@/lib/color/season'
import { getPalette } from '@/lib/color/palettes'
import { tryHairColor } from '@/lib/youcam/tryon'
import { getUnits } from '@/lib/youcam/client'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'public', 'samples', 'hair')
const ONLY = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--')))

async function main() {
  let rendered = 0
  for (const sample of SAMPLES) {
    if (ONLY.size && !ONLY.has(sample.id)) continue
    const palette = getPalette(classifySeason({ skinToneHex: sample.tone.skin_color, eyeHex: sample.tone.eye_color }).season)
    const dir = path.join(OUT, sample.id)
    await mkdir(dir, { recursive: true })
    const onDisk = new Set((await readdir(dir)).map((f) => `#${path.parse(f).name.toLowerCase()}`))
    const missing = palette.hair.filter((h) => !onDisk.has(h.hex.toLowerCase()))

    console.log(`\n${sample.label} (${palette.season}): ${missing.length} of ${palette.hair.length} to render`)
    if (!missing.length) continue
    const person = await readFile(path.join(ROOT, 'public', sample.image.replace(/^\//, '')))

    for (const shade of missing) {
      const res = await tryHairColor(person, shade.hex)
      if (!res.ok || !res.imageUrl) {
        console.log(`  ${shade.hex} ${shade.name}  FAILED  ${res.error}`)
        continue
      }
      const bytes = Buffer.from(await (await fetch(res.imageUrl)).arrayBuffer())
      await writeFile(path.join(dir, `${shade.hex.slice(1)}.jpg`), bytes)
      rendered++
      console.log(`  ${shade.hex} ${shade.name.padEnd(20)} ok  ${(bytes.length / 1024).toFixed(0)}kB`)
    }
  }
  console.log(`\nrendered ${rendered}, units left ${await getUnits()}`)
}
main()
