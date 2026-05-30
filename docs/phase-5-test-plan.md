# Phase 5 — Engagement Layer · Test Plan

Single source of truth for Phase 5 verification. Each entry is one assertion against the live system. Status: ⬜ untested · 🟡 partial · ✅ passed · ❌ failed.

> **Why this exists:** Kabir merged K2 without running the verification steps. Rather than silently assume K2 works in production, every untested assertion lives here so we can catch K2 regressions when they're discovered downstream (K3/K4 builds on these shapes).

---

## PR K2 — Reply path repair (merged, untested in prod)

### Server contract
- ⬜ `/api/inbox` against a tenant with IG/FB/LI/X connected returns 200 with `items[]` populated (no `ZERNIO_INBOX_ADDON_DISABLED` warning).
  - If warning fires → Zernio Inbox addon is NOT enabled on our plan despite Kabir's assertion that all features ship in every tier. Escalate to Zernio.
- ⬜ `/api/inbox` second call within the triage window does not re-triage already-triaged rows (idempotency check).

### Normalizer shape verification (R2 fix)
Each of these confirms the OpenAPI shape I assumed matches what Zernio actually returns for our connected accounts. Capture the raw response to `docs/zernio-response-shapes/{platform}-{event}.json` for K4 reference.
- ⬜ IG DM — `participantName`, `lastMessage`, `url`, `instagramProfile.isFollower`, `updatedTime` all present and non-null when expected.
- ⬜ FB DM — same as IG (minus `instagramProfile`).
- ⬜ X DM — same; document encrypted-chat empty-conversation behaviour if it appears.
- ⬜ IG comment (via webhook) — `from.name`, `from.username`, `message` populated.
- ⬜ FB comment (via webhook) — same.
- ⬜ LI comment (via webhook) — same.
- ⬜ X comment (via webhook) — same.

### Reply round-trip (R1 + R4 fix)
- ⬜ IG comment reply — 200 from `/api/zernio reply_comment`. Pre-K2 expectation: 400 ("conversationId required" / "commentId required"). Post-K2 expectation: 200 with `replyId` returned.
- ⬜ FB comment reply — 200.
- ⬜ LI comment reply — 200.
- ⬜ IG DM reply — 200 from `reply_dm`.
- ⬜ FB DM reply — 200.
- ⬜ X DM reply — either 200 (Zernio shared key is Pro) OR 403 with `X_DM_PRO_TIER_REQUIRED:` prefix. Either result closes scoping-doc Q1.
- ⬜ Bluesky comment reply with `parent_cid` / `root_uri` / `root_cid` plumbed through — 200. (Blocked until K4 wires Bluesky into the platform list, but the wiring code is in K2; smoke-test as soon as a Bluesky account is connected.)

### Frontend (workspaces3.jsx)
- ⬜ Per-channel daily auto-reply cap fires on the correct row's platform (IG hitting cap doesn't block FB replies).
- ⬜ LinkedIn DM row surfaces "LinkedIn DMs aren't exposed by Zernio" warning when reply is attempted, no network call made.
- ⬜ Triage-derived risk buckets fetched rows into urgent/ready correctly (was: every fetched row → "ready" because column was always 'low').
- ⬜ `source_url` "View original" link renders when present, opens in new tab, doesn't render when null.
- ⬜ Comment reply with missing `parentExternalId` surfaces "re-sync inbox" rather than silently failing.

### Schema
- ⬜ `db/migrations/2026-05-30-inbox-parent-ref.sql` applied against the live Supabase project (`parent_external_id text` column + index exist).

---

## PR K3 — Capability matrix + UI affordances + webhook handler additions (untested in prod)

### Capability matrix wiring
- ⬜ `api/inbox.js` no longer references `V1_PLATFORMS` / `DM_PLATFORMS`; reads `DM_PULL_PLATFORMS` derived from `dmPullPlatforms()` in `api/lib/inboxCapabilities.js`. Verify: connecting a Reddit account triggers a DM pull on the next `/api/inbox` call (was: ignored entirely pre-K3, even though Zernio exposes Reddit DMs).
- ⬜ `getConnectedPlatforms` queries all 8 matrix platforms (was: hardcoded 4). Verify: a YouTube-connected tenant returns a channels row from this fn.
- ⬜ `window.INBOX_CAPABILITIES` and `window.PLATFORM_DISPLAY_NAMES` set in browser console after page load.

### Private reply (IG/FB cold-DM-from-comment)
- ⬜ `/api/zernio private_reply_comment` on an IG comment with `text` only → 200, DM lands in the comment author's IG inbox.
- ⬜ Same on FB → 200.
- ⬜ Same with `platform: "li"` → 400 "private_reply_comment is IG/FB only".
- ⬜ `quick_replies` length 14 → 400 "max 13".
- ⬜ Both `quick_replies` and `buttons` set → 400 "mutually exclusive".
- ⬜ UI: "Reply privately" button renders on IG comments only (not LI, not YT, not on DMs). Click → DM sent, comment row remains open in inbox.

### DM-window indicator (IG only, imprecise — see code comment)
- ⬜ IG DM with `instagramProfile.isFollower: true` AND `updatedTime` < 24h ago → renders `Follower` + `DM window open · ~Nh left` chips.
- ⬜ IG DM with `isFollower: false` AND `updatedTime` > 24h ago → renders `Not a follower` + `DM window closed · use private-reply from comment`.
- ⬜ Non-IG DM → no window badge renders.
- ⬜ IG comment → no window badge (DMs only).

### X DM Pro-tier defensive surface
- ⬜ When `CAP_MATRIX[x].dmWriteRequiresProTier` is true, X DM detail pane shows `Reply requires X API Pro` chip.
- ⬜ Attempting reply still flows through `sendReply`; if Zernio returns 403 `X_DM_PRO_TIER_REQUIRED`, UI surfaces the K2 warning.

### Capability-driven structural blocks
- ⬜ LinkedIn DM reply attempt → "DMs aren't available via Zernio" notification (was: LI-specific hardcoded check; now matrix-driven).
- ⬜ X comment reply attempt → works (X has comment:true).
- ⬜ Adding a `dm: false, comment: false` row to the matrix temporarily → both reply attempts get blocked. (Sanity check the matrix-driven path.)

### Webhook handler additions
- ⬜ `account.disconnected` → channels row for that (tenant, platform) flips to `status='disconnected'`. Connections workspace shows it as disconnected on next mount.
- ⬜ `account.connected` → no DB change; log line in Vercel.
- ⬜ `review.updated` → no DB change; log line in Vercel (Q-1 decision: GMB workspace owns review state).
- ⬜ `post.partial` → no DB change; log line in Vercel including `results` (Q-3 deferred to add enum value).
- ⬜ Unknown event (any new Zernio event we don't handle) → log line includes event name + data keys, returns 200 ignored.

### Real-time banner / notification follow-up
- ⬜ Filed separate ticket: backend-triggered banner for `account.disconnected` requires notifications table + frontend Supabase realtime subscription. Out of K3 by design.

## PR K4 — (pending)
*Test cases added when K4 opens.*

---

## How to run a test entry

For server-contract / shape / reply tests:
1. Connect the relevant platform via the Connections workspace using a real account.
2. Generate the inbound event (a real DM / comment from a test account).
3. Trigger `/api/inbox` (auto-fires on InboxEscalation mount + 30s interval), or hit the reply path through the UI.
4. Capture the raw Zernio response from Vercel logs.
5. Flip the box and paste the result (or link the log) below the entry.

For frontend tests: exercise via the InboxEscalation workspace in a `?seed=mveda` or `?seed=erickson` session.
