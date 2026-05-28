/**
 * FlowOS Reach — Zernio Publishing actions (Phase 1)
 * Vercel Edge Function: POST /api/zernio-publish
 *
 * Companion to api/zernio.js. Covers the post-lifecycle actions Zernio added
 * after the original integration: edit, unpublish, retry, plus metadata,
 * bulk-upload, validators, and queue-slot reads.
 *
 * Auth: user JWT only (requireAuth). tenantId comes from the verified JWT.
 *
 * Actions (each returns { ok: true, ... } or errResponse):
 *   edit_post              — POST   /v1/posts/{postId}/edit
 *   unpublish_post         — POST   /v1/posts/{postId}/unpublish
 *   retry_post             — POST   /v1/posts/{postId}/retry
 *   update_metadata        — POST   /v1/posts/{postId}/update-metadata
 *   bulk_upload            — POST   /v1/posts/bulk-upload
 *   validate_post_length   — POST   /v1/tools/validate/post-length
 *   validate_post          — POST   /v1/tools/validate/post
 *   validate_media         — POST   /v1/tools/validate/media
 *   validate_subreddit     — POST   /v1/tools/validate/subreddit
 *   queue_slots            — GET    /v1/queue/slots
 *   queue_next_slot        — GET    /v1/queue/next-slot
 *   queue_preview          — GET    /v1/queue/preview
 *
 */

import { requireAuth } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import {
  zernioFetch, zernioHeaders, ZERNIO_BASE,
  getOrCreateZernioProfile, getZernioAccountId,
} from "./lib/zernioClient.js";
import { resolvePlatform } from "./lib/zernioMap.js";

export const config = { runtime: "edge" };

const BULK_UPLOAD_MAX = 200;

// CSV header for bulk-upload. The Zernio OpenAPI spec defines the endpoint
// as multipart/form-data but does NOT document the CSV column schema —
// these column names are best-guess inferred from the documented row-level
// error codes (unknown_profile, no_account_for_platform, schedule_time_missing).
// If Zernio rejects with "Invalid CSV", verify the column order here against
// their actual expected header.
const BULK_CSV_HEADER = ["profileId", "platform", "accountId", "scheduledAt", "content", "mediaUrls"];

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(rows) {
  const lines = [BULK_CSV_HEADER.join(",")];
  for (const row of rows) {
    lines.push(BULK_CSV_HEADER.map(col => csvEscape(row[col])).join(","));
  }
  return lines.join("\n") + "\n";
}

// ─── Action handlers ─────────────────────────────────────────────────────────

async function handleEditPost(body) {
  const { postId, platform, content } = body;
  if (!postId) return errResponse("postId required");
  if (!platform) return errResponse("platform required");
  if (typeof content !== "string" || !content.trim()) return errResponse("content required");

  // Zernio's edit endpoint is currently twitter-only (per OpenAPI spec).
  // Forward the platform the caller asked for; let Zernio reject if unsupported
  // so we don't drift from the spec when they expand it.
  const slug = resolvePlatform(platform);

  const data = await zernioFetch(
    `/posts/${encodeURIComponent(postId)}/edit`,
    {
      method: "POST",
      body:   JSON.stringify({ platform: slug, content }),
    },
  );

  return jsonResponse({
    ok:      true,
    postId:  data.id || postId,
    url:     data.url || null,
    message: data.message || null,
    raw:     data,
  });
}

async function handleUnpublishPost(body) {
  const { postId, platform } = body;
  if (!postId) return errResponse("postId required");
  if (!platform) return errResponse("platform required");

  const slug = resolvePlatform(platform);

  const data = await zernioFetch(
    `/posts/${encodeURIComponent(postId)}/unpublish`,
    {
      method: "POST",
      body:   JSON.stringify({ platform: slug }),
    },
  );

  return jsonResponse({
    ok:      Boolean(data.success ?? true),
    message: data.message || null,
    raw:     data,
  });
}

