// FlowOS — Reddit posting via Zernio
// Thin proxy to /api/zernio for backward compat with workspaces3.jsx publish drawers
// and /api/cron/fire-scheduled PLATFORM_ROUTES.
//
// Actions:
//   search_subreddits → not forwarded to Zernio (Zernio handles this client-side);
//                       kept for backward compat — returns empty results with a hint.
//   publish_now       → publish_now via Zernio (subreddit + title + text)

import { requireAuthOrCron } from "./lib/auth.js";
import { corsHeaders, corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";

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
    // Subreddit search is now handled via Zernio's community discovery API.
    // The UI renders a free-text input so this stub keeps things working while
    // a future iteration wires the Zernio endpoint.
    return jsonResponse({ ok: true, subreddits: [] });
  }
  if (action === "publish_now") {
    return forwardToZernio(req, { ...body, platform: "reddit" });
  }

  return errResponse(`Unknown action: ${action}. Supported: search_subreddits, publish_now`);
}
