# Flow — Feature Backlog

Items here are scoped, parked for future development, and not yet prioritised into a sprint.

---

## Scheduled posting — DONE (2026-05-14)

**Status:** Shipped — platform-agnostic queue, fires for linkedin/facebook/x/instagram/reddit
**Approach taken:** Option 1 — Vercel Cron + Supabase queue

### What was built
- `scheduled_posts` table (`db/migrations/005_scheduled_posts.sql`) with snapshot `payload` jsonb, status lifecycle `pending → publishing → published|failed|cancelled`, and a unique partial index that prevents double-queueing the same calendar item.
- `claim_due_scheduled_posts(limit_n)` plpgsql RPC — atomic claim with `FOR UPDATE SKIP LOCKED`. Same row cannot be picked twice across concurrent cron runs.
- `/api/scheduled-posts` — `create` / `list` / `cancel`.
- `/api/cron/fire-scheduled` at `* * * * *` — claims, POSTs `${origin}/api/<platform>` with `{ ...payload, action: "publish_now", tenantId }`, PATCHes the row terminal.
- `handleSchedule` in `app/workspaces3.jsx` now writes to `scheduled_posts` via `PLATFORM_PUBLISHERS[platform].buildPayload(...)`. Drawer takes absolute date + time (not day-of-week).
- `PublishingQueue` hydrates from the table on mount — pending → calendar status `scheduled`, published → `sent` with platform-specific postId/postUrl applied.

### Known constraints
- 1-min cron requires Vercel **Pro**. Hobby rejects sub-daily crons at deploy. Confirm tier before deploying — if Hobby, swap to an external trigger (GitHub Actions calling the endpoint with `Bearer ${CRON_SECRET}`).
- `payload` is a snapshot at Schedule time. Editing the calendar row body/image after scheduling does NOT change what fires — reschedule is `cancel` + new Schedule. No UI surface for this yet; users will be surprised. **Next**: add an "Unschedule" button in the drawer and a "this was edited after scheduling — re-Schedule?" warn when `body !== payload.text`.
- v1 is fail-loud — no retries. Failed rows surface as `publishStatus: "failed"` on the calendar row with `last_error`. Add backoff if it bites.

---

## Other social platforms — Composio posting audit

**Status:** Partial · updated 2026-05-14
**Priority:** Medium — five platforms now publish (LinkedIn + FB/X/IG/Reddit); rest still unwired

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

---

## Reddit — image posts not supported by Composio

**Status:** Workaround in place · added 2026-05-14
**Priority:** Low — fallback preserves user intent

`REDDIT_CREATE_REDDIT_POST` only accepts `kind: "self"` (text) and `kind: "link"`. No `kind: "image"`, no media-upload-lease slug. When a Reddit draft has an imageUrl, `/api/reddit` falls back to `kind:"link"` with the hosted image URL as the submission target and returns `{ imageAsLink: true }`. The drawer surfaces a warn toast.

To upgrade to native image posts later, we'd need to bypass Composio and call `/api/media/asset.json` (image lease) → `POST /api/submit` with `kind: "image"` directly, holding our own Reddit OAuth token.

---

## Reddit — no subreddit discovery slug

**Status:** Workaround in place · added 2026-05-14
**Priority:** Low

Composio doesn't expose `/subreddits/mine/subscriber`, `/contributor`, or `/moderator`. Only `REDDIT_GET_SUBREDDITS_SEARCH` (keyword search) is available. The drawer renders subreddit as a free-text input rather than a dropdown. Optional follow-up: wire `/api/reddit` `search_subreddits` as a typeahead suggestion list below the input.

---

## Instagram — carousel + video posts

**Status:** Open · added 2026-05-14
**Priority:** Low — single-image posts ship first

Composio exposes `INSTAGRAM_CREATE_CAROUSEL_CONTAINER` and presumably video container slugs, but `/api/instagram` only wires the single-image `INSTAGRAM_POST_IG_USER_MEDIA` flow today. Multi-image carousels and Reels would each need their own branch.

---

## X — chunked media upload (video / large images)

**Status:** Open · added 2026-05-14
**Priority:** Low

`/api/x` uses the simple `TWITTER_UPLOAD_MEDIA` (single-shot, base64). For video or images >5MB, the v1.1 chunked flow (`TWITTER_INITIALIZE_MEDIA_UPLOAD` → `_APPEND_` → `_FINALIZE_` → `_GET_MEDIA_UPLOAD_STATUS`) is required. Composio exposes all four slugs.

