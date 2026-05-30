# Flow — Work Log

Reverse-chronological record of notable changes. New entries on top.

---

## 2026-05-29 · PR M3 — Real Reddit subreddit search via Zernio

**Scope:** Replace the stub `search_subreddits` handler in `api/reddit.js` with a real implementation that searches Reddit posts via Zernio's `/v1/reddit/search` endpoint and extracts unique subreddits from the results.

### Changes
- **[api/reddit.js](api/reddit.js)** — `search_subreddits` action:
  - Fetches the tenant's Reddit accountId via `getZernioAccountId`
  - Calls `GET /v1/reddit/search?q=<query>&accountId=<id>&limit=25&sort=relevance`
  - Extracts unique subreddits from returned posts (name + first 120 chars of selftext as description)
  - Returns `{ ok: true, subreddits: [...] }` matching the UI contract
  - Gracefully returns `[]` when Reddit is not connected (no 500)
  - Empty query returns `[]` cleanly

### Acceptance
- Zernio search returns real posts; unique subreddits extracted from them
- Empty query → `[]`, no error
- Reddit not connected → `[]`, no error

---

## 2026-05-29 · PR M2 — Prune merged local branches

Deleted 21 merged-to-main local branches:

```
chore/auth-rls-audit
chore/backlog-engine
chore/connector-cleanup-drops
chore/remove-publer
docs/audit-backlog
feat/brand-voice
feat/campaign-planner
feat/connectors-redesign-composio-e2e
feat/direct-connectors-ab-testing-audiostack-wordpress
feat/direct-connectors-image-video
feat/direct-connectors-oauth-msads-attentive
feat/drafter-channel-format-rules
feat/fix-insights-center
feat/klaviyo-sms
feat/proactive-email-drafts
feat/proactive-sms-image-drawer
feat/runware-provider-adapter
feat/scheduled-posting
feat/scheduled-posts
feat/seo-auditor
fix/dark-theme-workspace-buttons
```

No force-deleted branches — all were cleanly merged.

## 2026-05-29 · PR M1 — Remove legacy app.html

**Scope:** Delete `app.html` (legacy Babel-CDN entry point) and update `server.py` to serve `index.html` (Vite entry) at `/`.

### Changes
- **app.html** — deleted. Was the Babel-CDN era entry with Jost/Cormorant fonts; `index.html` is the live Vite entry with Inter Tight fonts. No deploy config referenced it.
- **server.py** — updated `do_GET` to serve `/index.html` at root, updated startup URL print.

---

## 2026-05-28 · Track B · Phase 4 PR B.3 — Cohort drill-downs (demographics)

**Scope:** Persist and surface demographic breakdowns from Instagram and YouTube analytics. New `analytics_cohorts` table, cron extraction, and audience-breakdown UI cards.

### Changes
- **[db/migrations/2026-06-02-analytics-cohorts.sql](db/migrations/2026-06-02-analytics-cohorts.sql)** — new table:
  - `analytics_cohorts` — one row per `(tenant, channel, cohort_type, period)`
  - Columns: `tenant_id`, `channel`, `cohort_type` (age/gender/country/city/...), `period`, `breakdowns` (jsonb array of `{ label, value, pct }`), `meta` (extra context like metric/timeframe/dateRange), `fetched_at`
  - Unique constraint on `(tenant_id, channel, cohort_type, period)`
  - RLS policies matching `analytics_snapshots` / `analytics_primitives`

- **[api/cron/daily-analytics.js](api/cron/daily-analytics.js)** — extended:
  - Added `youtube_demographics` to `PLATFORM_ENDPOINTS` for YouTube (was missing; Instagram already had it)
  - New `cohortRows` accumulator in `processTenant`
  - `extractCohorts(snap)` helper — parses `metrics.demographics` from Instagram/YouTube responses, normalizes `{ dimension, value }` items into `{ label, value, pct }`, computes percentages per cohort type
  - `persistCohorts()` helper — upserts into `analytics_cohorts` with `resolution=merge-duplicates`
  - Cron summary now reports `cohorts: cohortRows.length`

