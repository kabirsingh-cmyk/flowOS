# Phase 5 — Engagement Layer · Scoping Doc (v4)

**Status:** Final scoping. Awaiting Kabir's sign-off on §2 + §9 before K2.
**Author:** Claude · 2026-05-30 (v4 after full OpenAPI YAML grep)
**Goal:** Unified inbox of DMs and comments from connected organic platforms — surfaced inside FlowOS Reach for triage and reply.

### v4 corrections (I was wrong in v3 too)
After unpacking the actual 1.2MB OpenAPI YAML:
- **`GET /v1/inbox/comments` IS a real endpoint** — but it returns **posts that have comments** (with `commentCount`), not individual comments. Our normalizer runs on post objects today and silently produces garbage rows. v3 said it didn't exist — wrong, but our use of it is still wrong.
- **Per-comment fetch:** `GET /v1/inbox/comments/{postId}?accountId=...` (postId can be Zernio ID or platform-native; LinkedIn accepts activity URN or numeric).
- **Reply path stays `POST /v1/inbox/comments/{postId}` with body `{accountId, message, commentId?, parentCid?, rootUri?, rootCid?}`.** v3 said it should change — wrong. Our path is correct; only the snake_case/camelCase bug and missing Bluesky fields need fixing.
- **Per-comment shape** is `{id, message, createdTime, from:{id,name,username,picture,isOwner,verifiedType}, likeCount, replyCount, platform, url, replies[], canReply, canDelete, canHide, canLike, isHidden, isLiked, likeUri, cid, parentId, rootUri, rootCid}`. Our normalizer reads `comment.author?.name` (wrong — it's `from.name`) and `comment.text || comment.message` (text doesn't exist).
- **Per-conversation shape** is `{id, platform, accountId, accountUsername, participantId, participantName, participantPicture, participantVerifiedType, lastMessage, updatedTime, status, unreadCount, url, instagramProfile:{...}}`. Our normalizer reads `conv.participant?.name` (wrong — it's `participantName` flat) and `conv.snippet` (wrong — it's `lastMessage`).
- **X DM writes require X API Pro tier ($5,000/month) or Enterprise** for BYOK. Whether Zernio's shared tier covers this is unclear — must test.
- **X DM reads** affected by "encrypted X Chat" — some convos appear empty. Document but live with it.
- **Private reply path** is `POST /v1/inbox/comments/{postId}/{commentId}/private-reply` (both IDs in URL, not just `{commentId}` as v3 claimed). 7-day window. IG + FB only. Supports `quickReplies` and `buttons`.
- **Bluesky replies** require `parentCid`, `rootUri`, `rootCid` — none captured in our normalizer.
- **`instagramProfile.isFollower`** on IG conversations — directly answers "is this DM in the 24h window or message-requests folder." Use for K3 badging.

### Decisions locked from Kabir
1. Zernio Inbox addon — "all features included in every tier." Treat as enabled; sanity-check with a real call in K2 (if 403 fires, surface and ask).
2. K4 — single PR.
3. `account.disconnected` UX — banner + notification + flip `channels.status`.
4. Threads comment pull cadence — every 15 min via cron.
5. LinkedIn — surface comments (no DM rows since none come in anyway).
6. X DM pull cadence — every 15 min via cron.
7. Drop entirely: WhatsApp, Telegram, Discord, Snapchat.
8. Drop GB from unified inbox (GMB workspace owns it).
9. Daily auto-reply cap per channel from `state.channelRules`.
10. Mentions killed — no Zernio inbound-mention surface.

---

## 1. Verified per-platform capability matrix (final)

