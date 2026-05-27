# FlowOS Reach — Sprint Board

*Claude: read this at the start of every session. Update it at the end.*

---

## Now (in progress)

Nothing actively in progress.

---

## Just shipped

| ID | What | Date |
|----|------|------|
| b_9eda | Tenant-aware fallback drafts | `api/proactive-drafts.js`: replaced hardcoded MVEDA/Ayurveda `FALLBACK_DRAFTS` constant with `buildFallbackDrafts(brand, count)` — uses `brand.name`/`brand.industry` from Supabase so all fallback paths produce brand-appropriate placeholder content. Brand fetch moved before the API-key check so it's always available. | 2026-05-25 |
| b_0035 | /api/chat 503 on missing key | `api/chat.js`: changed no-API-key response from `200 { ok:true, content:[…] }` to `503 { ok:false, error:"…" }`. Frontend `callSpecialist` treats `!response.ok` as `fallback:true`, triggering `inferResponse` simulation correctly. | 2026-05-25 |
| b_4b42 | CORS wildcard fix | `api/generate.js` + `api/spend.js`: replaced hardcoded `'Access-Control-Allow-Origin': '*'` with `corsHeaders()` from `./lib/cors.js`. `b_8ff1` already resolved — `cors.js` omits the header entirely when `APP_ORIGIN` unset. | 2026-05-25 |
| b_sec2 | Prompt injection fix | `api/chat.js`: dropped `brandFromClient` from body — brand is now Supabase-only, never client-supplied. `api/proactive-drafts.js`: same; removed `brand` from body destructure and fallback logic. | 2026-05-25 |
| b_sec1 | PATCH allowlist + tenant scope | `api/proactive-emails.js` + `api/proactive-sms.js`: `patchDraft` now filters on `id AND tenant_id`; PATCH handler strips patch to allowlisted keys only (`status`, `klaviyo_*`, `sent_at`). | 2026-05-25 |
| b_img1 | Durable video storage | `api/generate.js`: `handleGenerateVideo` now calls `rehost()` after row insert for sync providers, patches row with durable Supabase Storage URL. Closes the video gap (image path was already done). | 2026-05-25 |
| b_cbnd | CanvasErrorBoundary | `chat-app.jsx`: `class CanvasErrorBoundary` wraps `<CanvasBody>`; catches throws, logs once at warn, shows inline retry. Silences the repeating CanvasBody crash spam from seed-bypass JWT failure. | 2026-05-25 |
| b_gsc1 | GSC channel display | `insights.jsx`: `gsc` entry in `CHANNEL_META` (organic group, 🔎) + `CHANNEL_KEY_METRICS`; `avg_ctr`/`avg_position` label+format; Search Clicks KPI strip; key-first `channelMeta` lookup in `InsightsGrid`. | 2026-05-25 |
| b_ins1 | Analytics → Insights pipeline | `api/analytics-ingest.js`: GA4 slug fix, Google Ads → Zernio, GSC fetcher added. `app/insights.jsx`: hook aliases (b_47d0), ErrorState + three-state render (b_c945), workspace-specific CTAs on action + insight cards. `CLAUDE.md` hook-alias table updated. | 2026-05-25 |
| b_inb1 | Wire Inbox | `api/inbox.js` (new edge fn); `workspaces3.jsx` fetchInbox → `/api/inbox`; `conversation_id` → `conversationId` fix; local-only fallback for reply_comment (b_inb2 gap). | 2026-05-25 |
| b_60f8 | Fix Shopify 306 → modal shows actionable error + Composio link | `workspaces4.jsx`: catch block re-opens `ConnectorAuthModal` with `errorMsg` on 409; modal renders error banner + "Open Composio dashboard" button instead of spinning | 2026-05-24 |
| b_c003 | Fix unverified inbox/analytics endpoints in zernio.js | Removed stale `ENDPOINT_UNVERIFIED` from `handleBoostPost` and `ENDPOINT_PARTIAL` from `handleGetAnalytics` — paths were already correct from prior session | 2026-05-24 |
| b_c002 | Social ads action layer (all 5 paid platforms) | `api/social-ads.js` — `list_campaigns`, `create_campaign`, `boost_post`, `get_analytics`, `create_audience` via Zernio; covers metaads/liads/ttads/xads/pinads | 2026-05-24 |
| b_c001 | Wire 5 remaining organic platforms to publish cron | `api/whatsapp.js`, `api/telegram.js`, `api/snapchat.js`, `api/discord.js`, `api/googlebusiness.js` (thin Zernio proxies); `PLATFORM_ROUTES` in `api/cron/fire-scheduled.js` extended | 2026-05-24 |
| b_a004 | Migrate googleads from Composio to Zernio | `api/google-ads.js` rewritten against Zernio `/v1/ads/*`; `ADS_TO_ORGANIC` routing added to `api/zernio.js`; `seed.jsx` provider flipped; Composio `APP_MAP` cleaned | 2026-05-24 |
| b_a001 | Adopt Zernio for all organic social publishing | `api/zernio.js` unified publisher; all 10 cron-routed platforms wired; individual platform files are thin proxies; all organic social `seed.jsx` entries flipped to `provider: "zernio"` | 2026-05-24 |
| b_a003 | Scope Composio strictly to non-social | Social toolkits removed from Composio path; Composio now covers only: GA4, GSC, HubSpot, Salesforce, Mailchimp, ElevenLabs, HeyGen | 2026-05-24 |
| b_8cad | Wire social platform publishers via Zernio | All 10 platforms in `fire-scheduled` PLATFORM_ROUTES wired end-to-end; retitled from "via Composio" | 2026-05-24 |
| b_ea4e | IG text-only post fix | Schedule + Publish Now disabled when no image; pink callout with "Generate image" button; auto-unblocks on completion | 2026-05-24 |
| b_cc01 | DB migrations complete | 008 connector_credentials · 009 brand_voice_fields · 010 proactive_sms added to db/migrations/ — now a full sequential source of truth | 2026-05-24 |
| b_3037 | Proactive SMS cron | api/proactive-sms.js + cron/proactive-sms.js + vercel.json + store (3 cases/actions) + ProactiveSmsDrafts UI in SmsCenter + DB migration | 2026-05-24 |
| b_6c61 | Verify Composio connection_status after JWT auth | 2026-05-23 |
| b_d25a | Verify brand-import tenant scoping after JWT auth | 2026-05-23 |
| b_0c94 | JWT verification on every /api/* endpoint | 2026-05-22 |
| b_9d59 | Row Level Security on all Supabase tables | 2026-05-22 |
| b_8698 | Scheduled posting via Vercel Cron + Supabase queue | 2026-05-22 |
| b_e061 | InsightsCenter undefined globals + duplicate stub fix | 2026-05-22 |

---

## Up next — one chat each, in priority order

| ID | Chat scope | What it touches | Effort |
|----|-----------|-----------------|--------|
---

## Known issues

- Cron `fire-scheduled` requires **Vercel Pro** for guaranteed 1-min execution; Hobby plan won't fire reliably.
- `sourceBriefId` on calendar items is wired but no UI reads it yet (b_2504).

---

## Health check

Run `node scripts/health-check.mjs` after any session. Silent = all clear.
*(Also runs automatically via Claude Code Stop hook.)*

---

*Last updated: 2026-05-25 — b_0035/b_9eda/b_4b42 shipped; security audit complete (b_sec1/b_sec2/b_e15e/b_b826/b_8ff1 all closed)*
