/**
 * FlowOS — Zernio social publishing connector
 * Vercel Edge Function: POST /api/zernio
 *
 * Zernio is the single provider for all 15 social platforms. It handles:
 *   - OAuth-as-a-service per tenant per platform
 *   - Unified publishing API
 *   - Native scheduling (eliminates need for FlowOS cron on social posts)
 *   - Analytics, DMs, comments, and paid boost
 *
 * Auth:
 *   ZERNIO_API_KEY — platform-level API key (server-side only)
 *   Per-user identity is passed as X-External-User-ID: {tenantId}
 *
 * Supported platforms:
 *   linkedin, facebook, instagram, x, reddit, tiktok, pinterest, threads,
 *   bluesky, youtube, whatsapp, telegram, snapchat, discord, gbusiness
 *   + paid social: pinads, metaads, liads, ttads, xads
 *
 * Actions:
 *   initiate_connection  — start OAuth flow for a tenant + platform
 *   connection_status    — poll whether OAuth completed
 *   disconnect           — revoke connection
 *   publish_now          — post immediately to a platform
 *   schedule_post        — hand scheduling to Zernio natively
 *   get_analytics        — impressions, reach, engagement, followers
 *   get_dms              — unified DM inbox for a platform
 *   get_comments         — unified comments for a platform
 *   boost_post           — paid social / ads boost
 */

/*
 * # b_a002 migration notes (2026-05-24)
 *
 * metaads, liads, ttads, xads migrated from Composio to Zernio for OAuth.
 * Full ad campaign management APIs are out of scope — only the auth/connection
 * layer is wired here.
 *
 * Platform identifier uncertainty:
 *   workspaces4.jsx sends connector.id as `app` (i.e. "metaads", "liads",
 *   "ttads", "xads"). These are added to SUPPORTED_PLATFORMS and passed
 *   directly to Zernio as the `platform` field, following the same pattern
 *   as "pinads". UNCONFIRMED: whether Zernio's OAuth endpoint recognises
 *   "metaads", "liads", "ttads", "xads" as valid platform slugs. If Zernio
 *   uses different identifiers (e.g. "facebook_ads", "linkedin_ads"), add a
 *   mapping in handleInitiateConnection / handleConnectionStatus /
 *   handleDisconnect before shipping to users.
 *
 * Connection flow on paper for each of the four connectors:
 *   1. User clicks tile → handleConnectSubmit → POST /api/zernio
 *        { action: "initiate_connection", app: "<id>", redirectUri }
 *   2. zernio.js validates platform ∈ SUPPORTED_PLATFORMS ✓ (after this PR)
 *      → forwards platform:"<id>" to Zernio /connections/initiate
 *      → returns { ok, mode:"oauth", redirectUrl }  [UNCONFIRMED: Zernio accepts slug]
 *   3. Popup opens redirectUrl. Zernio handles the OAuth handshake with the
 *      ad platform (Meta / LinkedIn / TikTok / X).
 *   4. Callback hits oauth-callback.html?zernio_connected=<id>
 *      → postMessage to opener, then polling picks it up.
 *   5. Poll: POST /api/zernio { action:"connection_status", app:"<id>" }
 *      → Zernio /connections/status?platform=<id>  [UNCONFIRMED]
 *      → returns connected:true → verifyAndPersistConnection → Supabase upsert
 *   6. Tile flips green.
 */