| Platform | DM fetch | DM webhook | Reply DM | Comment fetch | Comment webhook | Reply comment | Phase 5? |
|---|---|---|---|---|---|---|---|
| Facebook (fb) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ + private-reply | **YES** |
| Instagram (ig) | ✅ (+`instagramProfile.isFollower`) | ✅ | ✅ | ✅ | ✅ | ✅ + private-reply | **YES** |
| LinkedIn (li) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | **YES** (comments only) |
| X / Twitter (x) | ✅ (encrypted-chat caveat) | ❌ | ✅ ($5k/mo Pro tier — verify) | ✅ | ✅ | ✅ | **YES** |
| YouTube (yt) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | **YES** (comments only) |
| Reddit (reddit) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **YES** |
| Bluesky (bluesky) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (needs `parentCid`, `rootUri`, `rootCid`) | **YES** |
| Threads (threads) | ❌ "no DMs" | ❌ | ❌ | ✅ (read + reply existing only) | ❌ (no webhook) | ✅ reply-only | **YES** (comments, pull-only) |
| TikTok | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | NO — Zernio has no API |
| Pinterest | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | NO — Zernio has no API |

**Phase 5 platforms: fb, ig, li, x, yt, reddit, bluesky, threads (8).**
**Drop forever from inbox: TikTok, Pinterest** (record in BACKLOG.md).
**Pull cadence platforms (no webhook):** X DMs every 15 min; Threads comments every 15 min.

---

## 2. ONE remaining open question for Kabir before K2

**X DM writes: does Zernio's shared X tier cover the $5k/mo Pro tier requirement, or is it BYOK-only?**

The OpenAPI explicitly says: *"X API tier requirement: DM write endpoints require X API Pro tier ($5,000/month) or Enterprise access. This applies to BYOK (Bring Your Own Key) users who provide their own X API credentials."*

- If Zernio fronts a Pro/Enterprise key for all customers → we can `reply_dm` for X out of the box.
- If BYOK-only → no X DM replies for any tenant who doesn't have their own Pro key. UI must disable X DM reply with a clear "Requires X API Pro" badge.

Default until you say otherwise: **disable X DM reply with the badge.** Switch to enabled once you confirm Zernio's tier covers it.

---

## 3. Endpoint contract — final, verified

### DM pull
`GET /v1/inbox/conversations?profileId=&platform=&accountId=&limit=&cursor=&status=active&sortOrder=desc`
- Supported platforms (enum): facebook, instagram, twitter, bluesky, reddit, telegram.
- Response: `{ data: [Conv], pagination: {hasMore, nextCursor}, meta: {accountsQueried, accountsFailed, failedAccounts[], lastUpdated} }`.
- `Conv` fields (full): see §v4-corrections. Use `participantName`, `lastMessage`, `updatedTime`, `unreadCount`, `url`, `instagramProfile.isFollower`.

### Comments — TWO-STEP pull (only used for Threads pull cycle)
1. `GET /v1/inbox/comments?platform=threads&profileId=&minComments=1` → list of posts with comment counts.
2. For each post: `GET /v1/inbox/comments/{postId}?accountId=...` → comments.

For the 7 webhook-eligible platforms (fb, ig, li, x, yt, reddit, bluesky): rely on `comment.received` webhook — no pull needed.

### Reply DM
`POST /v1/inbox/conversations/{conversationId}/messages` — body `{accountId, message}`. Our path correct, body shape correct.

### Reply comment
`POST /v1/inbox/comments/{postId}` — body `{accountId, message, commentId?, parentCid?, rootUri?, rootCid?}`. Our path correct; **fix bug R1** (snake_case→camelCase) and add Bluesky fields.

### Private reply (IG + FB)
`POST /v1/inbox/comments/{postId}/{commentId}/private-reply` — body `{accountId, message, quickReplies?, buttons?}`. 7-day window. New action `private_reply_comment` in zernio.js.

### Delete / hide / like comment
Available but out of Phase 5 scope unless Kabir wants them.

---

## 4. Confirmed bugs in current code

