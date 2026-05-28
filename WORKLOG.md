# Flow — Work Log

Reverse-chronological record of notable changes. New entries on top.

---

## 2026-05-28 · Track A · PR 4a — Paid ads targeting + hierarchy

**Scope:** Phase 4 PR 1/3 — extend the paid-social route with full ad-tree CRUD and normalized cross-platform targeting; add a separate zernio-ads route for pre-flight primitives; ship a three-pane Ads workspace.

### Changes

- **[api/paid-social.js](api/paid-social.js)** — extended (existing actions preserved):
  - Migrated to shared `api/lib/zernioClient.js` + `api/lib/zernioMap.js` — eliminated three duplicated helpers (`zernioFetch`, `sbHeaders`, `getZernioAccountId/resolveAdAccountId`) that pre-dated the shared lib.
  - New `buildTargetingForCreate` / `buildTargetingForBoost` map a single normalized shape `{ countries, regions, cities, zips, metros, customLocations, ageMin/Max, interests, advantageAudience }` to `/v1/ads/create`'s top-level fields vs. `/v1/ads/boost`'s nested `targeting:`. LinkedIn-specific `jobFunction/seniority/companySize` still nest under `targeting:` on create.
  - `create_campaign` now passes targeting for ALL platforms (was LinkedIn-only) and accepts `bidStrategy / bidAmount / roasAverageFloor`, schedule, currency, DSA fields, leadGenFormId, video, organizationId, promotedObject, specialAdCategories.
  - `update_budget` now hits `PUT /v1/ads/campaigns/{id}` (CBO); falls back to per-ad-set update on 409 BUDGET_LEVEL_MISMATCH (ABO). Also accepts bid-strategy updates.
  - New actions:
    - `create_ad_set` — `PUT /v1/ads/ad-sets/{adSetId}` (budget / status / bidStrategy).
    - `create_ad` — `POST /v1/ads/create` with `adSetId` (attach an ad to an existing ad set).
    - `get_ad_tree` — `GET /v1/ads/tree` (campaign → ad-set → ad with rolled-up metrics).
    - `campaign_duplicate` — `POST /v1/ads/campaigns/{id}/duplicate` (deepCopy on by default; paused).
    - `bulk_status` — `POST /v1/ads/campaigns/bulk-status` (up to 50 in one call; per-row results).
  - `boost_post` — dropped `liads`-only gate. Now uses `POST /v1/ads/boost` for ALL five platforms (previously `boostLinkedInPost` was calling `/ads/create` with `adType: sponsored_content`, which only matched LinkedIn). Accepts `postId` or `platformPostId`, full normalized targeting, bid passthrough, DSA fields, tracking, plus TikTok Spark Ad fields (`sparkAuthCode`, `linkUrl`, `callToAction`) — UI exposure for Spark Ads lands in PR 4c.

- **[api/zernio-ads.js](api/zernio-ads.js)** — new edge route. Three actions:
  - `targeting_search` — `GET /v1/ads/targeting/search` (geo / interest / behavior / income).
  - `targeting_reach_estimate` — `POST /v1/ads/targeting/reach-estimate`.
  - `ad_analytics` — `GET /v1/ads/{adId}/analytics`.
  Auth: `requireAuth`; accountId resolved server-side from the tenant's connected channel — caller passes `platform` only.

- **[app/ads-workspace.jsx](app/ads-workspace.jsx)** — new workspace. Three panes:
  - **Left:** platform picker (Meta / LinkedIn / TikTok / X / Pinterest) + campaigns list (`list_campaigns`).
  - **Center:** selected-campaign overview — 8-KPI grid (spend / impressions / clicks / CTR / CPC / CPM / conversions / ROAS).
  - **Right:** detail panel — Pause / Enable / Duplicate buttons; daily-budget edit with Save; live hierarchy from `get_ad_tree` (ad sets + their ads).
  - **New-campaign drawer:** name + headline + body + linkUrl + daily budget + bid-strategy picker (conditionally surfaces `bidAmount` or `roasAverageFloor` inputs) + targeting builder.
  - **Targeting builder:** country toggles, age min/max, `targeting_search` interest autocomplete (280ms debounce), live reach estimate via `targeting_reach_estimate` (380ms debounce) — shows lower/upper bounds, or a "not available on this platform" message for TikTok/Google.
  - Hook aliases `useStateAds / useMemoAds / useEffectAds / useRefAds`.

