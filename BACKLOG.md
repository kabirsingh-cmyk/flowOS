# FlowOS Backlog

Maintained by `scripts/backlog-engine.mjs`. Free-text `### Why` / `### Notes` are user-owned — the engine never rewrites them.

## Index

| id | title | status | last-touched |
|---|---|---|---|
| b_8cad | Audit and wire remaining social platform publishers via Composio | in-progress | 2026-05-22 |
| b_0c94 | Server-side JWT verification on every /api/* endpoint | done | 2026-05-22 |
| b_9d59 | Enable Row Level Security on every table | done | 2026-05-22 |
| b_cc01 | Add missing migrations: brands, channels, posts, google_ads_tokens, proactive_drafts | done | 2026-05-24 |
| b_3037 | Proactive SMS feature (analogue to proactive-emails) | done | 2026-05-24 |
| b_43d9 | Reddit native image posts (bypass Composio) | backlog | 2026-05-22 |
| b_fad1 | Reddit subreddit typeahead suggestions | backlog | 2026-05-22 |
| b_b274 | Instagram carousel + video/Reels posting | backlog | 2026-05-22 |
| b_55ec | X chunked media upload (video / large images) | backlog | 2026-05-22 |
| b_5da8 | Recently-Published view in Publishing Queue (all platforms) | backlog | 2026-05-22 |
| b_7117 | LinkedIn sponsored content / Ads | backlog | 2026-05-22 |
| b_2633 | LinkedIn true Articles (long-form) | backlog | 2026-05-22 |
| b_6236 | Programmatic Creative (Variant Testing) | backlog | 2026-05-22 |
| b_b826 | Google Ads OAuth — sign state with HMAC for CSRF protection | backlog | 2026-05-22 |
| b_c0a8 | Replace fake API-key connector validation with real validate calls | backlog | 2026-05-22 |
| b_317a | Strip or preview-tag platform pickers without backends | backlog | 2026-05-22 |
| b_4b42 | Tighten CORS to allowlist + add CORS to klaviyo/proactive-emails | backlog | 2026-05-22 |
| b_e15e | Fix cron fail-open and cron→platform auth handoff | backlog | 2026-05-22 |
| b_0035 | /api/chat should 503 when ANTHROPIC_API_KEY missing | backlog | 2026-05-22 |
| b_9d66 | Scope and allowlist keys on PATCH endpoints | backlog | 2026-05-22 |
| b_8f1f | Don't trust client-supplied brand in Claude prompts | backlog | 2026-05-22 |
| b_9eda | Replace MVEDA-specific fallback drafts with tenant-aware generation | backlog | 2026-05-22 |
| b_c91d | Replace simulateImageGen with real generation or label as demo-only | backlog | 2026-05-22 |
| b_0f34 | Reduce Klaviyo response logging to structured minimum | backlog | 2026-05-22 |
| b_6c61 | Verify Composio connection_status / list_connections after JWT auth lands | done | 2026-05-23 |
| b_d25a | Verify /api/brand-import tenant scoping after JWT auth lands | done | 2026-05-23 |
| b_6c24 | Centralise Claude model selection via env var + shared helper | backlog | 2026-05-22 |
| b_47d0 | Add InsightsCenter to CLAUDE.md hook-alias table and rename bare hooks | backlog | 2026-05-22 |
| b_8ff1 | Require explicit APP_ORIGIN or derive from VERCEL_URL with https | backlog | 2026-05-22 |
| b_0394 | Replace Math.random() UUIDs with crypto.randomUUID() | backlog | 2026-05-22 |
| b_2557 | Align app.html and index.html script lists (or remove app.html) | backlog | 2026-05-22 |
| b_801d | Move set_updated_at() helper to 000_helpers.sql | backlog | 2026-05-22 |
| b_b88d | Switch Google Ads OAuth prompt to select_account after initial consent | backlog | 2026-05-22 |
| b_d824 | Deploy-time guard for Vercel cron schedule (Pro vs Hobby) | backlog | 2026-05-22 |
| b_c664 | Extract shared platformPublisher helper for the five publish_now endpoints | backlog | 2026-05-22 |
| b_2504 | Enforce sourceBriefId on CAL_ADD path | backlog | 2026-05-22 |
| b_38f0 | Edit-after-schedule warning + Unschedule button in drawer | backlog | 2026-05-22 |
| b_60f8 | Composio code 306 (no managed auth) — Connect modal hangs forever | backlog | 2026-05-22 |
| b_ea4e | Text-only Instagram post fails at publish (imageUrl required) | done | 2026-05-24 |
| b_b259 | Chat AI confidently drafts for platforms with no publish path | backlog | 2026-05-22 |
| b_c945 | InsightsCenter empty state can't distinguish no-data from broken fetch | backlog | 2026-05-22 |
| b_a001 | Adopt Zernio for all organic social publishing (replaces Composio social toolkit + Pipedream Pinterest) | backlog | 2026-05-22 |
| b_a002 | Route paid social ads through Zernio (Meta / LinkedIn / TikTok / Pinterest / X Ads) | backlog | 2026-05-22 |
| b_a003 | Scope Composio strictly to non-social: Google Ads, GA4, GSC, HubSpot, Salesforce, Mailchimp, YouTube analytics, ElevenLabs, HeyGen, brand-import | backlog | 2026-05-22 |
| b_a004 | Remove SendGrid; transactional email via Postmark/Resend, marketing via Klaviyo | backlog | 2026-05-22 |
| b_a005 | Defer Twilio integration until validated tenant request (scope decision) | backlog | 2026-05-22 |
| b_a006 | generation_usage Supabase table to track Runware / HeyGen / Higgsfield cost per tenant | backlog | 2026-05-22 |
| b_dca6 | Campaign brief persistence + cross-feature wiring | proposed-done | 2026-05-22 |
| b_2fac | Disabled-platform drafts silently swallowed by queue | proposed-done | 2026-05-22 |
| b_3686 | Cron must mint per-tenant JWT for /api/<platform> publish calls | proposed-done | 2026-05-22 |
| b_8698 | Scheduled posting via Vercel Cron + Supabase queue | done | 2026-05-22 |
| b_e061 | InsightsCenter undefined globals + duplicate stub | done | 2026-05-22 |

---
## b_8cad · Audit and wire remaining social platform publishers via Composio

- **status**: in-progress
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Other social platforms — Composio posting audit)
- **depends-on**: []
- **touches**: api/linkedin.js, api/facebook.js, api/x.js, api/instagram.js, api/reddit.js

### Why
Partial · updated 2026-05-14. Priority: Medium — five platforms now publish (LinkedIn + FB/X/IG/Reddit); rest still unwired.

### Notes
| Connector | seed.id | Endpoint / toolkit | Status | Plan |
|---|---|---|---|---|
| LinkedIn | `li` | `/api/linkedin` · LINKEDIN | ✅ Shipped | — |
| Facebook | `fb` | `/api/facebook` · FACEBOOK | ✅ Shipped | resolve_pages + publish_now (photo or text) |
| X / Twitter | `x` | `/api/x` · TWITTER | ✅ Shipped | publish_now only, no author picker |
| Instagram | `ig` | `/api/instagram` · INSTAGRAM + FACEBOOK | ✅ Shipped | accounts resolved via linked FB Pages; image required |
| Reddit | `reddit` | `/api/reddit` · REDDIT | ✅ Shipped (with gaps — see below) | free-text subreddit; image posts fall back to link |
| TikTok | `tt` | TIKTOK | ⬜ Not feasible without approval | TikTok Content Posting API is gated — separate approval flow |
| YouTube | `yt` | YOUTUBE | ⬜ Open | likely (50 tools, 4 triggers) — Shorts upload, multi-step video |
| Pinterest | `pn` | not in toolkit index | ⬜ Open | Pinterest API direct, or skip |
| Threads | `threads` | not in toolkit index | ⬜ Out of scope | Meta Threads API direct (different auth shape) |
| Snapchat | `snap` | SNAPCHAT | ⬜ Out of scope | 139 tools but ads-only — Snap doesn't expose organic posting |
| Bluesky | `bluesky` | not in toolkit index | ⬜ Open | AT Protocol direct (open, easy) |
| Mastodon | `mastodon` | not in toolkit index | ⬜ Open | Mastodon API direct (per-instance) |
| Telegram | `telegram` | TELEGRAM | ⬜ Open | Bot API sendMessage — bot token flow, not OAuth |

**Pattern when Composio doesn't have it:** in the Publishing Queue drawer, surface "Composio doesn't currently support direct posting for X — choose one: (a) export and post manually, (b) connect a custom integration, (c) keep as draft." Don't silently flip `status: "sent"` without firing.

## b_0c94 · Server-side JWT verification on every /api/* endpoint

- **status**: done
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Server-side auth: JWT verification on every /api/* endpoint  `[in progress]`)
- **depends-on**: []
- **touches**: api/lib/auth.js, api/chat.js, api/generate.js, api/composio.js, api/brand-import.js, api/analytics-ingest.js, api/linkedin.js, api/facebook.js, api/x.js, api/instagram.js, api/reddit.js, api/klaviyo.js, api/proactive-drafts.js, api/proactive-emails.js, api/scheduled-posts.js, api/google-ads.js, api/google-ads-auth.js, api/cron/, app/supabase.jsx, api/replicate.js, api/higgsfield.js, api/luma.js, api/optimizely.js, api/wordpress.js, api/audiostack.js, api/pipedream.js

### Why
In progress on `feat/auth-and-rls` · added 2026-05-14. Priority: Critical — gates every other security control. Every `/api/*.js` reads `tenantId` from the request body or query and trusts it. `api/scheduled-posts.js:14` even explicitly documents "tenantId is trusted from the request body … RLS is intentionally not used." With the anon key shipped in `app/supabase.jsx`, any caller can impersonate any tenant and publish/read/write on their behalf.

### Notes
Shipped 2026-05-22. The bulk landed earlier on `main` (api/lib/auth.js + requireAuth/requireCron/requireAuthOrCron applied to chat, generate, composio, brand-import, analytics-ingest, the five social platform handlers, klaviyo, proactive-* POST, scheduled-posts, google-ads, all cron handlers — May 18 work). Final gap closed on `chore/auth-rls-audit` (commit `b21f69d`): an audit of every `/api/*` route found seven still trusting `body.tenantId`:
- `api/replicate.js`, `api/higgsfield.js`, `api/luma.js`, `api/optimizely.js`, `api/wordpress.js`, `api/audiostack.js` — Direct-API connector routes that persisted credentials per-tenant
- `api/pipedream.js` — Pipedream Connect token minting + account list/disconnect

All seven now call `requireAuth(req)` and override `body.tenantId` with the verified `auth.tenantId` (canonical pattern from `api/composio.js`). Pipedream's disconnect also gained a tenant-ownership preflight (was: any authenticated user could revoke any tenant's accounts by enumerating accountIds).

Intentionally left without auth, both verified safe:
- `api/google-ads-auth.js` — 410 tombstone since the Composio cutover
- `api/dev/mint-token.js` — hard-gated on `VERCEL_ENV !== "production"`

The two follow-up items b_6c61 (verify Composio status/list_connections post-JWT) and b_d25a (verify brand-import scoping post-JWT) were closed on 2026-05-23 — verified clean on `chore/jwt-followups`. See their individual sections below for the audit notes.

## b_9d59 · Enable Row Level Security on every table

- **status**: done
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Row Level Security on every table  `[in progress]`)
- **depends-on**: []
- **touches**: db/migrations/007_core_schema_and_rls.sql, supabase/migrations/2026-05-18-connector-credentials.sql, app/supabase.jsx, app/insights.jsx

### Why
In progress on `feat/auth-and-rls` · added 2026-05-14. Priority: Critical — companion to JWT auth. `app/supabase.jsx` ships the public anon key in client code; the comment claims "all data is protected by Row Level Security" but RLS is off everywhere. 001 and 002 migrations have RLS lines commented out. 003 / 004 / 005 ship with no RLS clauses at all. Tables: `generation_jobs`, `media_uploads`, `agent_overrides`, `analytics_snapshots`, `analytics_insights`, `proactive_emails`, `scheduled_posts`.

### Notes
Shipped 2026-05-22. Implementation landed earlier on `main` in `db/migrations/007_core_schema_and_rls.sql` (May 18): defines the missing brands/channels/posts/google_ads_tokens/proactive_drafts tables and enables RLS + tenant-isolation select+modify policies on all 12 public-schema tables (`generation_jobs`, `media_uploads`, `agent_overrides`, `analytics_snapshots`, `analytics_insights`, `proactive_emails`, `scheduled_posts`, `brands`, `channels`, `posts`, `google_ads_tokens`, `proactive_drafts`). `supabase/migrations/2026-05-18-connector-credentials.sql` enables RLS on the 13th table (`connector_credentials`) with no policies — service-role only, intentional.

Audit on `chore/auth-rls-audit` (2026-05-22) cross-referenced every table in `CREATE TABLE` migrations against tables actually referenced via `/rest/v1/<table>` in api code — every reference matches a table with RLS, no orphans. Frontend direct-REST reads in `app/insights.jsx` send the user JWT as `Authorization: Bearer ${access_token}` alongside the anon key; without the JWT the read returns zero rows.

Service-role writes from `/api/*` (including all six Direct-API connector routes via `api/lib/directCredentials.js` and the cron-fired publishers) continue to work because the service-role key bypasses RLS — which is correct, since those paths now identify the tenant via `requireAuth(req)` (b_0c94) before writing.

This closes b_9d59. Outstanding hardening followups stay open as their own items: b_b826 (Google Ads OAuth state HMAC — moot post-Composio cutover but the item is still on the board), b_8f1f (don't trust client-supplied brand in chat prompts — separate from tenant id).

## b_cc01 · Add missing migrations: brands, channels, posts, google_ads_tokens, proactive_drafts

- **status**: done
- **created**: 2026-05-22
- **last-touched**: 2026-05-24
- **effort**: unsized
- **source**: bootstrap (from Missing migrations: brands, channels, posts, google_ads_tokens, proactive_drafts  `[in progress]`)
- **depends-on**: []
- **touches**: db/migrations/007_core_schema_and_rls.sql, db/migrations/008_connector_credentials.sql, db/migrations/009_brand_voice_fields.sql, db/migrations/010_proactive_sms.sql

### Why
Priority: Critical — fresh Supabase project cannot reproduce schema.

### Notes
Original missing tables (brands, channels, posts, google_ads_tokens, proactive_drafts) were added in `007_core_schema_and_rls.sql` on 2026-05-22 as part of the auth+RLS work (b_9d59). The planned `006_core_schema.sql` was folded into `007`.

Completed 2026-05-24: added `008`, `009`, `010` to `db/migrations/` to cover the additive changes that had landed only in `supabase/migrations/`:
- `008_connector_credentials.sql` — `connector_credentials` table (service-role only, no RLS policies)
- `009_brand_voice_fields.sql` — `messaging` + `terminology` columns on `brands`
- `010_proactive_sms.sql` — `proactive_sms` table + RLS

`db/migrations/` (001–010) is now the complete source of truth for a fresh Supabase setup. All DDL is idempotent (`IF NOT EXISTS`, `OR REPLACE`, `ADD COLUMN IF NOT EXISTS`). The `006` gap is intentional — `006_core_schema.sql` was merged into `007` before numbering was finalized.

## b_3037 · Proactive SMS feature (analogue to proactive-emails)

- **status**: done
- **created**: 2026-05-22
- **last-touched**: 2026-05-24
- **effort**: unsized
- **source**: bootstrap (from WIP: proactive SMS feature (analogue to proactive-emails))
- **depends-on**: []
- **touches**: api/proactive-sms.js, api/cron/proactive-sms.js, supabase/migrations/2026-05-23-proactive-sms.sql, db/migrations/010_proactive_sms.sql, app/features.jsx, app/store.jsx, app/chat-app.jsx, vercel.json

### Why
Priority: Medium. Mirrors proactive-emails to close the SMS channel gap.

### Notes
Shipped 2026-05-24. Four rules (S1 win-back · S2 replenish · S3 cart · S4 VIP). Claude Haiku generates ≤138-char body (160 minus STOP footer headroom). Falls back to MVEDA/Erickson hand-written demo drafts when no insights row exists. Cron at 08:00 UTC (30 min after proactive-emails). ProactiveSmsDrafts UI in SmsCenter — approve pushes to Klaviyo via create_draft_sms, dismiss soft-deletes. Store has PROACTIVE_SMS_LOAD/UPDATE/REMOVE cases + 3 matching actions.

## b_43d9 · Reddit native image posts (bypass Composio)

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Reddit — image posts not supported by Composio)
- **depends-on**: []
- **touches**: api/reddit.js

### Why
Workaround in place · added 2026-05-14. Priority: Low — fallback preserves user intent.

### Notes
`REDDIT_CREATE_REDDIT_POST` only accepts `kind: "self"` (text) and `kind: "link"`. No `kind: "image"`, no media-upload-lease slug. When a Reddit draft has an imageUrl, `/api/reddit` falls back to `kind:"link"` with the hosted image URL as the submission target and returns `{ imageAsLink: true }`. The drawer surfaces a warn toast.

To upgrade to native image posts later, we'd need to bypass Composio and call `/api/media/asset.json` (image lease) → `POST /api/submit` with `kind: "image"` directly, holding our own Reddit OAuth token.

## b_fad1 · Reddit subreddit typeahead suggestions

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Reddit — no subreddit discovery slug)
- **depends-on**: []
- **touches**: api/reddit.js

### Why
Workaround in place · added 2026-05-14. Priority: Low.

### Notes
Composio doesn't expose `/subreddits/mine/subscriber`, `/contributor`, or `/moderator`. Only `REDDIT_GET_SUBREDDITS_SEARCH` (keyword search) is available. The drawer renders subreddit as a free-text input rather than a dropdown. Optional follow-up: wire `/api/reddit` `search_subreddits` as a typeahead suggestion list below the input.

## b_b274 · Instagram carousel + video/Reels posting

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Instagram — carousel + video posts)
- **depends-on**: []
- **touches**: api/instagram.js

### Why
Open · added 2026-05-14. Priority: Low — single-image posts ship first.

### Notes
Composio exposes `INSTAGRAM_CREATE_CAROUSEL_CONTAINER` and presumably video container slugs, but `/api/instagram` only wires the single-image `INSTAGRAM_POST_IG_USER_MEDIA` flow today. Multi-image carousels and Reels would each need their own branch.

## b_55ec · X chunked media upload (video / large images)

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from X — chunked media upload (video / large images))
- **depends-on**: []
- **touches**: api/x.js

### Why
Open · added 2026-05-14. Priority: Low.

### Notes
`/api/x` uses the simple `TWITTER_UPLOAD_MEDIA` (single-shot, base64). For video or images >5MB, the v1.1 chunked flow (`TWITTER_INITIALIZE_MEDIA_UPLOAD` → `_APPEND_` → `_FINALIZE_` → `_GET_MEDIA_UPLOAD_STATUS`) is required. Composio exposes all four slugs.

## b_5da8 · Recently-Published view in Publishing Queue (all platforms)

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from LinkedIn — Recently-Published view in Publishing Queue)
- **depends-on**: []
- **touches**: app/workspaces3.jsx

### Why
Open · added 2026-05-14. Priority: Low — log captures it, just no UI surface.

### Notes
After `publish_now` succeeds the row gets `status: "sent"` and disappears from both `scheduled` and `drafts` filters in `workspaces3.jsx`. Add a Drafts / Scheduled / Sent tab and render `linkedinUrl` as a click-through link.

### Update 2026-05-22
Generalised from LinkedIn-only to all five platforms (LinkedIn, FB, X, IG, Reddit). Today, after `publish_now` succeeds the row gets `status: "sent"` and disappears from both `scheduled` and `drafts` filters. No Sent tab, no clickable post URL anywhere in the UI. Affects every platform that publishes.

## b_7117 · LinkedIn sponsored content / Ads

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from LinkedIn — sponsored content / Ads)
- **depends-on**: []
- **touches**: 

### Why
Deferred · added 2026-05-14. Priority: Low — wait for organic post velocity to justify.

### Notes
Out of scope for organic posting. LinkedIn Marketing Developer Platform is a separate toolkit (`liads` in seed). Needs its own `/api/linkedin-ads.js` and a `sponsored_post` artifact carrying targeting (geo, function, seniority, company size), budget, and creative.

## b_2633 · LinkedIn true Articles (long-form)

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from LinkedIn — true Articles (long-form))
- **depends-on**: []
- **touches**: api/linkedin.js

### Why
Open · added 2026-05-14. Priority: Low.

### Notes
Drafter produces `contentType: "Article"` for LinkedIn. The publish leg currently posts these as long-form text via `LINKEDIN_CREATE_LINKED_IN_POST` (works up to 110k chars) — not a "true" article (no separate URL, no cover image header, no in-feed article card). Composio doesn't appear to expose the LinkedIn Articles API. Options: keep as long-form text, or hit LinkedIn's `/articles` endpoint directly.

## b_6236 · Programmatic Creative (Variant Testing)

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Programmatic Creative (Variant Testing))
- **depends-on**: []
- **touches**: 

### Why
Parked — revisit when chat-to-create + edit-in-Flow are shipped. Priority: Medium. Inspired by: InstaAgent (YC S26) — $1M ARR in 10 months on this concept alone.

What it is: Generate N variants of a single ad or post (targeting different hooks, headlines, visuals, or audience angles), publish them, collect performance data, extrapolate the winner, and auto-scale or kill the rest — without waiting for statistically significant sample sizes.

Why build it:
- Paid social creative testing is manual and slow today — this automates the loop
- Flow already has the pieces: brand voice layer, Runware for image variants, Claude for copy variants, ads connectors for distribution and data read-back
- Defensible because it's tied to Flow's brand memory — variants stay on-voice, not generic

### Notes
Flow's version (lighter):
- **N = 5–10 variants** (not 50 — extrapolate from smaller sample, lower spend risk)
- User writes or approves a base brief → Flow generates variants automatically
- Variants differ on: headline, hook, visual style, CTA, tone angle
- Published as a Meta / TikTok ad set (via existing ads connectors)
- After 48–72h: Flow reads performance data back (CTR, CPC, ROAS via connector)
- Decision engine: auto-pause underperformers below threshold, flag winner for budget scaling
- User approves the scale decision or overrides in the Publishing Queue

Open questions:
- Extrapolation model: simple threshold (winner has >2× CTR of median) or Bayesian?
- Minimum viable spend per variant to get signal (likely $10–25/variant)
- How many platforms at launch — Meta only first, or Meta + TikTok simultaneously?
- Where does the user set budget caps — per variant or total pool?

## b_b826 · Google Ads OAuth — sign state with HMAC for CSRF protection

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Google Ads OAuth — CSRF state binding)
- **depends-on**: []
- **touches**: api/google-ads-auth.js

### Why
Open · added 2026-05-14. Priority: Critical — auth gap independent of JWT work. `api/google-ads-auth.js:40` sets `state = tenantId` and `:129` verifies on callback by trusting that same value. An attacker who knows a victim's tenantId crafts a malicious callback URL with their own `code` and the victim's tenantId — Google Ads account gets bound to the victim's tenant.

### Notes
Fix: sign state with HMAC-SHA256 over `{tenantId, nonce, exp}` using a new `OAUTH_STATE_SECRET`. 10-min TTL. Verify HMAC + exp on callback. The OAuth callback can't use the user's JWT (it's a Google redirect), so signed state is the only path.

## b_c0a8 · Replace fake API-key connector validation with real validate calls

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Fake API-key connector validation (workspaces4.jsx))
- **depends-on**: []
- **touches**: app/workspaces4.jsx, api/runware.js, api/klaviyo.js, api/heygen.js

### Why
Open · added 2026-05-14. Priority: Critical — false-positive "Connected" state misleads users. `app/workspaces4.jsx:534-545` flips non-OAuth connectors (Runware, Heygen, Klaviyo when entered as raw key) to `connected: true` after a 1.1s `setTimeout` with **no validation call**. Users believe the key works; the real failure shows up later when an image gen or send fails.

### Notes
Plan:
- Add `action: "validate"` to each non-OAuth connector endpoint (`/api/runware`, `/api/klaviyo`, `/api/heygen`, etc.) — server makes a cheap real call to the provider (Klaviyo `GET /api/accounts`, Runware `GET /v1/balance`, etc.), returns 200 on success or 401 on bad key.
- Frontend: replace the `setTimeout` with `await fetch(\`/api/${id}?action=validate\`)`; only flip `connected: true` on a real 200.

## b_317a · Strip or preview-tag platform pickers without backends

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Strip / preview-tag no-backend platform pickers)
- **depends-on**: []
- **touches**: app/seed.jsx, app/features.jsx, api/scheduled-posts.js

### Why
Open · added 2026-05-14. Priority: Critical — UI advertises features that silently fail. `seed.jsx` and `features.jsx` surface Mastodon, Bluesky, Threads, YouTube, TikTok, Snapchat, Pinterest, Telegram as connectable channels. Only 5 platforms have backends (linkedin / facebook / x / instagram / reddit). Selecting any of the others silently fails to schedule (correctly rejected by `scheduled-posts.js:33-35`).

### Notes
Pick one:
- **Strip** — remove from connector list entirely (cleanest).
- **Preview-tag** — keep visible with "Coming soon" badge and disabled Connect button (better for demos).

## b_4b42 · Tighten CORS to allowlist + add CORS to klaviyo/proactive-emails

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from CORS tightening + missing CORS on klaviyo / proactive-emails)
- **depends-on**: []
- **touches**: api/lib/cors.js, api/x.js, api/reddit.js, api/generate.js, api/composio.js, api/scheduled-posts.js, api/google-ads.js, api/instagram.js, api/linkedin.js, api/facebook.js, api/klaviyo.js, api/proactive-emails.js

### Why
Open · added 2026-05-14. Priority: Critical — `Access-Control-Allow-Origin: "*"` combined with body-trusted tenantId enables cross-site account takeover.

### Notes
Wildcard CORS on: `api/x.js:17`, `api/reddit.js:19`, `api/generate.js:31`, `api/composio.js:25`, `api/scheduled-posts.js:20`, `api/google-ads.js:403`, `api/instagram.js:22`, `api/linkedin.js:21`, `api/facebook.js:16`.

**Missing CORS entirely:** `api/klaviyo.js`, `api/proactive-emails.js` — cross-origin preflight will fail outright.

Fix: shared helper in `api/lib/cors.js` — restrict origin to allowlist (`process.env.APP_ORIGIN` + `flow-os-v2.vercel.app` + preview deploy regex). Apply uniformly.

## b_e15e · Fix cron fail-open and cron→platform auth handoff

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Cron fail-open + cron-to-platform auth handoff)
- **depends-on**: []
- **touches**: api/cron/fire-scheduled.js, api/cron/

### Why
Open · added 2026-05-14. Priority: Critical — companion to JWT auth work.

### Notes
Two bugs:
1. **Fail-open** — `api/cron/*` handlers use `if (cronSecret && req.headers.get("authorization") !== ...)`. If `CRON_SECRET` env var is unset, auth is bypassed entirely. Should fail closed.
2. **Cron-to-platform** — `api/cron/fire-scheduled.js:98` POSTs to `/api/<platform>` with no auth header. Once platform endpoints require JWT (from the auth-and-rls work), scheduled fires will break unless cron is allowlisted via a dual-auth pattern (`CRON_SECRET` accepted in lieu of JWT for service-to-service paths).

## b_0035 · /api/chat should 503 when ANTHROPIC_API_KEY missing

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from /api/chat returns 200 + placeholder when ANTHROPIC_API_KEY missing)
- **depends-on**: []
- **touches**: api/chat.js, app/chat-app.jsx, app/ai.jsx

### Why
Open · added 2026-05-14. Priority: Needs attention. `api/chat.js:432-439` returns HTTP 200 with `content: [{type:"text", text:"API key not configured."}]`. Frontend can't distinguish from a real reply, so the `inferResponse` fallback in `chat-app.jsx` never triggers.

### Notes
Fix: return 503 + `{ ok: false, error: "missing_anthropic_key" }`; have `ai.jsx` treat non-2xx as a network error and run `inferResponse`.

## b_9d66 · Scope and allowlist keys on PATCH endpoints

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from PATCH endpoints accept arbitrary patch keys)
- **depends-on**: []
- **touches**: api/proactive-emails.js

### Why
Open · added 2026-05-14. Priority: Needs attention. `api/proactive-emails.js:311-318` accepts `{ id, patch }` from the client and applies the whole patch object to the row. Client can overwrite `klaviyo_campaign_id`, `source_insight_id`, `tenant_id`, etc. — no tenant scope, no key allowlist.

### Notes
Fix: scope filter by `tenant_id` (from `requireAuth`) and allowlist patch keys (`{ status, klaviyo_campaign_id, klaviyo_template_id, sent_at }` only).

Same pattern audit on any other PATCH/UPDATE handlers added in future.

## b_8f1f · Don't trust client-supplied brand in Claude prompts

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Brand prompt injection via client-supplied `brand`)
- **depends-on**: []
- **touches**: api/chat.js, api/proactive-drafts.js

### Why
Open · added 2026-05-14. Priority: Needs attention. `api/chat.js:445` and `api/proactive-drafts.js:27` accept `brand` from the request body as a fallback when the Supabase brand profile lookup misses. Client can pass an arbitrary brand object that gets embedded into Claude's system prompt — prompt injection vector.

### Notes
Fix: if Supabase lookup misses, return an error or use a server-side default. Never trust client-supplied brand in the prompt.

## b_9eda · Replace MVEDA-specific fallback drafts with tenant-aware generation

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from MVEDA-specific fallback drafts shown to all tenants)
- **depends-on**: []
- **touches**: api/proactive-drafts.js

### Why
Open · added 2026-05-14. Priority: Needs attention. `api/proactive-drafts.js:22-65` `FALLBACK_DRAFTS` is hardcoded Ayurveda content. Non-MVEDA tenants who hit the fallback path (when Claude API errors or key missing) see Ayurveda drafts as if they were generated for their brand.

### Notes
Fix: generate fallback drafts from the tenant's brand profile at request time, or return an explicit error instead of templated content.

## b_c91d · Replace simulateImageGen with real generation or label as demo-only

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from simulateImageGen writes broken image refs to posts.media_urls)
- **depends-on**: []
- **touches**: app/features.jsx, app/chat-app.jsx, api/generate.js

### Why
Open · added 2026-05-14. Priority: Needs attention. `app/features.jsx:860-863` `simulateImageGen` returns a hardcoded `"product-shot-gen.jpg"` filename after a 2.2s timeout regardless of the connected image-gen provider. `savePost` then writes this into `posts.media_urls`. The real generation pipeline lives in `chat-app.jsx:874`; the simulate path produces dead refs.

### Notes
Fix: delete `simulateImageGen` and route the Studio flow through the same `/api/generate` path as chat-to-create, or document and label it as a demo-only placeholder.

## b_0f34 · Reduce Klaviyo response logging to structured minimum

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Klaviyo console.log dumps response payloads)
- **depends-on**: []
- **touches**: api/klaviyo.js

### Why
Open · added 2026-05-14. Priority: Needs attention. `api/klaviyo.js:260` logs the full Klaviyo API response (including campaign objects with potential audience data) to Vercel logs. Long-term retention varies; sensitive PII may leak.

### Notes
Fix: structured log of `{ campaignId, status }` only.

## b_6c61 · Verify Composio connection_status / list_connections after JWT auth lands

- **status**: done
- **created**: 2026-05-22
- **last-touched**: 2026-05-23
- **effort**: unsized
- **source**: bootstrap (from Composio connection_status / list_connections leak)
- **depends-on**: []
- **touches**: api/composio.js

### Why
Open · added 2026-05-14. Priority: Needs attention. `api/composio.js:179-217` `connection_status` and `list_connections` accept `tenantId` from the body. Without JWT auth, any caller can enumerate which connectors any tenant has linked. Subsumed by the JWT work but worth verifying explicitly when that lands.

### Notes
Verified clean on `chore/jwt-followups` 2026-05-23. The main handler at `api/composio.js:444` calls `requireAuth(req)` and at `:452` rewrites the body with the server-trusted `tenantId` (`body = { ...body, tenantId: auth.tenantId }`) before dispatch. Both audited handlers destructure `tenantId` from that overridden body:
- `handleConnectionStatus` (`:318-341`) — uses `tenantId` only at `:325` in `?user_ids=${encodeURIComponent(tenantId)}&statuses=ACTIVE` against Composio's `/connected_accounts`. Composio's v3 API filters by `user_id` (the external user identifier — see file header line 7), so the response is scoped to the verified tenant.
- `handleListConnections` (`:347-362`) — same pattern at `:351`, `?user_ids=${encodeURIComponent(tenantId)}&statuses=ACTIVE&limit=100`.

A client supplying `tenantId: "victim"` in the body has it overwritten at `:452` before any handler reads it. No path returns rows for another tenant.

Adjacent finding (out of audit scope, not fixed here): `handleDisconnect` (`:368-373`) accepts `accountId` from the body and calls `DELETE /connected_accounts/${accountId}` with the global server `COMPOSIO_API_KEY2` — there is no check that `accountId` belongs to `auth.tenantId`. An authed tenant who learns another tenant's accountId (e.g. via leak or guess) could disconnect them. Worth a new backlog row.

## b_d25a · Verify /api/brand-import tenant scoping after JWT auth lands

- **status**: done
- **created**: 2026-05-22
- **last-touched**: 2026-05-23
- **effort**: unsized
- **source**: bootstrap (from /api/brand-import overwrites any tenant's brand profile)
- **depends-on**: []
- **touches**: api/brand-import.js

### Why
Open · added 2026-05-14. Priority: Needs attention. `api/brand-import.js:148` takes `tenantId` from body and upserts the brand row. Same root as the JWT gap — but specifically, an attacker can rewrite another tenant's brand voice / palette / messaging by posting their own URL with the victim's tenantId. Verify after JWT work lands.

### Notes
Verified clean on `chore/jwt-followups` 2026-05-23. The handler:
- Calls `requireAuth(req)` at `:168` and pins `const tenantId = auth.tenantId` at `:170`.
- Parses the body at `:173-176` extracting only `url`. Any `tenantId` / `userId` / `user_id` keys a caller adds to the body are never read.
- Calls `upsertBrand(tenantId, brand)` at `:347` with the verified value (not from body).
- `upsertBrand` is local to this file (`:121-154`) — `user_id: tenantId` at `:135` comes from the function parameter. Writes use `SUPABASE_SERVICE_KEY` (RLS-bypassing) directly to `/rest/v1/brands`, which is the right pattern since the row identity is server-derived.

A request body of `{ url: "x", userId: "victim", tenantId: "victim", user_id: "victim" }` would still upsert into the authenticated caller's own brand row. No body-supplied identity reaches the SQL.

CLAUDE.md mentions `api/lib/supabase.js upsertBrand` but that helper does not exist there — only `fetchBrandProfile`. The upsert lives inline in brand-import.js. Doc nit, not a code gap.

## b_6c24 · Centralise Claude model selection via env var + shared helper

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Hardcoded Claude model strings)
- **depends-on**: []
- **touches**: api/lib/anthropic.js, api/proactive-emails.js, api/proactive-drafts.js, api/chat.js

### Why
Open · added 2026-05-14. Priority: Low. `api/proactive-emails.js:260` and `api/proactive-drafts.js` hardcode `claude-opus-4-5`. `api/chat.js` uses a different (newer) default. Drift across endpoints will cause silent quality differences.

### Notes
Fix: env var `ANTHROPIC_MODEL` consumed by a shared `api/lib/anthropic.js` helper.

## b_47d0 · Add InsightsCenter to CLAUDE.md hook-alias table and rename bare hooks

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from InsightsCenter hook-alias drift (bare React hooks))
- **depends-on**: []
- **touches**: app/insights.jsx, CLAUDE.md

### Why
Open · added 2026-05-14. Priority: Low. `app/insights.jsx:9` destructures bare `useState/useEffect/useRef/useCallback` from `React` inside its IIFE. CLAUDE.md "Hook aliases" table has no row for `insights.jsx` — the file silently violates the per-file alias contract. Works today because of script load order, but breaks the moment another file's bare hooks collide.

### Notes
Fix: add row `insights.jsx → useStateI / useEffectI / useRefI / useCallbackI` to the table and the file. Companion to the now-shipped InsightsCenter fix (PR `feat/fix-insights-center`).

## b_8ff1 · Require explicit APP_ORIGIN or derive from VERCEL_URL with https

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from APP_ORIGIN falls back to localhost)
- **depends-on**: []
- **touches**: api/google-ads-auth.js

### Why
Open · added 2026-05-14. Priority: Low. `api/google-ads-auth.js:21-23` falls back to `http://localhost:3000` when `VERCEL_URL` is unset. OAuth redirects break on preview deploys where the env var isn't injected the same way.

### Notes
Fix: derive from `VERCEL_URL` with `https://` prefix, or require an explicit `APP_ORIGIN` env var at boot.

## b_0394 · Replace Math.random() UUIDs with crypto.randomUUID()

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Math.random() UUIDs in providerRouter)
- **depends-on**: []
- **touches**: api/lib/providerRouter.js

### Why
Open · added 2026-05-14. Priority: Low. `api/lib/providerRouter.js:271` uses `Math.random()` for server-side IDs. Acceptable today (no collision-sensitive use), but `crypto.randomUUID()` is one line and available on the Edge runtime.

## b_2557 · Align app.html and index.html script lists (or remove app.html)

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from app.html vs index.html drift)
- **depends-on**: []
- **touches**: app.html, index.html, server.py, app/ui2.jsx

### Why
Open · added 2026-05-14. Priority: Low. `app.html` includes `app/ui2.jsx`; `index.html` does not. `server.py:29` serves `app.html` locally while Vercel serves `index.html` in production. Components defined in `ui2.jsx` (Drawer, Input, Textarea, etc.) are available in dev but not prod.

### Notes
Fix: align both to the same script list, or delete `app.html` and have `server.py` serve `index.html`.

## b_801d · Move set_updated_at() helper to 000_helpers.sql

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from set_updated_at() helper trigger location)
- **depends-on**: []
- **touches**: db/migrations/000_helpers.sql, db/migrations/002_agent_overrides.sql

### Why
Open · added 2026-05-14. Priority: Low. `db/migrations/002_agent_overrides.sql:25-36` defines `set_updated_at()`. If another migration needs the same helper, the second `CREATE FUNCTION` will collide. Move to `000_helpers.sql` so it lives once.

## b_b88d · Switch Google Ads OAuth prompt to select_account after initial consent

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from google-ads-auth: prompt=consent is over-aggressive)
- **depends-on**: []
- **touches**: api/google-ads-auth.js

### Why
Open · added 2026-05-14. Priority: Low. `api/google-ads-auth.js:38` always passes `prompt: "consent"` to Google's OAuth endpoint, forcing a re-consent every time the user reconnects. Switch to `prompt: "select_account"` once initial consent is granted.

## b_d824 · Deploy-time guard for Vercel cron schedule (Pro vs Hobby)

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Vercel cron schedule requires Pro plan)
- **depends-on**: []
- **touches**: vercel.json

### Why
Open · added 2026-05-14. Priority: Low — documented constraint, but no runtime guard. `vercel.json` `* * * * *` on `fire-scheduled` is rejected at deploy on the Hobby plan. The 2026-05-14 BACKLOG entry on Scheduled Posting already notes this. Add a deploy-time check or a no-op fallback so the rest of the app still ships if Hobby is the target.

## b_c664 · Extract shared platformPublisher helper for the five publish_now endpoints

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Five platform publishers share publish_now pattern with no shared helper)
- **depends-on**: []
- **touches**: api/lib/platformPublisher.js, api/linkedin.js, api/facebook.js, api/x.js, api/instagram.js, api/reddit.js

### Why
Open · added 2026-05-14. Priority: Low — refactor. `api/linkedin.js`, `api/facebook.js`, `api/x.js`, `api/instagram.js`, `api/reddit.js` each implement near-identical `publish_now` skeleton: validate input, fetch token, call Composio, handle image branch, return shaped response.

### Notes
Extract into `api/lib/platformPublisher.js` once the auth-and-rls work settles (touching every platform file at once is risky).

## b_2504 · Enforce sourceBriefId on CAL_ADD path

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from sourceBriefId not enforced on CAL_ADD path)
- **depends-on**: []
- **touches**: app/store.jsx

### Why
Open · noted 2026-05-19. Priority: Low — no risk until brief→queue conversion exists. The `sourceBriefId` field is in the calendar item schema (see [WORKLOG.md](WORKLOG.md) 2026-05-19), but only the `QUEUE_ADD_DRAFT` reducer guarantees it gets written — that reducer constructs items field-by-field. The other path into `state.calendar` is `CAL_ADD`, which just spreads pre-built items from the caller (`[...s.calendar, ...a.items]`) — `sourceBriefId` only lands on the row if the caller remembered to put it there.

Today the only `CAL_ADD` caller is `NewCampaignDialog` (no brief involved → correctly leaves the field unset). The risk surfaces when the brief→queue conversion is built: if that future code uses `actions.addCampaign(items, name)` and forgets to stamp `sourceBriefId: state.activePlan.id` onto every item before dispatching, rows will silently lose their back-reference and no error fires.

### Notes
Fix when it bites: either (a) extend `CAL_ADD` to accept a top-level `sourceBriefId` arg and stamp it onto every item in the reducer, or (b) add a dedicated `CAL_ADD_FROM_BRIEF` action that requires the id. (a) is cheaper; (b) is more explicit.

## b_38f0 · Edit-after-schedule warning + Unschedule button in drawer

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: triage 2026-05-22
- **depends-on**: []
- **touches**: app/workspaces3.jsx, api/scheduled-posts.js

### Why
`scheduled_posts.payload` is a snapshot at Schedule time — editing the calendar row body/image after scheduling does NOT change what fires. Users will be surprised when their edited copy doesn't show up live. Need (a) an "Unschedule" button in the drawer and (b) a "this was edited after scheduling — re-Schedule?" warning when `body !== payload.text`. Spun out of the `Scheduled posting` ship notes (see b_8698).

## b_60f8 · Composio code 306 (no managed auth) — Connect modal hangs forever

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: triage 2026-05-22
- **depends-on**: []
- **touches**: api/composio.js, app/workspaces4.jsx

### Why
Shopify, TikTok (tt + ttads), Twitter/X (x + xads) require a custom OAuth app registered in the Composio dashboard — Composio has no default managed credentials and returns error code 306. `/api/composio` translates this to a 409 with a clear message, but the frontend Connect modal still flips amber and polls indefinitely; no error path surfaces the 409 to the user. Needs the modal to catch the 409, stop polling, and show the actionable "configure auth_config in dashboard or switch to direct provider" copy that the API already returns.

## b_ea4e · Text-only Instagram post fails at publish (imageUrl required)

- **status**: done
- **created**: 2026-05-22
- **last-touched**: 2026-05-24
- **effort**: unsized
- **source**: triage 2026-05-22
- **depends-on**: []
- **touches**: app/workspaces3.jsx

### Why
Instagram Graph API only supports media-bearing posts — `INSTAGRAM_POST_IG_USER_MEDIA` requires a media URL. `/api/instagram` already documents this (imageUrl required), but the chat-to-create + drafts paths don't enforce it: a text-only IG draft surfaces a Schedule button, queues fine, and fails at fire time with a non-obvious Composio error.

### Notes
Shipped 2026-05-24. Three changes to `app/workspaces3.jsx`:
1. `hasImage` + `needsImageGuard` computed at drawer render scope from live `editItem` (not duplicated in each handler).
2. Schedule button and Publish now button both get `|| needsImageGuard` in their `disabled` conditions — visually blocked, not just warned.
3. Pink callout banner appears when `needsImageGuard` is true: "Instagram requires an image. Add a prompt below and generate one." If `imagePrompt` is filled, shows a "Generate image" button that calls `/api/generate` (Runware), sets `imageStatus: "pending"`, and patches `editItem` local state + store on completion — so the buttons auto-unblock without closing the drawer.

## b_b259 · Chat AI confidently drafts for platforms with no publish path

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: triage 2026-05-22
- **depends-on**: []
- **touches**: api/chat.js, app/ai.jsx, app/chat-ui.jsx

### Why
The drafter specialist will happily produce a `draft_created` artifact for TikTok, YouTube, Pinterest, etc. The artifact card shows the platform badge and a "Send to queue" CTA. The user sees confident, on-brand copy and assumes it's shippable — but there's no `/api/tiktok` publisher and no plan for one in the short term. The drafter prompt needs a hard list of publishable platforms; for anything else, it should produce the copy but tag the artifact `nonPublishable: true` so the card hides Schedule and surfaces "copy for manual upload" instead. Distinct from the queue-side hard-block (disabled-platform swallow) — this one is about chat-side overconfidence.

## b_c945 · InsightsCenter empty state can't distinguish no-data from broken fetch

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: triage 2026-05-22
- **depends-on**: []
- **touches**: app/insights.jsx

### Why
When `analytics_snapshots` and `analytics_insights` return zero rows, InsightsCenter renders the same empty-state UI as when the fetch itself fails (RLS denial, network error, missing auth header, etc.). A new tenant who hasn't run analytics-ingest yet sees the same screen as one whose Supabase token is broken — neither knows which case they're in. Needs three distinct states: (1) fetch ok + zero rows → "Run your first analytics sync", (2) fetch failed → error toast + retry, (3) loading. Also related to b_47d0 (hook-alias drift in this same file).

## b_a001 · Adopt Zernio for all organic social publishing (replaces Composio social toolkit + Pipedream Pinterest)

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: integration architecture decision 2026-05-22
- **depends-on**: [b_0c94]
- **touches**: api/zernio.js (new), api/linkedin.js, api/facebook.js, api/x.js, api/instagram.js, api/reddit.js, api/cron/fire-scheduled.js, app/seed.jsx, app/workspaces4.jsx, app/workspaces3.jsx, app/channel-strategy.jsx, api/brand-import.js, agents.jsx, db/migrations/

### Why
Zernio collapses all organic social publishing — LinkedIn, Facebook, Instagram, X, TikTok, Reddit, Pinterest, Threads, Bluesky, YouTube, Snapchat, Google Business, Telegram, WhatsApp, Discord — behind one REST API with one OAuth flow per tenant account. Zernio owns the developer apps and platform approvals, which eliminates the entire class of failures FlowOS hits today: Composio error 306 (no managed credentials for X / TikTok / Shopify — b_60f8), TikTok content-posting gating (b_8cad row), Reddit's lack of native image post support (b_43d9, REDDIT_CREATE_REDDIT_POST kind:link fallback), Instagram's two-step creation+publish dance with required imageUrl (b_ea4e), and the seven platforms currently surfaced in the picker with no backend (b_b259, b_2fac). Replaces Composio social toolkit usage (LinkedIn / Facebook / Instagram / X / Reddit) and the Pipedream Pinterest connector. Pricing scales predictably: free for the first two tenant social accounts, $6/account for 3–10, $3 for 11–100, $1 for 101–2,000 — bakes cleanly into per-tenant unit economics.

### Notes
**Scope of replacement**

| FlowOS today | Moves to Zernio |
|---|---|
| `/api/linkedin` (Composio LINKEDIN) | `/api/zernio` `publish` with platform=linkedin |
| `/api/facebook` (Composio FACEBOOK) | `/api/zernio` platform=facebook |
| `/api/x` (Composio TWITTER, error 306) | `/api/zernio` platform=x |
| `/api/instagram` (Composio INSTAGRAM via FB Pages) | `/api/zernio` platform=instagram |
| `/api/reddit` (Composio REDDIT, kind:link fallback) | `/api/zernio` platform=reddit |
| Pinterest (Pipedream) | `/api/zernio` platform=pinterest |
| TikTok, YouTube, Threads, Bluesky, Snapchat, Google Business, Telegram, WhatsApp, Discord — all currently no-publisher | `/api/zernio` |

**Implementation shape**
- New `/api/zernio.js` edge function with `initiate_connection`, `connection_status`, `list_accounts`, `publish_now`, `schedule`, `cancel_scheduled`, `read_analytics`, `list_dms`, `reply_dm`, `list_comments`, `reply_comment`.
- `seed.jsx connectorCatalog`: flip the 13 social provider entries to `provider: "zernio"`. Add new entries for TikTok, Threads, Bluesky, Google Business, Telegram, WhatsApp, Discord. Drop the `pn` / Pinterest Pipedream provider.
- `workspaces4.jsx`: extend the provider-agnostic Connect modal fork — one new branch for `provider === "zernio"` mirroring the Composio OAuth shape (popup → polling → channels row write).
- `cron/fire-scheduled.js`: route platform POSTs through `/api/zernio` when the row's platform is in the Zernio set.
- `channel-strategy.jsx connectedSet` + `agents.jsx CONNECTOR_LABELS` + `brand-import.js CONNECTOR_IDS` + `store.jsx channelRules`: add the new platforms.
- Schema: per-platform `imageUrl`/`videoUrl`/`postId`/`postUrl` columns on calendar items already exist for the five shipped platforms; extend `state.calendar` shape (lines 88–106 in this file's project CLAUDE.md) for the new platforms.

**Open questions before starting**
- Zernio's MCP server — wire it into Supervisor/Drafter as a single tool surface vs. one tool per action? MCP-native is simpler but loses the structured-output widgets the current `create_draft` artifact gives. Probably start with a thin `/api/zernio` REST shim like the existing Composio platform handlers, defer MCP integration to a follow-up.
- Token migration: when a tenant already has a Composio LinkedIn / FB / IG / X / Reddit connection, do we force re-auth through Zernio or run both in parallel until cutover? Default: force re-auth, sunset Composio social connections on the same release.
- Analytics: the cron daily-analytics path currently pulls per-platform via Composio. Zernio includes analytics read-back — move analytics ingestion to Zernio in the same change, or split into a second backlog item?

## b_a002 · Route paid social ads through Zernio (Meta / LinkedIn / TikTok / Pinterest / X Ads)

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: integration architecture decision 2026-05-22
- **depends-on**: [b_a001]
- **touches**: api/zernio.js, app/seed.jsx, app/features.jsx (paid-social surface — does not exist yet)

### Why
Zernio covers Meta Ads, LinkedIn Ads, TikTok Ads, Pinterest Ads, and X Ads under the same per-account billing as organic. Routing paid social through the same integration as organic keeps the auth model coherent (one OAuth per account covers both surfaces) and avoids spinning up five separate Ads platform handlers. Replaces the existing `liads`, `metaads`, `ttads`, `pinads`, `xads` slots in seed.jsx (most currently unwired) plus the LinkedIn sponsored content backlog item (b_7117).

### Notes
- **Out of scope**: Google Ads. Google Ads stays on Composio (b_a003) because GOOGLEADS toolkit is already wired and working — no reason to migrate it. This item is the *five non-Google* paid social ad surfaces.
- Likely needs a new `PaidSocialStudio` workspace or extension of `features.jsx OrganicSocialStudio` to handle ad creative + budget + targeting. Today there's no ads UI for these platforms — boost flows live only in the Composio Google Ads path.
- Same `provider: "zernio"` flag in seed.jsx as b_a001, but with `category: "Paid Social"`.
- Sequenced behind b_a001 so the Zernio integration scaffolding (token mint, OAuth fork, account list) is already in place.

## b_a003 · Scope Composio strictly to non-social: Google Ads, GA4, GSC, HubSpot, Salesforce, Mailchimp, YouTube analytics, ElevenLabs, HeyGen, brand-import

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: integration architecture decision 2026-05-22
- **depends-on**: [b_a001, b_a002]
- **touches**: api/composio.js, api/chat.js, app/seed.jsx, agents.jsx, channel-strategy.jsx, api/brand-import.js

### Why
Composio earns its place on CRM + analytics + creative-AI: deep connector catalog, MCP-native, managed OAuth for hard-to-DIY platforms (HubSpot, Salesforce). It loses its place on social where Zernio is strictly better (b_a001, b_a002). Locking Composio's scope down explicitly — in code, in the brand-import recommendation surface, and in the agent CONNECTOR_LABELS — prevents the AI pipeline from drifting back toward Composio for social posting after the Zernio migration ships. Also gives us a clear answer to b_60f8 (Composio code 306): we will no longer hit it because the affected toolkits (X, TikTok, Shopify-ads) are all moving off Composio.

### Notes
**Composio in-scope after this lands**
- Google Ads (GOOGLEADS — already shipped via `/api/google-ads`)
- Google Analytics 4 (GA4)
- Google Search Console (GSC)
- HubSpot — CRM, contact sync, deal tracking
- Salesforce — enterprise tenants
- Mailchimp — alternative-to-Klaviyo tenants
- YouTube analytics read-back (organic posting moves to Zernio under b_a001 — Composio retains analytics only)
- ElevenLabs — voice-over generation
- HeyGen — UGC / avatar video
- Brand import via Jina AI scrape + Claude enrichment (`/api/brand-import` already uses Composio)

**Composio out-of-scope**
- LinkedIn, Facebook, Instagram, X, Reddit organic — to Zernio (b_a001)
- LinkedIn Ads, Meta Ads, TikTok Ads, Pinterest Ads, X Ads — to Zernio (b_a002)
- Klaviyo + Klaviyo SMS — already in scope and works; keeping on Composio for now (Composio's Klaviyo `create_draft_campaign` and `create_draft_sms` are wired and shipped). Re-evaluate if Klaviyo's native API would simplify, but not part of this item.

**Code changes**
- `api/composio.js APP_MAP`: drop linkedin, facebook, x, instagram, reddit, tiktok, ttads, xads slugs. Keep googleads, ga4, gsc, hubspot, salesforce, mailchimp, youtube (analytics-only), elevenlabs, heygen.
- `scripts/verify-composio.mjs`: same trim.
- `api/chat.js`: if Supervisor/Drafter tool definitions reference Composio social toolkits explicitly, remove. Most calls are abstract enough not to.
- `api/brand-import.js CONNECTOR_IDS`: leave social ids in (Claude can still recommend them — they just resolve to Zernio).

## b_a004 · Remove SendGrid; transactional email via Postmark/Resend, marketing via Klaviyo

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: integration architecture decision 2026-05-22
- **depends-on**: []
- **touches**: app/seed.jsx, api/pipedream.js (APP_MAP), scripts/verify-pipedream.mjs, agents.jsx, channel-strategy.jsx, api/brand-import.js, (new) api/lib/transactional.js

### Why
SendGrid currently sits as a Pipedream-keys connector for transactional system email (password reset, onboarding confirmations) but is not wired anywhere FlowOS actually sends mail. Marketing + campaign email already routes through Klaviyo via `/api/klaviyo create_draft_campaign` — that path is shipped and adequate. SendGrid's role was always the FlowOS-to-tenant-user transactional path, which is a tiny use case that doesn't justify Pipedream-mediated auth or per-tenant SendGrid accounts. Postmark or Resend with one FlowOS-platform SMTP account is dramatically simpler, has better deliverability for transactional, and costs cents per month at our scale. This is also what Supabase Auth uses by default for password-reset flows — likely we can lean on Supabase's built-in email and only need a Postmark/Resend layer if/when we send anything beyond auth (welcome emails, billing notices). Defer building the abstraction until we have something to send.

### Notes
**Decision**: SendGrid leaves the connector catalog entirely. We add **no replacement to the catalog** — Postmark/Resend is platform-internal infrastructure (FlowOS sends to its own users), not a tenant-facing connector.

**Today**: Supabase Auth's built-in transactional mailer handles password reset and email confirmation. That's all the transactional email FlowOS sends today, so no Postmark/Resend integration is needed yet.

**When to add Postmark/Resend**: first time we need to send a non-auth platform email (welcome series, plan-change notice, generation-quota alert, etc.). At that point add `api/lib/transactional.js` with one method `sendTransactional({ to, subject, html })` backed by whichever provider has the better free tier when the moment arrives. Single env var: `TRANSACTIONAL_PROVIDER_KEY`.

**Code changes for this item**
- `seed.jsx connectorCatalog`: remove the `sendgrid` row.
- `agents.jsx CONNECTOR_LABELS`: remove `sendgrid`.
- `channel-strategy.jsx connectedSet`: remove if present.
- `api/pipedream.js APP_MAP`: remove `sendgrid` slug.
- `scripts/verify-pipedream.mjs`: regenerate APP_MAP.
- `api/brand-import.js CONNECTOR_IDS`: remove `sendgrid` so Claude stops recommending it.
- Erickson's `brandConnectorStates`: remove the `sendgrid` default.

## b_a005 · Defer Twilio integration until validated tenant request (scope decision)

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: integration architecture decision 2026-05-22
- **depends-on**: []
- **touches**: app/seed.jsx, api/pipedream.js, scripts/verify-pipedream.mjs, agents.jsx, channel-strategy.jsx, api/brand-import.js

### Why
Twilio currently sits in the Pipedream-keys catalog but is not wired to any FlowOS feature. Klaviyo SMS (via Composio, shipped) covers the marketing/campaign SMS use case — scheduled sends, audience targeting, STOP compliance — which is the SMS use case FlowOS actually has today. Twilio's value-add is two-way conversational SMS, transactional triggered messages, dedicated phone numbers, and subaccount-per-tenant isolation — all real capabilities, but ones we should build against a validated tenant request, not speculatively. Removing Twilio from the catalog now keeps the connector surface honest (no integration is listed as "available" when it doesn't work end-to-end) and re-adds it cleanly when the first tenant actually asks.

### Notes
**Decision**: drop Twilio from the catalog. If a tenant later asks for two-way SMS, dedicated number, or transactional SMS triggers, re-evaluate then. Twilio's per-tenant subaccount model is well-documented and the integration is cheap to add when there's a buyer.

**Code changes**
- `seed.jsx connectorCatalog`: remove the `twilio` row.
- `api/pipedream.js APP_MAP`: drop `twilio`.
- `scripts/verify-pipedream.mjs`: regenerate.
- `agents.jsx CONNECTOR_LABELS`: remove.
- `channel-strategy.jsx connectedSet`: remove if present.
- `api/brand-import.js CONNECTOR_IDS`: remove so Claude stops recommending.
- Brand connector defaults in `seed.jsx brandConnectorStates`: remove.

**Pairs with**: b_a004 (SendGrid removal — same shape of "in-catalog-but-unwired" cleanup).

## b_a006 · generation_usage Supabase table to track Runware / HeyGen / Higgsfield cost per tenant

- **status**: backlog
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: integration architecture decision 2026-05-22
- **depends-on**: []
- **touches**: db/migrations/, api/generate.js, api/lib/providerRouter.js

### Why
Runware, HeyGen, and Higgsfield are all platform-managed — FlowOS holds one API key per provider and absorbs cost into platform pricing. That's the right product call (tenants should never hit a rate limit mid-campaign because they forgot to top up a third-party account), but it means FlowOS bears the variable cost without per-tenant visibility today. Adding a `generation_usage` table now — *before* introducing usage-based pricing tiers, generation limits per plan, or high-cost-tenant alerts — is cheap and gives the data needed to make those decisions later without a schema migration under pressure. Strictly a data-collection item; no UI, no pricing logic, no enforcement. Just write a row per generation job.

### Notes
**Schema** (`db/migrations/008_generation_usage.sql` or next available number)

```sql
create table if not exists generation_usage (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  provider    text not null,        -- "runware" | "heygen" | "higgsfield" | "elevenlabs"
  model       text not null,        -- e.g. "runware:flux-schnell", "higgsfield:kling3_0", "heygen:avatar-v3"
  job_kind    text not null,        -- "image" | "video" | "audio"
  cost_estimate numeric(10, 4),     -- USD; null when provider doesn't return cost
  duration_ms integer,              -- wall-clock from request to terminal state
  status      text not null,        -- "completed" | "failed" | "failed_content_policy"
  job_id      text,                 -- provider's job id, for cross-referencing
  created_at  timestamptz not null default now()
);

create index generation_usage_tenant_created_idx on generation_usage (tenant_id, created_at desc);
create index generation_usage_provider_created_idx on generation_usage (provider, created_at desc);

alter table generation_usage enable row level security;
-- service-role only; no anon access
```

**Write site**: `api/generate.js` `handleGenerateImage` / `handleGenerateVideo` already centralize the terminal-state write today. Add a `generation_usage` insert in the same code path when status transitions to `completed` / `failed_content_policy` / `failed`. Provider adapters in `api/lib/providerRouter.js` are the right place to surface `cost_estimate` (provider response usually has it for video; image is per-model published-price-table lookup).

**Out of scope for this item**: pricing tiers, generation caps per tenant plan, alerting on high spenders, BI dashboards. All future. This is the schema + write path only.

## b_dca6 · Campaign brief persistence + cross-feature wiring

- **status**: proposed-done
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Campaign brief persistence + cross-feature wiring)
- **depends-on**: []
- **touches**: api/chat.js, app/store.jsx

### Why
Open · noted 2026-05-19. Priority: Low — speculative until one of these use cases lands. Today the `campaign_planner` specialist writes the brief into `state.activePlan` (client-only). Brief lives in chat thread text + ephemeral store; refresh wipes the canvas rendering, though the markdown is recoverable from chat history. Persisting it gets justified by either of:

- **Analyst cross-campaign comparison.** Let the Analyst specialist reference past campaign briefs when interpreting metrics — "how did our last launch perform vs this one." Needs briefs in a queryable store the chat backend can read at delegation time.
- **Campaign history tab on CampaignPlanner.** A second view in the planner workspace listing every brief ever generated for the tenant, with click-to-restore into `state.activePlan`. Today's "Dismiss" is one-way.

### Notes
**Likely shape if/when built:** `campaign_plans` Supabase table (`id`, `tenant_id`, `title`, `summary`, `goal`, `audience`, `timeline`, `budget`, `channels jsonb`, `brief_md`, `created_at`); persist in `/api/chat.js` when `create_campaign_plan` fires; GET endpoint for history hydration; foreign key from `calendar` items or `scheduled_posts` rows back to `campaign_plans.id`.

### Update 2026-05-22
mentioned in WORKLOG.md

## b_2fac · Disabled-platform drafts silently swallowed by queue

- **status**: proposed-done
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: triage 2026-05-22
- **depends-on**: []
- **touches**: app/workspaces3.jsx, app/chat-ui.jsx, api/scheduled-posts.js

### Why
TikTok, YouTube, Pinterest, Threads, Snapchat, Bluesky, Mastodon, Telegram all surface in the UI as schedulable platforms but have no `/api/<platform>` publisher wired. A user can draft, queue, and "Schedule" — but the cron fire-scheduled handler has no route to POST to and the row sits in `pending` forever (or fails opaquely). The Composio audit (b_8cad) covers the wiring plan; this item is specifically about UX: the queue must refuse Schedule actions on platforms without publishers, or surface a "Composio doesn't support this yet — keep as draft / export manually" path before letting the user think the work is done.

### Update 2026-05-22
mentioned in WORKLOG.md

## b_3686 · Cron must mint per-tenant JWT for /api/<platform> publish calls

- **status**: proposed-done
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: triage 2026-05-22
- **depends-on**: []
- **touches**: api/cron/fire-scheduled.js, api/lib/auth.js

### Why
After server-side JWT verification ships (b_0c94), `requireAuthOrCron` will accept the cron path only when the request carries `CRON_SECRET`. But the five platform publishers (linkedin/facebook/x/instagram/reddit) use `requireAuthOrCron(req, bodyTenantId)` — currently the cron fire handler POSTs with the row's payload but no auth header. It works today because cron fail-open exists (b_e15e). The moment fail-open is closed, every scheduled post breaks. Cron must either (a) attach `Authorization: Bearer ${CRON_SECRET}` to the platform POST, or (b) mint a short-lived per-tenant JWT via `/api/dev/mint-token`-equivalent. (a) is simpler if `requireAuthOrCron` already accepts cron secret on the platform routes.

### Update 2026-05-22
mentioned in WORKLOG.md

## b_8698 · Scheduled posting via Vercel Cron + Supabase queue

- **status**: done
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from Scheduled posting — DONE (2026-05-14))
- **depends-on**: []
- **touches**: db/migrations/005_scheduled_posts.sql, api/scheduled-posts.js, api/cron/fire-scheduled.js, app/workspaces3.jsx, vercel.json

### Why
Shipped — platform-agnostic queue, fires for linkedin/facebook/x/instagram/reddit. Approach taken: Option 1 — Vercel Cron + Supabase queue.

### Notes
What was built:
- `scheduled_posts` table (`db/migrations/005_scheduled_posts.sql`) with snapshot `payload` jsonb, status lifecycle `pending → publishing → published|failed|cancelled`, and a unique partial index that prevents double-queueing the same calendar item.
- `claim_due_scheduled_posts(limit_n)` plpgsql RPC — atomic claim with `FOR UPDATE SKIP LOCKED`. Same row cannot be picked twice across concurrent cron runs.
- `/api/scheduled-posts` — `create` / `list` / `cancel`.
- `/api/cron/fire-scheduled` at `* * * * *` — claims, POSTs `${origin}/api/<platform>` with `{ ...payload, action: "publish_now", tenantId }`, PATCHes the row terminal.
- `handleSchedule` in `app/workspaces3.jsx` now writes to `scheduled_posts` via `PLATFORM_PUBLISHERS[platform].buildPayload(...)`. Drawer takes absolute date + time (not day-of-week).
- `PublishingQueue` hydrates from the table on mount — pending → calendar status `scheduled`, published → `sent` with platform-specific postId/postUrl applied.

Known constraints:
- 1-min cron requires Vercel **Pro**. Hobby rejects sub-daily crons at deploy. Confirm tier before deploying — if Hobby, swap to an external trigger (GitHub Actions calling the endpoint with `Bearer ${CRON_SECRET}`).
- `payload` is a snapshot at Schedule time. Editing the calendar row body/image after scheduling does NOT change what fires — reschedule is `cancel` + new Schedule. No UI surface for this yet; users will be surprised. **Next**: add an "Unschedule" button in the drawer and a "this was edited after scheduling — re-Schedule?" warn when `body !== payload.text`.
- v1 is fail-loud — no retries. Failed rows surface as `publishStatus: "failed"` on the calendar row with `last_error`. Add backoff if it bites.

## b_e061 · InsightsCenter undefined globals + duplicate stub

- **status**: done
- **created**: 2026-05-22
- **last-touched**: 2026-05-22
- **effort**: unsized
- **source**: bootstrap (from InsightsCenter undefined globals + duplicate stub  `[done]`)
- **depends-on**: []
- **touches**: app/insights.jsx, app/workspaces3.jsx

### Why
Shipped — PR `feat/fix-insights-center` (commit `d21b963`). Priority: Critical (resolved 2026-05-14). `app/insights.jsx` was reading `window.__SUPABASE_URL__` / `__SUPABASE_ANON_KEY__` — neither is set anywhere, so cached analytics fetches silently failed. Swapped to the existing `window.sb` client. Also deleted the 532-line dead InsightsCenter stub in `workspaces3.jsx:1126-1657` (overridden at runtime by `insights.jsx` via load order).
