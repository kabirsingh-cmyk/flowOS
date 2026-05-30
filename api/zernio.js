/**
 * FlowOS Reach — Zernio social publishing connector
 * Vercel Edge Function: POST /api/zernio
 *
 * Zernio handles all 15 organic social platforms via OAuth-as-a-service.
 * https://zernio.com  |  https://docs.zernio.com
 *
 * Auth:
 *   ZERNIO_API_KEY — platform-level API key (server-side only)
 *   Header: Authorization: Bearer {key}
 *   Per-user isolation via Zernio profiles (one profile per FlowOS Reach tenant).
 *   Profiles are created on first connection and stored in
 *   connector_credentials(user_id, platform='zernio_profile').
 *
 * Supported platforms (organic social):
 *   facebook, instagram, linkedin, tiktok, pinterest, youtube,
 *   twitter (X), reddit, bluesky, threads, googlebusiness,
 *   whatsapp, telegram, snapchat, discord
 *   + FlowOS Reach short IDs: fb, ig, li, tt, pn, yt, x, gbusiness
 *
 * Supported ad platforms (connection via /v1/connect/{platform}/ads):
 *   metaads, linkedinads, tiktokads, xads, pinterestads, googleads
 *   FlowOS Reach IDs: metaads, liads→linkedinads, ttads→tiktokads, xads, pinads→pinterestads
 *   googleads→googleads (migrated from Composio 2026-05-24; actions in api/google-ads.js)
 *
 *   Paid social OAuth quirks:
 *   - Same-token platforms (metaads/liads/pinads): Zernio copies token from the organic
 *     account — returns { alreadyConnected: true, accountId } immediately, no popup.
 *   - Separate-token (ttads/xads): new OAuth round-trip, returns { authUrl }.
 *   - googleads: standalone Google Ads OAuth, returns { authUrl }.
 *
 * Actions:
 *   initiate_connection  — start OAuth flow for a tenant + platform
 *   connection_status    — poll whether OAuth completed
 *   disconnect           — revoke connection
 *   publish_now          — post immediately to a platform
 *   schedule_post        — schedule post via Zernio natively
 *   get_analytics        — platform analytics
 *   get_dms              — unified DM inbox (GET /inbox/conversations)
 *   get_comments         — unified comments inbox (GET /inbox/comments)
 *   boost_post           — paid boost via /v1/ads/boost
 *   resolve_authors      — list connected accounts / pages for a platform
 *   reply_comment        — reply to a comment (POST /inbox/comments/{postId})
 *   reply_dm             — reply to a DM (POST /inbox/conversations/{id}/messages)
 */

import { requireAuthOrCron, requireAuth } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import {
  PLATFORM_ID_MAP,        // eslint-disable-line no-unused-vars
  ZERNIO_TO_FLOWOS,       // eslint-disable-line no-unused-vars
  SUPPORTED_PLATFORMS,
  ADS_TO_ORGANIC,
  resolvePlatform,
  flowOSId,               // eslint-disable-line no-unused-vars
} from "./lib/zernioMap.js";
import {
  zernioFetch,
  getOrCreateZernioProfile,
  getCachedZernioProfile,
  getZernioAccountId,
} from "./lib/zernioClient.js";

export const config = { runtime: "edge" };

// ─── Media helper ─────────────────────────────────────────────────────────────

/**
 * buildMediaArray — normalises the three possible media inputs into a Zernio
 * `media` array.
 *
 * Priority:
 *   1. mediaUrls (string[]) — carousel or multi-image post (≥ 2 items → carousel)
 *   2. videoUrl (string)    — single video / Reel / Short
 *   3. imageUrl (string)    — single image / Post
 *
 * Each Zernio media item shape: { url: string, type: "image" | "video" }
 * For carousels Zernio expects all items in one `media` array; the platform
 * param ("instagram") tells Zernio it's a carousel when multiple image items
 * are present.
 */
function buildMediaArray({ imageUrl, videoUrl, mediaUrls }) {
  if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
    return mediaUrls.map(url => ({ url, type: "image" }));
  }
  if (videoUrl) return [{ url: videoUrl, type: "video" }];
  if (imageUrl) return [{ url: imageUrl, type: "image" }];
  return [];
}