- **[app/main.jsx](app/main.jsx)** — one line: `import './ads-workspace.jsx'` immediately before `chat-app.jsx`.
- **[app/chat-app.jsx](app/chat-app.jsx)** — one line: `ads: AdsWorkspace,` in the CanvasBody `Comp` map. To open the workspace: `openWorkspace("ads")` or `OPEN_CANVAS { kind: "workspace", target: "ads" }`.

### Deliberately not in this PR

- **Audiences sub-tab + customer-list CSV upload** — PR 4b.
- **TikTok Spark Ads UI** (`sparkAuthCode` field, Boost dialog) — PR 4c. The API already accepts the field; the UI just doesn't surface it yet.
- **Lead forms sub-tab + conversions** — PR 4c.
- **Local DB cache of ad-tree state** — Zernio's `/ads/tree` is fast enough to fetch on demand; no migration needed yet. Re-evaluate if the workspace starts paginating heavily.
- **No edits to `api/zernio.js`, `api/lib/zernioMap.js`, `api/lib/zernioClient.js`** — they're frozen per Track A boundary.

---

## 2026-05-27 · Track A · PR 1 chunk 3 — Validators + Smart slots

**Scope:** Eight read-only Zernio tool endpoints surfaced as actions, plus live char-count validation and a Smart-slots schedule picker in the edit drawer.

### Changes
- **[api/zernio-publish.js](api/zernio-publish.js)** — new actions:
  - `validate_post_length` — POST `/v1/tools/validate/post-length`. Returns the full per-platform map; if the caller passes `platform`, also returns a `forPlatform` slice (`{ count, limit, valid }`) for the most common UI use.
  - `validate_post` — POST `/v1/tools/validate/post`. Normalises body into the spec's `{ content, platforms: [{ platform }] }` shape; flattens errors/warnings.
  - `validate_media` — POST `/v1/tools/validate/media`. Endpoint validates one URL at a time; fanned out client-side so the frontend can ask "are all my URLs ok?" in a single call.
  - `validate_subreddit` — GET `/v1/tools/validate/subreddit`.
  - `queue_slots`, `queue_next_slot`, `queue_preview` — GET endpoints. All read the tenant's `profileId` via `getOrCreateZernioProfile` so the frontend doesn't have to pass it.
  - `update_metadata` — POST `/v1/posts/{postId}/update-metadata`. YouTube-only on Zernio's side today; we accept a free-form `metadata` object and forward it.
- **[app/workspaces3.jsx](app/workspaces3.jsx)**
  - Two new component-scoped hooks: `liveValidation` (debounced 300ms `validate_post_length` result per platform; falls back to the hardcoded `CHAR_LIMIT` map until the first response) and `smartSlots` (Zernio queue preview, up to 8 ISO slot strings).
  - Drawer textarea: `charLimit / charCount / overLimit` now read from `liveValidation` when present — X / Twitter benefit from Zernio's weighted character count (URLs = 23 chars, emojis = 2 chars). Red-border + counter behaviour unchanged.
  - Schedule section: when editing a draft and the tenant has a configured queue, a "Smart slots" chip row appears above the date/time inputs. Clicking a chip writes the local `YYYY-MM-DD` / `HH:MM` into `editDraft` so the existing publish/schedule flow picks it up without further changes.

### Worktree note
Track A work is now done from a dedicated git worktree at `~/Desktop/flowOS-track-a` (branch `feat/track-a-phase-1`) so it can run in parallel with Track B in the main worktree without `git checkout` collisions. Both worktrees share the same `.git` and remote.

### Deliberately not done
- **No UI surface for `validate_post`, `validate_media`, `validate_subreddit`, or `update_metadata`.** Endpoints are wired so future work can pull them in (e.g. Reddit subreddit field could call `validate_subreddit` on blur, IG media could pre-flight `validate_media`).
- **No queue configuration UI.** The Smart-slots picker only reads. If the tenant has no default queue yet, the chip row is empty. Configuring queues from FlowOS would need PUT `/v1/queue/slots` — out of scope for Phase 1.
- **No reducer state for `liveValidation` / `smartSlots`** — display-only, drawer-scoped, shouldn't survive drawer close.

