// FlowOS Reach — YouTube posting via Zernio
// Thin proxy to /api/zernio. Actions: publish_now
// Note: YouTube organic publishing (Shorts, long-form) goes through Zernio.
// YouTube analytics still go through Google/Composio GA4 connector.
import { requireAuthOrCron } from "./lib/auth.js";
import { corsHeaders, corsPreflightResponse, errResponse } from "./lib/cors.js";

export const config = { runtime: "edge" };

async function forwardToZernio(req, body) {
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/zernio`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || req.headers.get("authorization") || "" },
    body:    JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return new Response(JSON.stringify(data), { status: res.status, headers: { "Content-Type": "application/json", ...corsHeaders() } });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return errResponse("POST required", 405);
  let body;
  try { body = await req.json(); } catch { return errResponse("Invalid JSON body", 400); }
  const auth = await requireAuthOrCron(req, body.tenantId);
  if (auth instanceof Response) return auth;
  body = { ...body, tenantId: auth.tenantId };
  if (body.action === "publish_now") return forwardToZernio(req, { ...body, platform: "youtube" });
  return errResponse(`Unknown action: ${body.action}. Supported: publish_now`);
}
