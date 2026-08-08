'use client'

import DemoVideo from './DemoVideo'

const STRIP = ['#b5461f', '#1f5f5b', '#c79320', '#6e1f2e', '#2ec4b6', '#c65b93', '#5f7fb0', '#9fae7b']

const STEPS = [
  { n: '01', t: 'Read your skin', d: 'YouCam AI reads your true skin undertone, plus your eye and hair color, from one selfie.' },
  { n: '02', t: 'Find your season', d: 'Our color engine places you in one of 12 seasonal palettes, the colors science says flatter you.' },
  { n: '03', t: 'Try them on', d: 'See yourself wearing your colors with AI virtual try-on. Watch the right shade transform you.' },
]

export default function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="paper-grain min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl font-semibold tracking-tight">Drape</span>
        <span className="meta text-ink-soft">Personal Color Studio</span>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-10 md:pt-16">
        <div className="grid items-center gap-10 md:grid-cols-[1.15fr_0.85fr]">
          <div className="fade-up">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-paper-2/60 px-3 py-1 meta text-ink-soft">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" /> Powered by YouCam AI
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
              Find the colors<br />made for <span className="italic text-accent">you</span>.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
              Some colors make you glow. Others wash you out. Drape reads your skin&rsquo;s undertone and
              reveals the palette that was written into you, then lets you try it on.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={onStart}
                className="group rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper transition hover:bg-accent"
              >
                Discover your palette
                <span className="ml-2 inline-block transition group-hover:translate-x-0.5">&rarr;</span>
              </button>
              <span className="text-sm text-ink-soft">Free · takes 20 seconds</span>
            </div>
          </div>

          <div className="fade-up" style={{ animationDelay: '0.12s' }}>
            <div className="grid grid-cols-4 gap-2.5">
              {STRIP.map((c, i) => (
                <div
                  key={c}
                  className="swatch-in aspect-[3/4] rounded-xl shadow-sm ring-1 ring-black/5"
                  style={{ backgroundColor: c, animationDelay: `${0.15 + i * 0.05}s` }}
                />
              ))}
            </div>
            <p className="mt-4 text-center font-display text-sm italic text-ink-soft">
              12 seasons · 120+ curated shades
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-8 border-t border-line pt-12 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="font-display text-3xl text-accent">{s.n}</div>
              <h3 className="mt-2 font-display text-xl font-medium">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <DemoVideo />

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-3xl bg-ink px-8 py-10 text-paper md:px-14 md:py-14">
          <h2 className="max-w-xl font-display text-3xl font-medium md:text-4xl">
            Personal color analysis costs $150 in a studio. Yours is free.
          </h2>
          <p className="mt-4 max-w-lg text-paper/70">
            Retailers lose billions to returns from the wrong shade. Drape turns &ldquo;does this suit me?&rdquo;
            into confidence, and a sale.
          </p>
          <button
            onClick={onStart}
            className="mt-7 rounded-full bg-paper px-7 py-3.5 text-sm font-medium text-ink transition hover:bg-accent hover:text-paper"
          >
            Start with a selfie &rarr;
          </button>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 pb-10 text-xs text-ink-soft">
        <span>Drape · Skin AI + Apparel VTO · Built on the YouCam API by Perfect Corp.</span>
        {/* The evenness check used to be reachable only from a line of small print part-way
            down the results page, so you had to finish a read before you could find out
            whether the engine was fair. It belongs where someone can check first. */}
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href="/fairness" className="text-ink underline underline-offset-2 hover:text-accent">
            Does it work on every skin tone?
          </a>
          <a href="/mcp" className="text-ink underline underline-offset-2 hover:text-accent">
            The color engine, over MCP
          </a>
        </span>
      </footer>
    </div>
  )
}
