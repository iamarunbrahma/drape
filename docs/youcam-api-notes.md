# YouCam API - verified integration notes

Living doc of what's been confirmed against the **live** API. Update as we learn more.

## Credentials
- Stored in `.env.local` (gitignored): `YOUCAM_API_KEY` (client_id), `YOUCAM_SECRET_KEY` (RSA public key, base64 SPKI/X.509 DER).
- Balance confirmed **1,040 units** (1,000 redeemed via the hackathon code + 40 bonus).

## Base host
`https://yce-api-01.perfectcorp.com`

## Authentication (VERIFIED WORKING)
1. Build payload string: `client_id=<API_KEY>&timestamp=<epoch_ms>`
2. RSA-encrypt it with the secret key as an RSA **public** key, padding **PKCS#1 v1.5** (`RSA_PKCS1_PADDING`, NOT OAEP). Wrap the base64 secret in PEM:
   `-----BEGIN PUBLIC KEY-----\n<64-char lines>\n-----END PUBLIC KEY-----`
3. base64-encode the ciphertext → this is `id_token`.
4. `POST /s2s/v1.0/client/auth` with JSON `{ "client_id": <API_KEY>, "id_token": <base64> }`.
5. Response: `{ status:200, result:{ access_token } }`. Token valid **2 hours**.
6. Use `Authorization: Bearer <access_token>` on all subsequent calls.

Key note: the 1024-bit RSA key + PKCS#1 v1.5 leaves ~117 plaintext bytes; our payload (~98 bytes) fits one block.

## Credit / units (VERIFIED)
- `GET /s2s/v1.0/client/credit` → `{ status:200, results:[ { id, type:"ApiPaygToken", amount, amount_dec, expiry(ms) }, ... ] }`. Free to call. Sum `amount` across results for total balance.

## Task API pattern (v2) - VERIFIED
1. **Register file:** `POST /s2s/v2.0/file/{feature}` body `{ files:[{ content_type, file_name, file_size }] }`
   → `{ data:{ files:[{ file_id, requests:[{ method:"PUT", url:<presigned S3>, headers:{Content-Length,Content-Type} }] }] } }`
2. **Upload bytes:** `PUT` the raw file to `requests[0].url` with EXACTLY the returned headers.
3. **Start task:** `POST /s2s/v2.0/task/{feature}` with a **flat** body (params below) → `{ data:{ task_id } }`.
4. **Poll:** `GET /s2s/v2.0/task/{feature}/{task_id}` → `{ data:{ task_status, error, results } }`.
   `task_status` ∈ running | success | error. On success, `results.url` is a presigned S3 URL (JPG or ZIP).
- Rate limit: 250 req / 300 s per IP and per token (5 QPS). The host occasionally has slow (>10s) connects - **use retry + timeout** (see `fetchRetry`).
- **Failed tasks do NOT consume units** (validation errors are free). Units deducted only on `success`.

## Valid feature slugs (probed)
Skin: **`skin-analysis`**, **`skin-tone-analysis`**, `skin-simulation`, `aging`, `hair-color`.
Apparel/VTO: **`cloth`**, **`scarf`**, `shoes`, `hat`, `bag`, `fabric`.
(NOT valid: skin-tone, fitzpatrick, ai-clothes, earrings, necklace, ring, bracelet, watch - not enabled/other names.)

## skin-tone-analysis - THE ENGINE INPUT (verified)
- Request: `{ src_file_id }`. Needs a clear face; min image size applies (use ≥1080px long side to be safe).
- Response `data.results`:
  ```json
  { "color": { "skin_color":"#bd9a80", "lip_color":"#e196a6", "eye_color":"#231f23",
      "eye_color_name":"Brown", "eyebrow_color":"#5b575a", "hair_color":"#42280E", "hair_color_name":"Brown" },
    "face_quality": { "has_face":true, "area":"good", "frontal":"notgood", "lighting":"good", "faceangle":"leftward" } }
  ```
- `skin_color` hex → undertone/value/season engine. lip/eye/hair → enrich the palette story. `face_quality` → capture guidance.
- Fixture: `docs/fixtures/skin-tone-analysis.sample.json`.

## skin-analysis - skin health report (verified)
- Request: `{ src_file_id, dst_actions:[...] }`. **`hd_*` actions require long side ≥1080px** (else `error_below_min_image_size`); SD actions (no prefix) need ≥480px.
- Valid `dst_actions`: hd_wrinkle, hd_pore, hd_texture, hd_acne, hd_oiliness, hd_radiance, hd_eye_bag, hd_age_spot, hd_dark_circle, hd_droopy_upper_eyelid, hd_droopy_lower_eyelid, hd_firmness, hd_moisture, hd_redness, hd_tear_trough, hd_skin_type (+ SD variants w/o `hd_` prefix, `dark_circle_v2`).
- Response `results.url` → a **ZIP** containing `score_info.json` + per-concern mask PNGs (`hd_*_output.png`) + `resize_image.jpg`.
- `score_info.json`: each concern `{ raw_score, ui_score (0-100, higher=better), output_mask_name }`; `hd_skin_type` → whole/t_zone/u_zone `{ skin_type: Normal|Oily|Dry|Combination }`. (No skin_age observed in this response.)
- Fixture: `docs/fixtures/skin-analysis.score_info.json`.

## cloth - FAITHFUL color try-on (verified, HERO VTO)
- Request: `{ src_file_id, garment_category, ref_file_id | ref_file_url | template_id }`.
- `garment_category` ∈ **upper_body** | lower_body | full_body | shoes | auto.
- Transfers the ref garment's **actual appearance + color** onto the person (color-faithful). Clean **complete flat-lay** garment refs drape best; messy/partial refs drape poorly.
- **Recolor strategy:** base white tee flat-lay (e.g. `tee5.jpg`) × palette hex via ImageMagick `-compose Multiply` → clean colored garment (free, no units). Verified faithful (teal ref → teal tee on model).
- `ref_file_url` allowed → on Vercel, pass hosted `/public/catalog/*.jpg` URLs directly (no upload step).

## scarf - GENERATIVE editorial styling (verified, BONUS)
- Request: `{ src_file_id, gender(female|male), ref_file_id|ref_file_url, style? }`. `style` ∈ random | style_french_elegance | style_light_luxury | style_cottagecore | style_modern_chic | style_bohemian.
- Produces a full generative styled scene (coat/scarf/background) - stunning but **does NOT preserve exact ref color**. Use for a "styled look" wow moment, not exact-color claims.

## Auth resilience
Add retry+timeout on all calls (`fetchRetry`, 5 tries, 20s timeout). The API host intermittently connects slowly.
