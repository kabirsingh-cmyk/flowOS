# FlowOS Reach — Combined Backlog (Kimi + Claude Recon)

**Date:** 2026-05-28  
**Branches landed:** Track A Phase 1, 4a, 4b | Track B Phase 2, 3, 4 | Phase 0.2 Webhooks  
**Status:** Core platform solid. Remaining work is "backend exists, UI missing" + a few genuine gaps.

---

## Part 1 — Combined Findings

### A. User-Facing Breaks (Fix First)

| # | Issue | Source | Impact |
|---|-------|--------|--------|
| 1 | **Fake connector validation** — unwired connectors flip to "Connected" after a 1.1s `setTimeout` with zero validation | Kimi | Users think API key works; real failure surfaces later |
| 2 | **Scheduled-posts allowlist mismatch** — `scheduled-posts.js` allows 5 platforms, but `fire-scheduled.js` + `store.jsx` support 16 | Kimi | Users queue for TikTok/YouTube/etc. → silent 400 on publish |
| 3 | **Chat AI overconfidence** — drafter produces "Send to queue" for platforms with no publisher | Kimi | Broken CTA for TikTok, YouTube, Pinterest, etc. |
| 4 | **Spark Ads UI** — `boost_post` accepts `sparkAuthCode`/`linkUrl`/`callToAction`, but no "Boost as Spark Ad" button exists | Claude | TikTok advertisers can't boost organic posts as Spark Ads |
| 5 | **Account health (Phase 0.3)** — no `channels.health_status`, no health-check cron, no tile badge | Claude | Users don't know a token expired until publish fails |

### B. Backend Exists, UI Missing (Fast Wins)

| # | Issue | Source | Backend Status |
|---|-------|--------|----------------|
| 6 | **Audiences tab in Ads Workspace** — backend actions wired, UI tab deferred | Claude | `audiences_list/create/get/delete/add_users` all done in `api/zernio-ads.js` |
| 7 | **Per-ad analytics surface** — `ad_analytics` action exists in both `zernio-ads.js` and `zernio-analytics.js` | Claude | Endpoint ready; no UI consumption |
| 8 | **Lead Ads** — no `lead_forms_*`, `leads_*`, `conversions_*` actions | Claude | Nothing built |
| 9 | **Campaign draft persistence** — campaigns live in ephemeral `state.activePlan` | Kimi | Nothing built |

### C. Infrastructure / Pipeline Gaps

| # | Issue | Source | Detail |
|---|-------|--------|--------|
| 10 | **Pending migrations not applied** | Kimi | `2026-06-01-analytics-extensions.sql` + `2026-06-02-analytics-cohorts.sql` may not be live |
| 11 | **Lib extraction follow-through** | Claude | `api/zernio.js` still inlines `zernioFetch`, `PLATFORM_ID_MAP`. Safe to refactor now |
| 12 | **Durable image storage smoke test** | Kimi | `rehost()` exists for videos; generated images may still return temp URLs |
| 13 | **Analytics → Insights pipeline validation** | Kimi | End-to-end loop (Claude summaries → insight cards → proactive emails) not validated |
| 14 | **Inbox end-to-end validation** | Kimi | `api/inbox.js` wired to Zernio; AI triage + reply drafting not validated for real data |
| 15 | **Remaining ad platforms on Composio** | Kimi | `metaads`, `liads`, `ttads`, `xads` still blocked by error 306 (no managed auth) |

### D. Polish / Cleanup

| # | Issue | Source | Detail |
|---|-------|--------|--------|
| 16 | `app.html` drift | Kimi | Still loads Babel-CDN + old fonts; `index.html` uses Vite + Inter Tight |
| 17 | Reddit subreddit search stub | Kimi | `api/reddit.js` returns `[]`; UI uses free-text |
| 18 | `sourceBriefId` has no UI consumer | Kimi | Field added to calendar items in May, never surfaced |
| 19 | Stale git branches | Kimi | ~28 local branches, many merged to main |

---

## Part 2 — Recommended Build Order

### Sprint 1: "Trust Fixes" (Week 1)
> These are small code changes with outsized user-trust impact.