| # | File | Bug | Impact |
|---|---|---|---|
| R1 | workspaces3.jsx:2009 / zernio.js:399,423 | Frontend sends `conversation_id`/`comment_id` (snake_case); server destructures camelCase | All replies 400 |
| R2 | inbox.js:269,284 — `normalizeDm` / `normalizeComment` | Reads `conv.participant?.name` (actual: `participantName`), `conv.snippet` (actual: `lastMessage`), `comment.author?.name` (actual: `from.name`), `comment.text` (actual: `message`) | Author + body always blank in UI for fetched items |
| R3 | inbox.js:337 — `GET /inbox/comments?platform=` | Response `data[]` is POSTS not COMMENTS. normalizeComment runs on post objects → produces rows with no text and no external_id | Comments pull currently inserts zero usable rows |
| R4 | zernio.js — `handleReplyComment` | Bluesky needs `parentCid`, `rootUri`, `rootCid` — never sent | Bluesky comment replies fail |
| R5 | zernio.js — no `private_reply_comment` action | IG/FB cold-DM-from-comment unwireable | Missing feature, not a regression |
| R6 | webhooks/zernio.js | `review.updated`, `account.disconnected`, `account.connected`, `post.partial`, `message.edited/deleted/delivered/read/failed` all ignored | account.disconnected = silent token-expiry → empty inbox |
| R7 | inbox.js triage | Patches `ai_triage_note` but never `risk`; pull-path rows always `risk='low'` | UI urgent/ready buckets miscategorise pull-path rows |

---

## 5. Final PR split (3 PRs)

### PR K2 — Reply repair + normalizer rewrite + per-channel cap
**Scope:** existing 4 platforms (ig/fb/li-comments/x). Make replies actually work; make fetched rows actually populate.
- Fix R1 (snake_case alignment).
- Fix R2 (rewrite `normalizeDm` / `normalizeComment` against verified OpenAPI shapes; extract `post_id`/`parentId`/`rootUri`/`rootCid` into raw + new `parent_external_id` column).
- Fix R4 (Bluesky reply fields — even though Bluesky lands in K4, the wiring goes in here so K4 only adds capability flags).
- Fix R3 by **removing the broken `/inbox/comments?platform=` call entirely**. Comments pull dropped; webhook is authoritative. For Threads (K4), we add a per-post two-step path.
- Migration `2026-06-XX-inbox-parent-ref.sql`: `parent_external_id text` + index.
- Fix R7: derive UI `risk` from `ai_triage_note.urgency` at render time. No column write.
- Surface `source_url` as "View original" link.
- Per-channel daily auto-reply cap from `state.channelRules` (match on `platform` column, not source-label substring).
- One-shot sanity check: if any `/v1/inbox/*` endpoint returns 403 ("Inbox addon required"), abort PR and re-open Q1 with Kabir.
- Test plan in PR: real reply round-trip per wired platform; log shapes to `docs/zernio-response-shapes/`.

### PR K3 — Capability matrix + UI affordances + webhook handler additions
- New `api/lib/inboxCapabilities.js` — 8-platform matrix from §1.
- `api/inbox.js` reads matrix; only pulls DMs for matrix `dm:true`.
- `workspaces3.jsx` consumes matrix (via window in compliance with IIFE rules). Disables unsupported event-types per row. Adds:
  - "Reply privately" button for IG + FB comments → `private_reply_comment` (with optional `buttons` for cold reach into Message Requests folder).
  - DM-window indicator for IG DMs using `instagramProfile.isFollower` + `updatedTime` (within 24h of last user message = open; otherwise show "Message Requests / use private-reply from comment").
  - "X DM Pro tier required" badge if §2 lands BYOK-only.
