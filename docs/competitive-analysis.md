# TrueHue vs the field - competitive analysis and action plan

Researched 2026-08-02. Deadline **2026-08-17, 11:45 AM EDT** - 15 days left.
Submission is editable until the deadline, so everything below is actionable.

---

## 1. Verdict

**Do not change topic. Sharpen this one.**

TrueHue is a genuinely strong build: four YouCam APIs, real color science, a deployed
product, and the best-looking front end I saw in the field. Rebuilding from scratch in
15 days would throw away the two assets that are hardest to reproduce (the design and
the tested color engine) and land us somewhere worse.

But as submitted, TrueHue reads as **mid-field, not first place**. Three reasons:

1. **The lane is crowded.** Five of 27 submissions do seasonal color analysis. One of
   them has the same name.
2. **Our differentiators are asserted, not demonstrated.** The strongest claim on the
   page ("Each shade opens real products in that exact color") is backed by a Google
   Shopping text search.
3. **We have no honesty story.** Every project scoring well in this field makes
   calibrated uncertainty its centerpiece. We show a verdict with no confidence.

Fixing those three is roughly a week of work and moves us from "nice" to "contender".

---

## 2. The rules, and how we're scored

Four criteria, **25% each**, after a Stage One pass/fail viability check.

| Criterion | What it rewards |
|---|---|
| Technological Implementation | Depth of YouCam integration, code quality, non-trivial functionality |
| Design | A complete, coherent product - "not just a technical proof of concept" |
| Potential Impact | Credible solution to a real problem for a real audience |
| Quality of Idea | Creative, non-obvious API usage; understanding of the problem space |

Prizes: 1st $5,000 · 2nd $1,000 · 3rd–5th 5,000 API units. Winners announced Sept 4.

Two things worth internalising:

- **Design is 25%.** This is our strongest axis and we should not lose it.
- **Quality of Idea is 25%,** and it explicitly rewards *non-obvious*. "Seasonal color
  analysis" is now the single most obvious idea in this hackathon.

---

## 3. The field (27 submissions)

Every submission has a demo video, so there is no free win on the baseline check.

### Real threats

**Aloud** - *the likely front-runner.* Voice-first beauty AI a blind shopper can use
with the screen off. Grounds itself in the European Accessibility Act and the Sephora /
Fenty / Ulta accessibility lawsuits. Ships on web + iOS TestFlight + Android. Uses the
**YouCam MCP server**. Its standout move: it knows skin readings are less reliable on
deeper skin tones, so it lowers its own confidence and says so out loud. That is a
near-perfect answer to Impact *and* Quality of Idea. 2:55 video.

**GlowCast** - four YouCam APIs (skin analysis, facial color tones, clothes VTO, **AI
image generator**), event-driven framing, real weather data, four parallel try-on
renders, downloadable PDF plan. Directly overlaps our color-season feature and beats us
on breadth. 2:33 video.

**TrueHue (Mark Johnson)** - *same name, same concept.* Beats us on the two things we
lack: it shows **confidence and lets you correct a bad read** for free, and it puts
**real, color-verified eBay secondhand listings** on your body using CIEDE2000. 2:05
video. Weakness: requires a photo upload, no sample path, plainer UI.

**FitTruth** - disciplined and honest. Separates the VTO visual from deterministic fit
evidence, refuses to estimate a missing measurement ("uncertain, not guessed"), calls
YouCam's resource-deletion endpoint and shows a receipt, 52 gold test cases.

