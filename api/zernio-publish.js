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
 * PR 1 of this branch only ships edit_post / unpublish_post / retry_post.
 * Subsequent PRs in this branch add bulk_upload, validators, and queue.
 */

import { requireAuth } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import { zernioFetch, getOrCreateZernioProfile, requireZernioAccountId } from "./lib/zernioClient.js";
import { resolvePlatform } from "./lib/zernioMap.js";

export const config = { runtime: "edge" };

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

  const VALID_ACTIONS = ["edit_post", "unpublish_post", "retry_post"];
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
      default:
        return errResponse(`Unknown action "${body.action}"`);
    }
  } catch (e) {
    console.error("[zernio-publish]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(`Zernio error: ${e.message}`, status);
  }
}

// requireZernioAccountId is imported for use by bulk_upload in PR 2 — keep the
// import here so the helper surface stays visible to future edits in this file.
void requireZernioAccountId;
