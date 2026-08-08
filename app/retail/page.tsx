'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { products, rankAgainstPalette, type Garment } from '@/lib/catalog'
import { classifySeason } from '@/lib/color/season'
import { getPalette } from '@/lib/color/palettes'
import { SAMPLES } from '@/lib/samples'

// A mock product page, to show what the engine looks like as a retailer widget.
// Everything here runs client-side from the pure color engine: a retailer reordering
// colorways for a shopper never has to send the shopper's photo anywhere.

const GENDER: Record<string, 'female' | 'male'> = { deep: 'male', medium: 'female', light: 'female' }

function Swatch({ g, rank, best }: { g: Garment & { deltaE?: number; verdict?: string }; rank?: number; best?: boolean }) {
  const flattering = g.deltaE !== undefined && g.deltaE <= 15
  return (
    <div className={`relative rounded-xl border p-2 transition ${best ? 'border-ink shadow-sm' : 'border-line'} ${g.deltaE !== undefined && !flattering ? 'opacity-45' : ''}`}>
      <div className="aspect-square w-full overflow-hidden rounded-lg ring-1 ring-black/10" style={{ backgroundColor: g.measuredHex }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.imageUrl} alt={g.colorName} loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
      </div>
      <p className="mt-1.5 truncate text-[11px] font-medium">{g.colorName}</p>
      {g.deltaE !== undefined ? (
        <p className="text-[10px] font-mono tabular-nums text-ink-soft">ΔE {g.deltaE.toFixed(1)}</p>
      ) : (
        <p className="text-[10px] text-ink-soft">&nbsp;</p>
      )}
      {best && (
        <span className="absolute -top-2 left-2 rounded-full bg-ink px-2 py-0.5 text-[9px] font-semibold text-paper">
          Your color
        </span>
      )}
      {rank !== undefined && (
        <span className="absolute right-2 top-2 rounded-full bg-paper/90 px-1.5 text-[9px] font-semibold font-mono tabular-nums text-ink-soft shadow-sm">
          {rank}
        </span>
      )}
    </div>
  )
}

export default function RetailPage() {
  const [sampleId, setSampleId] = useState<string | null>(null)

  const sample = SAMPLES.find((s) => s.id === sampleId) ?? null
  const gender = sample ? GENDER[sample.id] : 'male'

  const season = useMemo(
    () => (sample ? classifySeason({ skinToneHex: sample.tone.skin_color, eyeHex: sample.tone.eye_color }) : null),
    [sample],
  )
  const palette = season ? getPalette(season.season) : null

  // Show a product where the reordering is actually meaningful for this shopper. Picking
  // purely by colorway count can land on an item with nothing in their palette, which
  // demonstrates the opposite of the point. Rank by the strongest single match, then by
  // how many of the remaining colorways also suit them.
  const product = useMemo(() => {
    const list = products(gender).filter((p) => p.colorways.length >= 6)
    if (!palette) return list[0]
    const stats = list.map((p) => {
      const ranked = rankAgainstPalette(p.colorways, palette)
      return { p, top: ranked[0].deltaE, suit: ranked.filter((g) => g.deltaE <= 15).length }
    })
    stats.sort((a, b) => a.top - b.top || b.suit - a.suit)
    return stats[0].p
  }, [gender, palette])

  const ordered = useMemo(() => {
    if (!palette) return product.colorways.map((g) => ({ ...g })) as Array<Garment & { deltaE?: number; verdict?: string }>
    return rankAgainstPalette(product.colorways, palette)
  }, [product, palette])

  const wearable = palette ? ordered.filter((g) => (g.deltaE ?? 99) <= 15).length : null

  return (
    <main className="paper-grain min-h-dvh pb-24">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-display text-xl font-semibold">Drape</Link>
        <Link href="/" className="text-sm text-ink-soft hover:text-ink">Back to the studio</Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-8 text-center">
        <p className="meta text-ink-soft">For retailers</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          The same product page, reordered for the shopper
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-ink-soft">
          Size, fit and color drive around 45% of apparel returns. Color is the part a palette
          can actually fix. This is a mock product page using real colorways: pick a shopper
          and watch the swatches reorder.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pt-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setSampleId(null)}
            className={`rounded-full border px-4 py-2 text-sm transition ${!sample ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink/40'}`}
          >
            No shopper (retailer order)
          </button>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSampleId(s.id)}
              className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-sm transition ${sampleId === s.id ? 'border-ink bg-ink text-paper' : 'border-line hover:border-ink/40'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image} alt={s.label} className="h-7 w-7 rounded-full object-cover" />
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-4xl px-6">
        <div className="rounded-3xl border border-line bg-paper-2/40 p-6 md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-soft">{product.retailer}</p>
              <h2 className="font-display text-2xl font-medium">{product.name}</h2>
            </div>
            <p className="text-sm text-ink-soft">{product.colorways.length} colors</p>
          </div>

          {season && palette ? (
            <div className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm">
              <span className="font-medium">{season.season}</span>
              <span className="text-ink-soft">
                {' '}· {wearable} of {product.colorways.length} colors in this product suit this shopper.
                Sorted by measured color distance, closest first.
              </span>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink-soft">
              Showing the retailer&rsquo;s own order. Pick a shopper above to reorder.
            </p>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
            {ordered.map((g, i) => (
              <Swatch
                key={g.id}
                g={g}
                rank={palette ? i + 1 : undefined}
                // only crown a winner when the winner is genuinely in the palette
                best={!!palette && i === 0 && (g.deltaE ?? 99) <= 15}
              />
            ))}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-ink-soft">
            Ranking is CIEDE2000 against the shopper&rsquo;s palette, using colors measured from
            {' '}{product.retailer}&rsquo;s own fabric swatches. Dimmed swatches are beyond ΔE 15,
            where the color stops being flattering. The whole computation is client-side and
            deterministic, so the shopper&rsquo;s photo never has to leave their device.
          </p>
        </div>
      </section>
    </main>
  )
}
