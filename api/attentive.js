/**
 * FlowOS — Attentive connector (Direct API, per-tenant OAuth)
 * Vercel Edge Function: POST /api/attentive
 *
 * Actions:
 *   disconnect — wipe stored OAuth tokens + flip channels to disconnected.
 *   refresh    — force a refresh-token exchange (no-op if the credential is
 *                long-lived without a refresh_token).
 *
 * OAuth initiate / callback / status surface lives in /api/attentive-auth.js.
 */

import {
  deleteCredential,
  loadOAuthCredential,
  json,
  err,
  CORS,
} from "./lib/directCredentials.js";

export const config = { runtime: "edge" };

const REFRESH_URL = "https://api.attentivemobile.com/v1/refresh-tokens";
const PLATFORM    = "attentive";

async function refreshAccessToken(tokens) {
  if (!tokens?.refresh_token) throw new Error("No refresh_token (Attentive may have issued a long-lived token)");
  if (!process.env.ATTENTIVE_CLIENT_ID || !process.env.ATTENTIVE_CLIENT_SECRET) {
    throw new Error("ATTENTIVE_CLIENT_ID / ATTENTIVE_CLIENT_SECRET missing");
  }
  const res = await fetch(REFRESH_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body:    JSON.stringify({
      refresh_token: tokens.refresh_token,
      client_id:     process.env.ATTENTIVE_CLIENT_ID,
      client_secret: process.env.ATTENTIVE_CLIENT_SECRET,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Attentive refresh failed (${res.status}): ${data?.error || data?.message || "unknown"}`);
  }
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at:    data.expires_in ? Date.now() + (Number(data.expires_in) * 1000) : 0,
    scope:         data.scope || tokens.scope,
    token_type:    data.token_type || tokens.token_type || "Bearer",
  };
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: PLATFORM });
  return json({ ok: true });
}

async function handleRefresh({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  const tokens = await loadOAuthCredential({ tenantId, platform: PLATFORM, refresh: refreshAccessToken });
  if (!tokens) return err("No stored credential", 404);
  return json({ ok: true, expiresAt: tokens.expires_at });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return err("POST required", 405);

  let body;
  try { body = await req.json(); }
  catch { return err("Invalid JSON body", 400); }

  try {
    switch (body.action) {
      case "disconnect": return handleDisconnect(body);
      case "refresh":    return handleRefresh(body);
      default:
        return err(`Unknown action "${body.action}". Supported: disconnect, refresh`);
    }
  } catch (e) {
    console.error("[attentive]", e);
    return err(`Attentive error: ${e.message}`, 502);
  }
}
