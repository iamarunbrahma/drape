'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Palette, SkinReport as SkinReportData } from '@/lib/types'
import { TRYON_HINTS, TRYON_FALLBACK } from '@/lib/types'
import { ycPost, isTimeout } from '@/lib/byok'
import { shopForColor } from '@/lib/shop'
import { nearestGarment } from '@/lib/catalog'
import type { Season } from '@/lib/color/season'
import { getPalette } from '@/lib/color/palettes'
import StyledLook from './StyledLook'
import SkinReportPanel from './SkinReport'
import HairPanel from './HairPanel'

/**
 * What you can do with your own face used to be three stacked sections, each with its own
 * heading and its own copy of the same portrait. It is one studio now, and the portrait is
 * drawn once. The generative styling is not a separate tab either: it builds a look around
 * the color you just tapped, so it belongs in the same frame as the picker rather than in
 * a tab of its own that showed the untouched photo and ignored your choice.
 */
const TABS = [
  { id: 'colors', label: 'Colors' },
  { id: 'hair', label: 'Hair' },
  { id: 'skin', label: 'Skin' },
] as const
type Tab = (typeof TABS)[number]['id']

export interface Precomputed {
  tryons: Record<string, string>
  heroHex: string
  clashHex: string
  /** hex -> baked hair-color render, so the sample path stays free */
  hairShots?: Record<string, string>
  /** the season this face measures as, named when we fall back to its renders */
  measuredSeason: Season
  /** a real skin-analysis response captured for this sample face */
  skin?: SkinReportData
}

function readable(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#201d18' : '#f6f2ea'
}

