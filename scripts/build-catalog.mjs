// Builds the verified garment catalog.
//
// Every color in the catalog is MEASURED from the retailer's own fabric swatch image,
// never typed in by us. That is the whole point: if we picked the hex ourselves, the
// ΔE match would be circular and would prove nothing. Uniqlo chose these colorways;
// we only measure what they actually are.
//
// Product names, color names and colorway lists come from Uniqlo's public commerce API.
//
// Run: node scripts/build-catalog.mjs   (writes lib/catalog.data.json)

import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'

// Real Uniqlo US product ids, collected from their men's and women's t-shirt and tops
// listings. A few appear in both listings; whichever we see first wins.
const MEN = ['455365', '422992', '487962', '465185', '482299', '482766', '457517', '465193',
  '486103', '474244', '482301', '485455', '465189', '450179', '483970', '489013', '475376',
  '483924', '465187', '487898', '482514', '481004', '487302', '484508', '484780', '461003',
  '479791', '486111', '452402', '433028']
const WOMEN = ['424873', '465760', '482195', '480054', '483458', '484457', '483535', '485719',
  '487819', '465755', '482979', '487119', '488280', '489372', '487579', '473977', '483523',
  '482148', '482839', '473980', '485673', '488457', '489044', '487202', '457912', '489483',
  '487118', '487120', '487121', '487908', '483536', '465751', '488298', '470143', '478965',
  '480868', '460407', '489040', '487595', '489682', '485808']

const API = 'https://www.uniqlo.com/us/api/commerce/v5/en'
const UA = { 'User-Agent': 'Mozilla/5.0' }

const chipUrl = (goods, code) =>
  `https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/${goods}/chip/goods_${code}_${goods}_chip.jpg`
const itemUrl = (goods, code) =>
  `https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/${goods}/item/goods_${code}_${goods}_3x4.jpg?width=400`
const productUrl = (goods, code) =>
  `https://www.uniqlo.com/us/en/products/E${goods}-000/00?colorDisplayCode=${code}`

/** Uniqlo serves a tiny placeholder rather than a 404 for colorways that do not exist. */
const MIN_BYTES = 500

const toHex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
const titleCase = (s) =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim()

async function json(url) {
  const r = await fetch(url, { headers: UA })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

/** Product name plus the list of colorways the retailer actually sells. */
async function productMeta(goods) {
  const id = `E${goods}-000`
  const [search, details] = await Promise.all([
    json(`${API}/products?productIds=${id}&limit=1`),
    json(`${API}/products/${id}/price-groups/00/details`),
  ])
  const item = search.result?.items?.[0]
  const colors = details.result?.colors ?? []
  if (!item?.name || colors.length === 0) return null
  return {
    name: item.name,
    colors: colors
      .filter((c) => c.display?.showFlag !== false)
      .map((c) => ({ code: c.displayCode, name: titleCase(c.name) })),
  }
}

/** The true color of the fabric, read off the retailer's own swatch photo. */
async function measureChip(goods, code) {
  let res
  try {
    res = await fetch(chipUrl(goods, code), { headers: UA })
  } catch {
    return null
  }
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength < MIN_BYTES) return null

  try {
    const meta = await sharp(buf).metadata()
    if (!meta.width || !meta.height) return null
    // Sample the middle 50% so chip borders and JPEG edge ringing cannot bias the read.
    const { data } = await sharp(buf)
      .extract({
        left: Math.round(meta.width * 0.25),
        top: Math.round(meta.height * 0.25),
        width: Math.round(meta.width * 0.5),
        height: Math.round(meta.height * 0.5),
      })
      .resize(1, 1, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true })
    return toHex(data[0], data[1], data[2])
  } catch {
    return null
  }
}

async function collect(ids, gender, taken) {
  const items = []
  for (const goods of ids) {
    if (taken.has(goods)) continue
    taken.add(goods)
    let meta
    try {
      meta = await productMeta(goods)
    } catch {
      continue
    }
    if (!meta) continue

    const measured = await Promise.all(
      meta.colors.map(async (c) => {
        const hex = await measureChip(goods, c.code)
        return hex ? { ...c, hex } : null
      }),
    )
    for (const c of measured.filter(Boolean)) {
      items.push({
        id: `uniqlo-${goods}-${c.code}`,
        retailer: 'Uniqlo',
        name: meta.name,
        colorName: c.name,
        colorCode: c.code,
        category: 'upper_body',
        gender,
        measuredHex: c.hex,
        swatchUrl: chipUrl(goods, c.code),
        imageUrl: itemUrl(goods, c.code),
        productUrl: productUrl(goods, c.code),
      })
    }
    console.log(`  ${goods}  ${meta.name.slice(0, 44).padEnd(44)} ${measured.filter(Boolean).length}/${meta.colors.length}`)
  }
  return items
}

const taken = new Set()
console.log("men's:")
const men = await collect(MEN, 'male', taken)
console.log("\nwomen's:")
const women = await collect(WOMEN, 'female', taken)

// Drop duplicate colors within a gender so the grid never shows the same shade twice.
const seen = new Set()
const deduped = [...men, ...women].filter((i) => {
  const key = `${i.gender}:${i.measuredHex}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

const out = {
  source: "Uniqlo US public commerce API and product image CDN",
  measuredAt: new Date().toISOString().slice(0, 10),
  method: 'mean of the central 50% of each fabric swatch image, sRGB',
  items: deduped,
}
await writeFile(new URL('../lib/catalog.data.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log(`\nwrote ${deduped.length} garments  (male ${deduped.filter((i) => i.gender === 'male').length}, female ${deduped.filter((i) => i.gender === 'female').length})`)
