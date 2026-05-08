# SPEC-01 — Generation Engine

**Status:** unimplemented
**Files to create:** `api/generate.js`, `api/lib/providerRouter.js`
**Depends on:** SPEC-02 (Asset Prompt Library), SPEC-05 (Source Index — for packshot resolution)
**Consumed by:** SPEC-04 (Story Bank → reel beat frames), SPEC-06 (Stitch service), SPEC-07 (Weekly cron)

## Purpose

Single edge function that orchestrates AI image and video generation across providers. Handles:

- Provider abstraction (Higgsfield / Runware / fal.ai / HeyGen) behind a uniform interface
- Reference media upload + confirmation flow
- Job submission + status polling
- Result retrieval (raw URL + thumbnail)
- Known-bad-combo routing (skip gated/unworkable models)
- Brand-aware prompt assembly (pulls from SPEC-02)

The frontend never talks to provider APIs directly. The frontend calls `/api/generate` with intent, the engine handles the rest.

## Public API contract

`POST /api/generate` — Vercel Edge Function, mirrors `api/social.js` shape.

### Action: `upload_reference`
Upload a reference image (e.g. packshot) to the active provider, return a `media_id` callable in subsequent generations.

Request:
```json
{
  "action": "upload_reference",
  "tenantId": "<tenant-id>",
  "provider": "higgsfield",
  "filename": "AYS-002_packshot_b.png",
  "fileBytesBase64": "..."  // or "fileUrl" for already-public assets
}
```

Response:
```json
{ "ok": true, "mediaId": "a43608ea-...", "provider": "higgsfield", "expiresAt": "..." }
```

Implementation note: For Higgsfield this is a 3-step dance (`media_upload` returns presigned URL → curl PUT bytes → `media_confirm` with type `image`). The engine hides this from callers.

### Action: `generate_image`
Generate a single still image.

Request:
```json
{
  "action": "generate_image",
  "tenantId": "<tenant-id>",
  "provider": "higgsfield",
  "model": "nano_banana_2",
  "aspectRatio": "9:16",
  "resolution": "2k",
  "promptIntent": {
    "kind": "feed_hero",        // or "story", "carousel_1", "carousel_2_ingredient", "carousel_3_texture", "pin_2x3", "reel_beat_1_frame", ...
    "skuId": "AYS-002",
    "story": null,              // if reel beat, the story id from SPEC-04
    "register": "royal",
    "lane": "cinematic",
    "extra": {                  // free-form, merged into prompt template variables
      "barColor": "deep oud-brown (almost black-brown), NOT GREEN",
      "boxColor": "gold/mustard-yellow with cream-yellow filigree border"
    }
  },
  "referenceMediaId": "a43608ea-..."
}
```

Response:
```json
{ "ok": true, "jobId": "...", "status": "pending", "provider": "higgsfield" }
```

The prompt is assembled server-side using SPEC-02. The frontend does NOT construct prompts.

### Action: `generate_video`
Generate a single 4–15s video clip from a start frame.

Request:
```json
{
  "action": "generate_video",
  "tenantId": "<tenant-id>",
  "provider": "higgsfield",
  "model": "cinematic_studio_3_0",
  "aspectRatio": "9:16",
  "duration": 6,
  "startImageJobId": "edd88b1d-...",  // job id from a prior generate_image call
  "promptIntent": {
    "kind": "reel_beat",
    "story": "story_02_the_arrival",
    "beat": 1,
    "extra": {}
  }
}
```

Response: same as `generate_image`.

### Action: `job_status`
Poll a single or batch of jobs.

Request: `{ "action": "job_status", "jobIds": [...] }`
Response: `{ "ok": true, "results": [{ "jobId", "status": "pending|in_progress|completed|nsfw|failed", "rawUrl?": "...", "thumbnailUrl?": "..." }, ...] }`

### Action: `models_explore`
List or get a model's capabilities (passes through to provider).

Request: `{ "action": "models_explore", "provider": "higgsfield", "subAction": "search|get|list", "query": "...", "modelId": "..." }`
Response: provider-specific metadata.

## Data model — Supabase