### Verification
- `node --check api/zernio-publish.js` → OK
- `@babel/standalone` transform of `app/workspaces3.jsx` → OK
- End-to-end smoke: open a draft with `platform: "x"`, type `Visit https://example.com 🎉 — this is a long tweet…` past 280 plain chars but under Zernio's weighted limit, expect no red border (URL collapses to 23). Pick a Smart slot chip, hit Schedule, expect the row to fire at the chosen time.

---

## 2026-05-27 · Track A · PR 1 chunk 2 — Bulk upload + CSV import drawer

**Scope:** `bulk_upload` action on the new Zernio publish route + an in-app CSV import drawer with column mapping, dry-run, and per-row results.

### Changes
- **[api/zernio-publish.js](api/zernio-publish.js)** — `bulk_upload` action accepts `{ posts: [{ platform, content, scheduledFor?, media? }], dryRun? }`, capped at 200 rows. Resolves platform via `resolvePlatform`, fetches each tenant's Zernio profileId once, and resolves an accountId per distinct platform via `getZernioAccountId`. Builds an in-memory CSV (header `profileId,platform,accountId,scheduledAt,content,mediaUrls`) and posts it as `multipart/form-data` to `/v1/posts/bulk-upload`. Early-error rows (missing platform, missing content, no connected account) are short-circuited into the response with synthetic error codes so the client always sees one result row per input row in original order. Forwards `?dryRun=true` when requested.
- **[app/store.jsx](app/store.jsx)** — Track A block adds `importCSV({ posts, dryRun })`. Returns the bulk_upload response 1:1 so the drawer can render per-row outcomes; toasts a summary on real submits (suppressed on dry runs).
- **[app/workspaces3.jsx](app/workspaces3.jsx)** — Header gets an "Import CSV" button. New Drawer (sibling to the edit drawer) with three steps: (1) file picker, (2) auto-detected column mapping for `platform / content / scheduled_for / media_urls` over the parsed header + 10-row preview, (3) results table. Includes a minimal RFC4180-ish CSV parser (`parseCsv`) and a heuristic mapper (`autoMapColumns`) — both module-level helpers in the IIFE.

### CSV column assumption
The Zernio OpenAPI spec defines `/v1/posts/bulk-upload` as a multipart upload but does **not** document the CSV column schema. Header used here (`profileId,platform,accountId,scheduledAt,content,mediaUrls`) is best-guess inferred from documented row-level error codes (`unknown_profile`, `no_account_for_platform`, `schedule_time_missing`, `rate_limited:<platform>:@<username>`). If Zernio rejects with "Invalid CSV", verify the column order in `BULK_CSV_HEADER` against their canonical header. Flagged in code with a comment block above the constant.

### Deliberately not done
- **No write to `state.calendar`** on successful import. Bulk-uploaded rows live in Zernio; the local calendar will pick them up via the existing scheduled-post hydration path on the next sync. Avoiding a partial duplicate write that would drift from Zernio's source of truth.
- **No client-side platform-slug validation** beyond what Zernio returns. Easier to let Zernio be the authority and surface its error codes.

### Verification
- `node --check api/zernio-publish.js` → OK
- `@babel/standalone` transform of the two .jsx files → OK
- End-to-end smoke is: drop a 5-row CSV with mixed valid/invalid platforms, dry-run, then real import — expect the results table to show the corresponding ok/failed breakdown and the natural Zernio error codes for the bad rows.

---

## 2026-05-27 · Track A · PR 1 chunk 1 — Zernio edit / unpublish / retry

**Scope:** New `api/zernio-publish.js` edge route + PublishingQueue UI hooks for post-lifecycle actions on already-published rows.