---

## LinkedIn — Recently-Published view in Publishing Queue

**Status:** Open · added 2026-05-14
**Priority:** Low — log captures it, just no UI surface

After `publish_now` succeeds the row gets `status: "sent"` and disappears from both `scheduled` and `drafts` filters in `workspaces3.jsx`. Add a Drafts / Scheduled / Sent tab and render `linkedinUrl` as a click-through link.

---

## LinkedIn — sponsored content / Ads

**Status:** Deferred · added 2026-05-14
**Priority:** Low — wait for organic post velocity to justify

Out of scope for organic posting. LinkedIn Marketing Developer Platform is a separate toolkit (`liads` in seed). Needs its own `/api/linkedin-ads.js` and a `sponsored_post` artifact carrying targeting (geo, function, seniority, company size), budget, and creative.

---

## LinkedIn — true Articles (long-form)

**Status:** Open · added 2026-05-14
**Priority:** Low

Drafter produces `contentType: "Article"` for LinkedIn. The publish leg currently posts these as long-form text via `LINKEDIN_CREATE_LINKED_IN_POST` (works up to 110k chars) — not a "true" article (no separate URL, no cover image header, no in-feed article card). Composio doesn't appear to expose the LinkedIn Articles API. Options: keep as long-form text, or hit LinkedIn's `/articles` endpoint directly.

---

## Programmatic Creative (Variant Testing)

**Status:** Parked — revisit when chat-to-create + edit-in-Flow are shipped  
**Priority:** Medium  
**Inspired by:** InstaAgent (YC S26) — $1M ARR in 10 months on this concept alone

### What it is
Generate N variants of a single ad or post (targeting different hooks, headlines, visuals, or audience angles), publish them, collect performance data, extrapolate the winner, and auto-scale or kill the rest — without waiting for statistically significant sample sizes.

### Flow's version (lighter)
- **N = 5–10 variants** (not 50 — extrapolate from smaller sample, lower spend risk)
- User writes or approves a base brief → Flow generates variants automatically
- Variants differ on: headline, hook, visual style, CTA, tone angle
- Published as a Meta / TikTok ad set (via existing ads connectors)
- After 48–72h: Flow reads performance data back (CTR, CPC, ROAS via connector)
- Decision engine: auto-pause underperformers below threshold, flag winner for budget scaling
- User approves the scale decision or overrides in the Publishing Queue

### Why build it
- Paid social creative testing is manual and slow today — this automates the loop
- Flow already has the pieces: brand voice layer, Runware for image variants, Claude for copy variants, ads connectors for distribution and data read-back
- Defensible because it's tied to Flow's brand memory — variants stay on-voice, not generic

### Open questions
- Extrapolation model: simple threshold (winner has >2× CTR of median) or Bayesian?
- Minimum viable spend per variant to get signal (likely $10–25/variant)
- How many platforms at launch — Meta only first, or Meta + TikTok simultaneously?
- Where does the user set budget caps — per variant or total pool?

---

# Audit findings — 2026-05-14

Sourced from full codebase audit at HEAD `6d82a78`. Items grouped by severity. `[in progress]` markers indicate work already on a branch (see `feat/auth-and-rls`, `feat/fix-insights-center`). Items marked `[done]` have shipped since the audit.

---

## Server-side auth: JWT verification on every /api/* endpoint  `[in progress]`

**Status:** In progress on `feat/auth-and-rls` · added 2026-05-14
**Priority:** Critical — gates every other security control

Every `/api/*.js` reads `tenantId` from the request body or query and trusts it. `api/scheduled-posts.js:14` even explicitly documents "tenantId is trusted from the request body … RLS is intentionally not used." With the anon key shipped in `app/supabase.jsx`, any caller can impersonate any tenant and publish/read/write on their behalf.

**Plan**
- Add `api/lib/auth.js` exporting `requireAuth(req)` (verifies Supabase JWT against `SUPABASE_JWT_SECRET`, returns `{ tenantId, claims }`) and `requireCron(req)` (verifies `Authorization: Bearer ${CRON_SECRET}`, fail closed if env var unset).
- Apply `requireAuth` to: chat, generate, composio, brand-import, analytics-ingest, linkedin, facebook, x, instagram, reddit, klaviyo, proactive-drafts, proactive-emails, scheduled-posts, google-ads, google-ads-auth.
- Apply `requireCron` to all `/api/cron/*` handlers (currently `if (cronSecret)` → fails open when env unset).
- Frontend: every `fetch("/api/...")` in `app/*.jsx` must send `Authorization: Bearer ${session.access_token}` from the existing Supabase session.