async function handleBulkUpload(body) {
  const { tenantId, posts, dryRun } = body;
  if (!Array.isArray(posts) || posts.length === 0) {
    return errResponse("posts[] required (non-empty array)");
  }
  if (posts.length > BULK_UPLOAD_MAX) {
    return errResponse(`Too many posts (${posts.length}). Max ${BULK_UPLOAD_MAX} per call.`);
  }

  const profileId = await getOrCreateZernioProfile(tenantId);

  // Resolve accountId per distinct platform once. Rows targeting an
  // unconnected platform get a synthetic error row in the response so
  // callers see exactly which rows blew up and why.
  const accountByPlatform = new Map();
  const earlyErrors = [];
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    if (!p?.platform) {
      earlyErrors.push({ rowIndex: i + 1, ok: false, errors: ["platform_required"] });
      continue;
    }
    if (typeof p.content !== "string" || !p.content.trim()) {
      earlyErrors.push({ rowIndex: i + 1, ok: false, errors: ["content_required"] });
      continue;
    }
    const slug = resolvePlatform(p.platform);
    if (!accountByPlatform.has(slug)) {
      const id = await getZernioAccountId(tenantId, slug);
      accountByPlatform.set(slug, id);
    }
    if (!accountByPlatform.get(slug)) {
      earlyErrors.push({ rowIndex: i + 1, ok: false, errors: [`no_account_for_platform:${slug}`] });
    }
  }

  // Build the CSV from rows that passed the local checks. Drop early-error
  // rows from the CSV — we'll splice their synthetic errors back in below
  // so the response covers every input row in its original order.
  const csvRows = [];
  const csvRowOriginalIndex = []; // maps csv index → original posts index
  for (let i = 0; i < posts.length; i++) {
    if (earlyErrors.find(e => e.rowIndex === i + 1)) continue;
    const p = posts[i];
    const slug = resolvePlatform(p.platform);
    const media = Array.isArray(p.media) ? p.media.join(";")
                : typeof p.media === "string" ? p.media
                : "";
    csvRows.push({
      profileId,
      platform:    slug,
      accountId:   accountByPlatform.get(slug),
      scheduledAt: p.scheduledFor || "",
      content:     p.content,
      mediaUrls:   media,
    });
    csvRowOriginalIndex.push(i);
  }

  let zernioResult = { total: 0, valid: 0, invalid: 0, results: [], warnings: [] };
  let zernioStatus = 200;

  if (csvRows.length > 0) {
    const csv = buildCsv(csvRows);
    const form = new FormData();
    form.append("file", new Blob([csv], { type: "text/csv" }), "bulk.csv");

    const { Authorization } = zernioHeaders();
    const qs = dryRun ? "?dryRun=true" : "";
    const res = await fetch(`${ZERNIO_BASE}/posts/bulk-upload${qs}`, {
      method:  "POST",
      headers: { Authorization }, // intentionally no Content-Type — FormData sets the boundary
      body:    form,
    });
    const text = await res.text();
    try { zernioResult = JSON.parse(text); } catch { zernioResult = { raw: text }; }
    zernioStatus = res.status;
    if (!res.ok && res.status !== 207) {
      const err = new Error(zernioResult?.error || `Zernio bulk-upload ${res.status}`);
      err.status = res.status;
      err.body   = zernioResult;
      throw err;
    }
  }

  // Re-attach early-error rows to results, preserving original row order.
  const mergedResults = [];
  const zResults = Array.isArray(zernioResult.results) ? zernioResult.results : [];
  for (let i = 0; i < posts.length; i++) {
    const early = earlyErrors.find(e => e.rowIndex === i + 1);
    if (early) { mergedResults.push(early); continue; }
    const csvIdx = csvRowOriginalIndex.indexOf(i);
    const zRow   = zResults[csvIdx];
    mergedResults.push(zRow ? { ...zRow, rowIndex: i + 1 } : { rowIndex: i + 1, ok: false, errors: ["no_response_for_row"] });
  }

  const valid   = mergedResults.filter(r => r.ok).length;
  const invalid = mergedResults.length - valid;

  return jsonResponse({
    ok:         invalid === 0,
    total:      mergedResults.length,
    valid,
    invalid,
    results:    mergedResults,
    warnings:   zernioResult.warnings || [],
    dryRun:     !!dryRun,
    upstreamStatus: zernioStatus,
  });
}