### Changes
- **NEW [api/zernio-publish.js](api/zernio-publish.js)** — edge route with `edit_post`, `unpublish_post`, `retry_post`. User JWT only (`requireAuth`), tenantId from the verified JWT. Uses the shared `api/lib/zernioClient.js` (`zernioFetch`, `getOrCreateZernioProfile`) and `api/lib/zernioMap.js` (`resolvePlatform`) — no helper duplication. Validates `postId` / `platform` / `content` inline (no zod). Endpoints forwarded per the Zernio OpenAPI spec at `~/Downloads/zernio-api-openapi.yaml`.
- **[app/store.jsx](app/store.jsx)** — append-only `// === TRACK A: PUBLISHING + ADS ===` block adds `editPost(itemId, {...})`, `unpublishPost(itemId, {...})`, `retryPost(itemId, {...})` async actions. Each calls `window.apiFetch("/api/zernio-publish", …)` and dispatches `CAL_UPDATE` plus a `NOTIFY` toast on success/failure. A matching marker block sits in the reducer for later PRs in this track. **No existing reducer cases or actions modified.**
- **[app/workspaces3.jsx](app/workspaces3.jsx)** — `getZernioPostId(item)` helper at top of file (reads the existing per-platform `<platform>PostId` field). Row-level Edit + Unpublish buttons added to the Published-7d table. In the existing edit drawer, conditional "Update post" (when `publishStatus === "published"`), "Unpublish" (same), and "Retry" (when `publishStatus === "failed"`) buttons in the actions slot — Update reuses `editDraft.body` as the new content.

### Why these specific endpoints first
The Zernio integration shipped `publish_now` / `schedule_post` but never the lifecycle actions (edit/unpublish/retry/metadata/bulk-upload/validators/queue-slots). The first three close the loop on "a publish failed or was wrong" without the user having to switch to the platform UI — highest-value subset and fastest to ship.

### Deliberately not done
- **Edit on non-X platforms** — Zernio's `/v1/posts/{postId}/edit` is currently twitter-only per OpenAPI spec. The button surfaces on any published row; the call will fail at the Zernio layer for other platforms until they expand support. I chose to forward the platform faithfully rather than gate client-side, so the UI lights up automatically when Zernio adds platforms. Worth a follow-up if the failure UX is too rough.
- **bulk_upload / validators / queue-slots** — land in later chunks of this PR (`PR 2` and `PR 3` per the branch plan).
- **CSV drawer / smart-slots picker / live char validation** — same.
- **`requireZernioAccountId` import is a `void`-discard placeholder** — `bulk_upload` (PR 2) needs it for per-platform account resolution; kept the import to surface the helper to future edits in this file.

### Verification
- `node --check api/zernio-publish.js` → OK
- `@babel/standalone` transform of `app/workspaces3.jsx` and `app/store.jsx` → OK (matches the Babel-CDN runtime)
- End-to-end run against a real Zernio tenant with a published X post is the natural smoke test once this lands.

---

## 2026-05-19 · Calendar items carry sourceBriefId (data-only)

**Scope:** Schema-only plumbing. No UI consumes the field yet.

Added a `sourceBriefId` field to the `state.calendar` item shape so that drafts spawned from a campaign brief can carry a back-reference to the brief that created them. This is groundwork for the linkage use case noted in [BACKLOG.md](BACKLOG.md) ("Campaign brief persistence + cross-feature wiring") — specifically the third bullet: PublishingQueue items knowing which brief they came from.

### Changes
- [app/store.jsx](app/store.jsx) — `QUEUE_ADD_DRAFT` reducer writes `sourceBriefId: a.sourceBriefId || null` onto new draft rows. `addDraft` action signature extended: `addDraft(platform, contentType, copy, imagePrompt, id?, sourceBriefId?)`. Existing callers pass `undefined` and get `null` on the row.
- [app/store.jsx](app/store.jsx) — `ACTIVE_PLAN_SET` reducer now assigns `id: "br_<random>"` to the active plan if the caller didn't supply one, so brief items have a stable reference target. Spread order fixed so the generated id isn't overwritten by `undefined` from the input plan.
- [CLAUDE.md](CLAUDE.md) — documented the new field on the calendar item shape and on the `addDraft` action signature.

### Deliberately not done
- No UI surface that displays "Part of: <brief title>" anywhere in PublishingQueue or the drawer.
- No callsite passes `sourceBriefId` today — `create_campaign_plan` writes the brief into `state.activePlan` but doesn't push calendar items. The flow that converts a brief's section-5 calendar table into actual queue rows is the next piece of work, and it'll be the first writer of this field.
- No persistence. `sourceBriefId` references `state.activePlan.id`, which is a client-only id that disappears on refresh. If/when briefs persist to Supabase (see BACKLOG.md), the id format and the FK shape will need to match.

### Why now
Cheap to add the field today before any rows exist; expensive to backfill later if rows already do. Adding the field with no consumer is normally premature, but here it's a one-line schema decision that costs nothing and unblocks the brief→queue flow whenever someone builds it.
