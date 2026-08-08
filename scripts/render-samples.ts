// Pre-renders the try-on image for every color in each sample's palette.
//
// The sample path has to be free and instant (it is what a judge sees first), so its
// try-ons are baked at build time rather than called live. Previously only a handful of
// colors were baked, and TryOnStudio silently hid the rest, so most of the palette was
// not tappable. This renders the full set: every palette color, plus the hero and the
// clashing color used by the comparison.
//
// It goes through the exact production path (recolorTee -> YouCam cloth try-on), so a
// baked image is pixel-identical to what a live upload would produce.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/render-samples.ts [--dry] [id...]
// Naming samples limits the run to those. The medium face is slow enough (see ATTEMPTS)
// that it is worth being able to finish the others without queueing behind it.
// Costs YouCam units: about 2 per rendered color. Failed attempts are free.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { SAMPLES } from '@/lib/samples'
import { classifySeason } from '@/lib/color/season'
import { getPalette } from '@/lib/color/palettes'
import { uploadPersonForCloth, tryOnColor, CLOTH_FEATURE, type ClothFeature } from '@/lib/youcam/tryon'
import { getUnits } from '@/lib/youcam/client'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'public', 'samples', 'precomputed')
const DRY = process.argv.includes('--dry')
const ONLY = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--')))

/**
 * The medium face is a tight head-and-shoulders crop with only a sliver of collar, and the
 * default endpoint cannot repaint it: 15 consecutive `error_editing_failed` for a single
 * color, against a 2.6% success rate overall. v3 renders it first try, so this one face is
 * baked with v3 even though the live path stays on v2 (see CLOTH_FEATURE).
 */
const FEATURE: Record<string, ClothFeature> = { medium: 'cloth-v3' }

/** Every color the UI can ask a sample to render. */
function wanted(sample: (typeof SAMPLES)[number]): string[] {
  const season = classifySeason({ skinToneHex: sample.tone.skin_color, eyeHex: sample.tone.eye_color })
  const palette = getPalette(season.season)
  return [...new Set([palette.hero.hex, ...palette.colors.map((c) => c.hex), palette.clash.hex].map((h) => h.toLowerCase()))]
}

/**
 * The cloth model returns `error_editing_failed` on a large share of otherwise-identical
 * requests, and how often depends on the photo: the deep and light faces succeed almost
 * every time, the medium one about one try in five, because it is a tight head-and-
 * shoulders crop with only a sliver of collar to repaint. It does succeed, so ask again.
 * A failed task costs no units, only time, and this runs offline.
 */
const ATTEMPTS = 15

async function render(fileId: string, hex: string, feature: ClothFeature): Promise<{ url?: string; error?: string; tries: number }> {
  let error = 'not attempted'
  for (let tries = 1; tries <= ATTEMPTS; tries++) {
    const res = await tryOnColor(fileId, hex, 'upper_body', undefined, feature)
    if (res.ok && res.imageUrl) return { url: res.imageUrl, tries }
    error = res.error ?? 'unknown'
    await new Promise((r) => setTimeout(r, 1500))
  }
  return { error, tries: ATTEMPTS }
}

async function main() {
  let rendered = 0
  const failures: string[] = []

  for (const sample of SAMPLES) {
    if (ONLY.size && !ONLY.has(sample.id)) continue
    const need = wanted(sample)
    const dir = path.join(OUT, sample.id)
    await mkdir(dir, { recursive: true })

    // Ask the disk, not samples.ts, so a re-run only picks up what is still missing.
    const onDisk = new Set((await readdir(dir)).map((f) => `#${path.parse(f).name.toLowerCase()}`))
    const missing = need.filter((h) => !onDisk.has(h))

    console.log(`\n${sample.label}: ${need.length} colors, ${onDisk.size} on disk, ${missing.length} to render`)
    console.log(`  full set: ${need.join(' ')}`)
    if (!missing.length || DRY) continue

    // One upload of the person photo, reused for every color on this sample.
    const feature = FEATURE[sample.id] ?? CLOTH_FEATURE
    const person = await readFile(path.join(ROOT, 'public', sample.image.replace(/^\//, '')))
    const fileId = await uploadPersonForCloth(person, undefined, feature)
    if (feature !== CLOTH_FEATURE) console.log(`  using ${feature}`)

    for (const hex of missing) {
      const res = await render(fileId, hex, feature)
      if (!res.url) {
        console.log(`  ${hex}  FAILED after ${res.tries}  ${res.error}`)
        failures.push(`${sample.id} ${hex}`)
        continue
      }
      const bytes = Buffer.from(await (await fetch(res.url)).arrayBuffer())
      await writeFile(path.join(dir, `${hex.slice(1)}.jpg`), bytes)
      rendered++
      console.log(`  ${hex}  ok  ${(bytes.length / 1024).toFixed(0)}kB  (${res.tries} ${res.tries === 1 ? 'try' : 'tries'})`)
    }
  }

  console.log(`\nrendered ${rendered}, failed ${failures.length}${failures.length ? `: ${failures.join(', ')}` : ''}`)
  if (!DRY) console.log(`units left ${await getUnits()}`)
}

main()