async function handleUpdateMetadata(body) {
  const { postId, platform, metadata } = body;
  if (!postId)   return errResponse("postId required (use \"_\" for direct video-id mode)");
  if (!platform) return errResponse("platform required");
  if (!metadata || typeof metadata !== "object") return errResponse("metadata object required");

  const slug = resolvePlatform(platform);
  const data = await zernioFetch(
    `/posts/${encodeURIComponent(postId)}/update-metadata`,
    {
      method: "POST",
      body:   JSON.stringify({ platform: slug, ...metadata }),
    },
  );
  return jsonResponse({ ok: true, raw: data });
}

async function handleValidatePostLength(body) {
  const { text, platform } = body;
  if (typeof text !== "string") return errResponse("text required");
  const data = await zernioFetch("/tools/validate/post-length", {
    method: "POST",
    body:   JSON.stringify({ text }),
  });
  let forPlatform = null;
  if (platform) {
    const slug = resolvePlatform(platform);
    forPlatform = data.platforms?.[slug] || null;
  }
  return jsonResponse({ ok: true, platforms: data.platforms || {}, forPlatform });
}

async function handleValidatePost(body) {
  const { platform, content, mediaUrls } = body;
  if (!platform) return errResponse("platform required");
  if (typeof content !== "string") return errResponse("content required");

  const slug = resolvePlatform(platform);
  const payload = {
    content,
    platforms:  [{ platform: slug }],
    ...(Array.isArray(mediaUrls) && mediaUrls.length
      ? { mediaItems: mediaUrls.map(url => ({ url })) }
      : {}),
  };
  const data = await zernioFetch("/tools/validate/post", {
    method: "POST",
    body:   JSON.stringify(payload),
  });
  return jsonResponse({
    ok:       true,
    valid:    !!data.valid,
    errors:   data.errors   || [],
    warnings: data.warnings || [],
    raw:      data,
  });
}

async function handleValidateMedia(body) {
  const { platform, mediaUrls } = body;
  if (!Array.isArray(mediaUrls) || mediaUrls.length === 0) {
    return errResponse("mediaUrls[] required");
  }
  // Zernio's endpoint validates one URL at a time; fan out client-side here
  // so the frontend can ask "are all my URLs ok?" in one call.
  const results = await Promise.all(mediaUrls.map(async (url) => {
    try {
      const data = await zernioFetch("/tools/validate/media", {
        method: "POST",
        body:   JSON.stringify({ url }),
      });
      const slug = platform ? resolvePlatform(platform) : null;
      return {
        url,
        valid:        !!data.valid,
        error:        data.error || null,
        contentType:  data.contentType || null,
        size:         data.size || null,
        type:         data.type || null,
        forPlatform:  slug ? (data.platformLimits?.[slug] || null) : null,
        raw:          data,
      };
    } catch (e) {
      return { url, valid: false, error: e.message };
    }
  }));
  return jsonResponse({ ok: true, results });
}

async function handleValidateSubreddit(body) {
  const { subreddit, accountId } = body;
  if (!subreddit) return errResponse("subreddit required");
  const qs = new URLSearchParams({ name: subreddit });
  if (accountId) qs.set("accountId", accountId);
  const data = await zernioFetch(`/tools/validate/subreddit?${qs}`, { method: "GET" });
  return jsonResponse({
    ok:        true,
    exists:    !!data.exists,
    subreddit: data.subreddit || null,
    error:     data.error || null,
  });
}

