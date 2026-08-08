'use client'

import { useState, useSyncExternalStore } from 'react'
import { hasByok, setByok, subscribeByok } from '@/lib/byok'

/**
 * Lets a tester run the live features on their own YouCam credentials once the shared
 * demo's units run out. The plumbing already existed (`ycHeaders` sends them on every
 * call, and the budget guard steps aside for them); there was simply no way to type a key
 * in, so the limit message told people to clone the repo.
 *
 * Collapsed by default, because for anyone using the sample faces it is noise.
 */
export default function ByokKey() {
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  // localStorage is an external store: read it through the hook so the server render says
  // "no key" and the client corrects itself without a setState-in-effect.
  const saved = useSyncExternalStore(subscribeByok, hasByok, () => false)

  function save() {
    if (!apiKey.trim() || !secretKey.trim()) return
    setByok({ apiKey: apiKey.trim(), secretKey: secretKey.trim() })
    setApiKey('')
    setSecretKey('')
    setOpen(false)
  }

  function clear() {
    setByok(null)
    setApiKey('')
    setSecretKey('')
  }

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs text-ink-soft transition hover:text-ink"
      >
        <span aria-hidden className="text-[9px]">{open ? '▼' : '▶'}</span>
        {saved ? 'Using your own YouCam key' : 'Use your own YouCam key'}
        {saved && <span className="rounded-full bg-[#4a6b4f] px-1.5 py-0.5 text-[10px] font-medium text-paper">on</span>}
      </button>

      {open && (
        <div className="mt-2.5 rounded-xl border border-line bg-paper p-3.5">
          <p className="text-xs text-ink-soft">
            From your{' '}
            <a
              href="https://yce.perfectcorp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline underline-offset-2 hover:text-accent"
            >
              YouCam console
            </a>
            . Stored in this browser only.
          </p>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API key"
              autoComplete="off"
              spellCheck={false}
              className="rounded-lg border border-line bg-paper-2/60 px-3 py-2 text-sm outline-none focus:border-ink/40"
            />
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="Secret key"
              autoComplete="off"
              spellCheck={false}
              className="rounded-lg border border-line bg-paper-2/60 px-3 py-2 text-sm outline-none focus:border-ink/40"
            />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              onClick={save}
              disabled={!apiKey.trim() || !secretKey.trim()}
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper transition hover:bg-accent disabled:opacity-40"
            >
              Save key
            </button>
            {saved && (
              <button
                onClick={clear}
                className="rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition hover:border-ink/40 hover:text-ink"
              >
                Remove saved key
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