- **[app/insights.jsx](app/insights.jsx)** — added cohort UI:
  - New state `cohorts` + fetch from `analytics_cohorts` in `loadCached()`
  - `CohortsSection` — grid of cards grouped by channel, one card per `(channel, cohort_type)`
  - `CohortCard` — horizontal bar chart with channel color, top 6 segments, percentage labels. Bars are relative to the max segment so small differences remain visible.
  - Placed between Primitives and Data by Channel in the normal (non-compare) view

### Why not ad_analytics breakdowns
The `ad_analytics` drill-down (PR B.1) supports Meta/TikTok demographic breakdowns, but requires a specific `adId`. The cron doesn't have a campaign/ad inventory to iterate over. Ad-level cohorts belong in the Ads workspace (Track A) or a future report builder that queries specific ads.

### Verification
- `node --check api/cron/daily-analytics.js` → OK
- `esbuild app/insights.jsx --loader=jsx --format=iife --bundle` → OK

---

## 2026-05-28 · Track B · Phase 4 PR B.2 — Comparison views in Insights

**Scope:** Side-by-side channel comparison UI in `app/insights.jsx`. Pure frontend enhancement using existing snapshot data.

### Changes
- **[app/insights.jsx](app/insights.jsx)** — added comparison mode:
  - New state: `compareMode`, `compareSelection` (max 4 channels)
  - Top bar: "⊕ Compare" / "Exit Compare" toggle button next to period selector
  - `ComparisonView` component: channel picker (icon + label chips, color-coded by channel), prompts to select 2–4 channels
  - `ComparisonTable` component: sticky-header table with metrics as rows and selected channels as columns
    - Only shows metrics that appear in at least 2 selected channels
    - Uses existing `resolveMetricValue` + `fmtMetricValue` for consistent formatting
    - Highlights best value per row: green background + bold for higher-is-better metrics (impressions, revenue, ROAS, etc.); same for lower-is-better (CPC, CPM, bounce rate, etc.)
    - Sticky first column (`Metric`) so it stays visible on horizontal scroll
  - When compare mode is active, the regular sections (Summary, Insights, Primitives, Data by Channel, Analytics Chat) are hidden to reduce noise

### Deliberately not done
- No new backend calls — comparison uses cached `analytics_snapshots` rows already loaded for the current period. Drill-down endpoints from PR B.1 will be consumed in PR B.3 (cohort drill-downs).
- No campaign-level comparison — `ad_analytics` drill-down needs a specific `adId`; campaign comparison belongs in the Ads workspace (Track A) or a future dedicated report builder.
- No persistence of comparison selection — selection resets when toggling compare mode off.

### Verification
- `esbuild app/insights.jsx --loader=jsx --format=iife --bundle` → OK

---

## 2026-05-28 · Track B · Phase 4 PR B.1 — Drill-down analytics actions

**Scope:** Wire three unwired Zernio analytics endpoints into the existing `api/zernio-analytics.js` proxy as a new "drill-down" action category.

### Changes
- **[api/zernio-analytics.js](api/zernio-analytics.js)** — added `DRILL_DOWNS` registry + `handleDrillDown` handler:
  - `post_analytics` — `GET /v1/analytics`. Single-post lookup (`postId`) or paginated list with overview stats. Query passthrough: `platform`, `profileId`, `accountId`, `source`, `fromDate`, `toDate`, `limit`, `page`, `sortBy`, `order`.
  - `ad_analytics` — `GET /v1/ads/{adId}/analytics`. Per-ad/campaign performance with optional demographic `breakdowns` (Meta/TikTok). Requires `adId`.
  - `linkedin_personal_aggregate` — `GET /v1/accounts/{accountId}/linkedin-aggregate-analytics`. Personal LinkedIn account-level aggregates (not org pages). Supports `aggregation: TOTAL | DAILY`, `startDate`, `endDate`, comma-separated `metrics`.
  - All three reuse existing auth (`requireAuthOrCron`) and error handling (Zernio status passthrough). Path params are `encodeURIComponent`-escaped.

