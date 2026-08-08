import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import { classifySeason, type Undertone, type Depth, type Clarity } from '@/lib/color/season'
import { getPalette } from '@/lib/color/palettes'
import { scoreConfidence } from '@/lib/color/confidence'
import { deltaEHex, describeDeltaE } from '@/lib/color/deltae'
import { matchGarments } from '@/lib/catalog'
import { hairAdvice } from '@/lib/color/hair'
import { checkStock } from '@/lib/stock'

// Drape's color engine as an MCP server.
//
// Perfect Corp ships YouCam itself over MCP, so an agent can already ask it for the hex
// values of a face. What it cannot do is turn those into a season, a palette, and real
// garments ranked by measured color distance. That is what this exposes. Nothing here
// needs YouCam credentials: the engine is pure, so it composes with their MCP server
// rather than duplicating it.

export const runtime = 'nodejs'

const HEX = z
  .string()
  .regex(/^#?[0-9a-fA-F]{6}$/, 'expected a 6-digit hex color, for example #bd9a80')
  .transform((s) => (s.startsWith('#') ? s : `#${s}`))

const GENDER = z.enum(['female', 'male'])

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'analyze_season',
      {
        title: 'Analyze color season',
        description:
          'Turn measured facial colors into a 12-season color analysis. Give it the skin ' +
          'hex (and eye hex if you have it) as returned by YouCam Skin Tone Analysis. ' +
          'Returns the season, the three underlying axes, the palette, and a calibrated ' +
          'confidence score that says how trustworthy the read is and why.',
        inputSchema: z.object({
          skin_hex: HEX.describe('skin color, e.g. #bd9a80'),
          eye_hex: HEX.optional().describe('eye color; sharpens the clarity axis'),
          lighting: z
            .enum(['good', 'notgood'])
            .optional()
            .describe('YouCam face_quality.lighting, if known; poor lighting lowers confidence'),
        }),
      },
      async ({ skin_hex, eye_hex, lighting }) => {
        const season = classifySeason({ skinToneHex: skin_hex, eyeHex: eye_hex })
        const palette = getPalette(season.season)
        const confidence = scoreConfidence(skin_hex, { lighting }, eye_hex)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  season: season.season,
                  family: season.parent,
                  undertone: season.undertone,
                  depth: season.depth,
                  clarity: season.clarity,
                  measurements: {
                    hue_angle: +season.hue.toFixed(2),
                    ita: +season.ita.toFixed(2),
                    chroma: +season.chroma.toFixed(2),
                    lightness: +season.lightness.toFixed(2),
                  },
                  confidence: {
                    score: confidence.score,
                    level: confidence.level,
                    least_certain_axis: confidence.weakest,
                    reasons: confidence.reasons,
                  },
                  palette: {
                    tagline: palette.tagline,
                    why: palette.why,
                    colors: palette.colors.map((c) => ({ name: c.name, hex: c.hex })),
                    neutrals: palette.neutrals.map((c) => ({ name: c.name, hex: c.hex })),
                    hair: palette.hair.map((c) => ({ name: c.name, hex: c.hex })),
                    avoid: { name: palette.clash.name, hex: palette.clash.hex },
                  },
                },
                null,
                2,
              ),
            },
          ],
        }
      },
    )

    server.registerTool(
      'find_garments',
      {
        title: 'Find garments in your colors',
        description:
          'Rank real garments by how close their measured color is to a season palette, ' +
          'using CIEDE2000. Colors are measured from the retailer\'s own fabric swatch ' +
          'images, not from product titles, so a low delta E is evidence rather than a ' +
          'keyword guess. Only garments the retailer is currently selling are returned, ' +
          'so the links are safe to hand to a shopper. Returns product links.',
        inputSchema: z.object({
          skin_hex: HEX.describe('skin color; the season is derived from it'),
          eye_hex: HEX.optional().describe('eye color; sharpens the clarity axis'),
          gender: GENDER.default('female').describe('which half of the catalog to search'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(12)
            .default(6)
            .describe('how many matches to return; fewer come back if nothing else is within delta E 15'),
        }),
      },
      async ({ skin_hex, eye_hex, gender, limit }) => {
        const season = classifySeason({ skinToneHex: skin_hex, eyeHex: eye_hex })
        const palette = getPalette(season.season)
        // The website already hides sold-out colorways; an agent handing someone a dead
        // product link is worse, because nobody is looking at the page to notice.
        const { unavailable } = await checkStock()
        const matches = matchGarments(palette, gender, limit, unavailable)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  season: season.season,
                  matches: matches.map((m) => ({
                    retailer: m.retailer,
                    product: m.name,
                    color: m.colorName,
                    measured_hex: m.measuredHex,
                    delta_e: +m.deltaE.toFixed(2),
                    verdict: m.verdict,
                    closest_palette_color: m.nearest.name,
                    url: m.productUrl,
                  })),
                  note:
                    matches.length < limit
                      ? 'Fewer results than requested: anything beyond delta E 15 is not this palette and is not returned.'
                      : undefined,
                },
                null,
                2,
              ),
            },
          ],
        }
      },
    )

    server.registerTool(
      'check_color',
      {
        title: 'Check whether a color suits someone',
        description:
          'Answer "does this specific color suit me?" for a garment the shopper is already ' +
          'looking at. Returns the CIEDE2000 distance to the nearest color in their palette ' +
          'and a plain-language verdict. Under 2.3 is a just-noticeable difference; beyond ' +
          '15 the color is not in the palette.',
        inputSchema: z.object({
          skin_hex: HEX.describe('the shopper, e.g. #bd9a80'),
          eye_hex: HEX.optional().describe('eye color; sharpens the clarity axis'),
          garment_hex: HEX.describe('the color being considered, e.g. #1f5f5b'),
        }),
      },
      async ({ skin_hex, eye_hex, garment_hex }) => {
        const season = classifySeason({ skinToneHex: skin_hex, eyeHex: eye_hex })
        const palette = getPalette(season.season)
        let best = palette.hero
        let bestD = deltaEHex(garment_hex, palette.hero.hex)
        for (const c of palette.colors) {
          const d = deltaEHex(garment_hex, c.hex)
          if (d < bestD) {
            bestD = d
            best = c
          }
        }
        const clash = deltaEHex(garment_hex, palette.clash.hex)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  season: season.season,
                  garment_hex,
                  delta_e: +bestD.toFixed(2),
                  verdict: describeDeltaE(bestD),
                  closest_palette_color: { name: best.name, hex: best.hex },
                  suits_them: bestD <= 15,
                  nearer_to_the_shade_to_avoid: clash < bestD,
                },
                null,
                2,
              ),
            },
          ],
        }
      },
    )

    server.registerTool(
      'check_hair',
      {
        title: 'Check hair color against the season',
        description:
          'Compare the hair color measured from a photo against the shades the wearer\'s ' +
          'season calls for. YouCam Skin Tone Analysis returns hair alongside skin and eyes, ' +
          'so this needs no extra capture. Returns the nearest in-season shade, the CIEDE2000 ' +
          'distance to it, and the full set of shades for that season.',
        inputSchema: z.object({
          skin_hex: HEX.describe('skin color; the season is derived from it'),
          hair_hex: HEX.describe('hair color as measured, e.g. #3a2a20'),
          eye_hex: HEX.optional().describe('eye color; sharpens the clarity axis'),
        }),
      },
      async ({ skin_hex, hair_hex, eye_hex }) => {
        const season = classifySeason({ skinToneHex: skin_hex, eyeHex: eye_hex })
        const palette = getPalette(season.season)
        const advice = hairAdvice(hair_hex, palette)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  season: season.season,
                  measured_hair: hair_hex,
                  in_range: advice.inRange,
                  delta_e: +advice.deltaE.toFixed(2),
                  nearest_shade: { name: advice.nearest.name, hex: advice.nearest.hex },
                  verdict: advice.verdict,
                  season_hair_shades: palette.hair.map((h) => ({ name: h.name, hex: h.hex })),
                },
                null,
                2,
              ),
            },
          ],
        }
      },
    )

    server.registerTool(
      'correct_read',
      {
        title: 'Correct an axis of the analysis',
        description:
          'Re-derive the season with one or more axes set by hand. Use this when the shopper ' +
          'disagrees with the measured read, which is common when confidence is low. Costs ' +
          'nothing and needs no new photo: the classifier is deterministic.',
        inputSchema: z.object({
          skin_hex: HEX.describe('skin color, e.g. #bd9a80'),
          eye_hex: HEX.optional().describe('eye color; sharpens the clarity axis'),
          undertone: z.enum(['warm', 'cool', 'neutral']).optional().describe('override the measured undertone'),
          depth: z.enum(['light', 'medium', 'deep']).optional().describe('override the measured depth'),
          clarity: z.enum(['bright', 'true', 'soft']).optional().describe('override the measured clarity'),
        }),
      },
      async ({ skin_hex, eye_hex, undertone, depth, clarity }) => {
        const overrides = {
          undertone: undertone as Undertone | undefined,
          depth: depth as Depth | undefined,
          clarity: clarity as Clarity | undefined,
        }
        const measured = classifySeason({ skinToneHex: skin_hex, eyeHex: eye_hex })
        const corrected = classifySeason({ skinToneHex: skin_hex, eyeHex: eye_hex }, overrides)
        const palette = getPalette(corrected.season)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  measured_season: measured.season,
                  corrected_season: corrected.season,
                  axes_changed: corrected.corrected,
                  undertone: corrected.undertone,
                  depth: corrected.depth,
                  clarity: corrected.clarity,
                  palette: palette.colors.map((c) => ({ name: c.name, hex: c.hex })),
                },
                null,
                2,
              ),
            },
          ],
        }
      },
    )
  },
  {
    serverInfo: { name: 'drape', version: '1.0.0' },
    capabilities: { tools: {} },
    verboseLogs: false,
  },
)

export { handler as GET, handler as POST }