**LoopLook** - return-rescue workflow with careful consent, explicit limits ("VTO shows
appearance only, never fit"), and a seeded demo mode so judges need no credentials.

### Second tier
MirrorMe, naxora (5 APIs but shallow reasoning), BACKDROPIQ (novel scene-aware angle),
PerfectSkinDiary (actually shipped to the App Store), Undertone, FitDNA, FitLens,
FitSure, TREND//TWIN, TotalLook, Loom, CriShirt, Mirror Session, skinwise,
OurSkinOurFuture, Holistic Mirror.

### Not competitive
**Fintrex** - a personal-finance app with **no YouCam API at all**, spammed to 22
hackathons. Should fail Stage One. **The Wolf of the North** - 43-word writeup, broken
video link. **Universal Try-On** - no live demo, thin writeup. **IA Studio** - unrelated
Gemini console.

### The color-analysis lane is crowded
Ours · TrueHue (Johnson) · Undertone · GlowCast · LoopLook all read facial color tones
and derive a palette. Judges will see five of these. Being the fifth "we found your
season" demo is a scoring problem, not just an aesthetic one.

---

## 4. Where we actually stand

### Genuine strengths (keep these)
- **Design.** The editorial art direction is the best in the field. This is 25% of the score.
- **Four YouCam APIs** causally chained: skin-tone-analysis → our engine → cloth VTO →
  scarf generative styling, plus skin-analysis. Only GlowCast matches the depth; only
  naxora uses more, and shallowly.
- **Real IP.** CIELAB b\* undertone, ITA° depth, 12-season map, 33 unit tests. The
  12-season framework is the modern professional standard; several rivals use 4.
- **Free precomputed samples.** A judge sees the whole product in one click with no
  key, no upload, no credits. The rival TrueHue makes you upload. This is a real edge
  and we under-sell it.
- **Server-side keys, BYOK, unit-budget guard.** Production hygiene most entries lack.
- **The side-by-side proof** (`TryOnStudio` hero vs `clash`) is the strongest single
  visual in the category.

### Real gaps (these are what cost us the win)

**G1 - The shop claim is not true.** `lib/shop.ts` builds
`google.com/search?tbm=shop&q="Deep Teal men's shirt"`. The UI says *"Each shade opens
real products in that exact color."* Nothing verifies color. A judge who clicks will
see it. Meanwhile the rival color-verifies real eBay inventory with CIEDE2000 and
Undertone ΔE-scores a catalog. **This is our single biggest liability** - it is both a
missing feature and an overclaim.

**G2 - No confidence, no correction.** We print "Deep Autumn" as fact. We already
receive `face_quality` (lighting, frontal, faceangle) from the API and throw the signal
away. Rival TrueHue, Aloud and FitTruth all make honest uncertainty their centerpiece,
and it is clearly landing with this rubric.

**G3 - Skin Analysis is invisible on the demo path.** `Result.tsx:39` renders
`<SkinReport>` only when `personBlob` exists. Judges taking the sample path - the one we
promote as "instant & free" - never see one of our four APIs.

**G4 - The video is 1:13.** Second shortest of 27. The limit is 3:00. We are leaving
more than half the airtime on the table on the single artifact judges weigh most.
Aloud uses 2:55, naxora 2:57, GlowCast 2:33.

**G5 - We bury our best story.** Our README explains that naive hue thresholds
misclassify deep skin tones, which is why we use CIELAB b\* and ITA°. That is a
**fairness** result and we present it as a debugging anecdote. Aloud built its whole
impact case on exactly this insight.

**G6 - The retailer claim is unproven.** "For retailers, fewer returns and more sales"
is narration. Nothing demonstrates it.

### Minor
- Em dashes throughout user-facing copy (page title, hero, palette card), against your
  standing preference.
- Devpost writeup is 874 words vs 1,100–1,200 for the strongest entries.

---

## 5. Plan: 15 days

The through-line: **stop being the fifth color-season demo. Become the one that is
honest about uncertainty and works on every skin tone.**

That repositioning is free - it is already true of our engine - and it is the one story
in this lane nobody else in the color group has claimed.

### P0 - Close the credibility gaps (days 1–4)

**1. Ship a verified garment catalog.** Replace the Google search with 40–60 real
garments (name, retailer URL, product image, hex). Score each against the palette with
**CIEDE2000** and show the ΔE: *"Deep Teal - ΔE 3.1 from your Forest."* Sort by match.
The claim becomes true, demonstrable, and directly answers the rival's eBay feature.
`lib/color/` already has the primitives.

**2. Confidence and correction.** Derive a confidence band from `face_quality`
(lighting / frontal / faceangle) plus distance to the nearest season boundary in our
own classifier. Show it. When confidence is medium or low, say why. Let the user tap to
correct undertone or depth and re-derive **instantly, locally, at zero API cost** - our
classifier is deterministic and runs client-side. This neutralises the rival's headline
feature in about a day.

**3. Surface Skin Analysis on the sample path.** Precompute and ship a skin report for
the three sample faces so all four APIs are visible without an upload.

### P1 - Make the case (days 5–9)

**4. Fairness evidence.** Run the engine across a labelled set spanning light→deep and
publish a short results page: ITA°/b\* classification stability versus a naive
hue-threshold baseline, with the misclassifications the naive method produces on deep
tones. This is a defensible, measured, genuinely novel claim in this field.

**5. Re-shoot the video at 2:30–2:50.** Suggested beat sheet:
   - 0:00 hook - two shades on the same person, the drain is obvious
   - 0:15 the $150 studio problem, and that verdicts are opaque and unevenly reliable
   - 0:30 live read: skin, eyes, lips, **plus the confidence band and why**
   - 0:50 correction: tap, re-derive instantly, free
   - 1:10 the proof: side-by-side hero vs clash on your own photo
   - 1:35 **ΔE-verified real garments**, on your body
   - 2:05 fairness: the same pipeline across light/medium/deep, measured
   - 2:25 skin report + palette card + retailer embed
   - 2:40 close

**6. Rewrite the Devpost page** to ~1,100 words led by fairness and transparency, with
the evidence table and the ΔE catalog. Retitle around the new angle so it does not read
as a duplicate of the other TrueHue.

### P2 - If time allows (days 10–13)

**7. An MCP surface.** Perfect Corp's stated 2026 direction is AI agents and
developer-first APIs with native MCP, and they call out Claude by name. Exposing
TrueHue's engine as an MCP tool ("analyze this face, return season + palette + ΔE-ranked
garments") speaks directly to the sponsor's roadmap. Aloud already does this; nobody in
the color lane does.

**8. Retailer embed.** A small iframe widget dropped onto a mock product page that
reorders colorways by the shopper's palette. Turns the B2B claim into something judges
can see. Ground it in the real number: **sizing, fit and color drive ~45% of apparel
returns**, and apparel returns run 20–30%.

### Days 14–15
Freeze, re-test both demo paths end to end, proofread, submit early. Strip em dashes
from user-facing copy while you're in there.

---

## 6. On starting over

Rules permit a second submission if it is "substantially different", and each project
can win only one prize. So a second entry is technically another shot on goal.

I would not. Splitting 15 days across two projects gets you two mid-field entries
instead of one contender, and the strongest thing we have - the design and a tested
color engine - is exactly what a new topic throws away. The empty niches I found
(accessibility, agentic/MCP, B2B tooling) are either already occupied by a strong entry
or reachable *from* TrueHue as P2 items.

**Sharpen this one.**

---

## 7. Honest expected outcome

- **As submitted today:** likely 4th–8th. Good product, crowded idea, unproven claims.
- **With P0 + P1:** credible top 3. The fairness angle plus ΔE-verified inventory plus
  honest confidence is a combination nobody else in this field has assembled.
- **With P2 as well:** competitive with Aloud for 1st, on a different axis - Aloud owns
  accessibility, we would own measured fairness plus a real shoppable funnel.

Aloud is the entry to beat. Its impact story is exceptional and hard to out-argue
head-on, which is exactly why we should not try to; we should win on rigor and on
turning the analysis into a purchase.
