# SPEC-05 — Source Index / Asset Library Service

**Status:** unimplemented
**Files to create:** Supabase migration, `api/classify.js`, `api/lib/sourceIndex.js`
**Depends on:** Brand Memory (PATCH-03)
**Consumed by:** SPEC-01 (engine reads index before deciding to generate)

## Purpose

Tenants upload large source libraries (production validation: ~1,000 files for a single brand). Most files are usable, some are misfiled, some are off-brand legacy generation outputs. The platform needs an **editorial index over the raw library** that:

1. Resolves a SKU → list of usable assets per lane (FEED hero / STORY / CAROUSEL ingredient / CAROUSEL macro / PIN / reel start frame)
2. Auto-rejects files that will never be on-brand (text overlays, off-brief batch outputs, label artwork mistaken for product photos)
3. Soft-guardrails files with brand-cliché tendencies (incidental vs dominant judgment)
4. Falls back to generation when no library asset fits

**Why this is its own service:** The raw asset library is dumb storage. The index is editorial intelligence. Same rule that the agent shell already separates raw Claude output from voice-validated content.

## The drift mode this prevents

See `drift-modes/DM-01-flat-graphic-vs-3d-product.md` for the full case study. In short: a tenant's body-oil SKU had a `_hero` file that followed the platform's packshot naming convention but whose contents were **a flat 2D label graphic with no actual bottle**. The model had nothing to anchor the bottle shape to and invented one entirely. Same pattern for another SKU where `_packshot_a` was the label artwork and the real product photo was in `_packshot_b`.

The Source Index must encode **what each file actually depicts** (3D product, label artwork, lifestyle scene, woman+product, ingredient flatlay), not just trust the filename.

## Data model — Supabase

```sql
create table source_assets (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             text not null,
  storage_path          text not null,                  -- supabase storage key or external URL
  filename              text not null,
  sku_id                text,                            -- resolved SKU; null if multi-SKU or generic
  asset_kind            text not null,                   -- 'packshot_3d_product' | 'label_artwork' | 'lifestyle' | 'woman_with_product' | 'ingredient_flatlay' | 'texture_macro' | 'ugc' | 'other'
  register              text,                            -- 'royal' | 'regular' | 'lofi' | null
  lane                  text,                            -- 'feed_hero' | 'story' | 'carousel_1' | etc — primary slot
  alt_lanes             text[],                          -- secondary slots this asset works for
  classification_status text not null default 'pending', -- 'pending' | 'classified' | 'flagged' | 'rejected'
  rejection_reason      text,                            -- if rejected, why (filename pattern? vision-classifier? operator?)
  flag_reasons          text[],                          -- soft guardrails triggered (e.g. ['incidental_marigold'])
  visual_summary        text,                            -- 1-sentence description from vision classifier
  created_at            timestamptz default now()
);
create index on source_assets (tenant_id, sku_id, classification_status);
create index on source_assets (tenant_id, asset_kind, register, lane);
```

## Classification rules (universal — encoded in `api/lib/sourceIndex.js`)

### Hard reject — `classification_status = 'rejected'`

A file is hard-rejected if any apply:

```js
const HARD_REJECT_PATTERNS = {
  filenameContains: [
    'DONT_USE', 'MISC_', '_illustration', 'SOAP_layout',
  ],
  filenameRegex: [
    /^[0-9]+ .* 2026-01-09\.png$/,    // dated batch outputs (legacy off-brief generation runs)
    /^[0-9]+ .* 2026-01-04\.png$/,
    /\*3\.png$/,                       // numeric-suffix infographic ingredient cards
  ],
  fileTypes: ['.pdf'],                 // label artwork PDFs
};
```

### Soft guardrail — `classification_status = 'flagged'`, populates `flag_reasons`

Filename or visual-classifier suggests a brand-cliché tendency. Per-tenant configurable; for luxury/wellness brands the defaults are:

```js
const SOFT_GUARDRAIL_KEYWORDS = [
  'marigold', 'diya', 'ganesh', 'incense', 'merchant_ivory', 'bollywood', 'orientalist',
];
```

Flagged files are NOT auto-rejected. They go to operator review with the visual summary. Rule from production: "incidental flagged element in otherwise-strong frame = accept; cliché-dominated frame = reject."

