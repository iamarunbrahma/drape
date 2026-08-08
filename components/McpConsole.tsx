'use client'

import { useState } from 'react'

/**
 * Runs the MCP server's own tools against `/api/mcp`, over the same JSON-RPC an agent
 * uses. The server is stateless and needs no credentials, so the browser can speak to it
 * directly and what you see here is exactly what Claude would get back.
 */

export interface ToolDemo {
  name: string
  title: string
  blurb: string
  args: Record<string, string | number>
}

const RPC_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
}

/** The transport replies as an event stream, so the JSON arrives on a `data:` line. */
function parseRpc(body: string): unknown {
  const line = body.split('\n').find((l) => l.startsWith('data: '))
  return JSON.parse(line ? line.slice(6) : body)
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const res = await fetch('/api/mcp', {
    method: 'POST',
    headers: RPC_HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  })
  const parsed = parseRpc(await res.text()) as {
    result?: { content?: { text?: string }[] }
    error?: { message?: string }
  }
  if (parsed.error) return `error: ${parsed.error.message ?? 'unknown'}`
  return parsed.result?.content?.[0]?.text ?? JSON.stringify(parsed, null, 2)
}

export default function McpConsole({ tool }: { tool: ToolDemo }) {
  const [out, setOut] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      setOut(await callTool(tool.name, tool.args))
    } catch (e) {
      setOut(`error: ${e instanceof Error ? e.message : 'request failed'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper-2/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <code className="font-mono text-sm font-semibold">{tool.name}</code>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper transition hover:bg-accent disabled:opacity-60"
        >
          {busy ? 'Running…' : out ? 'Run again' : 'Run it'}
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{tool.blurb}</p>

      <pre className="mt-3 overflow-x-auto rounded-lg bg-ink/[0.04] p-3 text-[11px] leading-relaxed">
        <code>{JSON.stringify(tool.args, null, 2)}</code>
      </pre>

      {out && (
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-ink p-3 text-[11px] leading-relaxed text-paper">
          <code>{out}</code>
        </pre>
      )}
    </div>
  )
}
