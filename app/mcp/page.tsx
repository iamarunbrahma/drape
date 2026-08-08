import type { Metadata } from 'next'
import Link from 'next/link'
import McpConsole, { type ToolDemo } from '@/components/McpConsole'
import { CATALOG } from '@/lib/catalog'

export const metadata: Metadata = {
  title: 'The color engine over MCP · Drape',
  description:
    'Drape exposes its color engine as an MCP server, so an agent can turn a measured skin color into a season, a palette and real garments ranked by CIEDE2000.',
}

// The MCP server had no surface at all: it was a route handler and a paragraph in the
// README, which meant nobody would find it without being told. This page is where you can
// see it, install it, and run its tools against the live server.

const SKIN = '#be9c82'

const TOOLS: ToolDemo[] = [
  {
    name: 'analyze_season',
    title: 'Analyze color season',
    blurb:
      'Turns measured facial colors into a season, the three axes underneath it, the palette, and a confidence score that says how much to trust the read.',
    args: { skin_hex: SKIN, eye_hex: '#4f4030' },
  },
  {
    name: 'find_garments',
    title: 'Find garments in your colors',
    blurb:
      'Ranks real garments by CIEDE2000 against the palette. Colors are measured from the retailer’s own fabric swatches, and sold-out colorways are left out.',
    args: { skin_hex: SKIN, gender: 'female', limit: 4 },
  },
  {
    name: 'check_color',
    title: 'Check whether a color suits someone',
    blurb:
      'Answers "does this specific shade suit me?" for a garment the shopper is already looking at. This one asks about a deep teal on a warm, light reader.',
    args: { skin_hex: SKIN, garment_hex: '#1f5f5b' },
  },
  {
    name: 'correct_read',
    title: 'Correct an axis of the analysis',
    blurb:
      'Re-derives the season with an axis set by hand, for when the shopper disagrees. Deterministic, so it costs nothing and needs no new photo.',
    args: { skin_hex: SKIN, depth: 'deep' },
  },
]

const CONFIG = `{
  "mcpServers": {
    "drape": {
      "type": "http",
      "url": "https://drape-youcam.vercel.app/api/mcp"
    }
  }
}`

export default function McpPage() {
  return (
    <main className="paper-grain min-h-dvh pb-24">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-display text-xl font-semibold">Drape</Link>
        <Link href="/" className="text-sm text-ink-soft hover:text-ink">Back to the studio</Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-10">
        <p className="meta text-ink-soft">For agents</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          The color engine, over MCP
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          Perfect Corp ships YouCam itself over MCP, so an agent can already ask it for the hex
          values of a face. What it cannot do is turn those into a season, a palette, or real
          garments ranked by measured color distance. That is what this exposes, and it needs no
          YouCam credentials of its own, because the engine is pure. It composes with their server
          rather than duplicating it.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ['Endpoint', '/api/mcp'],
            ['Transport', 'Streamable HTTP'],
            ['Credentials', 'none required'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line bg-paper-2/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">{k}</div>
              <div className="mt-0.5 font-mono text-sm">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pt-12">
        <h2 className="font-display text-2xl font-medium">Add it to a client</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Claude Code:{' '}
          <code className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[12px]">
            claude mcp add --transport http drape https://drape-youcam.vercel.app/api/mcp
          </code>
        </p>
        <p className="mt-3 text-sm text-ink-soft">Claude Desktop, in <code className="font-mono text-[12px]">claude_desktop_config.json</code>:</p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-ink p-4 text-[12px] leading-relaxed text-paper">
          <code>{CONFIG}</code>
        </pre>
      </section>

      <section className="mx-auto max-w-3xl px-6 pt-12">
        <h2 className="font-display text-2xl font-medium">Try the tools</h2>
        <p className="mt-2 text-sm text-ink-soft">
          These run against the same live server an agent talks to, over the same JSON-RPC. The
          skin color below, <code className="font-mono text-[12px]">{SKIN}</code>, is a real
          reading YouCam returned for one of the sample faces, so the answers here match what the
          studio shows for it.
        </p>
        <div className="mt-6 space-y-4">
          {TOOLS.map((t) => (
            <McpConsole key={t.name} tool={t} />
          ))}
        </div>
        <p className="mt-6 text-xs text-ink-soft">
          Reading this as an agent rather than a person? The same thing in one markdown file:{' '}
          <a href="/llms.txt" className="text-ink underline underline-offset-2 hover:text-accent">/llms.txt</a>.
        </p>
        <p className="mt-2 text-xs text-ink-soft">
          {CATALOG.length} garment colorways back <code className="font-mono">find_garments</code>,
          each measured from the retailer&rsquo;s own swatch image and re-checked daily against what
          they are still selling.
        </p>
      </section>
    </main>
  )
}