### Asset-kind classification (vision-required)

Filename alone CAN'T determine `asset_kind` for ambiguous files. Use a vision classifier:

```js
async function classifyAssetKind(imageBytes) {
  // Calls Claude Vision via api/chat.js with a structured prompt:
  // "Classify this image into ONE of: packshot_3d_product | label_artwork |
  //  lifestyle | woman_with_product | ingredient_flatlay | texture_macro | ugc | other"
  // Returns the label + 1-sentence visual_summary.
}
```

Cost-control: only run vision on filenames that don't clearly match a hard-reject pattern. Cache results.

### SKU resolution (LEARNED — folder is a hint, not authority)

A documented case had a folder named for one product line (`Spa Soaps`) containing misfiled files belonging to a different line (`Sensitive Soaps`). **Folder paths are advisory, not authoritative.**

Resolution algorithm:
1. Filename keyword match (e.g. "Honey Vanilla", "Saffron Lime") → look up tenant's `sku_keyword_map` table
2. If filename keyword maps to a SKU, that wins
3. Folder hint is fallback only

`sku_keyword_map` is populated during tenant onboarding (operator confirms keyword → SKU mapping).

### Packshot real-photo verification (LEARNED — the BOD-001 fix)

For files claiming `asset_kind = 'packshot'`, run a secondary vision check:

```
"Is this image a photograph of a 3D physical product, or a flat 2D label/artwork
file? Respond ONLY with: 3d_product OR flat_artwork OR ambiguous."
```

`flat_artwork` packshots get demoted to `asset_kind = 'label_artwork'` and never used as generation references. This single check would have prevented the BOD-001 night-1 drift.

## Public API

`POST /api/classify` — Vercel Edge Function.

### Action: `classify_asset`
```json
{ "action": "classify_asset", "tenantId": "<tenant-id>", "assetId": "uuid" }
```
Runs full classification pipeline (filename rules → vision check → SKU resolution → packshot real-photo verification). Updates `source_assets` row.

### Action: `bulk_classify`
```json
{ "action": "bulk_classify", "tenantId": "<tenant-id>", "filter": { "classification_status": "pending" } }
```
Background job. Streams progress via SSE.

### Action: `resolve_for_lane`
```json
{
  "action": "resolve_for_lane",
  "tenantId": "<tenant-id>",
  "skuId": "FAC-003",
  "lane": "feed_hero",
  "register": "lofi"
}
```
Returns:
```json
{
  "ok": true,
  "asset": { "id": "...", "storage_path": "...", "visual_summary": "..." },
  "alternatives": [...]
}
```
Or `{ "ok": false, "reason": "no_library_match", "fallback": "generate" }` to tell SPEC-01 it must generate.

## UI — Asset Library page

Already in the platform's roadmap (per `seed.jsx` recommendedConnectors). This service powers it. Required UI affordances:

- Filter by `asset_kind`, `register`, `lane`, `classification_status`
- Bulk-tag operations (operator can override classifier)
- "Flagged for review" queue
- Per-SKU view: "Show me everything assigned to BOD-001, by lane"

## Edge cases

1. **Vision classifier mis-categorizes** — operator override via UI; the override is logged and feeds back into a per-tenant fine-tuning of the classifier prompt
2. **File reuploaded with different content** — keyed on storage path + content hash; classification re-runs on hash change
3. **SKU not yet onboarded** — `sku_id = null`, asset still classified by kind, available for global lookup
4. **Misfiled file (folder says X, contents say Y)** — SKU resolution by filename keyword wins. The mismatch is logged for operator visibility ("Folder hints SPA but filename suggests SSS-003")

## Test strategy

`tests/integration/source-index.test.js`:
- Seed with a synthetic fixture library spanning every classification path (clean files + dated batch outputs + infographic suffix files + flat-artwork files mislabeled as packshots + folder-misfiled files)
- Assert hard-reject patterns match the expected file count
- Assert flat-artwork demotion catches files named `*_hero.png` whose vision-classifier output is `flat_artwork`
- Assert keyword-based SKU resolution beats folder-based hints when they conflict
- Assert `resolve_for_lane(<sku>, feed_hero, <register>)` returns the highest-fit asset and not a fallback when both exist
