'use client'

import type { AnalyzeOk } from '@/lib/types'

function readable(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#201d18' : '#f6f2ea'
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draw a shareable palette card to a canvas and trigger a PNG download. */
export async function downloadPaletteCard(result: AnalyzeOk): Promise<void> {
  const W = 1080, H = 1350
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const PAPER = '#f6f2ea', INK = '#201d18', SOFT = '#6b6459', ACCENT = '#b5461f', LINE = '#e2d9c8'
  const serif = 'Georgia, "Times New Roman", serif'
  const sans = 'Inter, system-ui, -apple-system, sans-serif'
  const center = (t: string, x: number, y: number) => ctx.fillText(t, x - ctx.measureText(t).width / 2, y)

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  // grain
  ctx.fillStyle = 'rgba(120,100,70,0.04)'
  for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 6) ctx.fillRect(x, y, 1, 1)

  ctx.fillStyle = INK
  ctx.font = `600 44px ${serif}`
  center('Drape', W / 2, 100)
  ctx.fillStyle = SOFT
  ctx.font = `500 20px ${sans}`
  ctx.save()
  ctx.letterSpacing = '6px'
  center('P E R S O N A L   C O L O R   C A R D', W / 2, 138)
  ctx.restore()

  ctx.fillStyle = SOFT
  ctx.font = `500 22px ${sans}`
  center('YOUR SEASON', W / 2, 230)
  ctx.fillStyle = INK
  ctx.font = `600 96px ${serif}`
  center(result.season.season, W / 2, 320)
  ctx.fillStyle = ACCENT
  ctx.font = `italic 34px ${serif}`
  center(result.palette.tagline, W / 2, 372)

  // coloring
  const coloring = [
    { label: 'Skin', hex: result.tone.skin_color },
    { label: 'Eyes', hex: result.tone.eye_color },
    { label: 'Lips', hex: result.tone.lip_color },
  ]
  const cw = 130, startX = W / 2 - (coloring.length * cw) / 2 + cw / 2
  coloring.forEach((c2, i) => {
    const x = startX + i * cw
    ctx.fillStyle = c2.hex
    ctx.beginPath()
    ctx.arc(x, 470, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = `600 20px ${sans}`
    center(c2.label, x, 535)
    ctx.fillStyle = SOFT
    ctx.font = `500 16px ${sans}`
    center(c2.hex.toUpperCase(), x, 558)
  })

  // palette grid
  ctx.fillStyle = SOFT
  ctx.font = `500 22px ${sans}`
  center('YOUR PALETTE', W / 2, 640)
  const cols = 5, sw = 176, gap = 18
  const gridW = cols * sw + (cols - 1) * gap
  const gx = (W - gridW) / 2
  result.palette.colors.slice(0, 10).forEach((col, i) => {
    const r = Math.floor(i / cols), cc = i % cols
    const x = gx + cc * (sw + gap)
    const y = 680 + r * (sw + 46)
    ctx.fillStyle = col.hex
    roundRect(ctx, x, y, sw, sw, 16)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.stroke()
    ctx.fillStyle = readable(col.hex)
    ctx.font = `600 15px ${sans}`
    const name = col.name.length > 13 ? col.name.slice(0, 12) + '…' : col.name
    ctx.fillText(name, x + 12, y + sw - 14)
  })

  ctx.strokeStyle = LINE
  ctx.beginPath()
  ctx.moveTo(80, 1250)
  ctx.lineTo(W - 80, 1250)
  ctx.stroke()
  ctx.fillStyle = SOFT
  ctx.font = `500 22px ${sans}`
  // Read the host at download time rather than hardcoding it: the card is the one asset
  // people share, so it must not carry a stale domain if the deployment ever moves.
  const host = typeof window === 'undefined' ? '' : window.location.host
  center(`${host}  ·  Skin AI + Apparel VTO`, W / 2, 1295)

  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png', 0.95))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `drape-${result.season.season.replace(/ /g, '-').toLowerCase()}.png`
  a.click()
  URL.revokeObjectURL(url)
}
