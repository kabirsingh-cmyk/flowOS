/**
 * FlowOS — Inbox capability matrix (SERVER).
 *
 * Single source of truth for what each Zernio-connected platform can do in
 * the unified inbox. Drives:
 *   - api/inbox.js → which platforms to attempt DM-pull on
 *   - api/zernio.js → server-side validation of reply / private-reply targets
 *
 * Mirror lives at app/inbox-capabilities.jsx (IIFE — exposes window.INBOX_CAPABILITIES).
 * Keep both files in sync — they describe the same Zernio reality.
 *
 * Phase 5 scope: fb, ig, li, x, yt, reddit, bluesky, threads (8 platforms).
 * Excluded from inbox forever (Zernio has no API surface): tt, pn.
 * Excluded from Phase 5 by product decision: gbusiness (handled in GMB
 * workspace), whatsapp, telegram, discord, snapchat.
 *
 * Field definitions:
 *   dm                       — can fetch + reply to DMs via /v1/inbox/conversations
 *   comment                  — can fetch + reply to comments via /v1/inbox/comments/{postId}
 *   privateReplyToComment    — can use POST /v1/inbox/comments/{postId}/{commentId}/private-reply
 *                              (moves a public comment thread into a DM; IG + FB only per OpenAPI)
 *   replyDmWindowHours       — platform-imposed reply window; null = no window
 *   dmWriteRequiresProTier   — platform requires special API tier for DM writes
 *                              (X requires Pro $5k/mo per Zernio OpenAPI; defensive — we surface
 *                              the actual 403 if it fires, this flag pre-warns the UI)
 *   commentsViaPullOnly      — comment.received webhook does NOT fire; must pull
 *                              (Threads is the only one per OpenAPI webhook table)
 */

export const INBOX_CAPABILITIES = {
  fb: {
    dm: true,
    comment: true,
    privateReplyToComment: true,    // IG + FB only per OpenAPI
    replyDmWindowHours: null,
    dmWriteRequiresProTier: false,
    commentsViaPullOnly: false,
  },
  ig: {
    dm: true,
    comment: true,
    privateReplyToComment: true,
    replyDmWindowHours: 24,         // non-followers; surface via instagramProfile.isFollower
    dmWriteRequiresProTier: false,
    commentsViaPullOnly: false,
  },
  li: {
    dm: false,                       // Zernio doesn't expose LinkedIn DMs
    comment: true,
    privateReplyToComment: false,
    replyDmWindowHours: null,
    dmWriteRequiresProTier: false,
    commentsViaPullOnly: false,
  },
  x: {
    dm: true,
    comment: true,
    privateReplyToComment: false,
    replyDmWindowHours: null,
    dmWriteRequiresProTier: true,   // X API Pro tier ($5k/mo); defensive only
    commentsViaPullOnly: false,
  },
  yt: {
    dm: false,
    comment: true,
    privateReplyToComment: false,
    replyDmWindowHours: null,
    dmWriteRequiresProTier: false,
    commentsViaPullOnly: false,
  },
  reddit: {
    dm: true,
    comment: true,
    privateReplyToComment: false,
    replyDmWindowHours: null,
    dmWriteRequiresProTier: false,
    commentsViaPullOnly: false,
  },
  bluesky: {
    dm: true,
    comment: true,
    privateReplyToComment: false,
    replyDmWindowHours: null,
    dmWriteRequiresProTier: false,
    commentsViaPullOnly: false,
  },
  threads: {
    dm: false,                       // "Threads API does not support direct messages"
    comment: true,                   // reply-only — no new top-level comments
    privateReplyToComment: false,
    replyDmWindowHours: null,
    dmWriteRequiresProTier: false,
    commentsViaPullOnly: true,       // comment.received webhook does NOT fire for Threads
  },
};

/** Returns true iff the platform exists in the matrix AND supports the given event-type. */
export function canHandle(platform, eventType) {
  const cap = INBOX_CAPABILITIES[platform];
  if (!cap) return false;
  if (eventType === "dm")      return cap.dm;
  if (eventType === "comment") return cap.comment;
  return false;
}

/** Returns the array of platform IDs that support DM pull (for inbox.js fan-out). */
export function dmPullPlatforms() {
  return Object.keys(INBOX_CAPABILITIES).filter(p => INBOX_CAPABILITIES[p].dm);
}
