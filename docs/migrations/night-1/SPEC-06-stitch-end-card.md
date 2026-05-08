# SPEC-06 — ffmpeg Stitch Service + Universal End Card

**Status:** unimplemented
**Files to create:** `api/stitch.js`, `api/lib/endCard.js`, Supabase storage bucket `tenant-brand-assets`
**Depends on:** SPEC-01 (provides beat clips), SPEC-04 (story format determines stitch shape), Brand Memory (per-tenant logo + tagline)
**Consumed by:** SPEC-07 (cron triggers stitch after generation)

## Purpose

Reels = N beat clips + brand end card, stitched into one 15s file. The platform needs:

1. A deterministic ffmpeg recipe that handles 1-beat / 2-beat / 3-beat formats consistently
2. A pre-rendered end-card mp4 per tenant (logo + tagline on black, fades in over 1s, holds, total 3s)
3. A stitch endpoint that takes job IDs from SPEC-01 and produces a final reel

**Why pre-rendered end card:** Each reel runs the same closer. Generating it fresh each time is waste; rendering once per tenant and re-using is deterministic and free.

## Reel structure — locked at 15s total

```
[Beat 1]  [Beat 2 (with 0.3s fade-out at end)]  [End card (3s)]
```

| Format    | Beat 1 | Beat 2 | Beat 3 | End card | Total |
|-----------|--------|--------|--------|----------|-------|
| 1-beat    | 12s (last 0.3s fade-out) | — | — | 3s | 15s |
| 2-beat    | 6s     | 6s (last 0.3s fade-out) | — | 3s | 15s |
| 3-beat    | 4s     | 4s     | 4s (last 0.3s fade-out) | 3s | 15s |

Aspect: 1080×1920 (9:16). Codec: h.264 high profile, yuv420p, 30fps, CRF 19, faststart. Audio omitted (or silent track if Reels API requires one).

## End-card construction (one-time per tenant)

`api/lib/endCard.js`:

```js
/**
 * Build the per-tenant end-card mp4 from the tenant's brand mark + tagline.
 * Produces a 3s 1080x1920 mp4 with fade-in and stores it in Supabase Storage.
 *
 * @param {Object} args
 * @param {string} args.tenantId
 * @param {Object} args.endCardSpec — { logoSeal, wordmark, tagline, palette, durationSec }
 * @returns {string} storage path of the resulting mp4
 */
export async function buildTenantEndCard(args);
```

Two paths supported:

### Path A — Higgsfield-rendered design + ffmpeg fade-in (preferred, more cinematic)

1. Generate a 9:16 still via `nano_banana_2` with the tenant's logo seal as reference image:
   ```
   "Luxury brand end card, 9:16 vertical, deep matte black background.
    The {brand} monogram seal in {goldOrAccent} centered upper third...
    Below: '{wordmark}' in serif. Below: '{tagline}' in italic serif.
    Generous black negative space. No motion blur, no patterns."
   ```
2. ffmpeg fade-in (1.2s) on the static frame, hold for 1.8s = 3s total.

### Path B — Pure ffmpeg from raw assets (deterministic fallback)

1. Take tenant's `logo_seal.png` (square)
2. Pad to 1080×1920 black canvas, seal centered upper third
3. drawtext for wordmark + tagline using bundled serif font
4. Fade in over 1.2s, hold 1.8s

The ffmpeg command (Path A — animation of an existing static frame):

```bash
ffmpeg -y -loop 1 -t 3 -i "{endCardFrame}.png" \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fade=t=in:st=0:d=1.2" \
  -c:v libx264 -pix_fmt yuv420p -r 30 -preset slow -crf 18 -movflags +faststart \
  "{tenantId}_endcard_9x16.mp4"
```

Stored at `tenant-brand-assets/{tenantId}/endcard_9x16.mp4`.

## Stitch endpoint

`POST /api/stitch`:

