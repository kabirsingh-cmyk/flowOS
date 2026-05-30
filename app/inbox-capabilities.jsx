/**
 * FlowOS — Inbox capability matrix (FRONTEND IIFE mirror).
 *
 * Mirror of api/lib/inboxCapabilities.js. Two files because api/* (Edge
 * Functions) and IIFE-wrapped frontend files can't share imports per the
 * project's Vite-migration constraints (see /CLAUDE.md "IIFE pattern" rule).
 *
 * Keep this file in sync with api/lib/inboxCapabilities.js. They describe the
 * same Zernio reality. If you add a platform here, add it there too — and
 * vice versa.
 *
 * Loaded by app/main.jsx before workspaces3.jsx so InboxEscalation can read
 * window.INBOX_CAPABILITIES synchronously.
 *
 * See api/lib/inboxCapabilities.js for full field documentation.
 */

(function () {
  const INBOX_CAPABILITIES = {
    fb: {
      dm: true,
      comment: true,
      privateReplyToComment: true,
      replyDmWindowHours: null,
      dmWriteRequiresProTier: false,
      commentsViaPullOnly: false,
    },
    ig: {
      dm: true,
      comment: true,
      privateReplyToComment: true,
      replyDmWindowHours: 24,
      dmWriteRequiresProTier: false,
      commentsViaPullOnly: false,
    },
    li: {
      dm: false,
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
      dmWriteRequiresProTier: true,
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
      dm: false,
      comment: true,
      privateReplyToComment: false,
      replyDmWindowHours: null,
      dmWriteRequiresProTier: false,
      commentsViaPullOnly: true,
    },
  };

  // Display name lookup — used by workspaces3.jsx for channelRules matching
  // and badge labels. Kept here so adding a platform = update one file.
  const PLATFORM_DISPLAY_NAMES = {
    fb: "Facebook",  ig: "Instagram", li: "LinkedIn", x: "X",
    yt: "YouTube",   reddit: "Reddit", bluesky: "Bluesky", threads: "Threads",
  };

  Object.assign(window, { INBOX_CAPABILITIES, PLATFORM_DISPLAY_NAMES });
})();