- `api/zernio.js` new actions: `private_reply_comment`.
- `api/webhooks/zernio.js` additions (R6):
  - `review.updated`: noop for unified inbox; passes through if GMB workspace handles it.
  - `account.disconnected`: flip `channels.status='disconnected'`, write a notification row, surface banner in workspaces3.
  - `account.connected`: optional warm-trigger of `/api/inbox` to backfill.
  - Unknown events: `console.log` with payload shape for observation (no DB table — Kabir didn't pick one; Vercel logs sufficient).

### PR K4 — yt, reddit, bluesky, threads + X-comments + cron jobs
- Add yt, reddit, bluesky, threads to capability matrix (`dm` true only for reddit/bluesky; X already wired in K2).
- Webhook normalizers extended for yt/reddit/bluesky/threads comment shape variants (Reddit `body`, YouTube `snippet.textDisplay`, Bluesky ATProto, Threads).
- **New cron job** `/api/cron/threads-poll`: every 15 min, list connected Threads accounts → list their recent posts (`GET /v1/inbox/comments?platform=threads&since=...`) → fetch per-post comments → upsert into `inbox_events`. Idempotent via existing `(tenant_id, external_id)` unique index.
- **New cron job** `/api/cron/x-dm-poll`: every 15 min for X DMs (no webhook). Same shape, calls `GET /v1/inbox/conversations?platform=twitter`.
- Vercel `vercel.json` cron block additions (both Pro-tier — already on Pro per CLAUDE.md).
- Per-platform raw-shape verification before merge — append to `docs/zernio-response-shapes/`.
- BACKLOG.md: record that TikTok + Pinterest cannot be unified-inbox platforms at the Zernio layer.

### PR K5 — Mentions
**Killed.** Zernio has no inbound-mentions surface. If brand-mention monitoring is wanted, it's a separate workstream (Brand24 / Mention.com / SERP scraper).

---

## 6. Schema additions

Single migration in PR K2:
```sql
-- 2026-06-XX-inbox-parent-ref.sql
alter table public.inbox_events
  add column if not exists parent_external_id text;

create index if not exists inbox_events_tenant_parent_idx
  on public.inbox_events (tenant_id, parent_external_id);
```

No other migrations.

---

## 7. Build order

K2 → K3 → K4. K5 killed.

---

## 8. Cron + env additions summary

- Cron entries in `vercel.json`: `/api/cron/threads-poll` and `/api/cron/x-dm-poll`, both `*/15 * * * *`.
- No new env vars (uses existing `ZERNIO_API_KEY`, `CRON_SECRET`, Supabase keys).

---

## 9. Final open items before K2

| # | Item | Owner | Blocker? |
|---|---|---|---|
| Q1 | X DM Pro-tier coverage on Zernio's shared key | Kabir | **Yes for X DM reply path UX** (default: disable + badge) |
| V1 | Per-platform raw shape verification — real Zernio calls per platform/event-type, dump to `docs/zernio-response-shapes/` | Claude in K2 | Yes — normalizer rewrites depend on it |
| V2 | Inbox addon 403 sanity check on first real call | Claude in K2 | Defensive — Kabir says it's enabled |

V1 + V2 land inside PR K2 itself (the first real Zernio calls happen there). Q1 is the only thing I need from you before opening K2.

---

## Appendix A — verification trail

- OpenAPI YAML (1.2MB) cached locally; grepped paths `/v1/inbox/conversations*`, `/v1/inbox/comments*`, `/v1/inbox/comments/{postId}/{commentId}/private-reply`, request bodies and response schemas fully read.
- Per-platform pages (`twitter`, `threads`, `tiktok`, `pinterest`) fetched and quoted.
- Webhook events table extracted from OpenAPI (26 events with per-platform support listed in §1).
- Codebase: `api/inbox.js`, `api/zernio.js`, `api/webhooks/zernio.js`, `app/workspaces3.jsx`, `db/migrations/011_inbox_events.sql`, `2026-06-06-inbox-triage.sql`, `api/lib/zernioMap.js` — all read.

### What I still HAVEN'T verified
- Live response shapes from `/v1/inbox/*` per platform with our actual `ZERNIO_API_KEY` — happens in K2 first commit.
- Whether the OpenAPI's "Inbox addon required" 403 fires on our key — happens in K2 first commit.
- Whether Zernio's shared X tier covers Pro DM writes — needs Kabir or a test.
