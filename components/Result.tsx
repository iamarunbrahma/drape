'use client'

import { useState } from 'react'
import type { AnalyzeOk } from '@/lib/types'
import type { Axis, AxisValue } from '@/lib/color/season'
import Reveal from './Reveal'
import TryOnStudio, { type Precomputed } from './TryOnStudio'
import { downloadPaletteCard } from '@/lib/paletteCard'
import { matchGarments, CATALOG_SOURCE, CATALOG_MEASURED_AT } from '@/lib/catalog'
import { useUnavailable } from '@/lib/useAvailability'

export default function Result({
  result,
  personUrl,
  personBlob,
  precomputed,
  styledGender = 'female',
  onGenderChange,
  onCorrect,
  onResetCorrections,
  onRestart,
}: {
  result: AnalyzeOk
  personUrl: string
  personBlob: Blob | null
  precomputed?: Precomputed
  styledGender?: 'female' | 'male'
  onGenderChange: (g: 'female' | 'male') => void
  onCorrect: (axis: Axis, value: AxisValue) => void
  onResetCorrections: () => void
  onRestart: () => void
}) {
  const { palette, season } = result
  // Only show what can actually be bought. Excluding before the limit means a sold-out
  // colorway is replaced by the next closest one rather than leaving a gap. If the stock
  // check fails this set is empty, so the grid falls back to matching on color alone.
  const unavailable = useUnavailable()
  const matches = matchGarments(palette, styledGender, 8, unavailable)
  // The nonce lets you tap the same swatch twice and still be taken to the try-on.
  const [wear, setWear] = useState<{ hex: string; nonce: number }>()
  return (
    <div className="paper-grain min-h-dvh pb-24">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <button onClick={onRestart} className="font-display text-xl font-semibold transition hover:text-accent">
          Drape
        </button>
        <button onClick={onRestart} className="text-sm text-ink-soft hover:text-ink">Start over</button>
      </header>

      <Reveal
        result={result}
        onWear={(hex) => setWear((w) => ({ hex, nonce: (w?.nonce ?? 0) + 1 }))}
        onCorrect={onCorrect}
        onResetCorrections={onResetCorrections}
      />
      {/* Try-on, generative styling and the skin report are one studio with three tabs.
          They used to be three stacked sections drawing the same portrait three times. */}
      <TryOnStudio
        clothFileId={result.clothFileId}
        palette={palette}
        personUrl={personUrl}
        personBlob={personBlob}
        precomputed={precomputed}
        gender={styledGender}
        season={season.season}
        hairHex={result.tone.hair_color}
        onGenderChange={onGenderChange}
        unavailable={unavailable}
        wear={wear}
      />

      {/* Shop your palette: real garments, ranked by measured color distance */}
      <section className="mx-auto max-w-5xl px-6 pt-20">
        <div className="text-center">
          <p className="meta text-ink-soft">Analyze → try on → shop</p>
          <h2 className="mt-1 font-display text-4xl font-semibold tracking-tight md:text-5xl">Shop your palette</h2>
          <p className="mx-auto mt-3 max-w-lg text-ink-soft">
            Real garments, ranked by how close their color actually is to yours. We measured every
            one from the retailer&rsquo;s own fabric swatch, so these are matches, not keyword guesses.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {matches.map((g) => (
            <a
              key={g.id}
              href={g.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-xl border border-line bg-paper-2/40 transition hover:border-accent hover:shadow-sm"
            >
              <div className="relative aspect-[3/4] w-full" style={{ backgroundColor: g.measuredHex }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.imageUrl}
                  alt={`${g.retailer} ${g.name}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                />
                <span className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[10px] font-semibold font-mono tabular-nums text-ink shadow-sm">
                  ΔE {g.deltaE.toFixed(1)}
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-medium">{g.retailer} {g.name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-soft">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: g.measuredHex }} />
                  <span className="truncate">{g.colorName}, {g.verdict} to your {g.nearest.name}</span>
                </p>
              </div>
            </a>
          ))}
        </div>

        <p className="mt-5 text-center text-xs text-ink-soft">
          Color distance is CIEDE2000. Under 2.3 is a just-noticeable difference.
          Measured {CATALOG_MEASURED_AT} from the {CATALOG_SOURCE}; in stock, rechecked daily.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pt-20">
        <div className="overflow-hidden rounded-3xl bg-ink text-paper">
          <div className="grid gap-8 p-8 md:grid-cols-[1.2fr_1fr] md:p-12">
            <div>
              <p className="meta text-paper/60">Your palette card</p>
              <h2 className="mt-2 font-display text-4xl font-medium">{season.season}</h2>
              <p className="mt-2 max-w-sm text-paper/70">{palette.tagline}. Carry this with you when you shop, online or in store.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => downloadPaletteCard(result)}
                  className="rounded-full bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-accent hover:text-paper"
                >
                  Download your palette card ↓
                </button>
                <button onClick={onRestart} className="rounded-full border border-paper/30 px-6 py-3 text-sm font-medium text-paper hover:border-paper">
                  Analyze another photo
                </button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1.5 self-center">
              {[...palette.colors, ...palette.neutrals].slice(0, 12).map((c, i) => (
                <div key={c.hex + i} className="aspect-square rounded-md ring-1 ring-white/10" style={{ backgroundColor: c.hex }} />
              ))}
            </div>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-ink-soft">Drape · Skin AI + Apparel VTO · YouCam API by Perfect Corp.</p>
      </section>
    </div>
  )
}
