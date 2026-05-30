// FlowOS Reach — Reddit posting via Zernio
// Thin proxy to /api/zernio for backward compat with workspaces3.jsx publish drawers
// and /api/cron/fire-scheduled PLATFORM_ROUTES.
//
// Actions:
//   search_subreddits → searches Reddit posts via Zernio /v1/reddit/search and
//                        extracts unique subreddits from results. Falls back to
//                        empty array when Reddit is not connected.
//   publish_now       → publish_now via Zernio (subreddit + title + text)

import { requireAuthOrCron } from "./lib/auth.js";
import { corsHeaders, corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import { zernioFetch, getZernioAccountId } from "./lib/zernioClient.js";

export const config = { runtime: "edge" };

async function forwardToZernio(req, body) {
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/zernio`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  req.headers.get("Authorization") || req.headers.get("authorization") || "",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return new Response(JSON.stringify(data), {
    status:  res.status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return errResponse("POST required", 405);

  let body;
  try { body = await req.json(); } catch { return errResponse("Invalid JSON body", 400); }

  const { tenantId: bodyTenantId } = body;
  const auth = await requireAuthOrCron(req, bodyTenantId);
  if (auth instanceof Response) return auth;
  body = { ...body, tenantId: auth.tenantId };

  const { action } = body;

  if (action === "search_subreddits") {
    return handleSearchSubreddits(body);
  }
  if (action === "publish_now") {
    return forwardToZernio(req, { ...body, platform: "reddit" });
  }

  return errResponse(`Unknown action: ${action}. Supported: search_subreddits, publish_now`);
}

// ─── Subreddit search ────────────────────────────────────────────────────────
// Zernio's /v1/reddit/search searches posts, not subreddits. We extract unique
// subreddits from the post results and map them to the shape the UI expects.

async function handleSearchSubreddits(body) {
  const { tenantId, query } = body;
  if (!query || typeof query !== "string" || !query.trim()) {
    return jsonResponse({ ok: true, subreddits: [] });
  }

  const accountId = await getZernioAccountId(tenantId, "reddit");
  if (!accountId) {
    return jsonResponse({ ok: true, subreddits: [] });
  }

  try {
    const params = new URLSearchParams({
      accountId,
      q: query.trim(),
      limit: "25",
      sort: "relevance",
    });
    const data = await zernioFetch(`/reddit/search?${params}`, { method: "GET" });
    const items = data?.items || [];

    const seen = new Map();
    for (const item of items) {
      const name = item.subreddit;
      if (!name || seen.has(name)) continue;
      seen.set(name, {
        name,
        description: item.selftext
          ? item.selftext.slice(0, 120)
          : "",
        over18: !!item.over18,
      });
    }

    return jsonResponse({ ok: true, subreddits: Array.from(seen.values()) });
  } catch (e) {
    console.error("[reddit] search_subreddits failed:", e.message);
    return jsonResponse({ ok: true, subreddits: [] });
  }
}
