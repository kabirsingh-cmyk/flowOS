/**
 * FlowOS — Microsoft Advertising OAuth (Azure AD v2.0)
 * Vercel Edge Function: GET /api/msads-auth
 *
 * Three modes on one route, selected by query string:
 *
 *   GET ?init=1&tenantId=<uuid>
 *     → { ok, authorizeUrl } — frontend window.open()s this and starts polling.
 *
 *   GET ?code=<authcode>&state=<signed>
 *     → exchanges the code for access_token + refresh_token, persists via
 *       saveOAuthCredential, redirects the browser to
 *       /oauth-callback.html?direct_connected=msads. The opener picks the
 *       postMessage up (or the polling loop catches it).
 *
 *   GET ?status=1&tenantId=<uuid>
 *     → { connected: bool, expiresAt? } — read used by the frontend polling
 *       loop (parallels the Composio connection_status action).
 *
 * Azure AD's v2.0 endpoint is multi-tenant (`/common/`) — Microsoft Ads
 * accepts work, school, and personal MSAs that have an Ads account attached.
 * Scope `https://ads.microsoft.com/msads.manage` grants Bing Ads API access;
 * `offline_access` is what unlocks the refresh_token in the response.
 *
 * Env (set on Vercel):
 *   MS_ADS_CLIENT_ID         — Azure AD app registration App (client) ID
 *   MS_ADS_CLIENT_SECRET     — client secret from the same registration
 *   MS_ADS_DEVELOPER_TOKEN   — required for live API calls, not for OAuth itself,
 *                              but stored alongside so downstream callers can
 *                              forge the `DeveloperToken` header.
 *
 * Note: the developer token isn't part of OAuth — Microsoft Ads requires
 * `DeveloperToken: <token>` on every Bing Ads API request in addition to the
 * Bearer access token. We stash it in the persisted tokens bag so /api/msads
 * callers don't have to reach back into env.
 */

import {
  saveOAuthCredential,
  loadOAuthCredential,
  signOAuthState,
  verifyOAuthState,
  json,
  err,
  CORS,
} from "./lib/directCredentials.js";

export const config = { runtime: "edge" };

const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL     = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const SCOPE         = "https://ads.microsoft.com/msads.manage offline_access";
const PLATFORM      = "msads";

function callbackUrlFromReq(req) {
  // Re-uses the request origin so previews + prod don't need separate env vars.
  // Azure AD requires this URL to be pre-registered in the app's "Redirect URIs".
  const url = new URL(req.url);
  return `${url.origin}/api/msads-auth`;
}

function appRedirectUrl(req, params) {
  const url = new URL(req.url);
  const dest = new URL("/oauth-callback.html", url.origin);
  dest.searchParams.set("direct_connected", PLATFORM);
  for (const [k, v] of Object.entries(params || {})) dest.searchParams.set(k, v);
  return dest.toString();
}

async function handleInit(req) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId");
  if (!tenantId) return err("tenantId required");
  if (!process.env.MS_ADS_CLIENT_ID || !process.env.MS_ADS_CLIENT_SECRET) {
    return err("Microsoft Ads OAuth not configured (MS_ADS_CLIENT_ID / MS_ADS_CLIENT_SECRET missing)", 500);
  }

  const state = await signOAuthState({ tenantId, platform: PLATFORM, n: crypto.randomUUID() });
  const authorizeUrl = new URL(AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id",     process.env.MS_ADS_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri",  callbackUrlFromReq(req));
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope",         SCOPE);
  authorizeUrl.searchParams.set("state",         state);
  authorizeUrl.searchParams.set("prompt",        "select_account");
  return json({ ok: true, authorizeUrl: authorizeUrl.toString() });
}

async function exchangeCode({ code, redirectUri }) {
  const form = new URLSearchParams({
    client_id:     process.env.MS_ADS_CLIENT_ID,
    client_secret: process.env.MS_ADS_CLIENT_SECRET,
    grant_type:    "authorization_code",
    code,
    redirect_uri:  redirectUri,
    scope:         SCOPE,
  });
  const res = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
    body:    form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Azure token exchange failed (${res.status}): ${data.error_description || data.error || JSON.stringify(data).slice(0, 200)}`);
  }
  return data;
}

async function handleCallback(req) {
  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return Response.redirect(appRedirectUrl(req, { ok: "0", error: oauthError }), 302);
  }

  let payload;
  try { payload = await verifyOAuthState(state); }
  catch (e) { return err(`Invalid OAuth state: ${e.message}`, 400); }
  if (payload.platform !== PLATFORM) return err("State platform mismatch", 400);

  let tok;
  try {
    tok = await exchangeCode({ code, redirectUri: callbackUrlFromReq(req) });
  } catch (e) {
    return Response.redirect(appRedirectUrl(req, { ok: "0", error: e.message.slice(0, 160) }), 302);
  }

  const expiresAt = Date.now() + (Number(tok.expires_in || 3600) * 1000);
  await saveOAuthCredential({
    tenantId: payload.tenantId,
    platform: PLATFORM,
    tokens: {
      access_token:    tok.access_token,
      refresh_token:   tok.refresh_token,
      expires_at:      expiresAt,
      scope:           tok.scope || SCOPE,
      token_type:      tok.token_type || "Bearer",
      developer_token: process.env.MS_ADS_DEVELOPER_TOKEN || null,
    },
    note: "OAuth connected · Microsoft Ads",
  });

  return Response.redirect(appRedirectUrl(req, { ok: "1" }), 302);
}

async function handleStatus(req) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId");
  if (!tenantId) return err("tenantId required");
  const tokens = await loadOAuthCredential({ tenantId, platform: PLATFORM });
  return json({ connected: !!tokens?.access_token, expiresAt: tokens?.expires_at || null });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET")     return err("GET required", 405);

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("init"))    return handleInit(req);
    if (url.searchParams.get("status"))  return handleStatus(req);
    if (url.searchParams.get("code"))    return handleCallback(req);
    return err("Specify ?init=1, ?status=1, or provide ?code= on the OAuth callback");
  } catch (e) {
    console.error("[msads-auth]", e);
    return err(`Microsoft Ads OAuth error: ${e.message}`, 502);
  }
}