---

## Row Level Security on every table  `[in progress]`

**Status:** In progress on `feat/auth-and-rls` · added 2026-05-14
**Priority:** Critical — companion to JWT auth

`app/supabase.jsx` ships the public anon key in client code; the comment claims "all data is protected by Row Level Security" but RLS is off everywhere. 001 and 002 migrations have RLS lines commented out. 003 / 004 / 005 ship with no RLS clauses at all. Tables: `generation_jobs`, `media_uploads`, `agent_overrides`, `analytics_snapshots`, `analytics_insights`, `proactive_emails`, `scheduled_posts`.

**Plan**
- `alter table … enable row level security` on every public-schema table.
- Per-table policy: `using (tenant_id = auth.uid()::text)` for select/insert/update/delete. Confirm text vs uuid cast per table.
- Service-role paths in `/api` continue to work because service-role bypasses RLS.

---

## Missing migrations: brands, channels, posts, google_ads_tokens, proactive_drafts  `[in progress]`

**Status:** In progress on `feat/auth-and-rls` (consolidated migration `006_core_schema.sql`) · added 2026-05-14
**Priority:** Critical — fresh Supabase project cannot reproduce schema

Code reads/writes these tables but no migration ships them:
- `brands` (`api/brand-import.js:148`, `api/chat.js` brand fetch)
- `channels` (`app/workspaces4.jsx:429,460,555,570`)
- `posts` (`app/features.jsx` savePost path)
- `google_ads_tokens` (`api/google-ads-auth.js:94`)
- `proactive_drafts` (`api/proactive-drafts.js:74`)

Pair with the RLS rollout — ship both at once.

---

## Google Ads OAuth — CSRF state binding

**Status:** Open · added 2026-05-14
**Priority:** Critical — auth gap independent of JWT work

`api/google-ads-auth.js:40` sets `state = tenantId` and `:129` verifies on callback by trusting that same value. An attacker who knows a victim's tenantId crafts a malicious callback URL with their own `code` and the victim's tenantId — Google Ads account gets bound to the victim's tenant.

