// Generates the demo voiceover from docs/video-script.md using Sarvam TTS.
//
// One audio file per narration beat, plus a concatenated master with a short pause
// between beats. Per-beat durations are printed so the screen capture can be cut
// against them.
//
// Run: node --env-file=.env.local scripts/build-voiceover.mjs

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const OUT = new URL('../docs/voiceover/', import.meta.url)
const SPEAKER = process.env.VO_SPEAKER ?? 'ashutosh'
const MODEL = process.env.VO_MODEL ?? 'bulbul:v3'
// v3 rejects pitch and loudness outright ("not supported for the Bulbul v3 model"), so the
// prosody arc below falls back to pace alone on that model. v3 earns its place anyway: v2
// swallows the D in "Drape" and reads it as a word we cannot ship.
const SUPPORTS_PITCH = !MODEL.includes('v3')
// Sarvam's own pace control. `karun` reads slowly enough to push the cut past the
// hackathon's hard 3:00 ceiling, and nudging pace is cleaner than post-hoc atempo.
const PACE = Number(process.env.VO_PACE ?? 1.12)

/**
 * Per-beat prosody, so the read has an arc instead of eighteen identical sentences.
 * A single global pitch just transposes the whole voice; what stops it sounding flat is
 * varying delivery with the content. Values are deltas applied on top of PACE.
 * Pitch is roughly -0.75..0.75 on bulbul:v2; these are deliberately small, because past
 * about 0.2 the timbre starts sounding synthetic.
 */
const PROSODY = {
  1: { pitch: 0.04, pace: -0.04 }, // the hook, let the image breathe
  2: { pitch: 0.02, pace: -0.08 }, // "This is Drape": the one beat that must land
  3: { pitch: 0.02, pace: -0.02 },
  4: { pitch: 0.00, pace: -0.06 }, // explains what a season is, so slow down
  5: { pitch: 0.10, pace: -0.04 }, // the turn, lean in
  6: { pitch: -0.02, pace: -0.02 },
  7: { pitch: 0.14, pace: -0.04 }, // "you can overrule it", playful
  8: { pitch: 0.04, pace: +0.02 },
  9: { pitch: 0.08, pace: -0.02 }, // the proof
  10: { pitch: 0.10, pace: -0.02 },
  11: { pitch: 0.10, pace: -0.04 },
  12: { pitch: 0.00, pace: +0.02 },
  13: { pitch: 0.02, pace: -0.02 },
  14: { pitch: -0.02, pace: +0.04 },
  15: { pitch: 0.00, pace: +0.04 },
  16: { pitch: -0.14, pace: -0.04 }, // the admission, lower and slower
  17: { pitch: 0.02, pace: +0.06 }, // spec list, move through it
  18: { pitch: 0.06, pace: -0.08 }, // the close, restate the product warmly
}
/**
 * Display text is written for humans; this is what the voice actually receives.
 *
 * Sarvam reads en-IN, so initialisms get run together into a word ("MCP" as "mssp")
 * and compound brand names get an unexpected stress. Spacing the letters forces a
 * letter-by-letter read. Keep the script readable and fix it here, once.
 * Order matters: longer patterns first so they win.
 */
const SAY = [
  // Confirmed by ear: hyphenated spell-outs land, spaced capitals do not.
  [/\bAPIs\b/g, "ay-pee-eyes"],
  [/\bAPI\b/g, 'ay-pee-eye'],
  [/\bMCP\b/g, 'em-see-pee'],
  [/\bYouCam\b/g, 'You Cam'],
  [/\bAI\b/g, 'ay-eye'],
  [/\bCIEDE ?2000\b/g, 'C I E D E two thousand'],
  [/\bCIELAB\b/g, 'C E LAB'],
  [/\bITA\b/g, 'I T A'],
]

/**
 * Whether to apply the spell-outs above.
 *
 * bulbul:v2 needed them. bulbul:v3 says the initialisms correctly on its own, verified
 * by ear, so the default is off and the script is sent as written. Set VO_SPELL_OUT=1 if
 * you switch back to a model that runs them together.
 */
const SPELL_OUT = process.env.VO_SPELL_OUT === '1'