// ─── Action handlers ──────────────────────────────────────────────────────────

/**
 * initiate_connection
 * Creates (or reuses) a Zernio profile for the tenant, returns the OAuth URL.
 *
 * Organic social:  GET /v1/connect/{platform}?profileId={id}            → { authUrl }
 * Paid social:     GET /v1/connect/{organic_platform}/ads?profileId={id} → { authUrl }
 *                  Same-token ad platforms return { alreadyConnected: true, accountId }
 *                  instead — no OAuth popup is needed in that case.
 */
async function handleInitiateConnection({ tenantId, app, redirectUri }) {
  if (!app) return errResponse("app required");
  const platform = app.toLowerCase();
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return errResponse(`Unsupported platform: ${platform}. Supported: ${[...SUPPORTED_PLATFORMS].join(", ")}`);
  }

  const profileId        = await getOrCreateZernioProfile(tenantId);
  const resolvedPlatform = resolvePlatform(platform);   // e.g. liads → linkedinads
  const qs               = new URLSearchParams({ profileId });
  if (redirectUri) qs.set("redirectUrl", redirectUri);

  // ── Paid social (ads) branch ──────────────────────────────────────────────
  const adsPlatformBase = ADS_TO_ORGANIC[resolvedPlatform];
  if (adsPlatformBase) {
    const data = await zernioFetch(`/connect/${adsPlatformBase}/ads?${qs}`, { method: "GET" });

    // Same-token platforms (Meta, LinkedIn, Pinterest): token copied from organic account.
    if (data.alreadyConnected) {
      return jsonResponse({ ok: true, mode: "already_connected", accountId: data.accountId, app });
    }

    const redirectUrl = data.authUrl || data.auth_url;
    if (!redirectUrl) {
      throw new Error(`No authUrl in Zernio ads response for ${platform}. Raw: ${JSON.stringify(data)}`);
    }
    return jsonResponse({ ok: true, mode: "oauth", redirectUrl, app });
  }

  // ── Organic social branch ─────────────────────────────────────────────────
  const data = await zernioFetch(`/connect/${resolvedPlatform}?${qs}`, { method: "GET" });

  const redirectUrl = data.authUrl || data.auth_url;
  if (!redirectUrl) {
    throw new Error(`No authUrl in Zernio response for ${platform}. Raw: ${JSON.stringify(data)}`);
  }
  return jsonResponse({ ok: true, mode: "oauth", redirectUrl, app });
}

/**
 * connection_status
 * Polls whether OAuth completed for this tenant + platform.
 * GET /v1/accounts?profileId={id}&platform={slug}
 */
async function handleConnectionStatus({ tenantId, app }) {
  if (!app) return errResponse("app required");
  const platform         = app.toLowerCase();
  const resolvedPlatform = resolvePlatform(platform);

  const profileId = await getCachedZernioProfile(tenantId);
  if (!profileId) {
    return jsonResponse({ ok: true, connected: false, accountId: null, status: "not_connected", app });
  }

  const qs   = new URLSearchParams({ profileId, platform: resolvedPlatform });
  const data = await zernioFetch(`/accounts?${qs}`, { method: "GET" });

  // Filter client-side in case Zernio ignores the query params
  const accounts = data.accounts || [];
  const account  = accounts.find(a => a.platform === resolvedPlatform);

  return jsonResponse({
    ok:        true,
    connected: !!account,
    accountId: account?._id || null,
    handle:    account?.handle || account?.username || null,
    status:    account ? "ACTIVE" : "not_connected",
    app,
  });
}

/**
 * disconnect
 * Deletes the Zernio social account connection.
 * DELETE /v1/accounts/{accountId}
 */
