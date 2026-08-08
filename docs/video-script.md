# Drape demo video script

> **Rebuild the voiceover with** `node --env-file=.env.local scripts/build-voiceover.mjs`.
> Defaults are Sarvam `bulbul:v3`, voice `ashutosh` (override with `VO_MODEL` / `VO_SPEAKER`).
> Per-beat files land in `docs/voiceover/beat-NN.wav`.
>
> Hard ceiling **3:00**; judges are not required to watch past it. This draft is written to
> land near **2:40**, which leaves room for the voice to run slower than the last cut did.
> The published 2:49 cut read 544 words at 193 words per minute. Re-measure after
> generating: if it overruns, cut beat 14 before touching anything else.

Every number spoken below is real and reproducible in the live app:

| Claim | Where it comes from |
|---|---|
| confidence 41 / 100 | Light sample, `scoreConfidence('#BE9C82', quality, '#4F4030')` |
| ITA 42.4, boundary 41, gap 1.4 | `ita()` on the Light sample vs `THRESHOLDS.ITA_LIGHT` |
| climbs to 84 after correcting depth | same call with `corrected: ['depth']` |
| top match ΔE 4.5 | Uniqlo Gathered Babydoll Camisole, True Spring female |
| ΔE 2.3 just-noticeable difference | `describeDeltaE` bands in `lib/color/deltae.ts` |
| 353 garments | `lib/catalog.data.json` |
| 11 skin scores | `CONCERN_LABELS` in `lib/youcam/skin.ts` |
| 5 of 10 Monk tones misread | `/fairness`, computed live at render |
| 207 tests | `npm test` |
| 5 YouCam APIs | skin-tone-analysis, skin-analysis, cloth, scarf, hair-color |

**Superseded claims.** The previous cut said the top garment scored ΔE 1.0, "closer than
the human eye can detect". The palette separation work moved those colors, and the real
figure is now 4.5. Do not restore the old line.

---

## Beat sheet

Narration lives in one place only (the section below) so it cannot drift from the audio.
This table is just what is on screen for each beat.

| # | On screen |
|---|---|
| 1 | Try-on comparison, held: two shades on the same person |
| 2 | Landing page, scrolling past the "$150 in a studio" card |
| 3 | Capture screen, then a sample face; the reveal animates in |
| 4 | Travel down the reveal: the three axes, the measured colors, the palette grid |
| 5 | Settle on the confidence card |
| 6 | The score and the reason line, held |
| 7 | Tap Depth; the correction menu opens |
| 8 | Choose Medium; the season and the score re-derive |
| 9 | The studio, Colors tab, comparison rendering |
| 10 | Both figures land; hover the two badges |
| 11 | Scroll to "Shop your palette" |
| 12 | The garment grid, real products with prices |
| 13 | The top card and its ΔE badge |
| 14 | Hair tab, tap a shade; then Skin tab |
| 19 | Colors tab, "See a whole outfit", press Style a full look; it spins |
| 20 | The generated look lands |
| 15 | /fairness, the Monk Skin Tone table, old rule column |
| 16 | The before and after summary cards |
| 17 | /mcp, tools and a live response |
| 18 | Landing page, close |

---

## Narration only (for text to speech)

`scripts/build-voiceover.mjs` reads everything below the marker. Keep the `---` separators:
they are the beat boundaries, and each one gets its own audio file.

<!-- narration-start -->

This is one woman, photographed once, wearing the same garment in two colors. Watch her face rather than the shirt.

---

Some colors suit you and some drain you, and most people never find out which. A stylist will tell you for a hundred and fifty dollars. This is Drape. It answers the same question from one photo, in about twenty seconds, free.

---

You give it a selfie. Perfect Corp's YouCam API measures the real color of your skin, your eyes, your lips and your hair, straight off the image.

---

Our engine turns those measurements into your season. There are twelve, and each carries about a dozen shades chosen to sit well against your face.

---

Here is what most tools skip. Drape tells you how sure it is.

---

This read scores forty-one out of a hundred, and it says why in one line. Her depth measurement came in one point four from the boundary between light and medium. That close, it could go either way, so Drape says so.

---

And if you think it has read you wrong, you can overrule it.

---

Tap depth, choose medium, and the whole result recalculates in your browser. Confidence climbs to eighty-four, because you have just settled the one thing it was unsure about. That correction is free and calls no API.

---

Then it proves the answer on you. YouCam's virtual try-on paints the colors onto your own photo. One shade from your palette, and one taken deliberately from the opposite temperature.

---

Same garment, same face, same light. The color is the only thing that moved.

---

A palette you cannot buy is a piece of trivia.

---

So Drape ranks three hundred and fifty-three real garments you can order today. We did not trust the product names. Every one of those colors was measured from the retailer's own fabric photo.

---

This top match scores four point five. Below about two point three, most people cannot tell two colors apart at all, so on a shop floor this reads as her shade.

---

More in the studio. Your own hair color, held against the shades your season wears. Eleven skin scores from YouCam's skin analysis.

---

And you can ask it for a whole outfit. This one is generative rather than measured, so give it a moment to think.

---

Clothes, styling and setting, all built around True Spring. Inspiration, where the palette is the measurement.

---

Now the part we are least comfortable with. Color analysis was built around pale skin, so we tested our own engine against the Monk Skin Tone Scale, ten reference tones, and we failed. Our rule was reading dark skin as cool skin. It got five of the ten wrong, all at the light or deep ends.

---

So we rebuilt it on a different measurement, and we published the before and the after on the site. You can check our working instead of taking our word.

---

Underneath: five YouCam APIs, two hundred and seven tests, and the whole color engine open to AI agents over MCP.

---

Drape. One photo, the colors that suit you, worn on your own face, and clothes you can actually buy.