export default function TryOnStudio({
  clothFileId,
  palette,
  personUrl,
  precomputed,
  gender = 'female',
  wear,
  season,
  personBlob,
  hairHex,
  onGenderChange,
  unavailable,
}: {
  clothFileId?: string
  palette: Palette
  personUrl: string
  precomputed?: Precomputed
  gender?: 'female' | 'male'
  /** a color requested from elsewhere on the page; `nonce` re-fires the same color */
  wear?: { hex: string; nonce: number }
  season: Season
  personBlob: Blob | null
  /** hair color as measured from the photo; absent only if the read had none */
  hairHex?: string
  onGenderChange: (g: 'female' | 'male') => void
  /** catalog ids the retailer is not currently selling */
  unavailable?: ReadonlySet<string>
}) {
  const [tab, setTab] = useState<Tab>('colors')
  // Each tab keeps its own render. Sharing one slot meant a tab switch had to clear it,
  // so a look that cost a call to generate was thrown away by clicking "Hair" and back.
  /**
   * Every styled look generated this session, oldest first.
   *
   * This used to be a single slot, so "Style another" overwrote the previous one and the
   * only way to keep a look was to have downloaded it before pressing the button again.
   * Each of these cost a live generation, so discarding one on a misclick threw away
   * something already paid for. `styledPick` is which of them is on screen; with none
   * chosen it is the newest, so generating still shows you what you just made.
   */
  const [styledLooks, setStyledLooks] = useState<string[]>([])
  const [styledPick, setStyledPick] = useState<string | null>(null)
  const styledUrl = styledPick ?? styledLooks[styledLooks.length - 1] ?? null
  // Whether the generated look is the thing on screen. It used to be discarded the moment
  // you tapped another swatch, on the theory that a look belonged to one color. It does
  // not: the endpoint ignores the color it is given and works from the season, so a look
  // stays valid across the whole palette. Tapping a swatch shows that swatch, and the look
  // waits rather than being thrown away.
  const [showStyled, setShowStyled] = useState(false)
  const [hairUrl, setHairUrl] = useState<string | null>(null)
  // Held here rather than in the panel: the panel unmounts with its tab, so a selection
  // kept inside it was forgotten the moment you looked at anything else.
  const [hairPick, setHairPick] = useState<string | null>(null)
  // Rendering a shade takes about ten seconds. Held here rather than in the panel so the
  // photo, which is what someone actually watches while waiting, can say so.
  const [hairBusy, setHairBusy] = useState(false)
  // Every shade already rendered on this photo, so going back to one is instant and free.
  // Without this, flipping between two shades paid for each of them again every time.
  const [hairRenders, setHairRenders] = useState<Record<string, string>>({})
  // The skin panel unmounts with its tab, so its result is kept out here where switching
  // tabs cannot discard it. See the note on SkinReport's `settled` prop.
  const [skinSettled, setSkinSettled] = useState<SkinReportData | 'failed' | undefined>()
  // No photo and no captured report means nothing to put behind the Skin tab.
  const hasSkin = !!(personBlob || precomputed?.skin)
  const tabs = TABS.filter((t) => (t.id !== 'skin' || hasSkin) && (t.id !== 'hair' || !!hairHex))
  // Two views of the same renders. The ref is read inside callbacks, where it answers
  // "have we already fetched this?" without making runTryOn depend on every render that
  // has landed so far. The state is what the markup reads: a ref cannot be read during
  // render, and doing it anyway is why this used to need a forced re-render to show a
  // picture it already had.
  const cache = useRef<Map<string, string>>(new Map())
  const [renders, setRenders] = useState<Record<string, string>>({})
  const section = useRef<HTMLElement>(null)
  const [liveHero, setLiveHero] = useState<string | null>(null)
  const [liveClash, setLiveClash] = useState<string | null>(null)
  const [loading, setLoading] = useState<Set<string>>(new Set())
  // A rejected try-on used to leave the shimmer running forever, which reads as a hang.
  const [failure, setFailure] = useState<string | null>(null)

  // A correction can move the palette to colors we have no pre-generated render for.
  // Prefer the corrected palette's own hero/clash, and fall back to the sample's
  // originals so the comparison never goes blank.
  const rendered = (hex: string) => !precomputed || !!precomputed.tryons[hex.toLowerCase()]
  const heroHex = rendered(palette.hero.hex) ? palette.hero.hex : precomputed!.heroHex
  const clashHex = rendered(palette.clash.hex) ? palette.clash.hex : precomputed!.clashHex
  const [selected, setSelected] = useState<string>(heroHex)

  // On the sample path these are just a lookup, so read them rather than copying them
  // into state from an effect. Only the live path has to wait for a network round trip,
  // and only that path keeps state.
  const hero = precomputed ? (precomputed.tryons[heroHex.toLowerCase()] ?? null) : liveHero
  const clash = precomputed ? (precomputed.tryons[clashHex.toLowerCase()] ?? null) : liveClash

  // Adjusting state while rendering, which is React's own answer to "a prop moved and
  // some state has to follow it". As an effect it rendered once with the stale color and
  // again with the right one; here the stale render never reaches the screen.
  const [prevHero, setPrevHero] = useState(heroHex)
  if (heroHex !== prevHero) {
    setPrevHero(heroHex)
    setSelected(heroHex)
  }

  const [prevWear, setPrevWear] = useState(wear?.nonce)
  if (wear && wear.nonce !== prevWear) {
    setPrevWear(wear.nonce)
    setTab('colors')
    setShowStyled(false)
    setSelected(wear.hex)
  }

  // Colors available to try on: precomputed subset, or the full palette when live.
  const gridColors = precomputed
    ? palette.colors.filter((c) => precomputed.tryons[c.hex.toLowerCase()])
    : palette.colors

  // A sample face is baked for the season it actually measures as. Correct an axis far
  // enough and the palette lands in a season we have no renders for, which used to leave
  // an empty grid under "Tap a color to wear it" and a comparison still captioned "in
  // your color" while showing a shade from the season you had just corrected away from.
  const offBaked = !!precomputed && gridColors.length === 0
  const heroBaked = rendered(palette.hero.hex)

  const runTryOn = useCallback(
    async (hex: string): Promise<string | null> => {
      const key = hex.toLowerCase()
      if (precomputed) return precomputed.tryons[key] ?? null
      if (cache.current.has(key)) return cache.current.get(key)!
      setLoading((s) => new Set(s).add(key))
      try {
        const r = await ycPost('/api/tryon', JSON.stringify({ clothFileId, hex }), {
          'Content-Type': 'application/json',
        })
        const d = await r.json()
        if (d.ok && d.imageUrl) {
          cache.current.set(key, d.imageUrl)
          setRenders((r) => ({ ...r, [key]: d.imageUrl }))
          setFailure(null)
          return d.imageUrl
        }
        setFailure(d.message || TRYON_HINTS[d.error] || TRYON_FALLBACK)
        return null
      } catch (e) {
        // There was no catch here at all, so a stalled or dropped request left the swatch
        // silently doing nothing: the spinner cleared and no reason was ever shown.
        setFailure(isTimeout(e) ? 'That took too long. Tap the color to try again.' : TRYON_FALLBACK)
        return null
      } finally {
        setLoading((s) => {
          const n = new Set(s)
          n.delete(key)
          return n
        })
      }
    },
    [clothFileId, precomputed],
  )

  // Fetching the two comparison shots is real work with a cleanup, so it stays an effect.
  //
  // Started on the microtask queue rather than inline: runTryOn raises a loading flag the
  // moment it is called, and doing that in an effect body queues a second render before
  // the first has committed. Waiting a tick keeps the two apart, and a tick is not
  // something anyone can see.
  useEffect(() => {
    if (precomputed) return
    let alive = true
    queueMicrotask(() => {
      if (!alive) return
      runTryOn(heroHex).then((u) => alive && u && setLiveHero(u))
      runTryOn(clashHex).then((u) => alive && u && setLiveClash(u))
    })
    return () => {
      alive = false
    }
  }, [heroHex, clashHex, runTryOn, precomputed])

  // A color tapped in the palette up in the reveal arrives here: wear it and bring the
  // studio into view, so the swatch you just tapped actually shows you something. Which
  // tab and which swatch were picked is settled above, during render; what is left here
  // is the fetch and the scroll, both of which belong in an effect.
  useEffect(() => {
    if (!wear) return
    let alive = true
    queueMicrotask(() => alive && void runTryOn(wear.hex))
    section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return () => {
      alive = false
    }
  }, [wear, runTryOn])

  async function pick(hex: string) {
    setSelected(hex)
    setShowStyled(false)
    await runTryOn(hex)
  }

  // Only ever show a color we can actually render: falling through to the untouched photo
  // left the chip naming a shade the garment in the picture was not wearing.
  const shownHex = rendered(selected) ? selected : heroHex
  const selKey = shownHex.toLowerCase()
  const baked = precomputed ? precomputed.tryons[selKey] : renders[selKey]
  const allSwatches = [...palette.colors, palette.hero, palette.clash]

  // After a correction the comparison still shows the measured season's renders, whose
  // colors are not in the corrected palette. Looking them up only in the current palette
  // meant both figures fell through to "Your color", captioning the flattering shade and
  // the clashing one identically. Fall back to the season the render actually came from.
  const measuredSwatches = precomputed
    ? (() => {
        const m = getPalette(precomputed.measuredSeason)
        return [...m.colors, m.hero, m.clash]
      })()
    : []
  const nameFor = (hex: string) => {
    const key = hex.toLowerCase()
    const hit = allSwatches.find((c) => c.hex.toLowerCase() === key) ?? measuredSwatches.find((c) => c.hex.toLowerCase() === key)
    return hit?.name ?? 'Your color'
  }

  // After a correction the picture can only be the measured season's render, which the
  // corrected palette has no name for. Say what it is rather than calling an abandoned
  // shade "your color".
  // A correction can leave the only render we hold in a color the new palette does not
  // contain. Showing it anyway put the wearer in a shade they had just been told is not
  // theirs, so the picture falls back to the untouched photo instead.
  const showingFallback = !allSwatches.some((c) => c.hex.toLowerCase() === selKey)
  const selectedUrl = showingFallback ? undefined : baked

  // Prefer a garment whose color we measured over a keyword search. "Shop Coral" used to
  // run a Google query for "coral women's top", which is exactly the guess this project
  // exists to replace; the catalog can name an actual product that is actually this color.
  const shopHex = showingFallback ? palette.hero.hex : shownHex
  const shopName = showingFallback ? palette.hero.name : nameFor(shownHex)
  const shopMatch = nearestGarment(shopHex, gender, unavailable)

  return (
    <section ref={section} className="mx-auto max-w-5xl px-6 pt-20">
      <div className="text-center">
        <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">See yourself in it</h2>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          The same garment, two shades. Your palette color lifts you; the wrong one drains you. Powered by YouCam virtual try-on.
        </p>
      </div>

      {failure && !precomputed && (
        <p className="mx-auto mt-6 max-w-md rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-center text-sm text-accent">
          {failure}
        </p>
      )}

      <div className="mt-10 grid grid-cols-2 gap-4 md:gap-6">
        <Figure
          url={hero}
          badge={heroBaked ? 'In your color' : `From the measured ${precomputed?.measuredSeason ?? 'read'}`}
          sub={nameFor(heroHex)}
          chipHex={heroHex}
          good={heroBaked}
          failed={!!failure}
          tip={`The hero of your ${palette.season} palette: of every shade your season calls for, the one that flatters you most. Both photos are the same garment on the same face in the same light, so the color is the only thing that changed.`}
        />
        <Figure
          url={clash}
          badge="Off your palette"
          sub={nameFor(clashHex)}
          chipHex={clashHex}
          failed={!!failure}
          tip="Taken from the opposite temperature to your season, and held further from your palette than any garment we would ever call a match. It is here so you can see the difference for yourself rather than take our word for it."
        />
      </div>

      <div className="mt-14 rounded-3xl border border-line bg-paper-2/50 p-6 md:p-10">
        <div role="tablist" aria-label="Studio" className="mb-8 inline-flex rounded-full border border-line bg-paper p-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 transition ${tab === t.id ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'colors' && (
        <div className="grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-start">
        <div>
          <p className="meta text-ink-soft">Try your palette</p>
          <h3 className="mt-1 font-display text-2xl font-medium">Tap a color to wear it</h3>
          <p className="mt-2 text-sm text-ink-soft">
            {offBaked
              ? `You corrected the read, so your palette moved to ${palette.season}. Sample faces are only pre-rendered for the season they measure as, so upload your own photo to wear this one.`
              : precomputed
                ? 'Every shade here is chosen for this season. Upload your own photo to try your full palette on you.'
                : 'Every shade here is chosen for your season. Tap to see it on.'}
          </p>
          <div className={`grid grid-cols-5 gap-2.5 ${offBaked ? '' : 'mt-5'}`}>
            {gridColors.map((c) => {
              const isLoading = loading.has(c.hex.toLowerCase())
              const isSel = selected.toLowerCase() === c.hex.toLowerCase()
              return (
                <button
                  key={c.hex}
                  onClick={() => pick(c.hex)}
                  title={c.name}
                  className={`relative aspect-square rounded-lg shadow-sm ring-1 transition ${isSel ? 'ring-2 ring-ink' : 'ring-black/10 hover:scale-105'}`}
                  style={{ backgroundColor: c.hex }}
                >
                  {isLoading && (
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent spin-slow" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Always available, including after a correction. This is a live call on the
              photo and the season only picks the editorial style, so unlike the swatches
              it needs no pre-rendering. Hiding it here left the corrected view empty. */}
          <StyledLook
            personUrl={personUrl}
            personBlob={personBlob}
            gender={gender}
            season={season}
            onGenderChange={onGenderChange}
            onResult={(url) => {
              if (url) {
                setStyledLooks((all) => (all.includes(url) ? all : [...all, url]))
                setStyledPick(url)
              }
              setShowStyled(!!url)
            }}
            hasSwatches={!offBaked}
          />
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={(showStyled && styledUrl) || selectedUrl || personUrl} alt="try-on" className="aspect-[4/5] w-full object-cover" />
            {showStyled && styledUrl && (
              <>
                <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper shadow">
                  ✦ Styled by YouCam AI
                </span>
                {/* Numbered for the same reason the swatch files are named for their
                    colour: several looks saved as one name just collect (1), (2). */}
                <Download url={styledUrl} name={`drape-styled-look-${styledLooks.indexOf(styledUrl) + 1}`} />
              </>
            )}
            {/* Same offer on the swatch try-on as on hair. Named for the colour rather than
                a fixed "drape-tryon", because trying five shades is the point and five files
                of the same name just collect (1), (2) suffixes. */}
            {!showStyled && selectedUrl && (
              <Download url={selectedUrl} name={`drape-${nameFor(shownHex).toLowerCase().replace(/\s+/g, '-')}`} />
            )}
            {!selectedUrl && !precomputed && (
              <div className="absolute inset-0 grid place-items-center bg-black/10">
                <span className="h-7 w-7 rounded-full border-2 border-white border-t-transparent spin-slow" />
              </div>
            )}
            {showStyled && styledUrl ? null : showingFallback ? (
              // Without this the untouched photo just looks like a try-on that failed.
              <div className="absolute bottom-3 left-3 rounded-full bg-paper/95 px-3 py-1 text-xs font-medium text-ink-soft shadow">
                Not rendered for {palette.season}
              </div>
            ) : (
              <div className="absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-medium shadow" style={{ backgroundColor: shownHex, color: readable(shownHex) }}>
                {nameFor(shownHex)}
              </div>
            )}
          </div>
          {/* Only worth showing once there is a choice to make. The strip sits under the
              picture rather than beside the button, so the thing you are picking between
              is directly above the thumbnails. */}
          {showStyled && styledLooks.length > 1 && (
            <div className="mt-3">
              <p className="meta text-ink-soft">Your looks</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {styledLooks.map((u, i) => (
                  <button
                    key={u}
                    onClick={() => setStyledPick(u)}
                    title={`Look ${i + 1}`}
                    aria-label={`Show styled look ${i + 1}`}
                    aria-current={u === styledUrl}
                    className={`h-16 w-[3.2rem] shrink-0 overflow-hidden rounded-lg transition ${
                      u === styledUrl ? 'ring-2 ring-ink' : 'opacity-70 ring-1 ring-black/10 hover:opacity-100'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {styledUrl && !showStyled && (
            <button
              onClick={() => setShowStyled(true)}
              className="mt-3 w-full rounded-full border border-line bg-paper py-2 text-sm text-ink-soft transition hover:border-ink/40 hover:text-ink"
            >
              ← Back to your styled look
            </button>
          )}

          <a
            href={shopMatch ? shopMatch.garment.productUrl : shopForColor(shopName, gender)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full flex-col items-center rounded-full border border-line bg-paper py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            <span>
              {shopMatch ? `Shop ${shopName}` : `Search ${shopName}`} <span aria-hidden>↗</span>
            </span>
            <span className="text-[11px] font-normal text-ink-soft">
              {shopMatch
                ? `${shopMatch.garment.retailer} ${shopMatch.garment.colorName} · ΔE ${shopMatch.deltaE.toFixed(1)}`
                : 'nothing this close in our catalog'}
            </span>
          </a>
        </div>
        </div>
        )}

        {tab === 'hair' && hairHex && (
          <div className="grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-start">
            <HairPanel
              palette={palette}
              measuredHex={hairHex}
              personUrl={personUrl}
              personBlob={personBlob}
              // Pre-rendered sample shots and anything rendered live this session are the
              // same thing to the panel: a shade it already has and must not pay for again.
              baked={{ ...(precomputed?.hairShots ?? {}), ...hairRenders }}
              bakedSeason={precomputed?.measuredSeason}
              busy={hairBusy}
              onBusy={setHairBusy}
              picked={hairPick}
              onPick={setHairPick}
              onResult={(url, hex) => {
                setHairUrl(url)
                // File it under the shade so coming back to it costs nothing.
                if (url && hex) setHairRenders((r) => ({ ...r, [hex.toLowerCase()]: url }))
              }}
            />
            <div className="mx-auto w-full max-w-sm">
              <div className="relative overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hairUrl ?? personUrl}
                  alt="hair color"
                  className={`aspect-[4/5] w-full object-cover transition ${hairBusy ? 'scale-[1.02] blur-[3px]' : ''}`}
                />
                {/* The photo barely changes between the original and a new shade, so a
                    quiet line of text under the swatches read as nothing happening at all.
                    Softening the picture and putting a spinner on top of it makes the wait
                    belong to the thing being waited for. */}
                {hairBusy && (
                  <div className="absolute inset-0 grid place-items-center bg-paper/55">
                    <div className="flex flex-col items-center gap-3">
                      <span className="h-9 w-9 rounded-full border-2 border-ink/20 border-t-ink spin-slow" />
                      <span className="meta text-ink-soft">Coloring your hair</span>
                    </div>
                  </div>
                )}
                {hairUrl && !hairBusy && <Download url={hairUrl} name="drape-hair" />}
              </div>
            </div>
          </div>
        )}

        {tab === 'skin' && (
          <SkinReportPanel
            embedded
            personBlob={personBlob}
            precomputed={precomputed?.skin}
            settled={skinSettled}
            onSettled={setSkinSettled}
          />
        )}
      </div>
    </section>
  )
}

/**
 * Saves a generated image to disk.
 *
 * The result URLs are short-lived and signed, so "right click, save" is a race against
 * expiry and the file lands with a meaningless name. YouCam serves them with
 * `access-control-allow-origin: *`, so the bytes can be fetched and handed to the browser
 * directly, which also means no proxy route and no open redirect to guard.
 */
function Download({ url, name }: { url: string; name: string }) {
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const blob = await (await fetch(url)).blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `${name}.jpg`
      a.click()
      URL.revokeObjectURL(href)
    } catch {
      window.open(url, '_blank', 'noopener')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={save}
      disabled={busy}
      title="Save this image"
      aria-label="Save this image"
      className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-paper/95 shadow transition hover:bg-paper disabled:opacity-60"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3v12" />
        <path d="m7 12 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    </button>
  )
}

function Figure({ url, badge, sub, chipHex, good, failed, tip }: { url: string | null; badge: string; sub: string; chipHex: string; good?: boolean; failed?: boolean; tip: string }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-sm">
      <div className="relative">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={badge} className="aspect-[4/5] w-full object-cover" />
        ) : failed ? (
          <div className="grid aspect-[4/5] w-full place-items-center bg-paper-2 px-6 text-center text-sm text-ink-soft">
            Not rendered
          </div>
        ) : (
          // The sweep alone reads as an empty card rather than a busy one, especially next
          // to a sibling that has already rendered: one side shows a person, the other a
          // grey rectangle, and nothing says which of the two is still coming. The spinner
          // is the same one the selected shot and the hair panel use.
          <div className="relative aspect-[4/5] w-full">
            <div className="shimmer h-full w-full" />
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-3">
                <span className="h-9 w-9 rounded-full border-2 border-ink/20 border-t-ink spin-slow" />
                <span className="meta text-ink-soft">Rendering the shade</span>
              </div>
            </div>
          </div>
        )}
        {/* Two words carrying the whole argument of the page, with nowhere to ask what
            they mean. The explanation hangs below the badge rather than above it, so it
            opens into the photo instead of into the figure's clipped edge, and it answers
            to focus as well as hover so it is reachable without a mouse. */}
        <span className="group absolute left-3 top-3 z-10">
          <span
            tabIndex={0}
            className={`block cursor-help rounded-full px-3 py-1 text-xs font-semibold shadow outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ink ${good ? 'bg-ink text-paper' : 'bg-paper text-ink-soft'}`}
          >
            {good ? '✓ ' : ''}{badge}
          </span>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-0 top-full mt-2 w-64 max-w-[min(16rem,70vw)] rounded-xl border border-line bg-paper/95 p-3 text-left text-xs font-normal leading-relaxed text-ink-soft opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            {tip}
          </span>
        </span>
      </div>
      <figcaption className="flex items-center justify-center gap-2 py-2.5 text-sm">
        <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: chipHex }} />
        {sub}
      </figcaption>
    </figure>
  )
}
