'use client'

import { useEffect, useState } from 'react'
import type { SkinReport as Report } from '@/lib/types'
import { ycPost } from '@/lib/byok'

/**
 * Band edges. The summary wording, the tick marks and the fill all read from these, so
 * they cannot drift apart: anything the summary calls out is the same thing its own row
 * labels "Watch". Set high because these scores cluster in the 60s and up -- on the old
 * 60/80 split almost everything landed in the top band and the scale said nothing.
 */
const WATCH_BELOW = 70
const EXCELLENT_AT = 90

/**
 * Fills stay full strength in all three bands: run through the palette validator against
 * this surface they pass the lightness, chroma, CVD and normal-vision checks, and dulling
 * the healthy ones to "de-emphasise" would have cost that. The emphasis comes from the
 * sort and the summary line instead. The gold sits under 3:1 on contrast, which the
 * per-row number and word alongside it relieve.
 */
function band(score: number): { hex: string; word: string } {
  if (score >= EXCELLENT_AT) return { hex: '#1f7d5b', word: 'Excellent' }
  if (score >= WATCH_BELOW) return { hex: '#c79320', word: 'Good' }
  return { hex: '#b5461f', word: 'Watch' }
}

export default function SkinReport({
  personBlob,
  precomputed,
  embedded = false,
  settled,
  onSettled,
}: {
  personBlob: Blob | null
  /** a real response captured earlier, used for the free sample faces */
  precomputed?: Report
  /** rendered inside the studio's tabs, which already supply the card and heading */
  embedded?: boolean
  /**
   * What a previous mount of this panel already found.
   *
   * Inside the studio this component lives behind a tab, so looking at Hair and coming
   * back unmounts it and throws its state away. Every return trip then re-ran the
   * slowest and most expensive call in the app to arrive at the answer it had already
   * had. The outcome is held by the studio instead, and handed back here.
   */
  settled?: Report | 'failed'
  onSettled?: (outcome: Report | 'failed') => void
}) {
  const known = precomputed ?? (settled && settled !== 'failed' ? settled : undefined)
  const [report, setReport] = useState<Report | null>(known ?? null)
  const [failed, setFailed] = useState(settled === 'failed')

  useEffect(() => {
    if (known || settled === 'failed' || !personBlob) return
    let alive = true
    const fd = new FormData()
    fd.append('image', personBlob, 'selfie.jpg')
    ycPost('/api/skin', fd)
      .then((r) => r.json())
      .then((d: Report) => {
        if (!alive) return
        if (d.ok && d.concerns?.length) {
          setReport(d)
          onSettled?.(d)
        } else {
          setFailed(true)
          onSettled?.('failed')
        }
      })
      .catch(() => {
        if (!alive) return
        setFailed(true)
        onSettled?.('failed')
      })
    return () => {
      alive = false
    }
    // onSettled is a setter from the studio and stable enough; re-running on its identity
    // would refetch on every parent render, which is the bug this exists to prevent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personBlob, known, settled])

  // Standing alone this section just disappears when the analysis is unavailable. Inside
  // the studio's tabs it cannot: the tab is already on screen, so returning nothing leaves
  // an empty card. Say why instead.
  if (failed) {
    return embedded ? (
      <p className="text-sm text-ink-soft">
        The skin report isn&rsquo;t available for this photo right now. Everything else on this
        page still works.
      </p>
    ) : null
  }

  const body = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!embedded && <p className="meta text-ink-soft">Bonus · Skin AI</p>}
          <h3 className="font-display text-2xl font-medium">Your skin at a glance</h3>
        </div>
        {report?.skinType && (
          <span className="rounded-full bg-ink px-4 py-1.5 text-sm text-paper">Skin type · {report.skinType}</span>
        )}
      </div>

        {!report ? (
          // This is the slowest call in the app: eleven concerns at HD, on an image we
          // upscale first, and it can run past half a minute. Bare bars gave no sign that
          // anything was happening, so a long wait was indistinguishable from a hang. The
          // spinner says it is working and the line underneath says it will be a moment,
          // which is the honest thing to say about a call this slow.
          <div className="mt-8">
            <div className="flex items-center gap-3">
              <span className="h-6 w-6 shrink-0 rounded-full border-2 border-ink/20 border-t-ink spin-slow" />
              <div>
                <p className="text-sm font-medium">Reading your skin</p>
                <p className="text-xs text-ink-soft">Eleven measurements at full resolution. This one takes a little longer.</p>
              </div>
            </div>
            <div className="mt-6 space-y-3" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 overflow-hidden rounded-full bg-line">
                  <div className="shimmer h-full w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          (() => {
            // Sorted worst-first, in one column. Unsorted across two columns, the question
            // this panel exists to answer -- which of these needs attention -- took eleven
            // comparisons and a scan back up. Sorted, the answer is the first row.
            const rows = [...report.concerns!].sort((a, b) => a.score - b.score)
            const watch = rows.filter((c) => c.score < WATCH_BELOW)
            return (
              <>
                <p className="mt-4 text-sm text-ink-soft">
                  {watch.length === 0
                    ? 'Every measure is in good range.'
                    : `${watch.length === 1 ? 'One area' : `${watch.length} areas`} to watch: ${watch
                        .map((c) => c.label.toLowerCase())
                        .join(', ')}.`}
                </p>

                <div className="mt-6 space-y-3.5">
                  {rows.map((c) => {
                    const b = band(c.score)
                    return (
                      <div key={c.key} className="grid grid-cols-[7.5rem_1fr_6rem] items-center gap-3 sm:grid-cols-[9rem_1fr_6rem]">
                        <span className="truncate text-sm">{c.label}</span>

                        <div className="relative h-2 rounded-full bg-line" title={`${c.label}: ${c.score} of 100 — ${b.word}`}>
                          {/* Square where it starts, rounded only at the data end: a pill
                              floating off the baseline overstates a low score. */}
                          <div
                            className="h-full rounded-r-full transition-all duration-700"
                            style={{ width: `${c.score}%`, backgroundColor: b.hex }}
                          />
                          {/* The thresholds the wording keys off, drawn where they are. */}
                          {[WATCH_BELOW, EXCELLENT_AT].map((t) => (
                            <span
                              key={t}
                              aria-hidden
                              className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-ink/15"
                              style={{ left: `${t}%` }}
                            />
                          ))}
                        </div>

                        <span className="flex items-baseline justify-end gap-2 text-sm">
                          <span className="font-mono tabular-nums text-ink-soft">{c.score}</span>
                          {/* Status never rides on colour alone. */}
                          <span className="w-16 text-right text-xs text-ink-soft">{b.word}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* The scale cue belongs on the scale, not in a footnote under it: without
                    it, "Redness 99" reads as an alarm right up until you find the legend. */}
                {/* Same column template as the rows above, so the end cap sits exactly over
                    the end of the tracks rather than near it. */}
                <div className="mt-3 grid grid-cols-[7.5rem_1fr_6rem] gap-3 sm:grid-cols-[9rem_1fr_6rem]">
                  <span />
                  <span className="flex justify-between text-[11px] text-ink-soft">
                    <span>0 · low</span>
                    <span>100 · ideal</span>
                  </span>
                  <span />
                </div>
              </>
            )
          })()
        )}
      <p className="mt-6 text-xs text-ink-soft">
        Dermatologist-grade scores from the YouCam Skin Analysis API.
      </p>
    </>
  )

  if (embedded) return body
  return (
    <section className="mx-auto max-w-5xl px-6 pt-20">
      <div className="rounded-3xl border border-line bg-paper-2/50 p-8 md:p-10">{body}</div>
    </section>
  )
}