```json
{
  "action": "stitch_reel",
  "tenantId": "<tenant-id>",
  "reelId": "uuid",
  "format": "2-beat",
  "beatJobIds": ["job_b1", "job_b2"],
  "outputPath": "generation-outputs/<tenant>/<date>/<reel>.mp4"
}
```

Flow:
1. Resolve `beatJobIds` to mp4 URLs from `generation_jobs`
2. Resolve tenant's end-card from `tenant-brand-assets/{tenantId}/endcard_9x16.mp4`
3. Download all to ephemeral storage
4. Run the stitch ffmpeg command (recipe locked below)
5. Upload result to Supabase Storage at `outputPath`
6. Insert row into `reels` table with metadata
7. Return signed URL

Response:
```json
{ "ok": true, "reelUrl": "...", "durationSec": 14.97, "fileSizeMb": 5.4 }
```

## The stitch recipe (LOCKED — verified 14.97s ≈ 15s)

For 2-beat (6s + 6s + 3s end card):

```bash
ffmpeg -y \
  -i {beat1.mp4} -i {beat2.mp4} -i {endcard.mp4} \
  -filter_complex "
    [0:v]format=yuv420p,setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30[v0];
    [1:v]format=yuv420p,setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,fade=t=out:st=5.7:d=0.3[v1];
    [2:v]format=yuv420p,setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30[v2];
    [v0][v1][v2]concat=n=3:v=1:a=0[outv]
  " -map "[outv]" \
  -c:v libx264 -pix_fmt yuv420p -r 30 -preset medium -crf 19 \
  -movflags +faststart \
  {output.mp4}
```

For 1-beat: input count = 2 (beat + end card), `fade=t=out:st=11.7:d=0.3` on the long beat.
For 3-beat: input count = 4, fade on the 3rd beat at `st=3.7:d=0.3`.

`api/lib/endCard.js` exports a function that emits the right command per format:

```js
export function buildStitchCommand({ format, beatPaths, endcardPath, outputPath });
```

## Vercel edge function constraint (CRITICAL)

ffmpeg is not available in Vercel's edge runtime by default. Three options:

| Option | Pros | Cons |
|---|---|---|
| **A. Vercel Functions (Node)** with `ffmpeg-static` npm | No infra, just code | Function execution timeout (10s default, 60s max on Pro). 6+6+3 stitch is fast but chunky uploads can exceed. |
| **B. Supabase Edge Function with ffmpeg-wasm** | Same vendor as DB | Slower than native ffmpeg; ~2-3x execution time |
| **C. Background worker on a small VPS** ($5/mo) | Native ffmpeg, no timeout | Adds infra |

**Recommend A** for now (Vercel Functions Pro tier with 60s timeout is plenty for this workload). Migrate to C only if scaling demands.

## Edge cases

1. **Beat clip aspect not 9:16** — the filter pads to 1080×1920 with black; safe but log warning so the calling code re-generates.
2. **End-card missing for tenant** — onboarding should create one; if absent, generate on-the-fly using Path B (deterministic fallback) and warn operator.
3. **Stitch produces wrong duration** — assert `15.0 ± 0.2s` after ffmpeg returns; if outside tolerance, log + retry once with re-encoded beat clips.
4. **Tenant updates their logo/tagline** — mark old end card as `superseded_at`, rebuild, future reels use new. Old reels in flight finish with old end card.

## Test strategy

`tests/integration/stitch.test.js`:
- Use a fixture set of beat mp4s (small synthetic clips, 6s each) and a fixture tenant end card (3s, 1080×1920)
- Stitch using each format (1-beat / 2-beat / 3-beat) and assert each output duration is 15.0s ± 0.2
- Assert output is 1080×1920, h.264, 30fps in all three cases
- Visual snapshot test: ffmpeg-extracted frame at t=14.5s should match the fixture tenant's end-card frame (regression check that end card actually got appended)
