# Night 1 Additions — Generation Engine + Asset Intelligence

This migration adds the **generation engine and asset-intelligence layer** flowOS doesn't yet have. The agent shell, multi-tenant data model, social posting, and onboarding are already built. This migration plugs in the missing pieces that turn the platform from "AI text proxy + Publer wrapper" into "AI marketing OS that produces visual + video assets at production quality."

## What's in this branch

Six **specifications** for Claude Code to implement (all platform-universal — no tenant-specific data):

| Spec | Implements | Files to create |
|---|---|---|
| **SPEC-01** | Generation Engine — provider-agnostic image + video orchestration | `api/generate.js`, `api/lib/providerRouter.js` |
| **SPEC-02** | Asset Prompt Library — 9-block prompt + "PRESERVE EXACTLY" anchor | `api/lib/assetPrompts.js` |
| **SPEC-04** | Story Bank — tenant-scoped reel narrative portfolio with cooldown | Supabase migration, `app/stories.jsx`, `api/lib/storySelect.js` |
| **SPEC-05** | Source Index / Asset Library — classifier + 3D-vs-flat detection | Supabase migration, `api/classify.js`, `api/lib/sourceIndex.js` |
| **SPEC-06** | ffmpeg Stitch + Universal End Card — 15s reel pipeline | `api/stitch.js`, `api/lib/endCard.js` |
| **SPEC-07** | Weekly Batch Cron — Tuesday-night batch model | edit `vercel.json`, `api/cron-weekly-batch.js`, `api/lib/calendar.js` |

One **direct patch** (universal utility, applied in this branch):

- **`app/lib/publerCsv.js`** — 12-column Publer-compliant CSV builder. Tenant-agnostic. Imported by Studio export buttons (TBD) and SPEC-07 weekly batch.

Three **drift-mode case studies** (universal failure-mode lessons learned in production):

| # | Drift mode | Defended by |
|---|---|---|
| **DM-01** | Flat graphic vs 3D product reference | SPEC-02 (prompt anchor) + SPEC-05 (vision classifier) |
| **DM-02** | SKU-name colour bias | SPEC-02 (explicit colour negation) + SPEC-01 (post-flight colour gate) |
| **DM-03** | Functional-cue overrides reference | SPEC-02 (saturation-lock clause) + SPEC-01 (per-asset colour gate) |

Each drift-mode doc includes symptom, root cause, detection layer, prevention pattern, and a regression test strategy. See `drift-modes/README.md`.

## Migration order — implement in this sequence

```
SPEC-01 (Generation Engine)              [foundation]
   ↓
SPEC-02 (Asset Prompt Library)           [imported by 01, prevents DM-01/02/03]
   ↓
SPEC-05 (Source Index / Asset Library)   [feeds 01, prevents DM-01]
   ↓
SPEC-04 (Story Bank)                     [consumed by 06]
   ↓
SPEC-06 (Stitch + End Card)              [requires 01, 04]
   ↓
SPEC-07 (Weekly Batch Cron)              [orchestrates 01–06]
```

## Tenancy rule

Everything in `docs/migrations/night-1/SPEC-*` describes **universal platform code**. Tenant data (any specific brand's stories, source index, calendar, brand assets) lives in Supabase as per-tenant rows or in a separate tenant-data branch. **Do not bake tenant-specific content into platform code.** The specs use abstract examples (`<TENANT>`, `<SKU>`) to keep tenant content out of the platform layer.

## Provider intel — known-bad combos at time of writing

Tested on the `creator` plan of one provider during platform R&D. Encode as `UNWORKABLE_MODELS` in `api/lib/providerRouter.js`:

| Model ID | Status | Notes |
|---|---|---|
| `nano_banana_2` | ✅ works | Stills, 2K, takes `medias[].image` reference. Aliased as "Nano Banana Pro" in Higgsfield UI. |
| `cinematic_studio_3_0` | ✅ works | Video, 4–15s single shot, `start_image` role. Higgsfield SOTA. |
| `kling3_0` | ✅ works | Video alternative; multi-shot + audio support |
| `seedance_2_0` | ❌ unworkable | Content filter rejects luxury/sensual register repeatedly (NSFW false-positive on crimson + silk combinations) |
| `veo3` / `veo3_1` | ❌ gated | Account-level block on creator-tier subscriptions; all calls return generic error |
| `kling2_6` | ❌ errors | Generic error on every call (kling3_0 works fine — model-specific issue) |

These should be encoded as `UNWORKABLE_MODELS: Set<string>` in the provider router so the engine never picks them. When tier or account changes unlock them, drop entries from the set.

## Implementing this — handoff prompt for Claude Code

When pointing Claude Code at this branch:

> *Read `docs/migrations/night-1/README.md`. Implement SPEC-01 first against this codebase. Follow the migration order in the README. Each spec has a Test Strategy section — write the tests as part of the implementation. The drift-mode case studies in `drift-modes/` document the specific failure patterns the test fixtures should cover. Tenant-specific seed data is handled on a separate branch and is not in scope for this implementation.*