async function handleDisconnect({ app, accountId }) {
  if (!app)       return errResponse("app required");
  if (!accountId) return errResponse("accountId required");

  await zernioFetch(`/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
  return jsonResponse({ ok: true });
}

/**
 * publish_now
 * Posts immediately via Zernio.
 * POST /v1/posts with { content, publishNow: true, platforms: [{platform, accountId}] }
 * Loads accountId from channels table if not in body.
 */
async function handlePublishNow(body) {
  const { tenantId, platform, text, imageUrl, videoUrl, mediaUrls, title, subreddit } = body;
  if (!platform) return errResponse("platform required");
  if (!text && !imageUrl && !videoUrl && !(mediaUrls?.length)) return errResponse("text, imageUrl, videoUrl, or mediaUrls required");

  const resolvedPlatform = resolvePlatform(platform.toLowerCase());
  const accountId = body.accountId || await getZernioAccountId(tenantId, platform);
  if (!accountId) return errResponse(`No connected account found for ${platform}. Reconnect and try again.`);

  const media = buildMediaArray({ imageUrl, videoUrl, mediaUrls });
  const payload = {
    content:    text || null,
    publishNow: true,
    platforms:  [{ platform: resolvedPlatform, accountId }],
    ...(media.length ? { media } : {}),
    ...(title     ? { title }     : {}),
    ...(subreddit ? { subreddit } : {}),
  };

  const data = await zernioFetch("/posts", { method: "POST", body: JSON.stringify(payload) });

  return jsonResponse({
    ok:      true,
    postId:  data.post?._id || data.id    || null,
    postUrl: data.post?.url || data.url   || null,
    raw:     data,
  });
}

/**
 * schedule_post
 * Delegates scheduling to Zernio natively (no FlowOS Reach cron needed for social).
 * POST /v1/posts with { content, scheduledFor, timezone, platforms: [{platform, accountId}] }
 */
async function handleSchedulePost(body) {
  const { tenantId, platform, text, imageUrl, videoUrl, mediaUrls, title, subreddit, scheduledAt } = body;
  if (!platform)    return errResponse("platform required");
  if (!scheduledAt) return errResponse("scheduledAt (ISO 8601 UTC) required");

  const resolvedPlatform = resolvePlatform(platform.toLowerCase());
  const accountId = body.accountId || await getZernioAccountId(tenantId, platform);
  if (!accountId) return errResponse(`No connected account found for ${platform}. Reconnect and try again.`);

  const media = buildMediaArray({ imageUrl, videoUrl, mediaUrls });
  const payload = {
    content:      text    || null,
    scheduledFor: scheduledAt,
    timezone:     "UTC",
    platforms:    [{ platform: resolvedPlatform, accountId }],
    ...(media.length ? { media } : {}),
    ...(title     ? { title }     : {}),
    ...(subreddit ? { subreddit } : {}),
  };

  const data = await zernioFetch("/posts", { method: "POST", body: JSON.stringify(payload) });

  return jsonResponse({
    ok:          true,
    scheduleId:  data.post?._id || data.id || null,
    scheduledAt: scheduledAt,
    platform,
  });
}

/**
 * get_analytics
 * GET /v1/analytics/{platform}/{metric}
 */
async function handleGetAnalytics({ platform, period = "30d", metric = "followers" }) {
  if (!platform) return errResponse("platform required");
  const resolvedPlatform = resolvePlatform(platform.toLowerCase());

  const data = await zernioFetch(
    `/analytics/${resolvedPlatform}/${metric}?period=${encodeURIComponent(period)}`,
    { method: "GET" },
  );

  return jsonResponse({ ok: true, platform, period, analytics: data });
}

/**
 * get_dms
 * GET /v1/inbox/conversations?profileId=&platform=&accountId=&limit=&cursor=
 * Response: { data: [...], pagination: { hasMore, nextCursor } }
 */
async function handleGetDms({ tenantId, platform, limit = 50, cursor, accountId: bodyAccountId }) {
  if (!platform) return errResponse("platform required");
  const resolvedPlatform = resolvePlatform(platform.toLowerCase());

  const profileId = await getCachedZernioProfile(tenantId);
  const accountId = bodyAccountId || await getZernioAccountId(tenantId, platform);

  const qs = new URLSearchParams({ platform: resolvedPlatform, limit: String(limit) });
  if (profileId) qs.set("profileId", profileId);
  if (accountId) qs.set("accountId", accountId);
  if (cursor)    qs.set("cursor", cursor);

  const data = await zernioFetch(`/inbox/conversations?${qs}`, { method: "GET" });
  return jsonResponse({
    ok:            true,
    platform,
    conversations: data.data || [],
    nextCursor:    data.pagination?.nextCursor || null,
    hasMore:       data.pagination?.hasMore ?? false,
  });
}

/**
 * get_comments
 * With postId:    GET /v1/inbox/comments/{postId}?accountId=&limit=&cursor=
 * Without postId: GET /v1/inbox/comments?profileId=&platform=&limit=&cursor=
 * Response: { data: [...], pagination: { hasMore, nextCursor } }
 */
async function handleGetComments({ tenantId, platform, postId, limit = 50, cursor, accountId: bodyAccountId }) {
  if (!platform) return errResponse("platform required");
  const resolvedPlatform = resolvePlatform(platform.toLowerCase());

  if (postId) {
    // Per-post comments: GET /inbox/comments/{postId}
    const accountId = bodyAccountId || await getZernioAccountId(tenantId, platform);
    const qs = new URLSearchParams({ limit: String(limit) });
    if (accountId) qs.set("accountId", accountId);
    if (cursor)    qs.set("cursor", cursor);

    const data = await zernioFetch(`/inbox/comments/${encodeURIComponent(postId)}?${qs}`, { method: "GET" });
    return jsonResponse({
      ok:         true,
      platform,
      postId,
      comments:   data.data || [],
      nextCursor: data.pagination?.nextCursor || null,
      hasMore:    data.pagination?.hasMore ?? false,
    });
  }

  // Inbox-wide comments: GET /inbox/comments
  const profileId = await getCachedZernioProfile(tenantId);
  const qs = new URLSearchParams({ platform: resolvedPlatform, limit: String(limit) });
  if (profileId) qs.set("profileId", profileId);
  if (cursor)    qs.set("cursor", cursor);

  const data = await zernioFetch(`/inbox/comments?${qs}`, { method: "GET" });
  return jsonResponse({
    ok:         true,
    platform,
    comments:   data.data || [],
    nextCursor: data.pagination?.nextCursor || null,
    hasMore:    data.pagination?.hasMore ?? false,
  });
}

/**
 * boost_post
 * POST /v1/ads/boost
 */
async function handleBoostPost({ platform, postId, budgetUsd, durationDays, targetAudience }) {
  if (!platform)  return errResponse("platform required");
  if (!postId)    return errResponse("postId required");
  if (!budgetUsd) return errResponse("budgetUsd required");

  const data = await zernioFetch("/ads/boost", {
    method: "POST",
    body: JSON.stringify({
      platform:        resolvePlatform(platform.toLowerCase()),
      post_id:         postId,
      budget_usd:      budgetUsd,
      duration_days:   durationDays || 7,
      target_audience: targetAudience || null,
    }),
  });

  return jsonResponse({ ok: true, boostId: data.boost_id || data.id || null, platform, raw: data });
}

/**
 * resolve_authors
 * Returns connected accounts for a platform (pages, orgs, etc.).
 * GET /v1/accounts?profileId={id}&platform={slug}
 */
async function handleResolveAuthors({ tenantId, platform }) {
  if (!platform) return errResponse("platform required");
  const resolvedPlatform = resolvePlatform(platform.toLowerCase());

  const profileId = await getCachedZernioProfile(tenantId);
  const qs        = new URLSearchParams({ platform: resolvedPlatform });
  if (profileId) qs.set("profileId", profileId);

  const data = await zernioFetch(`/accounts?${qs}`, { method: "GET" });
  const raw  = data.accounts || [];

  const authors = raw
    .filter(a => a.platform === resolvedPlatform)
    .map(a => ({
      urn:   a._id || a.id,
      name:  a.name || a.handle || a.username || null,
      kind:  a.kind || a.type || "account",
      extra: a,
    }));

  return jsonResponse({ ok: true, platform, authors });
}

/**
 * reply_comment
 * POST /v1/inbox/comments/{postId}
 * Body per Zernio OpenAPI: { accountId, message, commentId?, parentCid?, rootUri?, rootCid? }
 *
 * Client contract is snake_case (post_id, comment_id, parent_cid, root_uri,
 * root_cid) — we rename on destructure. Previous bug: client sent snake_case
 * but handler destructured camelCase → every reply landed with undefined
 * IDs and 400'd. See docs/phase-5-engagement-scoping.md §4 R1.
 *
 * Bluesky reply fields live in the inbox row's `raw` jsonb (captured by
 * normalizeComment); workspaces3.jsx passes them through when present.
 */
async function handleReplyComment(body) {
  const {
    tenantId,
    platform,
    post_id:    postId,
    comment_id: commentId,
    parent_cid: parentCid,
    root_uri:   rootUri,
    root_cid:   rootCid,
    text,
    accountId:  bodyAccountId,
  } = body;

  if (!platform) return errResponse("platform required");
  if (!postId)   return errResponse("post_id required");
  if (!text)     return errResponse("text required");

  const accountId = bodyAccountId || await getZernioAccountId(tenantId, platform);
  if (!accountId) return errResponse(`No connected account for ${platform}. Reconnect and try again.`);

  const reqBody = { accountId, message: text };
  if (commentId) reqBody.commentId = commentId;
  if (parentCid) reqBody.parentCid = parentCid;
  if (rootUri)   reqBody.rootUri   = rootUri;
  if (rootCid)   reqBody.rootCid   = rootCid;

  const data = await zernioFetch(`/inbox/comments/${encodeURIComponent(postId)}`, {
    method: "POST",
    body:   JSON.stringify(reqBody),
  });

  return jsonResponse({
    ok:      true,
    replyId: data.data?.commentId || data.reply?._id || data.id || null,
    raw:     data,
  });
}

/**
 * reply_dm
 * POST /v1/inbox/conversations/{conversationId}/messages
 * Body: { accountId, message }
 *
 * Client contract: snake_case conversation_id (matches reply_comment scheme).
 * See R1 fix above.
 */
async function handleReplyDm(body) {
  const {
    tenantId,
    platform,
    conversation_id: conversationId,
    text,
    accountId: bodyAccountId,
  } = body;

  if (!platform)       return errResponse("platform required");
  if (!conversationId) return errResponse("conversation_id required");
  if (!text)           return errResponse("text required");

  const accountId = bodyAccountId || await getZernioAccountId(tenantId, platform);
  if (!accountId) return errResponse(`No connected account for ${platform}. Reconnect and try again.`);

  try {
    const data = await zernioFetch(
      `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        body:   JSON.stringify({ accountId, message: text }),
      },
    );
    return jsonResponse({ ok: true, messageId: data.message?._id || data.id || null, raw: data });
  } catch (e) {
    // Defensive: X DM writes require X API Pro tier ($5k/mo) for BYOK per
    // Zernio OpenAPI. If Zernio's shared key doesn't cover it, surface a
    // structured error so the UI can flip to "Requires X API Pro" badge.
    const msg = e.message || "";
    if (platform === "x" && /\b(403|tier|pro)\b/i.test(msg)) {
      return errResponse(`X_DM_PRO_TIER_REQUIRED: ${msg}`, 403);
    }
    throw e;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return errResponse("POST required", 405);

  let body;
  try { body = await req.json(); } catch { return errResponse("Invalid JSON body", 400); }

  const VALID_ACTIONS = [
    "initiate_connection", "connection_status", "disconnect",
    "publish_now", "schedule_post", "get_analytics",
    "get_dms", "get_comments", "boost_post",
    "resolve_authors", "reply_comment", "reply_dm",
  ];
  if (!VALID_ACTIONS.includes(body.action)) {
    return errResponse(
      `Invalid action. Supported: ${VALID_ACTIONS.join(", ")}`,
      400,
    );
  }
  const action = body.action;
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
          `publish_now, schedule_post, get_analytics, get_dms, get_comments, boost_post, ` +
          `resolve_authors, reply_comment, reply_dm`,
        );
    }
  } catch (e) {
    console.error("[zernio]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(`Zernio error: ${e.message}`, status);
  }
}
