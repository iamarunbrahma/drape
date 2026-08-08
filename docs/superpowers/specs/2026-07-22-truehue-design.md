# TrueHue - Design Spec

**Date:** 2026-07-22
**Author:** Arun (with Claude Code)
**Hackathon:** YouCam API Skin AI & Apparel VTO Hackathon (Perfect Corp) - track: **Combined (Skin AI + Apparel VTO)**
**Deadline:** 2026-08-17 11:45am EDT

## 1. Summary

TrueHue is an AI personal-color stylist. From a single selfie it reads the user's skin
undertone and depth, classifies them into a **12-season color palette**, and then presents
**apparel and accessories in the user's flattering colors - virtually tried on their own photo.**

One-liner: *"Stop guessing which colors suit you. TrueHue reads your skin and dresses you
in the colors that actually do - then lets you try them on."*

The two YouCam API families are wired **causally**: skin analysis is the engine that decides
the try-on palette. This is the anti-"surface-level wrapper" thesis the judges reward.

## 2. Positioning & why it wins

Consumer web app that doubles as an embeddable **retail conversion widget** ("Shop Your
Palette"). Retail framing is deliberate - it targets the 1st-place "marketing meeting" prize
and the *Potential Impact* criterion (color-match → confidence → fewer returns).

Mapped to the four judging criteria:

- **Quality of Idea (non-obvious):** skin analysis *causes* the apparel palette. Not two tabs.
- **Technological Implementation:** 4+ YouCam APIs + a genuine perceptual-color algorithm,
  async task polling, server-side key handling.
- **Design:** one coherent flow with a "wow" palette reveal, not a proof-of-concept.
- **Potential Impact:** personal color analysis is a real $100–300 paid service; TrueHue makes
  it free and instantly shoppable.

## 3. User flow (5 screens)

1. **Landing** - hook + "Find your colors" CTA.
2. **Capture** - webcam (YouCam JS Camera Kit) or upload a selfie; good-lighting guidance.
3. **The Reveal** - animated result: undertone, season (e.g. "Cool Summer"), palette swatches,
   and a short "why these colors" credibility note.
4. **Your Looks** - curated apparel + accessories filtered to the user's palette; tap any →
   **virtual try-on** on their photo. The hero interaction is a side-by-side
   *"your color vs. a clashing color"* try-on.
5. **Shop Your Palette** - shareable summary card + shop CTAs (retail-widget story).

## 4. The color-science engine (the differentiator)

Inputs from YouCam: skin-tone hex/RGB, Fitzpatrick type, and any matched lip/eye/hair colors.
Engine computes, in a perceptual color space (CIELAB / HCL):

- **Undertone** (warm / cool / neutral) ← hue balance of the skin-tone hex (a*/b* in Lab).
- **Value** (light / medium / deep) ← Fitzpatrick I–VI + skin lightness (L*).
- **Chroma** (bright / muted) ← saturation.

→ Classify into one of the **12 seasons** → map to a curated **palette (hex sets per season)** →
filter the catalog → drive the virtual try-on.

Design principle: **do not hard-depend on the API returning a clean undertone label.** Derive
the season from the returned skin-tone color values so the product is resilient to the API's
actual output shape. This algorithm (not the API) is TrueHue's IP and is what makes the
writeup credible. Exact API field names to be confirmed against the live API console.

## 5. APIs used (both tracks, on purpose)

**Skin AI:** AI Skin Tone Analysis, AI Fitzpatrick Scale Analyzer, (optional) AI Skin Analysis
mini-report for a "your skin at a glance" credibility panel.
**Apparel VTO:** AI Clothes V3 + 1–2 accessory APIs (Scarf & Earrings - most color-driven and
photogenic). Optional: AI Fabric to recolor a base garment into palette variants.

## 6. Architecture & stack

- **Next.js (App Router) + TypeScript + Tailwind**, deployed to **Vercel** (live URL for judges).
- YouCam calls run through **server-side API routes** - API key stays secret; routes own the
  async upload → task → poll lifecycle (webhooks optional).
- Client handles camera/upload and the reveal animation.
- Latest library docs pulled via **Context7** during build.

Units of isolation:
- `lib/youcam/` - typed client: auth, file upload, task submit, poll. One purpose: talk to YouCam.
- `lib/color/` - the color engine: skin values → season → palette. Pure, unit-testable, no I/O.
- `data/catalog` - curated garment/accessory items tagged by color/season.
- `app/api/*` - server routes orchestrating analysis and try-on.
- `app/(screens)` - the 5 UI screens.

Each unit: clear purpose, well-defined interface, independently testable.

## 7. Assets (copyright-safe)

Video rules forbid third-party trademarks and copyrighted music. Catalog = **brandless,
solid-color garments/accessories** tagged by color, spanning palettes. Source royalty-free
or generate flat-lays; optionally use AI Fabric to recolor a base garment. No logos, no
branded music in the video.

## 8. Demo video plan (1–3 min, YouTube)

Cold open on the palette reveal → the side-by-side "your color vs. clashing color" try-on →
~20-sec narration naming which YouCam APIs power each step → retail-value close. Recorded via
the browser harness; uploaded to the user's YouTube channel.

## 9. Risks & mitigations

- **API tone output differs from assumed** → engine derives season from hex; validate in API
  console before building the engine.
- **VTO realism on accessories** → pre-test each API on the demo photos; keep only clean renders.
- **Credit budget (1,000 units; ~9–12/skin task, per-task VTO)** → cache results, test on a few
  fixed photos, never burn units on reload.
- **Camera/upload edge cases** → support upload fallback; validate face presence before calling.

## 10. Success criteria

- Live Vercel URL where a judge can upload a selfie and get a real palette + real try-on.
- ≥4 YouCam APIs integrated and demonstrably working on the real API.
- Public GitHub repo with clear README + setup instructions.
- 1–3 min public YouTube demo, no trademarks/copyrighted music.
- Devpost submission complete (text, screenshots, video, repo) before 2026-08-17 11:45am EDT.

## 11. Sequence

Design approval → spec doc → implementation plan → set up Devpost + YouCam accounts (user's
browser) & redeem 1,000 units → build → deploy → validate on real API → record → upload → submit.