1. **Fix scheduled-posts allowlist mismatch** (#2)
   - Expand `SUPPORTED_PLATFORMS` in `api/scheduled-posts.js` to match `PLATFORM_PUBLISHERS` (16 platforms)
   - Or shrink `PLATFORM_PUBLISHERS` + `PLATFORM_ROUTES` to 5 until Zernio publishers are validated
2. **Fix fake connector validation** (#1)
   - Replace `setTimeout` with real validate call for connectors that have a backend route
   - For connectors with no route, show "Validate pending" instead of fake "Connected"
3. **Fix Chat AI overconfidence** (#3)
   - Add `nonPublishable` flag to drafter prompt for platforms not in `SUPPORTED_PLATFORMS`
   - UI shows "Draft only" instead of "Send to queue" for those platforms

### Sprint 2: "Ads Workspace Completion" (Week 2–3)
> Backend exists for most of this. Pure frontend wiring.

4. **Audiences tab wiring** (#6)
   - Surface the existing `audiences_list/create/get/delete/add_users` backend in `ads-workspace.jsx`
5. **Spark Ads UI** (#4)
   - Add "Boost as Spark Ad" toggle/button on TikTok published rows
   - Thread `sparkAuthCode`, `linkUrl`, `callToAction` through the boost dialog
6. **Per-ad analytics surface** (#7)
   - Add an "Analytics" sub-tab or drawer in `ads-workspace.jsx` that calls `ad_analytics`

### Sprint 3: "New Features" (Week 4–5)
> Genuine new work. Larger scope.

7. **Account health (Phase 0.3)** (#5)
   - Migration: `channels.health_status` column
   - Cron: `/api/cron/account-health` that probes each connected platform
   - UI: badge on connection tiles + Settings hub
8. **Campaign draft persistence** (#9)
   - Migration: `campaign_plans` table
   - Backend: CRUD route for draft/activate/archive state machine
   - UI: CampaignPlanner can list historical drafts
9. **Lead Ads** (#8)
   - Backend: `lead_forms_list/create/get/delete`, `leads_list`, `conversions_*` in `api/zernio-ads.js`
   - UI: lead-form builder + leads table in `ads-workspace.jsx`
   - Webhook: route `lead.created` to inbox

### Sprint 4: "Pipeline + Cleanup" (Week 6)
> Validate things that should work but haven't been proven.

10. **Apply pending migrations** (#10)
11. **Durable image storage smoke test** (#12)
12. **Analytics → Insights pipeline validation** (#13)
13. **Lib extraction follow-through** (#11) — refactor `api/zernio.js` to use shared libs
14. **Inbox end-to-end validation** (#14)
15. **Remaining ad platforms on Composio** (#15) — migrate `metaads`, `liads`, `ttads`, `xads` to Zernio

### Backlog (Nice-to-Have)

16. `app.html` drift (#16)
17. Reddit subreddit search (#17)
18. `sourceBriefId` UI surface (#18)
19. Stale branch cleanup (#19)

---

## Part 3 — Redrafted Implementation Prompts

Each prompt is self-contained and can be handed to an agent.

---

### Prompt 1: Fix Scheduled-Posts Allowlist Mismatch

**Goal:** Eliminate the silent 400 when users schedule posts for platforms that have cron routes but no scheduler backend.

**Context:**
- `api/scheduled-posts.js` has `SUPPORTED_PLATFORMS = new Set(["linkedin", "facebook", "x", "instagram", "reddit"])`
- `api/cron/fire-scheduled.js` has `PLATFORM_ROUTES` with 16 platforms
- `app/store.jsx` has `PLATFORM_PUBLISHERS` with 16 platforms
- The publishing queue lets users draft for all 16, but `scheduled-posts.js` rejects 11 of them at POST time

**Task:**
1. Decide: either (a) expand `SUPPORTED_PLATFORMS` to match the 16 platforms that have Zernio publish routes, or (b) add a `CAN_SCHEDULE` allowlist to `store.jsx` that gates the "Schedule" button in the drawer
2. If expanding: verify each of the 11 missing platforms has a working `POST /api/<platform>` publish route (check `api/zernio.js` or platform-specific routes). If any are stubs, exclude them and file a follow-up.
3. Update the comment in `scheduled-posts.js` that says "Keep in sync with..."
4. If any platforms are excluded, the UI should show "Publish now only — scheduling not yet available" instead of a broken schedule flow

**Constraints:** Vercel Edge, no zod, tenantId from JWT.
**Verify:** `node --check api/scheduled-posts.js`, try scheduling a TikTok post and verify it lands in `scheduled_posts` table.

---

### Prompt 2: Fix Fake Connector Validation

**Goal:** Replace the fake 1.1s `setTimeout` validation with real calls for connectors that have backends.

**Context:**
- `app/workspaces4.jsx` around line 700 has a `setTimeout` that flips `status: "connected"` with no API call
- Some connectors have real validation routes (`/api/instagram`, `/api/linkedin`, etc.), others are thin Zernio proxies with no health endpoint

**Task:**
1. Find the `setTimeout` block in `workspaces4.jsx`
2. For connectors with a known health/validate endpoint, call it before flipping status:
   - If the call succeeds (200), flip to "connected"
   - If it fails, show the error and keep status as "error"
3. For connectors with no health endpoint, change the UI to show "Connected (unverified)" or keep the button as "Validate" instead of auto-flipping
4. Don't break the existing OAuth connectors (Meta, Google, etc.) — they have real callback validation

**Constraints:** JSX-with-IIFE, no ES imports.
**Verify:** Test connecting Instagram (has backend) vs a stub connector (no backend). Expect real validation for Instagram, "unverified" badge for stubs.

---

### Prompt 3: Fix Chat AI Overconfidence (Non-Publishable Platforms)

**Goal:** Stop the drafter from showing "Send to queue" for platforms that can't actually publish.

**Context:**
- `api/chat.js` drafter prompt produces `draft_created` artifacts with a platform field
- `app/store.jsx` `PLATFORM_PUBLISHERS` has 16 platforms, but only 5 can schedule
- The draft card in `app/chat-app.jsx` shows "Send to queue" unconditionally

**Task:**
1. In `api/chat.js`, add a `publishable` field to the drafter prompt instructions:
   - "Only set `publishable: true` if the platform is one of: linkedin, facebook, x, instagram, reddit"
   - "For all other platforms, set `publishable: false` and `note: 'Draft only — publishing not yet available for this platform'`"
2. In `app/chat-app.jsx` (or wherever draft cards render), read the `publishable` flag:
   - If `publishable === false`, show "Copy draft" instead of "Send to queue"
   - Disable the queue button with a tooltip explaining why
3. Back-fill: if existing drafts lack the `publishable` field, default to checking `PLATFORM_PUBLISHERS`

**Constraints:** No zod in backend. JSX IIFE in frontend.
**Verify:** Ask Claude to draft a TikTok post → expect "Copy draft" button. Ask for LinkedIn → expect "Send to queue".

---

### Prompt 4: Spark Ads UI for TikTok

**Goal:** Let users boost TikTok organic posts as Spark Ads.

**Context:**
- `api/paid-social.js` `boost_post` already accepts `sparkAuthCode`, `linkUrl`, `callToAction`
- The backend comment says "TikTok Spark Ads — wired here; UI exposure lands in PR 4c"
- `app/ads-workspace.jsx` has the boost dialog but no Spark Ad fields

**Task:**
1. In `app/ads-workspace.jsx` (or `workspaces3.jsx` if boost is there), find the boost dialog for TikTok posts
2. Add a "Boost as Spark Ad" checkbox/toggle
3. When enabled, reveal three fields:
   - `sparkAuthCode` — text input (required for Spark Ads)
   - `linkUrl` — URL input (optional landing page)
   - `callToAction` — dropdown: `SHOP_NOW`, `LEARN_MORE`, `SIGN_UP`, `DOWNLOAD`, etc.
4. Thread these fields through the `boost_post` API call
5. If platform is not TikTok, hide the Spark Ad toggle

**Constraints:** JSX IIFE. Hook aliases per file.
**Verify:** Open a TikTok published post → click Boost → enable Spark Ad → fill auth code → submit. Check network tab for `sparkAuthCode` in POST body.

---

### Prompt 5: Audiences Tab Wiring in Ads Workspace

**Goal:** Surface the existing audiences backend in the Ads workspace UI.

**Context:**
- `api/zernio-ads.js` has full audiences CRUD: `audiences_list`, `audiences_create`, `audiences_get`, `audiences_delete`, `audiences_add_users`
- `app/ads-workspace.jsx` has a tab structure but the Audiences tab may be minimal or placeholder
- The file comment says "Future PRs 4b/4c hang sub-tabs off the..."

**Task:**
1. Verify the current state of `app/ads-workspace.jsx` — find the AudiencesPane or equivalent
2. If it exists but is empty/minimal, wire it up:
   - On mount: call `audiences_list` for the selected platform
   - Render a list with name, type (Customer / Website / Lookalike / Saved), size (if returned)
   - Clicking an item opens a detail panel with:
     - Name + type + creation date
     - "Delete" button → `audiences_delete`
     - "Add users" button → file picker for CSV → `audiences_add_users` (chunk at 10k rows)
3. If no AudiencesPane exists, create one following the CampaignsPane pattern (three-pane shell: list / detail / actions)
4. Add the "Audiences" tab to the topbar tab strip

**Constraints:** JSX IIFE. Reuse existing CSV parser if available.
**Verify:** Open Ads workspace → click Audiences tab → see list → create audience → delete audience.

---

### Prompt 6: Per-Ad Analytics Surface

**Goal:** Show per-campaign / per-ad performance data in the Ads workspace.

**Context:**
- `api/zernio-ads.js` has `ad_analytics` → `GET /v1/ads/{adId}/analytics`
- `api/zernio-analytics.js` also has `ad_analytics` (raw passthrough)
- Neither is consumed by `ads-workspace.jsx`

**Task:**
1. In `app/ads-workspace.jsx`, add an "Analytics" button or sub-tab in the campaign/ad detail panel
2. When clicked, call `ad_analytics` with:
   - `adId` from the selected ad
   - `fromDate` / `toDate` from a date picker (default last 30 days)
   - Optional `breakdowns` for Meta/TikTok (age, gender, country, etc.)
3. Render a summary card with: spend, impressions, clicks, CTR, CPC, conversions
4. If `daily` array is present, render a mini line chart (reuse sparkline logic from `insights.jsx` if possible)
5. If `breakdowns` are present, render demographic bars (reuse `CohortCard` logic)

**Constraints:** JSX IIFE. No external chart libs — use SVG sparklines.
**Verify:** Select an active Meta ad → click Analytics → see spend/impressions/CTR + daily trend.

---

### Prompt 7: Account Health (Phase 0.3)

**Goal:** Proactively tell users when a platform connection is broken.

**Context:**
- No `channels.health_status` column exists
- No cron job checks token validity
- Users only discover expired tokens when a publish fails

**Task:**
1. **Migration:** `db/migrations/2026-06-03-account-health.sql`
   - Add `health_status` (text, default 'unknown') and `health_checked_at` (timestamptz) to `channels` table
   - Values: `healthy`, `expired`, `scope_missing`, `rate_limited`, `unknown`
2. **Backend:** `api/cron/account-health.js`
   - Vercel Edge cron, runs hourly
   - For each `status='connected'` channel, probe the platform:
     - Zernio platforms: call a lightweight endpoint (e.g. `GET /v1/accounts/{id}` or list posts)
     - Composio platforms: call Composio health check
   - Update `health_status` and `health_checked_at`
   - If status changes from `healthy` → something else, emit a `NOTIFY` toast event (or write to a new `notifications` table)
3. **UI:** `app/workspaces4.jsx` + `app/chat-app.jsx`
   - Connection tiles show a small dot: green (healthy), yellow (unchecked > 24h), red (expired/error)
   - On click, show the specific error (e.g. "Token expired — re-authenticate")

**Constraints:** Vercel Edge, no zod. Use existing `requireCron` and `zernioFetch`.
**Verify:** `node --check api/cron/account-health.js`. Revoke a test token → wait for cron → expect red badge.

---

### Prompt 8: Campaign Draft Persistence

**Goal:** Let users save campaign plans as drafts before activating them.

**Context:**
- Campaigns live in `state.activePlan` (ephemeral, lost on refresh)
- No `campaign_plans` table exists
- CampaignPlanner can't list historical drafts

**Task:**
1. **Migration:** `db/migrations/2026-06-04-campaign-plans.sql`
   - `campaign_plans` table: `id`, `tenant_id`, `name`, `status` (draft/active/paused/archived), `plan` (jsonb), `created_at`, `updated_at`
   - RLS policies for tenant isolation
2. **Backend:** `api/campaign-plans.js`
   - Actions: `list`, `get`, `create`, `update`, `delete`, `activate`
   - `activate` transitions `status: draft → active` and optionally pushes to `state.activePlan`
3. **UI:** `app/workspaces2.jsx` (CampaignPlanner)
   - Add a "My Campaigns" sidebar or drawer
   - Show drafts with edit/activate/delete actions
   - "Save as draft" button in the plan builder

**Constraints:** Vercel Edge, no zod. `tenantId` from JWT.
**Verify:** Create plan → Save as draft → Refresh → draft still there → Activate → status changes.

---

### Prompt 9: Lead Ads

**Goal:** Full lead ads support: forms, leads capture, conversions tracking.

**Context:**
- No backend actions for lead forms, leads, or conversions
- No webhook route for `lead.created`
- No UI for lead-form builder or leads table

**Task:**
1. **Backend:** Extend `api/zernio-ads.js`
   - `lead_forms_list` — `GET /v1/ads/lead-forms`
   - `lead_forms_create` — `POST /v1/ads/lead-forms`
   - `lead_forms_get` — `GET /v1/ads/lead-forms/{id}`
   - `lead_forms_delete` — `DELETE /v1/ads/lead-forms/{id}`
   - `leads_list` — `GET /v1/ads/leads` (with `formId` filter)
   - `conversions_list/create/get` — if Zernio has Conversions API endpoints
2. **Webhook:** Extend `api/webhooks/zernio.js`
   - Route `lead.created` events to inbox (create an inbox item with lead data)
3. **UI:** `app/ads-workspace.jsx`
   - "Lead Forms" tab with list + create drawer
   - "Leads" tab with table (name, email, phone, form, date) + CSV export
   - "Conversions" tab (if backend supports it)

**Constraints:** Check Zernio OpenAPI spec for exact lead-form endpoints before implementing.
**Verify:** Create lead form → webhook fires → lead appears in inbox + leads table.

---

### Prompt 10: Apply Pending Migrations

**Goal:** Ensure `analytics_primitives` and `analytics_cohorts` tables exist in production.

**Context:**
- `db/migrations/2026-06-01-analytics-extensions.sql` adds `analytics_primitives` + alters `analytics_snapshots`
- `db/migrations/2026-06-02-analytics-cohorts.sql` adds `analytics_cohorts`
- Both are checked in but not in the 000–013 sequential chain

**Task:**
1. Verify these haven't been run against the live Supabase project (check if tables exist)
2. If missing, apply via Supabase SQL Editor
3. Optionally rename/resequence them into `014_analytics_extensions.sql` and `015_analytics_cohorts.sql` for consistency
4. Update any README/AGENTS.md that references migration numbers

**Verify:** Check Supabase dashboard → Table Editor → `analytics_primitives` and `analytics_cohorts` visible.

---

### Prompt 11: Lib Extraction Follow-Through

**Goal:** Refactor `api/zernio.js` to use shared `zernioMap.js` + `zernioClient.js`.

**Context:**
- `api/lib/zernioMap.js` and `api/lib/zernioClient.js` exist and are used by `paid-social.js`, `zernio-ads.js`, etc.
- `api/zernio.js` still inlines `zernioFetch`, `PLATFORM_ID_MAP`, etc.
- Now that Track A and B are landed, it's safe to refactor without causing merge conflicts

**Task:**
1. Read `api/zernio.js` and identify all inlined helpers that duplicate shared libs
2. Replace them with imports from `api/lib/zernioMap.js` and `api/lib/zernioClient.js`
3. Ensure no behavior changes — this is a pure refactor
4. Run `node --check` on all affected files

**Constraints:** Must not break any existing actions. Minimal diff.
**Verify:** All `/api/zernio` actions still work (smoke test: list_posts, create_post).

---

### Prompt 12: Durable Image Storage Smoke Test

**Goal:** Verify generated images return durable Supabase Storage URLs.

**Context:**
- `api/generate.js` has `rehost()` for videos
- Images may still return temporary URLs from Runware/ provider that break after 24h

**Task:**
1. Trace the image generation path in `api/generate.js` — find where the image URL is returned to the client
2. Check if it goes through `rehost()` or similar
3. If not, add image rehosting to the same Supabase Storage bucket used for videos
4. Smoke test: generate an image → copy URL → wait 24h → verify URL still loads
5. If bucket `media-assets` doesn't exist or isn't public, fix that

**Verify:** Generate image → inspect URL → should be `*.supabase.co/storage/v1/object/public/media-assets/...`

---

### Prompt 13: Analytics → Insights Pipeline Validation

**Goal:** Prove the full loop works: metrics → Claude → insight cards → recommended actions → proactive drafts.

**Context:**
- `api/analytics-ingest.js` fetches GA4/GSC/Meta Ads data
- `app/insights.jsx` renders insight cards
- `api/proactive-drafts.js` generates email drafts based on insights

**Task:**
1. Run `/api/analytics-ingest` for a test tenant with real connected platforms
2. Verify `analytics_insights` table gets a row with `summary`, `insights`, `recommended_actions`
3. Check that `app/insights.jsx` renders the insight cards correctly
4. Trigger proactive drafts (via cron or manual) and verify they reference real numbers from the insights
5. Fix any breakage in the pipeline (prompt drift, schema mismatch, etc.)

**Verify:** End-to-end smoke with real data. Screenshot the Insights page + a proactive draft email.

---

### Prompt 14: Inbox End-to-End Validation

**Goal:** Prove the inbox works for real DMs, comments, and reviews.

**Context:**
- `api/inbox.js` is wired to Zernio
- `api/webhooks/zernio.js` receives message/comment/reaction/review events
- `app/workspaces3.jsx` has InboxEscalation UI

**Task:**
1. Verify `api/inbox.js` correctly fetches and normalizes inbox items from Zernio
2. Send a test DM/comment to a connected platform → verify webhook hits `api/webhooks/zernio.js` → verify inbox item is created
3. Test reply drafting: click reply in inbox → AI drafts response → send → verify it posts to platform
4. Test escalation rules: mark item as "Escalate" → verify it appears in the escalation queue
5. Fix any auth or routing issues

**Verify:** Real DM/comment on Instagram/LinkedIn → appears in inbox → reply sent → visible on platform.

---

### Prompt 15: Migrate Remaining Ad Platforms to Zernio

**Goal:** Move `metaads`, `liads`, `ttads`, `xads` off Composio to Zernio.

**Context:**
- Only `pinads` migrated to Zernio
- `metaads`, `liads`, `ttads`, `xads` still on Composio and blocked by error 306 (no managed auth)
- This breaks the Ads workspace for non-Pinterest platforms

**Task:**
1. Check if Zernio supports Meta Ads, LinkedIn Ads, TikTok Ads, X Ads APIs
2. If yes: create migration plan similar to `pinads` → Zernio
3. Update `api/paid-social.js` to use Zernio routes for these platforms
4. Update `app/ads-workspace.jsx` platform picker to remove Composio-based restrictions
5. If Zernio doesn't support some platforms, document the gap and keep Composio as fallback

**Verify:** Connect Meta Ads account → create campaign → verify it appears in Zernio (and FlowOS).

---

## How to Use This Document

1. **Pick a sprint** from Part 2
2. **Copy the matching prompt(s)** from Part 3
3. **Hand to an agent** — each prompt is self-contained with context, task, constraints, and verify steps
4. **Update this doc** as items ship — mark them `[x]` and append the commit/PR number

---

*Combined recon by Kimi + Claude. Redrafted by Kimi.*