**Fix:** sign state with HMAC-SHA256 over `{tenantId, nonce, exp}` using a new `OAUTH_STATE_SECRET`. 10-min TTL. Verify HMAC + exp on callback. The OAuth callback can't use the user's JWT (it's a Google redirect), so signed state is the only path.

---

## Fake API-key connector validation (workspaces4.jsx)

**Status:** Open · added 2026-05-14
**Priority:** Critical — false-positive "Connected" state misleads users

`app/workspaces4.jsx:534-545` flips non-OAuth connectors (Runware, Heygen, Klaviyo when entered as raw key) to `connected: true` after a 1.1s `setTimeout` with **no validation call**. Users believe the key works; the real failure shows up later when an image gen or send fails.

**Plan**
- Add `action: "validate"` to each non-OAuth connector endpoint (`/api/runware`, `/api/klaviyo`, `/api/heygen`, etc.) — server makes a cheap real call to the provider (Klaviyo `GET /api/accounts`, Runware `GET /v1/balance`, etc.), returns 200 on success or 401 on bad key.
- Frontend: replace the `setTimeout` with `await fetch(\`/api/${id}?action=validate\`)`; only flip `connected: true` on a real 200.

---

## Strip / preview-tag no-backend platform pickers

**Status:** Open · added 2026-05-14
**Priority:** Critical — UI advertises features that silently fail

`seed.jsx` and `features.jsx` surface Mastodon, Bluesky, Threads, YouTube, TikTok, Snapchat, Pinterest, Telegram as connectable channels. Only 5 platforms have backends (linkedin / facebook / x / instagram / reddit). Selecting any of the others silently fails to schedule (correctly rejected by `scheduled-posts.js:33-35`).

**Pick one:**
- **Strip** — remove from connector list entirely (cleanest).
- **Preview-tag** — keep visible with "Coming soon" badge and disabled Connect button (better for demos).

---

## CORS tightening + missing CORS on klaviyo / proactive-emails

**Status:** Open · added 2026-05-14
**Priority:** Critical — `Access-Control-Allow-Origin: "*"` combined with body-trusted tenantId enables cross-site account takeover

Wildcard CORS on: `api/x.js:17`, `api/reddit.js:19`, `api/generate.js:31`, `api/composio.js:25`, `api/scheduled-posts.js:20`, `api/google-ads.js:403`, `api/instagram.js:22`, `api/linkedin.js:21`, `api/facebook.js:16`.

**Missing CORS entirely:** `api/klaviyo.js`, `api/proactive-emails.js` — cross-origin preflight will fail outright.

**Fix:** shared helper in `api/lib/cors.js` — restrict origin to allowlist (`process.env.APP_ORIGIN` + `flow-os-v2.vercel.app` + preview deploy regex). Apply uniformly.

---

## Cron fail-open + cron-to-platform auth handoff

**Status:** Open · added 2026-05-14
**Priority:** Critical — companion to JWT auth work

Two bugs:
1. **Fail-open** — `api/cron/*` handlers use `if (cronSecret && req.headers.get("authorization") !== ...)`. If `CRON_SECRET` env var is unset, auth is bypassed entirely. Should fail closed.
2. **Cron-to-platform** — `api/cron/fire-scheduled.js:98` POSTs to `/api/<platform>` with no auth header. Once platform endpoints require JWT (from the auth-and-rls work), scheduled fires will break unless cron is allowlisted via a dual-auth pattern (`CRON_SECRET` accepted in lieu of JWT for service-to-service paths).

---

## /api/chat returns 200 + placeholder when ANTHROPIC_API_KEY missing

**Status:** Open · added 2026-05-14
**Priority:** Needs attention

`api/chat.js:432-439` returns HTTP 200 with `content: [{type:"text", text:"API key not configured."}]`. Frontend can't distinguish from a real reply, so the `inferResponse` fallback in `chat-app.jsx` never triggers.

**Fix:** return 503 + `{ ok: false, error: "missing_anthropic_key" }`; have `ai.jsx` treat non-2xx as a network error and run `inferResponse`.

---

## PATCH endpoints accept arbitrary patch keys

**Status:** Open · added 2026-05-14
**Priority:** Needs attention

`api/proactive-emails.js:311-318` accepts `{ id, patch }` from the client and applies the whole patch object to the row. Client can overwrite `klaviyo_campaign_id`, `source_insight_id`, `tenant_id`, etc. — no tenant scope, no key allowlist.

**Fix:** scope filter by `tenant_id` (from `requireAuth`) and allowlist patch keys (`{ status, klaviyo_campaign_id, klaviyo_template_id, sent_at }` only).

Same pattern audit on any other PATCH/UPDATE handlers added in future.

---

## Brand prompt injection via client-supplied `brand`

**Status:** Open · added 2026-05-14
**Priority:** Needs attention

`api/chat.js:445` and `api/proactive-drafts.js:27` accept `brand` from the request body as a fallback when the Supabase brand profile lookup misses. Client can pass an arbitrary brand object that gets embedded into Claude's system prompt — prompt injection vector.

**Fix:** if Supabase lookup misses, return an error or use a server-side default. Never trust client-supplied brand in the prompt.

---

## MVEDA-specific fallback drafts shown to all tenants

**Status:** Open · added 2026-05-14
**Priority:** Needs attention

`api/proactive-drafts.js:22-65` `FALLBACK_DRAFTS` is hardcoded Ayurveda content. Non-MVEDA tenants who hit the fallback path (when Claude API errors or key missing) see Ayurveda drafts as if they were generated for their brand.

**Fix:** generate fallback drafts from the tenant's brand profile at request time, or return an explicit error instead of templated content.

---

## simulateImageGen writes broken image refs to posts.media_urls

**Status:** Open · added 2026-05-14
**Priority:** Needs attention

`app/features.jsx:860-863` `simulateImageGen` returns a hardcoded `"product-shot-gen.jpg"` filename after a 2.2s timeout regardless of the connected image-gen provider. `savePost` then writes this into `posts.media_urls`. The real generation pipeline lives in `chat-app.jsx:874`; the simulate path produces dead refs.

**Fix:** delete `simulateImageGen` and route the Studio flow through the same `/api/generate` path as chat-to-create, or document and label it as a demo-only placeholder.

---

## Klaviyo console.log dumps response payloads

**Status:** Open · added 2026-05-14
**Priority:** Needs attention

`api/klaviyo.js:260` logs the full Klaviyo API response (including campaign objects with potential audience data) to Vercel logs. Long-term retention varies; sensitive PII may leak.

**Fix:** structured log of `{ campaignId, status }` only.

---

## Composio connection_status / list_connections leak

**Status:** Open · added 2026-05-14
**Priority:** Needs attention

`api/composio.js:179-217` `connection_status` and `list_connections` accept `tenantId` from the body. Without JWT auth, any caller can enumerate which connectors any tenant has linked. Subsumed by the JWT work but worth verifying explicitly when that lands.

---

## /api/brand-import overwrites any tenant's brand profile

**Status:** Open · added 2026-05-14
**Priority:** Needs attention

`api/brand-import.js:148` takes `tenantId` from body and upserts the brand row. Same root as the JWT gap — but specifically, an attacker can rewrite another tenant's brand voice / palette / messaging by posting their own URL with the victim's tenantId. Verify after JWT work lands.

---

## Hardcoded Claude model strings

**Status:** Open · added 2026-05-14
**Priority:** Low

`api/proactive-emails.js:260` and `api/proactive-drafts.js` hardcode `claude-opus-4-5`. `api/chat.js` uses a different (newer) default. Drift across endpoints will cause silent quality differences.

**Fix:** env var `ANTHROPIC_MODEL` consumed by a shared `api/lib/anthropic.js` helper.

---

## InsightsCenter hook-alias drift (bare React hooks)

**Status:** Open · added 2026-05-14
**Priority:** Low

`app/insights.jsx:9` destructures bare `useState/useEffect/useRef/useCallback` from `React` inside its IIFE. CLAUDE.md "Hook aliases" table has no row for `insights.jsx` — the file silently violates the per-file alias contract. Works today because of script load order, but breaks the moment another file's bare hooks collide.

**Fix:** add row `insights.jsx → useStateI / useEffectI / useRefI / useCallbackI` to the table and the file. Companion to the now-shipped InsightsCenter fix (PR `feat/fix-insights-center`).

---

## APP_ORIGIN falls back to localhost

**Status:** Open · added 2026-05-14
**Priority:** Low

`api/google-ads-auth.js:21-23` falls back to `http://localhost:3000` when `VERCEL_URL` is unset. OAuth redirects break on preview deploys where the env var isn't injected the same way.

**Fix:** derive from `VERCEL_URL` with `https://` prefix, or require an explicit `APP_ORIGIN` env var at boot.

---

## Math.random() UUIDs in providerRouter

**Status:** Open · added 2026-05-14
**Priority:** Low

`api/lib/providerRouter.js:271` uses `Math.random()` for server-side IDs. Acceptable today (no collision-sensitive use), but `crypto.randomUUID()` is one line and available on the Edge runtime.

---

## app.html vs index.html drift

**Status:** Open · added 2026-05-14
**Priority:** Low

`app.html` includes `app/ui2.jsx`; `index.html` does not. `server.py:29` serves `app.html` locally while Vercel serves `index.html` in production. Components defined in `ui2.jsx` (Drawer, Input, Textarea, etc.) are available in dev but not prod.

**Fix:** align both to the same script list, or delete `app.html` and have `server.py` serve `index.html`.

---

## set_updated_at() helper trigger location

**Status:** Open · added 2026-05-14
**Priority:** Low

`db/migrations/002_agent_overrides.sql:25-36` defines `set_updated_at()`. If another migration needs the same helper, the second `CREATE FUNCTION` will collide. Move to `000_helpers.sql` so it lives once.

---

## google-ads-auth: prompt=consent is over-aggressive

**Status:** Open · added 2026-05-14
**Priority:** Low

`api/google-ads-auth.js:38` always passes `prompt: "consent"` to Google's OAuth endpoint, forcing a re-consent every time the user reconnects. Switch to `prompt: "select_account"` once initial consent is granted.

---

## Vercel cron schedule requires Pro plan

**Status:** Open · added 2026-05-14
**Priority:** Low — documented constraint, but no runtime guard

`vercel.json` `* * * * *` on `fire-scheduled` is rejected at deploy on the Hobby plan. The 2026-05-14 BACKLOG entry on Scheduled Posting already notes this. Add a deploy-time check or a no-op fallback so the rest of the app still ships if Hobby is the target.

---

## Five platform publishers share publish_now pattern with no shared helper

**Status:** Open · added 2026-05-14
**Priority:** Low — refactor

`api/linkedin.js`, `api/facebook.js`, `api/x.js`, `api/instagram.js`, `api/reddit.js` each implement near-identical `publish_now` skeleton: validate input, fetch token, call Composio, handle image branch, return shaped response. Extract into `api/lib/platformPublisher.js` once the auth-and-rls work settles (touching every platform file at once is risky).

---

## InsightsCenter undefined globals + duplicate stub  `[done]`

**Status:** Shipped — PR `feat/fix-insights-center` (commit `d21b963`)
**Priority:** Critical (resolved 2026-05-14)

`app/insights.jsx` was reading `window.__SUPABASE_URL__` / `__SUPABASE_ANON_KEY__` — neither is set anywhere, so cached analytics fetches silently failed. Swapped to the existing `window.sb` client. Also deleted the 532-line dead InsightsCenter stub in `workspaces3.jsx:1126-1657` (overridden at runtime by `insights.jsx` via load order).

---

## WIP: proactive SMS feature (analogue to proactive-emails)

**Status:** Stashed locally · noted 2026-05-14
**Priority:** Medium

Local stash on `feat/klaviyo-sms`: `api/proactive-sms.js`, `api/cron/proactive-sms.js`, `db/migrations/006_proactive_sms.sql`, plus supporting edits in `app/features.jsx`, `app/store.jsx`, `app/studio.jsx`, `app/ui.jsx`, `app/chat-app.jsx`, `CLAUDE.md`, `vercel.json`. Recover with `git stash pop` once the auth-and-rls work is in.

Mirrors the proactive-emails design: cron reads `analytics_insights.recommended_actions`, classifies into SMS-friendly rules, Claude drafts ≤160-char body in brand voice, lands in `state.outbound.proactiveSms` for review in `SmsCenter`.

---

## Campaign brief persistence + cross-feature wiring

**Status:** Open · noted 2026-05-19
**Priority:** Low — speculative until one of these use cases lands

Today the `campaign_planner` specialist writes the brief into `state.activePlan` (client-only). Brief lives in chat thread text + ephemeral store; refresh wipes the canvas rendering, though the markdown is recoverable from chat history. Persisting it gets justified by either of:

- **Analyst cross-campaign comparison.** Let the Analyst specialist reference past campaign briefs when interpreting metrics — "how did our last launch perform vs this one." Needs briefs in a queryable store the chat backend can read at delegation time.
- **Campaign history tab on CampaignPlanner.** A second view in the planner workspace listing every brief ever generated for the tenant, with click-to-restore into `state.activePlan`. Today's "Dismiss" is one-way.

**Likely shape if/when built:** `campaign_plans` Supabase table (`id`, `tenant_id`, `title`, `summary`, `goal`, `audience`, `timeline`, `budget`, `channels jsonb`, `brief_md`, `created_at`); persist in `/api/chat.js` when `create_campaign_plan` fires; GET endpoint for history hydration; foreign key from `calendar` items or `scheduled_posts` rows back to `campaign_plans.id`.

---

## sourceBriefId not enforced on CAL_ADD path

**Status:** Open · noted 2026-05-19
**Priority:** Low — no risk until brief→queue conversion exists

The `sourceBriefId` field is in the calendar item schema (see [WORKLOG.md](WORKLOG.md) 2026-05-19), but only the `QUEUE_ADD_DRAFT` reducer guarantees it gets written — that reducer constructs items field-by-field. The other path into `state.calendar` is `CAL_ADD`, which just spreads pre-built items from the caller (`[...s.calendar, ...a.items]`) — `sourceBriefId` only lands on the row if the caller remembered to put it there.

Today the only `CAL_ADD` caller is `NewCampaignDialog` (no brief involved → correctly leaves the field unset). The risk surfaces when the brief→queue conversion is built: if that future code uses `actions.addCampaign(items, name)` and forgets to stamp `sourceBriefId: state.activePlan.id` onto every item before dispatching, rows will silently lose their back-reference and no error fires.

**Fix when it bites:** either (a) extend `CAL_ADD` to accept a top-level `sourceBriefId` arg and stamp it onto every item in the reducer, or (b) add a dedicated `CAL_ADD_FROM_BRIEF` action that requires the id. (a) is cheaper; (b) is more explicit.

