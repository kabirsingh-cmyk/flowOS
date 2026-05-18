/**
 * FlowOS — Microsoft Advertising connector (Direct API, per-tenant OAuth)
 * Vercel Edge Function: POST /api/msads
 *
 * Actions:
 *   disconnect — wipe stored OAuth tokens + flip channels to disconnected.
 *                Note: Azure AD doesn't expose a synchronous revoke; the
 *                refresh token simply stops being usable after we drop it,
 *                and the access token expires within an hour.
 *   refresh    — force a token refresh (callers usually rely on at-read
 *                refresh in loadOAuthCredential — exposed here for ops).
 *
 * The OAuth initiate / callback / status surface lives in /api/msads-auth.js.
 */

import {
  deleteCredential,
  loadOAuthCredential,
  saveOAuthCredential,
  json,
  err,
  CORS,
} from "./lib/directCredentials.js";

export const config = { runtime: "edge" };

const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const SCOPE     = "https://ads.microsoft.com/msads.manage offline_access";
const PLATFORM  = "msads";

async function refreshAccessToken(tokens) {
  if (!tokens?.refresh_token) throw new Error("No refresh_token on stored credential");
  if (!process.env.MS_ADS_CLIENT_ID || !process.env.MS_ADS_CLIENT_SECRET) {
    throw new Error("MS_ADS_CLIENT_ID / MS_ADS_CLIENT_SECRET missing");
  }
  const form = new URLSearchParams({
    client_id:     process.env.MS_ADS_CLIENT_ID,
    client_secret: process.env.MS_ADS_CLIENT_SECRET,
    grant_type:    "refresh_token",
    refresh_token: tokens.refresh_token,
    scope:         SCOPE,
  });
  const res = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
    body:    form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Azure refresh failed (${res.status}): ${data.error_description || data.error || "unknown"}`);
  }
  return {
    access_token:    data.access_token,
    refresh_token:   data.refresh_token || tokens.refresh_token,
    expires_at:      Date.now() + (Number(data.expires_in || 3600) * 1000),
    scope:           data.scope || tokens.scope || SCOPE,
    token_type:      data.token_type || "Bearer",
    developer_token: tokens.developer_token || process.env.MS_ADS_DEVELOPER_TOKEN || null,
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
    console.error("[msads]", e);
    return err(`Microsoft Ads error: ${e.message}`, 502);
  }
}
