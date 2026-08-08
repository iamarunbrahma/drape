'use client'

import { useState } from 'react'

const ID = 'YUOCEw7yFx4'

/**
 * The demo, as a facade rather than an iframe.
 *
 * A YouTube embed pulls roughly a megabyte and a long tail of requests before anyone has
 * decided to watch, on the one page where first paint matters most. So this ships a
 * thumbnail and a play button, and only mounts the player once someone actually asks for
 * it. Placed after the three steps: by then a reader knows what the thing is, and the
 * closing call to action sits right underneath.
 */
export default function DemoVideo() {
  const [playing, setPlaying] = useState(false)

  return (
    <section className="mx-auto max-w-6xl px-6 pb-16">
      <div className="border-t border-line pt-12">
        <p className="meta text-ink-soft">Demo · 2:47</p>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight md:text-4xl">
          Watch a full analysis
        </h2>
        <p className="mt-3 max-w-xl text-ink-soft">
          It reads one selfie, names the season, paints those colors onto her photo, and finds
          real clothes that match them.
        </p>

        <div className="mt-7 overflow-hidden rounded-2xl border border-line bg-ink shadow-sm">
          <div className="relative aspect-video w-full">
            {playing ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0&modestbranding=1`}
                title="Drape demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <button
                onClick={() => setPlaying(true)}
                aria-label="Play the Drape demo"
                className="group absolute inset-0 h-full w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-paper/95 shadow-lg transition group-hover:scale-105">
                    <span className="ml-1 border-y-[11px] border-l-[18px] border-y-transparent border-l-ink" />
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
