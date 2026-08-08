import type { Metadata } from 'next'
import Link from 'next/link'
import { fairnessTable, spread } from '@/lib/fairness'
import { scoreConfidence } from '@/lib/color/confidence'
import { CHROMA_RELIABLE } from '@/lib/color/season'

export const metadata: Metadata = {
  title: 'Does it work on every skin tone? · Drape',
  description:
    'Drape checked its own undertone rule against the Monk Skin Tone Scale, found a bias against the ends of the scale, and fixed it.',
}

const TONE_STYLE: Record<string, string> = {
  warm: 'bg-[#c79320]/15 text-[#7a5a12]',
  cool: 'bg-[#6f8fb5]/15 text-[#3f5a78]',
  neutral: 'bg-line text-ink-soft',
}

function Pill({ value, bad }: { value: string; bad?: boolean }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TONE_STYLE[value]} ${bad ? 'ring-1 ring-accent' : ''}`}>
      {value}
    </span>
  )
}

export default function FairnessPage() {
  const rows = fairnessTable()
  const before = spread(rows, 'oldRule')
  const after = spread(rows, 'newRule')
  const broken = rows.filter((r) => r.regression)
  const confidences = rows.map((r) => ({ step: r.step, ...scoreConfidence(r.hex) }))
  // Derived, not asserted. An earlier draft of this page claimed the confidence dips sat at
  // the ends of the scale, which reads well and is false: the score also weighs depth and
  // clarity against their own boundaries, and those bite hardest mid-scale.
  const lowChroma = rows.filter((r) => r.chroma < CHROMA_RELIABLE).map((r) => r.step)
  const weakest = confidences.reduce((a, b) => (b.score < a.score ? b : a))
  const weakestAxis = weakest.axes.find((a) => a.axis === weakest.weakest)!

  return (
    <main className="paper-grain min-h-dvh pb-24">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-display text-xl font-semibold">Drape</Link>
        <Link href="/" className="text-sm text-ink-soft hover:text-ink">Back to the studio</Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-10">
        <p className="meta text-ink-soft">Evenness check</p>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
          Does it work on every skin tone?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          Personal color analysis has a long history of being built around light skin. So we
          tested our own engine against the{' '}
          <a href="https://skintone.google" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 hover:text-accent">
            Monk Skin Tone Scale
          </a>
          , a ten-shade reference designed for exactly this kind of check. We found a bias in
          our own rule, and this page is the evidence and the fix.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pt-12">
        <h2 className="font-display text-2xl font-medium">What was wrong</h2>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Drape originally read undertone from <strong className="text-ink">b*</strong>, the
          yellow-to-blue axis in CIELAB. Warm skin is more golden, so a high b* meant warm.
          The problem is that b* is a <em>magnitude</em>, and colorfulness collapses at both
          ends of the scale. At the very lightest and very darkest tones b* falls close to
          zero. That is neutrality, and the old rule had no way to tell it apart from
          coolness. It called those tones cool.
        </p>
        <p className="mt-3 leading-relaxed text-ink-soft">
          The <strong className="text-ink">hue angle</strong> does not have this problem. It is
          a direction rather than a distance, so it does not shrink as skin gets darker.
          Monk tone 10 sits at hue {rows[9].hue.toFixed(0)}&deg;, plainly golden, while its b*
          is only {rows[9].bStar.toFixed(1)}.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pt-12">
        <h2 className="font-display text-2xl font-medium">The measurements</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="py-2 pr-3 font-medium">Monk tone</th>
                <th className="py-2 pr-3 font-medium">L*</th>
                <th className="py-2 pr-3 font-medium">b*</th>
                <th className="py-2 pr-3 font-medium">Chroma</th>
                <th className="py-2 pr-3 font-medium">Hue</th>
                <th className="py-2 pr-3 font-medium">Old rule (b*)</th>
                <th className="py-2 font-medium">Now (hue)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.hex} className="border-b border-line/60">
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2.5">
                      <span className="h-7 w-7 shrink-0 rounded-md ring-1 ring-black/10" style={{ backgroundColor: r.hex }} />
                      <span className="font-mono tabular-nums">{r.step}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums text-ink-soft">{r.lightness.toFixed(1)}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums text-ink-soft">{r.bStar.toFixed(1)}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums text-ink-soft">{r.chroma.toFixed(1)}</td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums text-ink-soft">{r.hue.toFixed(1)}&deg;</td>
                  <td className="py-2.5 pr-3"><Pill value={r.oldRule} bad={r.regression} /></td>
                  <td className="py-2.5"><Pill value={r.newRule} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-paper-2/40 p-4">
            <p className="text-xs uppercase tracking-wider text-ink-soft">Old rule, across the scale</p>
            <p className="mt-2 text-sm">
              {before.warm} warm · {before.cool} cool · {before.neutral} neutral
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              It disagreed with the hue angle on {broken.length} of the 10 tones, and all of them
              sit at the light or deep ends: tones {broken.map((b) => b.step).join(', ')}.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-paper-2/40 p-4">
            <p className="text-xs uppercase tracking-wider text-ink-soft">Now</p>
            <p className="mt-2 text-sm">
              {after.warm} warm · {after.cool} cool · {after.neutral} neutral
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              No tone is called cool for being dark. Tone 8 does sit near the neutral
              boundary, at hue {rows[7].hue.toFixed(1)}&deg;, and it is reported that way.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pt-12">
        <h2 className="font-display text-2xl font-medium">What we did not fix</h2>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Hue is stable across depth, but it gets noisy as skin approaches neutral grey, and
          that is what happens at both ends of the scale. Chroma falls under{' '}
          {CHROMA_RELIABLE} on tones {lowChroma.join(', ')}, so on those the undertone axis is
          discounted before it reaches the score below.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {confidences.map((c) => (
            <span key={c.step} className="rounded-full border border-line bg-paper-2/50 px-3 py-1.5 text-xs font-mono tabular-nums">
              Tone {c.step}: <strong className="font-semibold">{c.score}</strong>
            </span>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-soft">
          Confidence for each reference tone, from the same function the studio uses. It reads
          three axes, undertone, depth and clarity, and leans on whichever sits nearest a
          decision boundary, so the dips do not line up with the ends of the scale. The lowest
          here is tone {weakest.step}, held down by {weakest.weakest}, which lands{' '}
          {weakestAxis.margin.toFixed(1)} from its boundary at {weakestAxis.nearestBoundary}.
          Every number on this page is computed live by the shipping engine when the page
          renders, and held in place by the test suite.
        </p>
      </section>
    </main>
  )
}