### `generation_jobs` table
```sql
create table generation_jobs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text not null,
  provider        text not null,           -- 'higgsfield' | 'runware' | 'falai' | 'heygen'
  provider_job_id text not null,           -- their job id
  type            text not null,           -- 'image' | 'video'
  intent_kind     text not null,           -- 'feed_hero' | 'story' | 'carousel_1' | ...
  sku_id          text,
  story_id        text,                    -- nullable, only for reel beats
  beat            int,                     -- nullable
  status          text not null default 'pending', -- 'pending'|'in_progress'|'completed'|'nsfw'|'failed'
  raw_url         text,
  thumbnail_url   text,
  prompt_used     text,                    -- final assembled prompt (stored for debug + regression replay)
  prompt_intent   jsonb not null,          -- the structured intent that fed the prompt assembly
  created_at      timestamptz default now(),
  completed_at    timestamptz
);
create index on generation_jobs (tenant_id, status, created_at desc);
```

### `media_uploads` table
```sql
create table media_uploads (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null,
  provider      text not null,
  provider_id   text not null,             -- the media_id Higgsfield/etc returned
  source_path   text,                      -- where in tenant asset library this came from
  expires_at    timestamptz,
  created_at    timestamptz default now()
);
```

## Implementation notes

### Provider abstraction
`api/lib/providerRouter.js` exports:

```js
export async function uploadReference(provider, { filename, bytes, contentType }) { ... }
export async function generateImage(provider, params) { ... }
export async function generateVideo(provider, params) { ... }
export async function jobStatus(provider, jobIds) { ... }
export async function modelsExplore(provider, params) { ... }
```

Internally each provider has its own adapter. Higgsfield first.

### Higgsfield adapter
- Base URL: provider-specific MCP-style API. Env var `HIGGSFIELD_API_KEY`.
- For `generate_image`: POST to `models/nano_banana_2/generate` with `{ prompt, aspect_ratio, resolution, medias: [{ value: mediaId, role: 'image' }] }`
- For `generate_video`: POST with `{ prompt, aspect_ratio, duration, medias: [{ value: startImageJobId, role: 'start_image' }] }` — note `value` can be a media_id OR a prior job_id (model-specific quirk to handle).
- Status poll endpoint: `jobs/{job_id}` → returns `{ status, results: { rawUrl, thumbnailUrl } }`.
- NSFW handling: status `"nsfw"` is a real value Higgsfield returns. Treat as terminal failure — the engine should NOT auto-retry the same prompt; it's a content-policy rejection, not a transient error.

### Aspect ratio guardrail (LEARNED)
Some Higgsfield video models (kling, veo) reject 1:1 source frames when output is 9:16. The engine MUST validate aspect compatibility before submission and return a clear error: *"start_image is 1:1; kling2_6 requires matching 9:16 source"* — let the caller regenerate the start frame in the right aspect.

### Known-bad-combo router
`providerRouter.js` exports:

```js
export const UNWORKABLE_MODELS = new Set(['veo3', 'veo3_1', 'seedance_2_0', 'kling2_6']);
```

`generate_video` rejects requests for these models with a structured error pointing to the working alternative (`cinematic_studio_3_0` for video, `nano_banana_2` for stills).

### Streaming vs polling
Generation is async. The engine returns `pending` immediately. Frontend polls `job_status` every 4–10s. For weekly batches (SPEC-07), the cron handler awaits completion server-side.

### Cost tracking
Every successful job writes a row to `generation_jobs`. Add `credit_cost` column populated from provider response when available.

## Edge cases (LEARNED — encode these)

1. **Provider returns `nsfw` status** — surface to caller as terminal `failed_content_policy`. Do NOT auto-retry. Log so the prompt template can be tuned.
2. **Reference media expired** — Higgsfield uploads expire (typical 86400s). The engine should re-upload from `tenant_assets` if a generation references an expired upload.
3. **Job stuck in `queued` > 10 min** — log, surface, but don't auto-cancel; let caller decide.
4. **Provider list mid-deployment** — `models_explore` returns capabilities; cache for 1h per provider but invalidate on hard reload.
5. **Unicode in prompts** — pass through as UTF-8; Higgsfield handles em-dashes correctly.

## Test strategy

`tests/integration/generation-engine.test.js`:
- Mock Higgsfield endpoints with canned response fixtures (success, queued, in_progress, completed, nsfw, failed)
- Verify `upload_reference → generate_image` flow produces correct prompt (assert against `prompt_used` field)
- Verify `seedance_2_0` request is rejected with helpful error
- Verify `nsfw` status surfaces correctly without retry
- Verify aspect-ratio mismatch is caught pre-submission

## Connection points

- Brand context fetched from Supabase `brands` table (already exists in `seed.jsx` shape, post-PATCH-03)
- Prompt template fetched from SPEC-02 via `import { buildPrompt } from './lib/assetPrompts'`
- Source Index lookup (SPEC-05) determines whether to generate or copy from tenant asset library
- Story Bank (SPEC-04) provides scene descriptions for reel beats
