'use client'

import { useMemo, useState } from 'react'
import type { AnalyzeOk } from '@/lib/types'
import type { Axis, AxisValue } from '@/lib/color/season'
import { scoreConfidence, type ConfidenceLevel } from '@/lib/color/confidence'

function readable(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#201d18' : '#f6f2ea'
}

const OPTIONS: Record<Axis, readonly AxisValue[]> = {
  undertone: ['warm', 'neutral', 'cool'],
  depth: ['light', 'medium', 'deep'],
  clarity: ['bright', 'true', 'soft'],
}

const LEVEL_COPY: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

const LEVEL_TONE: Record<ConfidenceLevel, string> = {
  high: 'text-[#4a6b4f]',
  medium: 'text-[#8a6a2f]',
  low: 'text-accent',
}

const LEVEL_FILL: Record<ConfidenceLevel, string> = {
  high: 'bg-[#6f8f73]',
  medium: 'bg-[#c0912f]',
  low: 'bg-accent',
}

/** One axis of the read. Tap to correct it; the season re-derives locally, for free. */
function AxisChip({
  axis,
  value,
  weak,
  corrected,
  open,
  onToggle,
  onPick,
}: {
  axis: Axis
  value: string
  weak: boolean
  corrected: boolean
  open: boolean
  onToggle: () => void
  onPick: (v: AxisValue) => void
}) {
  const label = axis[0].toUpperCase() + axis.slice(1)
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`rounded-full border px-3.5 py-1.5 text-sm transition hover:border-ink/40 ${
          corrected ? 'border-ink bg-ink text-paper' : weak ? 'border-accent/50 bg-paper-2/60' : 'border-line bg-paper-2/60'
        }`}
      >
        <span className={corrected ? 'text-paper/70' : 'text-ink-soft'}>{label} </span>
        <span className="font-medium capitalize">{value}</span>
        <span className={`ml-1.5 text-[10px] ${corrected ? 'text-paper/60' : 'text-ink-soft'}`} aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-xl border border-line bg-paper p-1.5 shadow-lg">
          <div className="flex gap-1">
            {OPTIONS[axis].map((opt) => (
              <button
                key={opt}
                onClick={() => onPick(opt)}
                className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${
                  opt === value ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-2'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Reveal({
  result,
  onWear,
  onCorrect,
  onResetCorrections,
}: {
  result: AnalyzeOk
  onWear: (hex: string) => void
  onCorrect: (axis: Axis, value: AxisValue) => void
  onResetCorrections: () => void
}) {
  const { season, palette, tone, faceQuality } = result
  const [openAxis, setOpenAxis] = useState<Axis | null>(null)

  const confidence = useMemo(
    () => scoreConfidence(tone.skin_color, faceQuality, tone.eye_color, season.corrected),
    [tone.skin_color, tone.eye_color, faceQuality, season.corrected],
  )

  const coloring = [
    { label: 'Skin', hex: tone.skin_color },
    { label: 'Eyes', hex: tone.eye_color },
    { label: 'Lips', hex: tone.lip_color },
  ]
  const axes: Array<[Axis, string]> = [
    ['undertone', season.undertone],
    ['depth', season.depth],
    ['clarity', season.clarity],
  ]
  const hasCorrections = season.corrected.length > 0

  return (
    <section className="mx-auto max-w-5xl px-6 pt-16 text-center">
      <p className="fade-up meta text-ink-soft">Your season is</p>
      <h1 className="fade-up mt-3 font-display text-6xl font-semibold leading-none tracking-tight md:text-8xl" style={{ animationDelay: '0.05s' }}>
        {season.season}
      </h1>
      <p className="fade-up mt-4 font-display text-xl italic text-accent" style={{ animationDelay: '0.1s' }}>
        {palette.tagline}
      </p>

      {/* relative z-20: `fade-up` animates opacity, so each row forms its own stacking
          context. Without this the correction dropdown paints behind the card below. */}
      <div className="fade-up relative z-20 mt-7 flex flex-wrap justify-center gap-2.5" style={{ animationDelay: '0.15s' }}>
        {axes.map(([axis, value]) => (
          <AxisChip
            key={axis}
            axis={axis}
            value={value}
            weak={confidence.weakest === axis && confidence.level !== 'high'}
            corrected={season.corrected.includes(axis)}
            open={openAxis === axis}
            onToggle={() => setOpenAxis((a) => (a === axis ? null : axis))}
            onPick={(v) => {
              onCorrect(axis, v)
              setOpenAxis(null)
            }}
          />
        ))}
      </div>

      {/* How sure the engine is, and why. Shown before you are asked to believe it. */}
      <div className="fade-up mx-auto mt-6 max-w-lg rounded-2xl border border-line bg-paper-2/40 p-5 text-left" style={{ animationDelay: '0.17s' }}>
        <div className="flex items-baseline justify-between gap-3">
          <span className={`text-sm font-semibold ${LEVEL_TONE[confidence.level]}`}>
            {LEVEL_COPY[confidence.level]}
          </span>
          <span className="text-xs font-mono tabular-nums text-ink-soft">{confidence.score} / 100</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
          <div className={`h-full rounded-full transition-all duration-500 ${LEVEL_FILL[confidence.level]}`} style={{ width: `${confidence.score}%` }} />
        </div>
        <ul className="mt-3 space-y-1.5">
          {confidence.reasons.map((r) => (
            <li key={r} className="text-xs leading-relaxed text-ink-soft">{r}</li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
          {hasCorrections ? (
            <>
              You corrected {season.corrected.join(' and ')}. Re-derived instantly, with no re-upload and no API cost.{' '}
              <button onClick={onResetCorrections} className="font-medium text-ink underline underline-offset-2 hover:text-accent">
                Reset to the measured read
              </button>
            </>
          ) : (
            <>Not what you see in the mirror? Tap any of the three above to correct it. Your season re-derives instantly, at no cost.</>
          )}
        </p>
      </div>

      <p className="fade-up mt-4 text-xs text-ink-soft" style={{ animationDelay: '0.19s' }}>
        Deterministic color science (CIELAB · ITA°), calibrated on real skin data. Not an LLM guess.{' '}
        <a href="/fairness" className="text-ink underline underline-offset-2 hover:text-accent">
          See how it holds up across skin tones
        </a>
      </p>

      {/* Your natural coloring, straight from the skin-tone AI */}
      <div className="fade-up mt-10" style={{ animationDelay: '0.2s' }}>
        <p className="mb-3 meta text-ink-soft">Read from your photo</p>
        <div className="flex justify-center gap-5">
          {coloring.map((c) => (
            <div key={c.label} className="text-center">
              <div className="mx-auto h-14 w-14 rounded-full shadow-sm ring-1 ring-black/10" style={{ backgroundColor: c.hex }} />
              <div className="mt-2 text-xs font-medium">{c.label}</div>
              <div className="text-[11px] uppercase text-ink-soft">{c.hex}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Why these colors */}
      <p className="fade-up mx-auto mt-10 max-w-xl text-lg leading-relaxed text-ink-soft" style={{ animationDelay: '0.25s' }}>
        {palette.why}
      </p>

      {/* The palette */}
      <div className="mt-12">
        <p className="mb-4 meta text-ink-soft">Your palette</p>
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 md:grid-cols-10">
          {palette.colors.map((c, i) => (
            /* Tapping a swatch wears it: jumps to the try-on and renders that shade. The
               palette is the first place you meet these colors, so it should be the first
               place you can act on them. */
            <button
              key={c.hex + i}
              onClick={() => onWear(c.hex)}
              title={`${c.name} — see it on you`}
              aria-label={`Try on ${c.name}`}
              className="swatch-in group w-full"
              style={{ animationDelay: `${0.3 + i * 0.04}s` }}
            >
              {/* The swatch is always visible; only its label fades in on hover. Putting
                  the opacity on this box hid the entire palette until you hovered it. */}
              <div
                className="flex aspect-square items-end justify-center rounded-lg p-1.5 shadow-sm ring-1 ring-black/5"
                style={{ backgroundColor: c.hex }}
              >
                <span
                  className="text-[9px] font-medium opacity-0 transition group-hover:opacity-100"
                  style={{ color: readable(c.hex) }}
                >
                  {c.name}
                </span>
              </div>
            </button>
          ))}
        </div>
        {/* These sat unlabelled under the palette, so there was no way to tell what they
            were or why they differed from the swatches above. */}
        <p className="meta mt-8 text-ink-soft">Your neutrals</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          Your base layer: a pale, a mid, and the deepest tone this season carries. They are
          picked to sit underneath the colors above without competing with them.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {palette.neutrals.map((c) => (
            <span key={c.hex} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-soft">
              <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: c.hex }} />
              {c.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