import { requireAuthOrCron, requireAuth } from "./lib/auth.js";
import { corsHeaders, corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";

export const config = { runtime: "edge" };

const ZERNIO_BASE = "https://api.zernio.io/v1";

// Maps FlowOS short connector IDs → Zernio platform slugs.
// Organic connectors use abbreviated IDs in seed.jsx (fb, ig, li, tt, pn, yt)
// but Zernio expects full platform names. workspaces4 always sends connector.id,
// so we resolve here rather than changing the call shape.
const PLATFORM_ID_MAP = {
  fb:  "facebook",
  ig:  "instagram",
  li:  "linkedin",
  tt:  "tiktok",
  pn:  "pinterest",
  yt:  "youtube",
};

function resolvePlatform(id) {
  return PLATFORM_ID_MAP[id] || id;
}

// Gate check uses FlowOS IDs (short or full — both accepted).
const SUPPORTED_PLATFORMS = new Set([
  // Organic social — full Zernio slugs
  "linkedin", "facebook", "instagram", "x", "reddit",
  "tiktok", "pinterest", "threads", "bluesky", "youtube",
  "whatsapp", "telegram", "snapchat", "discord", "gbusiness",
  // Organic social — FlowOS short IDs (resolved to full names via PLATFORM_ID_MAP before API calls)
  "fb", "ig", "li", "tt", "pn", "yt",
  // Paid social — FlowOS connector IDs passed directly to Zernio.
  // Zernio slug support for metaads/liads/ttads/xads is UNCONFIRMED
  // (see b_a002 migration notes above). pinads is confirmed working.
  "pinads", "metaads", "liads", "ttads", "xads",
]);

function zernioHeaders(tenantId) {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new Error("ZERNIO_API_KEY env var not set");
  return {
    "Authorization":      `Bearer ${key}`,
    "Content-Type":       "application/json",
    "X-External-User-ID": tenantId,
  };
}

async function zernioFetch(path, options = {}, tenantId) {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...options,
    headers: { ...zernioHeaders(tenantId), ...(options.headers || {}) },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error || data?.message || `Zernio ${path} ${res.status}: ${text.slice(0, 300)}`;
    throw Object.assign(new Error(msg), { status: res.status, zernioCode: data?.code });
  }
  return data;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

/**
 * initiate_connection
 * Starts the Zernio OAuth flow for a tenant + platform. Returns a redirectUrl
 * the frontend opens in a popup. Zernio handles the full OAuth handshake.
 */
async function handleInitiateConnection({ tenantId, app, redirectUri }) {
  if (!app) return errResponse("app required");
  const platform = app.toLowerCase();
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return errResponse(`Unsupported platform: ${platform}. Supported: ${[...SUPPORTED_PLATFORMS].join(", ")}`);
  }

  const data = await zernioFetch("/connections/initiate", {
    method: "POST",
    body: JSON.stringify({
      platform:         resolvePlatform(platform),
      external_user_id: tenantId,
      callback_url:     redirectUri || null,
    }),
  }, tenantId);

  return jsonResponse({
    ok:           true,
    mode:         "oauth",
    redirectUrl:  data.oauth_url || data.redirect_url,
    connectionId: data.connection_id || null,
  });
}

/**
 * connection_status
 * Polls Zernio for an active connection for this tenant + platform.
 */
async function handleConnectionStatus({ tenantId, app }) {
  if (!app) return errResponse("app required");
  const platform = app.toLowerCase();

  const data = await zernioFetch(
    `/connections/status?platform=${encodeURIComponent(resolvePlatform(platform))}`,
    { method: "GET" },
    tenantId,
  );

  return jsonResponse({
    ok:        true,
    connected: data.connected ?? !!data.connection_id,
    accountId: data.connection_id || null,
    handle:    data.handle || data.username || null,
    status:    data.connected ? "ACTIVE" : "not_connected",
    app,
  });
}

/**
 * disconnect
 * Revokes the Zernio connection for a tenant + platform.
 */
async function handleDisconnect({ tenantId, app, accountId }) {
  if (!app) return errResponse("app required");
  const platform = app.toLowerCase();

  await zernioFetch("/connections/disconnect", {
    method: "POST",
    body: JSON.stringify({ platform: resolvePlatform(platform), connection_id: accountId || null }),
  }, tenantId);

  return jsonResponse({ ok: true });
}

/**
 * publish_now
 * Post to a platform immediately via Zernio.
 * Body fields vary by platform but the common shape is:
 *   { platform, text, imageUrl?, videoUrl?, title?, subreddit?, authorId? }
 */