/** Rewrite one narration beat into what the voice should say. */
function forSpeech(text) {
  if (!SPELL_OUT) return text
  return SAY.reduce((t, [pattern, spoken]) => t.replace(pattern, spoken), text)
}

const GAP_SECONDS = 0.45

const key = process.env.SARVAM_API_KEY
if (!key) {
  console.error('SARVAM_API_KEY missing. Run with: node --env-file=.env.local scripts/build-voiceover.mjs')
  process.exit(1)
}

/** Pull the narration beats out of the script's "Narration only" section. */
async function beats() {
  const md = await readFile(new URL('../docs/video-script.md', import.meta.url), 'utf8')
  const marker = '<!-- narration-start -->'
  const start = md.indexOf(marker)
  if (start < 0) throw new Error(`could not find ${marker} in the script`)
  return md
    .slice(start + marker.length)
    .split(/^---$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('#') && !s.startsWith('<!--'))
}

/**
 * Sarvam splits longer text into several *complete* WAV files rather than one stream.
 * They cannot be Buffer.concat'd: that leaves a second RIFF header mid-file and every
 * player stops at the first one, silently dropping the rest of the sentence. Write each
 * part out and let ffmpeg join them properly.
 */
async function speak(text, outPath, prosody = {}) {
  const r = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      target_language_code: 'en-IN',
      speaker: SPEAKER,
      model: MODEL,
      pace: +(PACE + (prosody.pace ?? 0)).toFixed(3),
      ...(SUPPORTS_PITCH ? { pitch: prosody.pitch ?? 0 } : {}),
    }),
  })
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  if (!j.audios?.length) throw new Error('no audio returned')

  if (j.audios.length === 1) {
    await writeFile(outPath, Buffer.from(j.audios[0], 'base64'))
    return 1
  }
  const parts = []
  for (const [i, a] of j.audios.entries()) {
    const p = `${outPath}.part${i}.wav`
    await writeFile(p, Buffer.from(a, 'base64'))
    parts.push(p)
  }
  const list = `${outPath}.parts.txt`
  await writeFile(list, parts.map((p) => `file '${p}'`).join('\n') + '\n')
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', outPath])
  await Promise.all([...parts, list].map((p) => rm(p, { force: true })))
  return j.audios.length
}

const duration = async (f) => {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f])
  return parseFloat(stdout.trim())
}

await mkdir(OUT, { recursive: true })
const lines = await beats()
console.log(`${lines.length} beats, ${MODEL} voice "${SPEAKER}", pace ${PACE}${SUPPORTS_PITCH ? "" : " (pitch unsupported)"}\n`)

const files = []
let total = 0
for (const [i, text] of lines.entries()) {
  const f = new URL(`beat-${String(i + 1).padStart(2, '0')}.wav`, OUT)
  await speak(forSpeech(text), f.pathname, PROSODY[i + 1] ?? {})
  const d = await duration(f.pathname)
  // A rough words-per-minute check catches silently dropped audio. Short one-line beats
  // legitimately read fast, so only judge beats long enough for the rate to mean anything.
  const words = text.split(/\s+/).length
  const wpm = (words / d) * 60
  if (words > 20 && wpm > 240) console.warn(`  beat ${i + 1} reads at ${wpm.toFixed(0)} wpm, audio may be truncated`)
  files.push(f.pathname)
  const start = total
  total += d + GAP_SECONDS
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  console.log(`  ${String(i + 1).padStart(2)}  ${mmss(start)}  ${d.toFixed(1)}s  ${text.slice(0, 62)}${text.length > 62 ? '…' : ''}`)
}

// Concatenate with a short silence between beats.
const silence = new URL('gap.wav', OUT).pathname
await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=22050:cl=mono`, '-t', String(GAP_SECONDS), silence])
const listFile = new URL('concat.txt', OUT).pathname
await writeFile(listFile, files.map((f) => `file '${f}'\nfile '${silence}'`).join('\n') + '\n')
const master = new URL('voiceover.wav', OUT).pathname
await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', master])

const d = await duration(master)
console.log(`\nvoiceover.wav  ${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, '0')}  (${d.toFixed(1)}s)`)
if (d > 180) console.warn('OVER the 3:00 limit, trim a beat')
