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
