'use client'

import { useState } from 'react'
import { ycPost, isTimeout } from '@/lib/byok'
import type { Season } from '@/lib/color/season'
import ByokKey from './ByokKey'

async function asBlob(personUrl: string, personBlob: Blob | null): Promise<Blob> {
  if (personBlob) return personBlob
  return (await fetch(personUrl)).blob()
}

/**
 * The controls for the generative styling, sitting under the color picker so both live in
 * one frame and share one portrait.
 *
 * It cannot be driven by the selected swatch: YouCam's scarf endpoint takes its cue from
 * `style` and ignores the reference image's color, so asking for Warm Pink came back olive.
 * The copy therefore promises a look for your season, which is what actually steers it,
 * and points at the picker above as the accurate half.
 *
 * The styling register is asked for rather than guessed. It could be inferred from the
 * photo, but guessing wrong means dressing someone as something they are not, and the
 * question is cheap to ask.
 */
export default function StyledLook({
  personUrl,
  personBlob,
  gender,
  season,
  onGenderChange,
  onResult,
  hasSwatches = true,
}: {
  personUrl: string
  personBlob: Blob | null
  gender: 'female' | 'male'
  season: Season
  onGenderChange: (g: 'female' | 'male') => void
  onResult: (url: string | null) => void
  /** false when the picker above it is empty, so the divider has nothing to divide */
  hasSwatches?: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function generate() {
    setStatus('loading')
    setMsg('')
    onResult(null)
    try {
      const blob = await asBlob(personUrl, personBlob)
      const fd = new FormData()
      fd.append('image', blob, 'me.jpg')
      fd.append('gender', gender)
      fd.append('season', season)
      const r = await ycPost('/api/styled', fd)
      const d = await r.json()
      if (d.ok && d.imageUrl) {
        onResult(d.imageUrl)
        setStatus('done')
      } else {
        setStatus('error')
        setMsg(d.message || 'Could not generate a styled look. Try again.')
      }
    } catch (e) {
      setStatus('error')
      setMsg(isTimeout(e) ? 'That took too long. Try again.' : 'Something went wrong. Try again.')
    }
  }

  return (
    <div className={hasSwatches ? 'mt-7 border-t border-line pt-6' : 'mt-5'}>
      <h4 className="font-display text-lg font-medium">See a whole outfit</h4>
      <p className="mt-1.5 text-sm text-ink-soft">
        {hasSwatches ? (
          <>
            The swatches above are exact. This is the opposite: YouCam&rsquo;s generative AI invents
            a complete {season} look, clothes and setting and all. Take it as inspiration, and the
            picker as the accurate half.
          </>
        ) : (
          <>
            YouCam&rsquo;s generative AI invents a complete {season} look, clothes and setting and
            all. It works on any photo, so a corrected read is no obstacle. Take it as inspiration
            rather than an exact color match.
          </>
        )}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-line bg-paper p-1 text-sm">
          {(['female', 'male'] as const).map((g) => (
            <button
              key={g}
              onClick={() => onGenderChange(g)}
              className={`rounded-full px-4 py-1.5 capitalize transition ${gender === g ? 'bg-ink text-paper' : 'text-ink-soft'}`}
            >
              {g === 'female' ? 'Feminine' : 'Masculine'}
            </button>
          ))}
        </div>
        <button
          onClick={generate}
          disabled={status === 'loading'}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-accent disabled:opacity-60"
        >
          {status === 'loading' ? 'Styling…' : status === 'done' ? 'Style another' : 'Style a full look'}
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-accent">{msg}</p>}
      <ByokKey />
    </div>
  )
}