### Why these endpoints
- `post_analytics` closes the loop on per-post metrics that the current per-platform endpoints don't surface (e.g. "how did this specific Reel perform across all its placements?").
- `ad_analytics` is distinct from Track A's `api/zernio-ads.js` `ad_analytics` — this one is raw Zernio passthrough for the same endpoint; Track A's version resolves the ad account server-side from the tenant's connected channel. Keeping both lets InsightsCenter call this directly without needing to know the tenant's ad-account mapping.
- `linkedin_personal_aggregate` fills the gap between `linkedin_org_aggregate` (org pages) and `linkedin_post_analytics` (single post) — personal profiles need their own endpoint per LinkedIn API limitations.

### Deliberately not done
- No UI consumption yet — `app/insights.jsx` will call these in PR B.2 (comparison views) and PR B.3 (cohort drill-downs).
- No new DB migrations — these are pure proxy actions; persistence decisions deferred until the frontend needs cached drill-down data.

### Verification
- `node --check api/zernio-analytics.js` → OK

---

## 2026-05-28 · Track A · PR 4c — Spark Ads UI + Lead Gen forms + conversions

**Scope:** Phase 4 final chunk — surface TikTok Spark Ads in a Boost drawer, add Meta Lead Gen form CRUD with a third workspace sub-tab, add server-side `send_conversions` for Meta/Google/LinkedIn CAPI, and a `subscribe_lead` action on `/api/klaviyo` so leads can be pushed into Klaviyo with one click.

### Changes

- **[api/zernio-ads.js](api/zernio-ads.js)** — 5 new actions, all Meta-gated where appropriate:
  - `lead_forms_list` — `GET /v1/ads/lead-forms` (Meta only).
  - `lead_forms_get` — `GET /v1/ads/lead-forms/{formId}` (Meta only).
  - `lead_forms_create` — `POST /v1/ads/lead-forms` (Meta only). Local validation: name, privacyPolicyUrl, and ≥1 question required before the call.
  - `leads_list` — when `formId` is passed: `GET /v1/ads/lead-forms/{formId}/leads`. Otherwise the cross-form CRM view via `GET /v1/ads/leads`.
  - `send_conversions` — `POST /v1/ads/conversions`. Platform inferred from `accountId` on Zernio's side; if the caller passes `platform` only, accountId is resolved from the connected channel. Pass-through for events / testCode / consent.

- **[api/klaviyo.js](api/klaviyo.js)** — new action `subscribe_lead`:
  - Wraps Composio's `KLAVIYO_CREATE_PROFILE` + optional `KLAVIYO_SUBSCRIBE_PROFILE_TO_MARKETING`.
  - Takes `{ email?, phone?, firstName?, lastName?, properties?, listId? }`. Either email or phone is required.
  - Handles the 409 "profile already exists" path by parsing the existing profile-id out of Klaviyo's conflict response.
  - Returns `{ profileId, subscribed, create, subscribe }` for inline UI feedback.

