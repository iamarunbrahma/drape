'use client'

import { useEffect, useRef, useState } from 'react'
import ByokKey from './ByokKey'
import { SAMPLES, type SampleData } from '@/lib/samples'

async function toJpeg(src: CanvasImageSource, w: number, h: number, maxPx = 1280): Promise<{ blob: Blob; url: string }> {
  const scale = Math.min(1, maxPx / Math.max(w, h))
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  canvas.getContext('2d')!.drawImage(src, 0, 0, cw, ch)
  const url = canvas.toDataURL('image/jpeg', 0.9)
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.9)!)
  return { blob, url }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

export default function Capture({
  onCapture,
  onSample,
  onBack,
  hint,
  detail,
  onRetry,
}: {
  onCapture: (blob: Blob, previewUrl: string) => void
  onSample: (sample: SampleData) => void
  onBack: () => void
  hint?: string
  /** the underlying cause, in the API's own words */
  detail?: string
  /** Present only when the last read timed out, so re-sending this photo can still pay off. */
  onRetry?: () => void
}) {
  const [camOpen, setCamOpen] = useState(false)
  const [camErr, setCamErr] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function openCam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 1280 } })
      streamRef.current = stream
      setCamOpen(true)
      setCamErr('')
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
    } catch {
      setCamErr('Camera unavailable. Upload a photo or use a sample instead.')
    }
  }

  async function shoot() {
    const v = videoRef.current
    if (!v) return
    const { blob, url } = await toJpeg(v, v.videoWidth, v.videoHeight)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setCamOpen(false)
    onCapture(blob, url)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const img = await loadImg(URL.createObjectURL(f))
    const { blob, url } = await toJpeg(img, img.naturalWidth, img.naturalHeight)
    onCapture(blob, url)
  }

  return (
    <div className="paper-grain min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <button onClick={onBack} className="text-sm text-ink-soft hover:text-ink">&larr; Back</button>
        <button onClick={onBack} className="font-display text-xl font-semibold transition hover:text-accent">
          Drape
        </button>
        <span className="w-12" />
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-28">
        <div className="fade-up text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Let&rsquo;s see your colors</h1>
          <p className="mx-auto mt-3 max-w-md text-ink-soft">
            Head and shoulders, squared to the camera, in even light. Keep your top in frame: the try-on needs something to dress. No filters, no makeup for the truest read.
          </p>
        </div>

        {hint && (
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-center text-sm text-accent">
            {hint}
            {/* The cause, verbatim. The guidance says what to do; this says what happened,
                so nobody has to take our word for which of the two went wrong. */}
            {detail && <span className="mt-1.5 block font-mono text-[11px] text-accent/70">{detail}</span>}
          </div>
        )}

        {camOpen ? (
          <div className="mx-auto mt-8 max-w-sm">
            <div className="overflow-hidden rounded-2xl border border-line bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-square w-full -scale-x-100 object-cover" />
            </div>
            <button onClick={shoot} className="mt-4 w-full rounded-full bg-ink py-3.5 text-sm font-medium text-paper hover:bg-accent">Capture</button>
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            {/* After a failed read the retry belongs beside the error. It used to sit 530px
                below it, behind three full-height sample cards, so on most screens the only
                way to try another photo was to scroll past everything with nothing saying
                so. When something went wrong, put the way to fix it first. */}
            {/* A read that timed out has no verdict yet: the work usually carries on and
                finishes a moment later, so asking for it again is the one action here that
                can come back instantly and cost nothing. It leads for that reason, and the
                other two, which both start a fresh read, follow it. */}
            {onRetry && (
              <div className="mx-auto max-w-md">
                <button
                  onClick={onRetry}
                  className="w-full rounded-xl border border-ink bg-ink py-4 text-sm font-medium text-paper transition hover:bg-accent"
                >
                  Retry this photo
                </button>
                <p className="mt-2 text-center text-xs text-ink-soft">
                  Picks up the same read if it has finished, without starting another.
                </p>
              </div>
            )}

            {hint && (
              <div className="mx-auto max-w-md">
                <ByokKey />
              </div>
            )}

            {hint && (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={openCam}
                  className={`rounded-xl py-4 text-sm font-medium transition ${
                    onRetry ? 'border border-line bg-paper-2/50 hover:border-accent' : 'border border-ink bg-ink text-paper hover:bg-accent'
                  }`}
                >
                  Try the camera
                </button>
                <label
                  className={`cursor-pointer rounded-xl py-4 text-center text-sm font-medium transition ${
                    onRetry ? 'border border-line bg-paper-2/50 hover:border-accent' : 'border border-ink bg-ink text-paper hover:bg-accent'
                  }`}
                >
                  Upload another photo
                  <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                </label>
              </div>
            )}

            <div>
              <p className="mb-3 meta text-ink-soft">{hint ? 'Or try a sample, instant & free' : 'Try a sample, instant & free'}</p>
              <div className="grid grid-cols-3 gap-3">
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSample(s)}
                    className="group overflow-hidden rounded-xl border border-line transition hover:border-accent hover:shadow-md"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.image} alt={s.label} className="aspect-[3/4] w-full object-cover transition group-hover:scale-105" />
                    <span className="block py-1.5 text-center text-xs text-ink-soft">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {!hint && (
              <div className="flex items-center gap-4 meta text-ink-soft">
                <span className="h-px flex-1 bg-line" /> or use your own <span className="h-px flex-1 bg-line" />
              </div>
            )}

            <div className={`grid gap-3 sm:grid-cols-2 ${hint ? 'hidden' : ''}`}>
              <button onClick={openCam} className="rounded-xl border border-line bg-paper-2/50 py-4 text-sm font-medium hover:border-accent">Use camera</button>
              <label className="cursor-pointer rounded-xl border border-line bg-paper-2/50 py-4 text-center text-sm font-medium hover:border-accent">
                Upload a photo
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
            </div>
            {camErr && <p className="text-center text-sm text-accent">{camErr}</p>}

            {/* Only one of these at a time: with an error on screen the key box has already
                been offered right beside it, where it is the answer to what just happened. */}
            {!hint && (
              <div className="mx-auto max-w-md text-center">
                <ByokKey />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
