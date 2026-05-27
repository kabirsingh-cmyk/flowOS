// FlowOS Reach — LinkedIn posting via Zernio
// Thin proxy to /api/zernio for backward compat with workspaces3.jsx publish drawers
// and /api/cron/fire-scheduled PLATFORM_ROUTES.
//
// Actions (same surface as before):
//   resolve_author  → resolve_authors via Zernio (returns { authors: [{urn,name,kind}] })
//   publish_now     → publish_now via Zernio

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

  if (action === "resolve_author") {
    return forwardToZernio(req, { ...body, action: "resolve_authors", platform: "linkedin" });
  }
  if (action === "publish_now") {
    return forwardToZernio(req, { ...body, platform: "linkedin" });
  }

  return errResponse(`Unknown action: ${action}. Supported: resolve_author, publish_now`);
}