- **[app/ads-workspace.jsx](app/ads-workspace.jsx)** — three additions:
  - **BoostDrawer** (new). Reachable from the Campaigns left column ("Boost existing post" button next to "+ New campaign"). Form: postId (with checkbox to switch to platform-native ID), goal picker, daily budget, then TargetingBuilder (with `showReach={false}` since the boost spec is smaller and Zernio's reach estimate is create-only). On TikTok the drawer surfaces the Spark Ads block: `sparkAuthCode` input, `linkUrl` (required when goal is traffic/conversion), `callToAction` picker with TikTok's standard CTA enum (LEARN_MORE / SHOP_NOW / DOWNLOAD_NOW / SIGN_UP / WATCH_NOW / GET_QUOTE / BOOK_NOW / CONTACT_US / APPLY_NOW / ORDER_NOW). The API already accepted these from PR 4a — this is just the UI surface.
  - **LeadFormsPane** (new) + topbar tab "Lead forms". Three-pane layout (forms list / leads list for selected form / lead detail with Push-to-Klaviyo). Non-Meta platforms render a "Lead forms are Meta-only — switch to Meta" panel and skip API calls entirely.
  - **NewLeadFormDrawer** (new). Inside LeadFormsPane. Captures name + privacyPolicyUrl + thank-you copy + a dynamic questions list (any of EMAIL / PHONE / FULL_NAME / FIRST_NAME / LAST_NAME / CITY / STATE / COUNTRY auto-fill from Meta, or CUSTOM with a label). The drawer normalises custom-question keys before the API call.
  - **PushToKlaviyoButton** (new, inside the Lead detail panel). Extracts email / phone / first_name / last_name from the lead's normalized `fields` map (falls back to raw `fieldData`), posts to `/api/klaviyo` `subscribe_lead` with the lead's id + form-id + campaign-id + ad-id as Klaviyo profile properties. One lead per click — batch push is deferred.
  - **TargetingBuilder** gained a `showReach` prop (default `true`) so the BoostDrawer can render the targeting UI without the reach-estimate panel that doesn't apply to boost.

### Deliberately not in this PR

- **Lead form archive (DELETE) + test-lead generation** — Zernio exposes both, but neither is in the Phase 4 acceptance criteria. Easy follow-up if needed.
- **Conversions API UI** — `send_conversions` is wired server-side but has no UI surface yet. The right home for this is probably a backend trigger tied to Shopify / Klaviyo order events (server-side CAPI), not a manual form in the Ads workspace.
- **Saved-targeting picker in BoostDrawer** — Zernio's `/v1/ads/create` supports `savedTargetingId`, and we already have a Saved targeting type in Audiences. Cross-wiring is one more iteration of polish; current behaviour is inline targeting only.
- **Batch lead export (CSV download)** — out of scope; one-at-a-time push is the headline acceptance criterion.
- **Spark Ads pre-flight validation** — Zernio validates `callToAction` enum values server-side; the UI is restricted to a known-good subset, but exotic CTAs accepted by TikTok would need an "Other…" input. Not yet.

### Files touched

- `api/zernio-ads.js` (extended, no breaking changes to 4a/4b actions).
- `api/klaviyo.js` (one new action; existing actions untouched).
- `app/ads-workspace.jsx` (extended; CampaignsPane gained a Boost button + state; main shell routes to LeadFormsPane; TargetingBuilder gained the `showReach` prop with default `true` so 4a/4b call sites are unaffected).

---

## 2026-05-28 · Track A · PR 4b — Ads audiences + customer-list CSV upload

**Scope:** Phase 4 PR 2/3 — audiences CRUD on the API side, a new Audiences sub-tab in the Ads workspace, and CSV upload for customer-list audiences (the headline acceptance criterion: "Upload a 500-email CSV to a Meta customer_list audience → audience populated").

### Changes

- **[api/zernio-ads.js](api/zernio-ads.js)** — extended with 5 audience actions (Zernio hashes member data server-side; we forward raw `{email, phone}` objects):
  - `audiences_list` — `GET /v1/ads/audiences` with optional `type` filter.
  - `audiences_create` — `POST /v1/ads/audiences`. `customer_list` works on all 6 ad platforms; `website` + `lookalike` are gated to Meta locally (fail-fast with a clear message rather than waiting for Zernio's 400). `saved_targeting` stores a reusable TargetingSpec with no member upload.
  - `audiences_get` — `GET /v1/ads/audiences/{id}`.
  - `audiences_delete` — `DELETE /v1/ads/audiences/{id}`.
  - `audiences_add_users` — `POST /v1/ads/audiences/{id}/users`. Server-side enforces the 10 000-per-request cap, lowercases emails, and drops rows with neither email nor phone before forwarding.

- **[app/ads-workspace.jsx](app/ads-workspace.jsx)** — workspace gained a topbar (platform picker + tab strip) and a second sub-tab.
  - **Restructure:** `AdsWorkspace` now hosts `CampaignsPane` (the existing three-pane, refactored to receive `platform` as a prop — its self-platform-picker was removed from the left column since it lives in the topbar now) and the new `AudiencesPane`.
  - **AudiencesPane:** three-pane shell. Left = filter chips (All / Customer / Website / Lookalike / Saved) + sticky platform-ad-account-ID input (persisted to `localStorage` per platform, keyed `flowos.ads.adAccountId.<platform>`) + audiences list. Center = audience name + spec preview (for saved_targeting). Right = `AudienceDetail` panel with delete + post-create CSV upload.
  - **NewAudienceDrawer:** type select gates website + lookalike to Meta-only (option marked `(Meta only)` and disabled on other platforms); per-type conditional fields (pixelId + retentionDays for website; sourceAudienceId + country + ratio for lookalike). For customer_list, an inline CSV file picker — parser auto-detects `email` / `phone` headers (or treats single-column files as one-email-per-line), then after the audience is created chunk-uploads members at 10 000 rows per request, with progress feedback.
  - Local CSV parser (`parseCsvForUsers`) is scoped to ads-workspace.jsx because `workspaces3.jsx`'s `parseCsv` is IIFE-private.

### Deliberately not in this PR

- **TikTok Spark Ads UI + Lead Forms + Conversions API** → PR 4c.
- **Audience-level analytics / member counts beyond what `audiences_list` returns** → out of scope; revisit if support tickets demand it.
- **CSV download / export of an audience** → not in the Zernio spec, skipped.
- **Cross-audience copy / merge** → Zernio has no native primitive for this; would require client-side fan-out, skipped.

### Files touched

- `api/zernio-ads.js` (extended, no breaking changes to the 4a actions).
- `app/ads-workspace.jsx` (extended; `CampaignsPane` is the 4a body, refactored to take `platform` as prop).

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

## 2026-05-27 · Track B Phase 3 — GMB workspace (PR 1)

**Scope:** New Google Business Profile workspace with Posts + Reviews panes. Backend route for GMB-specific Zernio actions.

### Changes
- `api/zernio-platform.js` (NEW) — `POST /api/zernio-platform` with actions:
  - `list_reviews` — wraps Zernio GET `/accounts/{id}/gmb-reviews`
  - `reply_to_review` — wraps Zernio POST `/accounts/{id}/gmb-reviews/{reviewId}/reply`
  - `create_post` — wraps Zernio POST `/v1/posts` with `platform: "googlebusiness"`, supports STANDARD/EVENT/OFFER topic types, CTA buttons, event schedule, offer coupon codes
  - `list_posts` — wraps Zernio GET `/v1/posts` filtered by platform
- `app/gmb-workspace.jsx` (NEW) — Two-tab workspace:
  - Posts tab: list view with topic type chip, status, text, CTA. Create Post side drawer with full form.
  - Reviews tab: average rating summary, star ratings per review, review text, owner reply display, Reply/Edit Reply side drawer.
  - Connection check: reads Supabase `channels` table for `platform='gbusiness'` + `status='connected'`.
- `app/main.jsx` — adds `import './gmb-workspace.jsx'`
- `app/chat-app.jsx` — adds `gmb: GmbWorkspace` to `CanvasBody` Comp map

### Deliberately not done
- Q&A pane — Zernio API has no GBP Q&A endpoint in the OpenAPI spec. Scoped out.
- GMB location selector — assumes single connected location per tenant. Multi-location businesses would need a location picker + `locationId` passthrough on every call.
- Post analytics — Google deprecated per-post analytics for GBP. Location-level metrics already available via `api/zernio-analytics` `gmb_performance`.
- No dedicated GMB migration — reuses existing `channels` table schema.

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