async function handleQueueSlots(body) {
  const { tenantId, queueId, all } = body;
  const profileId = await getOrCreateZernioProfile(tenantId);
  const qs = new URLSearchParams({ profileId });
  if (queueId) qs.set("queueId", queueId);
  if (all)     qs.set("all", "true");
  const data = await zernioFetch(`/queue/slots?${qs}`, { method: "GET" });
  return jsonResponse({ ok: true, ...data });
}

async function handleQueueNextSlot(body) {
  const { tenantId, queueId } = body;
  const profileId = await getOrCreateZernioProfile(tenantId);
  const qs = new URLSearchParams({ profileId });
  if (queueId) qs.set("queueId", queueId);
  const data = await zernioFetch(`/queue/next-slot?${qs}`, { method: "GET" });
  return jsonResponse({ ok: true, ...data });
}

async function handleQueuePreview(body) {
  const { tenantId, queueId, count } = body;
  const profileId = await getOrCreateZernioProfile(tenantId);
  const qs = new URLSearchParams({ profileId });
  if (queueId) qs.set("queueId", queueId);
  if (count)   qs.set("count", String(Math.min(100, Math.max(1, Number(count) || 10))));
  const data = await zernioFetch(`/queue/preview?${qs}`, { method: "GET" });
  return jsonResponse({ ok: true, profileId: data.profileId, count: data.count, slots: data.slots || [] });
}

async function handleRetryPost(body) {
  const { postId } = body;
  if (!postId) return errResponse("postId required");

  const data = await zernioFetch(
    `/posts/${encodeURIComponent(postId)}/retry`,
    { method: "POST" },
  );

  // Surface the new platform-side status so the queue can refresh accordingly.
  const post = data.post || {};
  const first = (post.platforms && post.platforms[0]) || {};
  return jsonResponse({
    ok:              true,
    status:          post.status || null,
    platformPostId:  first.platformPostId  || null,
    platformPostUrl: first.platformPostUrl || null,
    message:         data.message || null,
    raw:             data,
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return errResponse("POST required", 405);

  let body;
  try { body = await req.json(); } catch { return errResponse("Invalid JSON body", 400); }

  const VALID_ACTIONS = [
    "edit_post", "unpublish_post", "retry_post", "update_metadata",
    "bulk_upload",
    "validate_post_length", "validate_post", "validate_media", "validate_subreddit",
    "queue_slots", "queue_next_slot", "queue_preview",
  ];
  if (!VALID_ACTIONS.includes(body.action)) {
    return errResponse(`Invalid action. Supported: ${VALID_ACTIONS.join(", ")}`, 400);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  body = { ...body, tenantId: auth.tenantId };

  // Ensure the tenant has a Zernio profile — every Zernio post belongs to one.
  // We don't pass it in the request (Zernio resolves by postId + API key) but
  // this guards against attempts to act on posts before any connection exists.
  try { await getOrCreateZernioProfile(auth.tenantId); }
  catch (e) { return errResponse(`Zernio profile error: ${e.message}`, 502); }

  try {
    switch (body.action) {
      case "edit_post":      return await handleEditPost(body);
      case "unpublish_post": return await handleUnpublishPost(body);
      case "retry_post":     return await handleRetryPost(body);
      case "bulk_upload":    return await handleBulkUpload(body);
      case "update_metadata":     return await handleUpdateMetadata(body);
      case "validate_post_length":return await handleValidatePostLength(body);
      case "validate_post":       return await handleValidatePost(body);
      case "validate_media":      return await handleValidateMedia(body);
      case "validate_subreddit":  return await handleValidateSubreddit(body);
      case "queue_slots":         return await handleQueueSlots(body);
      case "queue_next_slot":     return await handleQueueNextSlot(body);
      case "queue_preview":       return await handleQueuePreview(body);
      default:
        return errResponse(`Unknown action "${body.action}"`);
    }
  } catch (e) {
    console.error("[zernio-publish]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(`Zernio error: ${e.message}`, status);
  }
}

