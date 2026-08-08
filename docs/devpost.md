# Devpost submission copy

Paste into the Drape submission. Roughly 1,150 words, against 874 in the current version.
The strongest entries in this hackathon run 1,100 to 1,200.

**Tagline:** Color analysis that shows its work, admits when it is unsure, and proves it on
real clothes you can buy.

---

## Inspiration

Personal color analysis is a real, growing service: a stylist drapes fabric under your chin
and tells you which colors make you look alive. It costs $150 to $300 a session, it is huge
in Korea and Japan and now spreading in the US, and it has two problems.

The first is that it is opaque. You pay for a verdict. Analysts disagree with each other,
nobody shows you a measurement, and you have no way to tell a good read from a bad one.

The second problem is less discussed. The whole seasonal framework was built in the 1980s
around light, European skin, and the tooling that has grown up around it inherits that.
We did not set out to fix this. We found it in our own code, which is the more useful story.

## What it does

One selfie, and Drape gives you four things.

**Your coloring, measured.** YouCam Skin Tone Analysis returns the actual hex values of your
skin, eyes, lips, brows and hair, plus a quality check on the photo itself.

**Your season, with the reasoning attached.** Our engine converts skin color to CIELAB and
derives three axes: undertone from the hue angle, depth from ITA (the dermatology standard
for skin pigmentation), and clarity from chroma and skin-to-eye contrast. Those place you in
one of the 12 seasons. It is a deterministic classifier, not a language model guessing.

**A confidence score, and the ability to overrule it.** This is the part every other tool
hides. Drape tells you how sure it is and why, in the reading's own units. If your ITA is
42.4 and the light-to-medium boundary sits at 41, that is close to a coin flip, and we say
so instead of printing a verdict. If a poor photo shifted the read, we discount it and name
the reason. And if you disagree, you tap the axis and correct it. The season re-derives
instantly, locally, with no re-upload and no API call, because the engine is pure. Correct
the weak axis and confidence climbs, because a value you set by hand is no longer in doubt.

**Proof on your own body, and real clothes to buy.** YouCam Apparel VTO renders your palette
onto your photo. We put your best color next to a deliberately clashing one so you can see
the difference on yourself, in the same photo and the same light. Then we rank 353 real
garments by how close their color actually is to your palette.

## The part we are proudest of: we found a bias in our own engine

Drape originally read undertone from CIELAB **b\***, the yellow-to-blue axis. Warm skin is
more golden, so high b* meant warm. It is a reasonable-sounding rule and it is wrong.

b* is a *magnitude*, and colorfulness collapses at both ends of the human range. We checked
the rule against the [Monk Skin Tone Scale](https://skintone.google), the 10-shade reference
Google and Dr Ellis Monk published so systems can be evaluated across all skin rather than
the light-skewed Fitzpatrick set.

The old rule disagreed with the hue angle on **5 of the 10 reference tones, and every one of
them sat at the light or deep ends of the scale.** Monk tone 10 has a hue of 67 degrees,
plainly golden, but a b* of only 3.5, so the rule called it cool. It was reading "dark" as
"cool".

The hue angle does not have this problem: it is a direction, not a distance, so it does not
shrink as skin gets darker. We rebuilt undertone around it, folding the magenta wraparound
onto the cool side so a rosy reading at 345 degrees is not mistaken for extremely warm.
Across the same 10 tones the engine now reads 9 warm, 0 cool, 1 genuinely neutral, and no
tone is called cool merely for being dark.

We did not stop at claiming the fix. Hue is stable across depth but does get noisy as skin
approaches neutral grey, which is exactly what happens at the ends of the scale. So the
undertone axis is discounted when chroma is low, and confidence drops accordingly. The whole
comparison is computed live from the shipping engine at **/fairness**, and locked by a test
suite that includes the old rule as the thing being measured against.

## Real garments, verified by measurement

The weakest thing a color app can do is send you to a search box. Our first version did
exactly that, and the claim "real products in that exact color" was not true.

So we built a catalog of 353 real garments and **measured every color from the retailer's
own fabric swatch image** rather than typing in a hex we liked. That distinction is the whole
point: if we chose the colors, a close match would be circular and prove nothing. The
retailer chose them; we only measured. Each garment is then ranked against your palette by
**CIEDE2000**, and we show you the number. ΔE 4.4 is very close. Under 2.3 the human eye
cannot separate two colors at all. Anything beyond 15 is not your color and is not shown,
because padding the grid would be the same overclaim we set out to remove.

## Two surfaces beyond the app

**A retailer widget (`/retail`).** A mock product page using a real product's 14 real
colorways. Pick a shopper and the swatches reorder by measured color distance: for a Deep
Autumn, 3 of the 14 colors suit them, the reds and greens come to the front, and the pale
pinks and greys dim out at ΔE 23 to 35. The whole computation is client-side and
deterministic, so a retailer can personalise a product page without the shopper's photo ever
leaving their device.

**An MCP server (`/api/mcp`).** Perfect Corp ships YouCam itself over MCP, so an agent can
already ask it for the hex values of a face. What it cannot do is turn those into a season, a
palette, and real garments ranked by measured color distance. Drape exposes exactly that,
as four tools: `analyze_season`, `find_garments`, `check_color`, `correct_read`. It needs no
YouCam credentials of its own, because the engine is pure. It composes with their server
rather than duplicating it, which is the point.

```jsonc
{ "mcpServers": { "truehue": { "url": "https://drape-youcam.vercel.app/api/mcp" } } }
```

## How we built it

Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, `sharp`, deployed on Vercel.

Four YouCam APIs, chained so the skin read *causes* what the try-on shows:

| Step | YouCam API |
|---|---|
| Read your coloring | Skin Tone Analysis |
| Prove it on your body | Apparel VTO (AI Clothes) |
| A full editorial look | Generative scarf styling |
| Skin at a glance | Skin Analysis, 11 concern scores |

All calls are server-side; the API key never reaches the browser. S2S auth is RSA PKCS#1
v1.5 to a short-lived token. There is a unit-budget guard and per-IP rate limiting so the
public demo cannot be drained, plus bring-your-own-key for anyone who wants to spend their
own units.

**103 unit tests**, including the full 29-pair CIEDE2000 conformance set from Sharma, Wu &
Dalal (2005), and the Monk Skin Tone evenness suite.

Judges need no credentials and no credits: three sample faces ship with real, pre-captured
YouCam responses, so the entire experience including the skin report runs instantly and free.

## Challenges

The undertone bias above was the big one, and we only found it because we went looking with
a reference scale instead of trusting that our reasoning was sound.

The smaller one was resisting the urge to make the numbers look good. It would have been easy
to widen the ΔE cutoff and show eight matches instead of five, or to hide the confidence
score on the sample that scores 36. Both would have made the demo smoother and the product
worse.

## What's next

Take the retailer widget from a mock product page to a real catalog ingest, so a store can
point it at their own product feed and have colors measured from their own imagery. Color is
one cause of the roughly 45% of apparel returns driven by size, fit and color, and it is the
part a palette can actually fix.

## Try it

- **The studio:** https://drape-youcam.vercel.app
- **Does it work on every skin tone:** https://drape-youcam.vercel.app/fairness
- **Retailer widget:** https://drape-youcam.vercel.app/retail
- **MCP server:** https://drape-youcam.vercel.app/api/mcp
- **Code:** https://github.com/iamarunbrahma/drape

Three sample faces run instantly and free, with no key and no credits, so nothing here needs
credentials to evaluate.
