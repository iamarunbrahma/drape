'use client'

import { useState } from 'react'
import type { Palette } from '@/lib/types'
import { hairAdvice } from '@/lib/color/hair'
import { describeDeltaE } from '@/lib/color/deltae'
import { ycPost, isTimeout } from '@/lib/byok'

/**
 * The fourth color YouCam measures.
 *
 * `skin-tone-analysis` returns skin, eyes, lips and hair, and for a long time we read
 * three of those and dropped the last one on the floor. Hair is an axis of seasonal
 * analysis in its own right, so this compares the hair the wearer actually has against the
 * shades their season calls for, and then puts one on them.
 *
 * Unlike the generative styling, the hair endpoint honours the exact hex it is given, so
 * this half can promise a color and mean it.
 */
export default function HairPanel({
  palette,
  measuredHex,
  bakedSeason,
  picked,
  onPick,
  personUrl,
  personBlob,
  baked,
  onResult,
  busy,
  onBusy,
}: {
  palette: Palette
  /** hair color as measured from the photo */
  measuredHex: string
  /** the season this face is baked for, when it is a sample */
  bakedSeason?: string
  /** which shade is chosen, held by the studio so a tab switch does not forget it */
  picked: string | null
  onPick: (hex: string | null) => void
  personUrl: string
  personBlob: Blob | null
  /** hex -> pre-rendered image, present on the free sample path */
  baked?: Record<string, string>
  onResult: (url: string | null, hex?: string) => void
  /** Held by the studio, because the wait is most visible over the photo, not over here. */
  busy: boolean
  onBusy: (b: boolean) => void
}) {
  const [msg, setMsg] = useState('')
  const advice = hairAdvice(measuredHex, palette)
  // A sample face is baked for the season it measures as. Correcting the read moves the
  // palette somewhere we hold no renders for, and the sample path has to stay free, so
  // there is nothing to call: say so rather than firing a request that cannot be served.
  const offBaked = !!baked && !!bakedSeason && bakedSeason !== palette.season

  async function wear(hex: string) {
    onPick(hex)
    setMsg('')
    const ready = baked?.[hex.toLowerCase()]
    if (ready) return onResult(ready)
    if (offBaked) return

    onBusy(true)
    onResult(null)
    try {
      const blob = personBlob ?? (await (await fetch(personUrl)).blob())
      const fd = new FormData()
      fd.append('image', blob, 'me.jpg')
      fd.append('hex', hex)
      const r = await ycPost('/api/hair', fd)
      const d = await r.json()
      if (d.ok && d.imageUrl) onResult(d.imageUrl, hex)
      else setMsg(d.message || 'Could not render that shade. Try again.')
    } catch (e) {
      setMsg(isTimeout(e) ? 'That took too long. Try again.' : 'Something went wrong. Try again.')
    } finally {
      onBusy(false)
    }
  }

  return (
    <div>
      <p className="meta text-ink-soft">Also read from your photo</p>
      <h3 className="mt-1 font-display text-2xl font-medium">Your hair, in your season</h3>

      <p className="mt-2 text-sm text-ink-soft">
        The same read that gave us your skin, eyes and lips also measured your hair. Seasonal
        analysis treats hair as part of the picture, so here is what yours says.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span className="h-10 w-10 shrink-0 rounded-full shadow-sm ring-1 ring-black/10" style={{ backgroundColor: measuredHex }} />
        <div className="text-sm">
          <div className="font-medium">
            Measured <span className="font-mono text-[13px] uppercase text-ink-soft">{measuredHex}</span>
          </div>
          <div className="text-ink-soft">
            {advice.verdict} <span className="font-mono tabular-nums">ΔE {advice.deltaE.toFixed(1)}</span>,{' '}
            {describeDeltaE(advice.deltaE)}.
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm text-ink-soft">
        {palette.season} hair runs {palette.hair.map((h) => h.name.toLowerCase()).join(', ')}.{' '}
        {offBaked
          ? `This face is only pre-rendered as ${bakedSeason}, so upload your own photo to see these on you.`
          : 'Tap one to see it on you.'}
      </p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {/* A way back. Without this the only route to your own hair was reloading the page,
            which also threw away everything else you had done. It leads the row because it
            is where you started, and it carries your measured color so the row reads as one
            set of choices rather than three shades and an escape hatch. */}
        {!offBaked && (
          <button
            onClick={() => {
              onPick(null)
              onResult(null)
            }}
            disabled={busy}
            className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition disabled:opacity-60 ${
              picked === null ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink/40'
            }`}
          >
            <span className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ backgroundColor: measuredHex }} />
            Your own
          </button>
        )}

        {palette.hair.map((shade) => {
          const isSel = picked?.toLowerCase() === shade.hex.toLowerCase()
          // The shade being rendered is the one just tapped, so the spinner belongs in its
          // own swatch: the wait then has a source rather than floating under the row.
          const isWorking = busy && isSel
          const chip = (
            <>
              <span className="relative h-6 w-6 rounded-full ring-1 ring-black/10" style={{ backgroundColor: shade.hex }}>
                {isWorking && (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/80 border-t-transparent spin-slow" />
                  </span>
                )}
              </span>
              {shade.name}
            </>
          )
          // With nothing to render these on, a disabled button is still a button: it invites
          // a click and answers with nothing, which reads as broken rather than unavailable.
          // Show the shades as labels instead, so the only thing that looks pressable is.
          return offBaked ? (
            <span
              key={shade.hex}
              className="flex items-center gap-2 rounded-full border border-dashed border-line py-1.5 pl-1.5 pr-3.5 text-sm text-ink-soft"
            >
              {chip}
            </span>
          ) : (
            <button
              key={shade.hex}
              onClick={() => wear(shade.hex)}
              disabled={busy}
              className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition disabled:opacity-60 ${
                isSel ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink/40'
              }`}
            >
              {chip}
            </button>
          )
        })}
      </div>

      {msg && <p className="mt-3 text-sm text-accent">{msg}</p>}

      <p className="mt-5 text-xs text-ink-soft">
        Hair color is the one YouCam endpoint that takes an exact hex, so these are the shades
        themselves rather than an impression of them.
      </p>
    </div>
  )
}
