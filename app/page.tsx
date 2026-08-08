'use client'

import { useMemo, useState } from 'react'
import Landing from '@/components/Landing'
import Capture from '@/components/Capture'
import Result from '@/components/Result'
import type { Precomputed } from '@/components/TryOnStudio'
import { FACE_HINTS, type AnalyzeResult, type AnalyzeOk } from '@/lib/types'
import { classifySeason, type SeasonOverrides } from '@/lib/color/season'
import { getPalette } from '@/lib/color/palettes'
import type { SampleData } from '@/lib/samples'
import { ycPost, isTimeout, YC_TIMEOUT_MS } from '@/lib/byok'

type Step = 'landing' | 'capture' | 'analyzing' | 'result'

const SAMPLE_GENDER: Record<string, 'female' | 'male'> = { deep: 'male', medium: 'female', light: 'female' }
const PHASES = ['Reading your skin tone', 'Finding your undertone', 'Matching your season', 'Building your palette']

function Analyzing({ personUrl }: { personUrl: string }) {
  return (
    <div className="paper-grain grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <div className="relative mx-auto h-40 w-40">
          <div className="absolute inset-0 animate-ping rounded-full bg-accent/10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={personUrl} alt="you" className="relative h-40 w-40 rounded-full object-cover shadow-md ring-4 ring-paper" />
          <span className="absolute -inset-1 rounded-full border-2 border-accent/40 border-t-accent spin-slow" />
        </div>
        <h2 className="mt-8 font-display text-3xl font-medium">Reading your colors&hellip;</h2>
        <div className="mt-4 space-y-1 text-sm text-ink-soft">
          {PHASES.map((p, i) => (
            <p key={p} className="fade-up" style={{ animationDelay: `${i * 0.8}s` }}>{p}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const [step, setStep] = useState<Step>('landing')
  const [result, setResult] = useState<AnalyzeOk | null>(null)
  const [personUrl, setPersonUrl] = useState('')
  const [personBlob, setPersonBlob] = useState<Blob | null>(null)
  const [precomputed, setPrecomputed] = useState<Precomputed | undefined>()
  const [styledGender, setStyledGender] = useState<'female' | 'male'>('female')
  const [hint, setHint] = useState<string | undefined>()
  // What actually went wrong, in the API's own words, shown under the guidance.
  const [detail, setDetail] = useState<string | undefined>()
  const [overrides, setOverrides] = useState<SeasonOverrides>({})
  // Whether the last failure is worth re-sending the same photo for. See handleCapture.
  const [canRetry, setCanRetry] = useState(false)

  // A correction re-derives the season locally from the same measured colors.
  // The engine is pure, so this costs nothing and needs no re-upload.
  const view = useMemo<AnalyzeOk | null>(() => {
    if (!result) return null
    const season = classifySeason(
      { skinToneHex: result.tone.skin_color, eyeHex: result.tone.eye_color },
      overrides,
    )
    return { ...result, season, palette: getPalette(season.season) }
  }, [result, overrides])

  function handleSample(s: SampleData) {
    setOverrides({})
    const season = classifySeason({ skinToneHex: s.tone.skin_color, eyeHex: s.tone.eye_color })
    const palette = getPalette(season.season)
    setResult({
      ok: true,
      tone: s.tone,
      faceQuality: { has_face: true, area: 'good', frontal: 'good', lighting: 'good', faceangle: 'good' },
      season,
      palette,
      clothFileId: '',
    })
    setPersonUrl(s.image)
    setPersonBlob(null)
    setPrecomputed({ tryons: s.tryons, hairShots: s.hairShots, heroHex: s.heroHex, clashHex: s.clashHex, measuredSeason: s.measuredSeason, skin: s.skin })
    setStyledGender(SAMPLE_GENDER[s.id] ?? 'female')
    setStep('result')
  }

  async function handleCapture(blob: Blob, url: string) {
    setPersonBlob(blob)
    setPersonUrl(url)
    setPrecomputed(undefined)
    setStyledGender('female')
    setHint(undefined)
    setCanRetry(false)
    setOverrides({})
    setStep('analyzing')
    try {
      const fd = new FormData()
      fd.append('image', blob, 'selfie.jpg')
      const r = await ycPost('/api/analyze', fd)
      const d = (await r.json()) as AnalyzeResult & { message?: string }
      if (d.ok) {
        setResult(d)
        setStep('result')
      } else {
        setHint(d.message || FACE_HINTS[d.error] || FACE_HINTS.analysis_failed)
        setDetail(d.detail)
        // Only a timeout is worth re-sending. Every other failure is a verdict on the
        // photo, and sending the same pixels again would spend units to be told the same
        // thing. A read that ran out of time has no verdict yet.
        setCanRetry(d.error === 'analysis_timeout')
        setStep('capture')
      }
    } catch (e) {
      const timedOut = isTimeout(e)
      setCanRetry(timedOut)
      setHint(
        timedOut
          ? 'That took too long to answer. It may still be finishing.'
          : 'Something went wrong. Please try again.',
      )
      setDetail(timedOut ? `the request passed ${YC_TIMEOUT_MS / 1000} seconds without an answer` : e instanceof Error ? e.message : undefined)
      setStep('capture')
    }
  }

  // The hint describes one attempt at one photo. It used to survive going back to the
  // landing page and starting again, so a fresh visitor was greeted by a failure that
  // belonged to a photo they never uploaded. Leaving the screen ends the message.
  function leaveCapture() {
    setHint(undefined)
    setDetail(undefined)
    setCanRetry(false)
    setStep(step === 'capture' ? 'landing' : 'capture')
  }

  if (step === 'result' && view) {
    return (
      <Result
        result={view}
        personUrl={personUrl}
        personBlob={personBlob}
        precomputed={precomputed}
        styledGender={styledGender}
        onGenderChange={setStyledGender}
        onCorrect={(axis, value) => setOverrides((o) => ({ ...o, [axis]: value }))}
        onResetCorrections={() => setOverrides({})}
        onRestart={() => {
          setResult(null)
          setPrecomputed(undefined)
          setOverrides({})
          setHint(undefined)
          setDetail(undefined)
          setCanRetry(false)
          setStep('landing')
        }}
      />
    )
  }
  if (step === 'analyzing') return <Analyzing personUrl={personUrl} />
  if (step === 'capture') {
    return (
      <Capture
        onCapture={handleCapture}
        onSample={handleSample}
        onBack={leaveCapture}
        hint={hint}
        detail={detail}
        onRetry={canRetry && personBlob ? () => handleCapture(personBlob, personUrl) : undefined}
      />
    )
  }
  return <Landing onStart={leaveCapture} />
}
