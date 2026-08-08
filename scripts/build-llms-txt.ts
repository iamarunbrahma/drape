// Generates public/llms.txt: the MCP server described for agents.
//
// It is generated rather than written by hand so the parameters and the example responses
// come from the server itself and cannot drift away from it. Every example below is a real
// call made while building the file.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/build-llms-txt.ts [baseUrl]

import { writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:3100'
const PUBLIC_URL = 'https://drape-youcam.vercel.app'
const OUT = path.resolve(import.meta.dirname, '..', 'public', 'llms.txt')

interface ToolSchema {
  name: string
  title?: string
  description?: string
  inputSchema: {
    properties?: Record<string, { type?: string; description?: string; enum?: string[]; default?: unknown }>
    required?: string[]
  }
}

async function rpc(method: string, params: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = await res.text()
  const line = body.split('\n').find((l) => l.startsWith('data: '))
  const parsed = JSON.parse(line ? line.slice(6) : body)
  if (parsed.error) throw new Error(parsed.error.message)
  return parsed.result
}

/** One real call per tool, so the examples are answers rather than invention. */
const EXAMPLES: Record<string, Record<string, unknown>> = {
  analyze_season: { skin_hex: '#be9c82', eye_hex: '#4f4030' },
  find_garments: { skin_hex: '#be9c82', gender: 'female', limit: 2 },
  check_color: { skin_hex: '#be9c82', garment_hex: '#1f5f5b' },
  check_hair: { skin_hex: '#be9c82', hair_hex: '#3a2a20' },
  correct_read: { skin_hex: '#be9c82', depth: 'deep' },
}


/**
 * A markdown table whose pipes line up when read as plain text.
 *
 * llms.txt is served as text/plain, so a reader sees the source, not a rendered table.
 * Ragged pipes are hard to scan in a monospace column, so every cell is padded to its
 * column width and centred, and the separator carries `:---:` so it also centres wherever
 * the file does get rendered. An escaped pipe is two characters but occupies one column,
 * No cell may contain a pipe: an escaped one is a single column when rendered but two
 * characters when read raw, so it cannot line up in both.
 */
function table(headers: string[], rows: string[][]): string {
  const shown = (cell: string) => cell.length
  const widths = headers.map((h, i) =>
    Math.max(shown(h), 3, ...rows.map((r) => shown(r[i] ?? ''))),
  )
  const centre = (cell: string, width: number) => {
    const pad = width - shown(cell)
    const left = Math.floor(pad / 2)
    return ' '.repeat(left) + cell + ' '.repeat(pad - left)
  }
  const line = (cells: string[]) =>
    '| ' + cells.map((c, i) => centre(c, widths[i])).join(' | ') + ' |'
  return [
    line(headers),
    '|' + widths.map((w) => ':' + '-'.repeat(w) + ':').join('|') + '|',
    ...rows.map((r) => line(headers.map((_, i) => r[i] ?? ''))),
  ].join('\n')
}

function params(tool: ToolSchema): string {
  const props = tool.inputSchema.properties ?? {}
  const required = new Set(tool.inputSchema.required ?? [])
  const rows = Object.entries(props).map(([name, p]) => [
    `\`${name}\``,
    p.enum ? p.enum.map((v) => `\`${v}\``).join(' / ') : `\`${p.type ?? 'string'}\``,
    required.has(name) ? 'required' : 'optional',
    (p.description ?? '').replace(/\|/g, '/'),
  ])
  return table(['Parameter', 'Type', 'Required', 'Description'], rows)
}

async function main() {
  const { tools } = (await rpc('tools/list', {})) as { tools: ToolSchema[] }
  const init = (await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'build-llms-txt', version: '1' },
  })) as { protocolVersion: string; serverInfo: { name: string; version: string } }

  const sections: string[] = []
  for (const tool of tools) {
    const args = EXAMPLES[tool.name]
    // Without this a newly added tool silently documents its own validation error as the
    // example response, which is worse than having no example at all. It happened once.
    if (!args) throw new Error(`no example arguments for '${tool.name}'; add one to EXAMPLES`)
    const result = (await rpc('tools/call', { name: tool.name, arguments: args })) as {
      content: { text: string }[]
    }
    sections.push(
      [
        `### \`${tool.name}\``,
        '',
        tool.description ?? '',
        '',
        params(tool),
        '',
        'Example call:',
        '',
        '```json',
        JSON.stringify({ name: tool.name, arguments: args }, null, 2),
        '```',
        '',
        'Returns:',
        '',
        '```json',
        result.content[0].text,
        '```',
      ].join('\n'),
    )
  }

  const doc = `# Drape MCP Server

> Turns a measured skin color into a seasonal color analysis, a wearable palette, and real
> garments ranked by CIEDE2000 against colors measured from the retailer's own fabric
> swatches. Exposed over MCP so an agent can do personal color analysis without a browser.

Perfect Corp ships YouCam itself over MCP, so an agent can already obtain the hex values of
a face. It cannot turn those into a season, a palette, or ranked real garments. This server
does that, and needs no YouCam credentials of its own because the engine is pure: it
composes with theirs rather than duplicating it.

## Connection

${table(
  ['Field', 'Value'],
  [
    ['URL', `\`${PUBLIC_URL}/api/mcp\``],
    ['Transport', 'Streamable HTTP (JSON-RPC 2.0)'],
    ['Protocol', `\`${init.protocolVersion}\``],
    ['Server', `\`${init.serverInfo.name}\` v${init.serverInfo.version}`],
    ['Authentication', 'none'],
    ['State', 'stateless; no session id is issued or required'],
  ],
)}