async function handlePublishNow(body) {
  const { tenantId, platform, text, imageUrl, videoUrl, title,
          subreddit, authorId, authorUrn, pageId, igUserId } = body;
  if (!platform) return errResponse("platform required");
  if (!text && !imageUrl && !videoUrl) return errResponse("text, imageUrl, or videoUrl required");

  const payload = {
    platform:         platform.toLowerCase(),
    text:             text || null,
    image_url:        imageUrl || null,
    video_url:        videoUrl || null,
    title:            title   || null,
    subreddit:        subreddit || null,
    author_id:        authorId || authorUrn || pageId || igUserId || null,
  };

  const data = await zernioFetch("/posts/publish", {
    method: "POST",
    body: JSON.stringify(payload),
  }, tenantId);

  return jsonResponse({
    ok:      true,
    postId:  data.post_id   || data.id      || null,
    postUrl: data.post_url  || data.url      || null,
    raw:     data,
  });
}

/**
 * schedule_post
 * Hand scheduling entirely to Zernio — no FlowOS cron needed for social.
 */
async function handleSchedulePost(body) {
  const { tenantId, platform, text, imageUrl, videoUrl, title,
          subreddit, authorId, authorUrn, pageId, igUserId, scheduledAt } = body;
  if (!platform)    return errResponse("platform required");
  if (!scheduledAt) return errResponse("scheduledAt (ISO 8601 UTC) required");

  const payload = {
    platform:         platform.toLowerCase(),
    text:             text     || null,
    image_url:        imageUrl || null,
    video_url:        videoUrl || null,
    title:            title    || null,
    subreddit:        subreddit || null,
    author_id:        authorId || authorUrn || pageId || igUserId || null,
    scheduled_at:     scheduledAt,
  };

  const data = await zernioFetch("/posts/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  }, tenantId);

  return jsonResponse({
    ok:          true,
    scheduleId:  data.schedule_id || data.id || null,
    scheduledAt: data.scheduled_at || scheduledAt,
    platform,
  });
}

/**
 * get_analytics
 * Impressions, reach, engagement rate, follower count for a platform.
 */
async function handleGetAnalytics({ tenantId, platform, period = "30d" }) {
  if (!platform) return errResponse("platform required");

  const data = await zernioFetch(
    `/analytics?platform=${encodeURIComponent(platform)}&period=${encodeURIComponent(period)}`,
    { method: "GET" },
    tenantId,
  );

  return jsonResponse({ ok: true, platform, period, analytics: data });
}

/**
 * get_dms
 * Unified DM inbox for a platform.
 */
async function handleGetDms({ tenantId, platform, limit = 50, cursor }) {
  if (!platform) return errResponse("platform required");

  const qs = new URLSearchParams({ platform, limit: String(limit) });
  if (cursor) qs.set("cursor", cursor);

  const data = await zernioFetch(`/messages/dms?${qs}`, { method: "GET" }, tenantId);

  return jsonResponse({ ok: true, platform, messages: data.messages || data.dms || [], nextCursor: data.next_cursor || null });
}

/**
 * get_comments
 * Unified comments for a platform (optionally filtered by post).
 */
async function handleGetComments({ tenantId, platform, postId, limit = 50, cursor }) {
  if (!platform) return errResponse("platform required");

  const qs = new URLSearchParams({ platform, limit: String(limit) });
  if (postId) qs.set("post_id", postId);
  if (cursor) qs.set("cursor", cursor);

  const data = await zernioFetch(`/comments?${qs}`, { method: "GET" }, tenantId);

  return jsonResponse({ ok: true, platform, comments: data.comments || [], nextCursor: data.next_cursor || null });
}

/**
 * boost_post
 * Submit a paid social / ads boost request via Zernio.
 */
async function handleBoostPost({ tenantId, platform, postId, budgetUsd, durationDays, targetAudience }) {
  if (!platform) return errResponse("platform required");
  if (!postId)   return errResponse("postId required");
  if (!budgetUsd) return errResponse("budgetUsd required");

  const data = await zernioFetch("/ads/boost", {
    method: "POST",
    body: JSON.stringify({
      platform,
      post_id:         postId,
      budget_usd:      budgetUsd,
      duration_days:   durationDays || 7,
      target_audience: targetAudience || null,
    }),
  }, tenantId);

  return jsonResponse({ ok: true, boostId: data.boost_id || data.id || null, platform, raw: data });
}

/**
 * resolve_authors
 * Returns normalized author/page list for platforms that support multiple
 * publishing identities (LinkedIn, Facebook, Instagram).
 * Replaces the per-platform resolve_author / resolve_pages / resolve_accounts actions.
 */
async function handleResolveAuthors({ tenantId, platform }) {
  if (!platform) return errResponse("platform required");

  const data = await zernioFetch(
    `/accounts/authors?platform=${encodeURIComponent(platform)}`,
    { method: "GET" },
    tenantId,
  );

  const raw = data.authors || data.pages || data.accounts || [];
  const authors = raw.map(a => ({
    urn:  a.id || a.urn,
    name: a.name || a.handle || null,
    kind: a.kind || a.type || "page",
    extra: a.extra || {},
  }));

  return jsonResponse({ ok: true, platform, authors });
}

/**
 * reply_comment
 * Reply to a comment on a platform via Zernio.
 * Endpoint inferred from existing /comments path; confirmed at runtime.
 */
async function handleReplyComment({ tenantId, platform, commentId, text }) {
  if (!platform) return errResponse("platform required");
  if (!commentId) return errResponse("comment_id required");
  if (!text) return errResponse("text required");

  const data = await zernioFetch("/comments/reply", {
    method: "POST",
    body: JSON.stringify({
      platform: platform.toLowerCase(),
      comment_id: commentId,
      text,
    }),
  }, tenantId);

  return jsonResponse({ ok: true, replyId: data.reply_id || data.id || null, raw: data });
}

/**
 * reply_dm
 * Reply to a DM conversation on a platform via Zernio.
 * Endpoint inferred from existing /messages path; confirmed at runtime.
 */
async function handleReplyDm({ tenantId, platform, conversationId, text }) {
  if (!platform) return errResponse("platform required");
  if (!conversationId) return errResponse("conversation_id required");
  if (!text) return errResponse("text required");

  const data = await zernioFetch("/messages/reply", {
    method: "POST",
    body: JSON.stringify({
      platform: platform.toLowerCase(),
      conversation_id: conversationId,
      text,
    }),
  }, tenantId);

  return jsonResponse({ ok: true, replyId: data.reply_id || data.id || null, raw: data });
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return errResponse("POST required", 405);

  // publish_now and schedule_post support dual-auth (user JWT or cron secret)
  // so the cron can fire scheduled social posts via Zernio.
  let body;
  try { body = await req.json(); } catch { return errResponse("Invalid JSON body", 400); }

  const { action } = body;
  const dualAuthActions = new Set(["publish_now", "schedule_post"]);

  let tenantId;
  if (dualAuthActions.has(action)) {
    const auth = await requireAuthOrCron(req, body.tenantId);
    if (auth instanceof Response) return auth;
    tenantId = auth.tenantId;
  } else {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;
    tenantId = auth.tenantId;
  }

  // Override tenantId from verified auth — never trust client-supplied value.
  body = { ...body, tenantId };

  try {
    switch (action) {
      case "initiate_connection":  return await handleInitiateConnection(body);
      case "connection_status":    return await handleConnectionStatus(body);
      case "disconnect":           return await handleDisconnect(body);
      case "publish_now":          return await handlePublishNow(body);
      case "schedule_post":        return await handleSchedulePost(body);
      case "get_analytics":        return await handleGetAnalytics(body);
      case "get_dms":              return await handleGetDms(body);
      case "get_comments":         return await handleGetComments(body);
      case "boost_post":           return await handleBoostPost(body);
      case "resolve_authors":      return await handleResolveAuthors(body);
      case "reply_comment":        return await handleReplyComment(body);
      case "reply_dm":             return await handleReplyDm(body);
      default:
        return errResponse(
          `Unknown action "${action}". Supported: initiate_connection, connection_status, disconnect, ` +
          `publish_now, schedule_post, get_analytics, get_dms, get_comments, boost_post, resolve_authors, ` +
          `reply_comment, reply_dm`,
        );
    }
  } catch (e) {
    console.error("[zernio]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(`Zernio error: ${e.message}`, status);
  }
}
