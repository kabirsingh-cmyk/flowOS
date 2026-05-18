/**
 * FlowOS — Attentive OAuth (partner app)
 * Vercel Edge Function: GET /api/attentive-auth
 *
 * Modes (single route):
 *   GET ?init=1&tenantId=<uuid>             → { ok, authorizeUrl }
 *   GET ?code=<authcode>&state=<signed>     → exchange + persist + redirect
 *                                             to /oauth-callback.html?direct_connected=attentive
 *   GET ?status=1&tenantId=<uuid>           → { connected, expiresAt }
 *
 * Attentive's OAuth flow:
 *   Authorize: https://ui.attentivemobile.com/oauth/authorize
 *   Token:     POST https://api.attentivemobile.com/v1/authorization-codes
 *              JSON body: { authorization_code, client_id, client_secret, redirect_uri }
 *              Returns:   { access_token, refresh_token?, expires_in, scope, token_type }
 *
 * Attentive issues access tokens that callers send as `Authorization: Bearer
 * <access_token>` against api.attentivemobile.com endpoints (subscribers,
 * campaigns, events, etc.). Public-partner apps are typically issued
 * long-lived tokens without refresh; if a refresh token is returned the
 * loadOAuthCredential auto-refresh path kicks in via /api/attentive's
 * refresh action.
 *
 * Env (set on Vercel):
 *   ATTENTIVE_CLIENT_ID
 *   ATTENTIVE_CLIENT_SECRET
 *   ATTENTIVE_SCOPES            (optional — defaults to a read+write bundle)
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

const AUTHORIZE_URL = "https://ui.attentivemobile.com/oauth/authorize";
const TOKEN_URL     = "https://api.attentivemobile.com/v1/authorization-codes";
const DEFAULT_SCOPE = "subscribers:read subscribers:write campaigns:write attributes:read messages:read";
const PLATFORM      = "attentive";

function callbackUrlFromReq(req) {
  const url = new URL(req.url);
  return `${url.origin}/api/attentive-auth`;
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
  if (!process.env.ATTENTIVE_CLIENT_ID || !process.env.ATTENTIVE_CLIENT_SECRET) {
    return err("Attentive OAuth not configured (ATTENTIVE_CLIENT_ID / ATTENTIVE_CLIENT_SECRET missing). Apply for a partner app at developers.attentivemobile.com.", 500);
  }

  const state = await signOAuthState({ tenantId, platform: PLATFORM, n: crypto.randomUUID() });
  const authorizeUrl = new URL(AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id",     process.env.ATTENTIVE_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri",  callbackUrlFromReq(req));
  authorizeUrl.searchParams.set("scope",         process.env.ATTENTIVE_SCOPES || DEFAULT_SCOPE);
  authorizeUrl.searchParams.set("state",         state);
  return json({ ok: true, authorizeUrl: authorizeUrl.toString() });
}

async function exchangeCode({ code, redirectUri }) {
  const res = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body:    JSON.stringify({
      authorization_code: code,
      client_id:          process.env.ATTENTIVE_CLIENT_ID,
      client_secret:      process.env.ATTENTIVE_CLIENT_SECRET,
      redirect_uri:       redirectUri,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Attentive token exchange failed (${res.status}): ${data?.error || data?.message || JSON.stringify(data).slice(0, 200)}`);
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

  // Attentive may return expires_in (seconds) or omit it for long-lived tokens.
  // Treat missing/zero as "never" by leaving expires_at at 0 — loadOAuthCredential
  // skips the refresh check when expires_at is falsy.
  const expiresAt = tok.expires_in ? Date.now() + (Number(tok.expires_in) * 1000) : 0;
  await saveOAuthCredential({
    tenantId: payload.tenantId,
    platform: PLATFORM,
    tokens: {
      access_token:  tok.access_token,
      refresh_token: tok.refresh_token || null,
      expires_at:    expiresAt,
      scope:         tok.scope || process.env.ATTENTIVE_SCOPES || DEFAULT_SCOPE,
      token_type:    tok.token_type || "Bearer",
    },
    note: "OAuth connected · Attentive",
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
    if (url.searchParams.get("init"))   return handleInit(req);
    if (url.searchParams.get("status")) return handleStatus(req);
    if (url.searchParams.get("code"))   return handleCallback(req);
    return err("Specify ?init=1, ?status=1, or provide ?code= on the OAuth callback");
  } catch (e) {
    console.error("[attentive-auth]", e);
    return err(`Attentive OAuth error: ${e.message}`, 502);
  }
}