Claude Code:

\`\`\`bash
claude mcp add --transport http drape ${PUBLIC_URL}/api/mcp
\`\`\`

Claude Desktop, in \`claude_desktop_config.json\`:

\`\`\`json
{ "mcpServers": { "drape": { "type": "http", "url": "${PUBLIC_URL}/api/mcp" } } }
\`\`\`

## Tools

${sections.join('\n\n')}

## Interpreting the numbers

- **Delta E** is CIEDE2000. Below 1 is an exact match, below 2.3 is a just-noticeable
  difference, below 5 is very close, below 10 is close, below 25 is the same family.
- **Beyond delta E 15 a color is not in the palette.** \`find_garments\` returns nothing past
  that rather than padding the list, so fewer results than \`limit\` means the catalog had
  nothing that close, not that something failed.
- **Confidence** is scored from how near the reading sits to a decision boundary and from
  photo quality. A low score is a genuine signal to ask the user before acting, and
  \`correct_read\` is the way to act on their answer.
- **Undertone comes from the CIELAB hue angle**, not from b\\*. Thresholding b\\* reads darkness
  as coolness and fails at both ends of the human range; the comparison against the Monk
  Skin Tone Scale is at ${PUBLIC_URL}/fairness.

## Sourcing and freshness

- Garment colors are measured from each retailer's own fabric swatch image, never taken
  from a product title. If we chose the hex, a close delta E would be circular.
- Availability is re-checked daily against the retailer, and colorways they have stopped
  selling are excluded, so product links are safe to hand to a shopper.
- The color engine itself is deterministic and offline. \`analyze_season\`, \`check_color\` and
  \`correct_read\` make no outbound calls at all.

## Related pages

- [Studio](${PUBLIC_URL}/): the analysis, try-on and shopping flow for humans.
- [Across skin tones](${PUBLIC_URL}/fairness): the engine checked against the Monk Skin Tone Scale.
- [Inside a shop's page](${PUBLIC_URL}/retail): the same ranking embedded in a product page.
- [For agents](${PUBLIC_URL}/mcp): this server, with a live console for each tool.
`

  await writeFile(OUT, doc, 'utf8')
  console.log(`wrote ${OUT}`)
  console.log(`${tools.length} tools, ${doc.split('\n').length} lines`)
}

main()
