/**
 * FlowOS Reach — Zernio Platform Actions
 * Vercel Edge Function: POST /api/zernio-platform
 *
 * Platform-specific actions that don't fit the generic analytics or publish
 * routes. Currently focused on Google Business Profile (GMB):
 *   - list_reviews, reply_to_review
 *   - create_post, list_posts
 *
 * All actions require user JWT auth.
 */

import { requireAuth } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import { zernioFetch, requireZernioAccountId } from "./lib/zernioClient.js";

export const config = { runtime: "edge" };

const VALID_ACTIONS = [
  "list_reviews",
  "reply_to_review",
  "create_post",
  "list_posts",
];

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return errResponse("POST required", 405);

  let body;
  try { body = await req.json(); } catch { return errResponse("Invalid JSON body", 400); }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;
  body = { ...body, tenantId };

  const { action } = body;
  if (!action) return errResponse("action required", 400);
  if (!VALID_ACTIONS.includes(action)) {
    return errResponse(`Invalid action. Supported: ${VALID_ACTIONS.join(", ")}`, 400);
  }

  try {
    switch (action) {
      case "list_reviews":  return await handleListReviews(body);
      case "reply_to_review": return await handleReplyToReview(body);
      case "create_post":   return await handleCreatePost(body);
      case "list_posts":    return await handleListPosts(body);
      default: return errResponse("Unknown action", 400);
    }
  } catch (e) {
    console.error("[zernio-platform]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(`Zernio error: ${e.message}`, status);
  }
}

// ─── GMB Reviews ──────────────────────────────────────────────────────────────

async function handleListReviews(body) {
  const { tenantId, pageSize, pageToken, locationId } = body;
  const accountId = await requireZernioAccountId(tenantId, "googlebusiness");

  const params = new URLSearchParams();
  if (pageSize)  params.set("pageSize", String(pageSize));
  if (pageToken) params.set("pageToken", pageToken);
  if (locationId) params.set("locationId", locationId);

  const qs = params.toString();
  const data = await zernioFetch(`/accounts/${accountId}/gmb-reviews${qs ? "?" + qs : ""}`, { method: "GET" });
  return jsonResponse({ ok: true, data });
}

async function handleReplyToReview(body) {
  const { tenantId, reviewId, reply, locationId } = body;
  if (!reviewId) return errResponse("reviewId required", 400);
  if (!reply || typeof reply !== "string") return errResponse("reply required", 400);

  const accountId = await requireZernioAccountId(tenantId, "googlebusiness");

  const payload = { reply };
  if (locationId) payload.locationId = locationId;

  const data = await zernioFetch(`/accounts/${accountId}/gmb-reviews/${encodeURIComponent(reviewId)}/reply`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return jsonResponse({ ok: true, data });
}

// ─── GMB Posts ────────────────────────────────────────────────────────────────

async function handleCreatePost(body) {
  const { tenantId, text, topicType, event, offer, callToAction, locationId, mediaUrls } = body;
  if (!text || typeof text !== "string") return errResponse("text required", 400);

  const accountId = await requireZernioAccountId(tenantId, "googlebusiness");

  const postBody = {
    platform: "googlebusiness",
    accountIds: [accountId],
    text,
    topicType: topicType || "STANDARD",
  };

  if (event) postBody.event = event;
  if (offer) postBody.offer = offer;
  if (callToAction) postBody.callToAction = callToAction;
  if (locationId) postBody.locationId = locationId;
  if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
    postBody.media = mediaUrls.map(url => ({ type: "image", url }));
  }

  const data = await zernioFetch("/posts", {
    method: "POST",
    body: JSON.stringify(postBody),
  });
  return jsonResponse({ ok: true, data });
}

async function handleListPosts(body) {
  const { tenantId, platform, status, limit, pageToken } = body;

  // list_posts is cross-platform; if platform omitted, default to googlebusiness
  const targetPlatform = platform || "googlebusiness";

  const params = new URLSearchParams();
  params.set("platform", targetPlatform);
  if (status)   params.set("status", status);
  if (limit)    params.set("limit", String(limit));
  if (pageToken) params.set("pageToken", pageToken);

  const qs = params.toString();
  const data = await zernioFetch(`/posts?${qs}`, { method: "GET" });
  return jsonResponse({ ok: true, data });
}
