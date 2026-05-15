// FlowOS — Google Ads OAuth2 callback
//
// Flow:
//   1. User clicks "Connect Google Ads" in Connections workspace.
//   2. Frontend POSTs to `/api/google-ads-auth?action=connect` with the user
//      JWT (requireAuth resolves the tenantId server-side). We HMAC-sign
//      { tenantId, nonce, exp } with OAUTH_STATE_SECRET and put the signed
//      blob in the OAuth `state` param. The frontend then redirects to the
//      returned authUrl.
//   3. Google redirects back to /api/google-ads-auth?code=...&state=<signed>.
//      We verify the HMAC and check exp (10-min TTL). If valid, the
//      tenantId comes from the *signed* payload — never trusted from the
//      raw URL.
//   4. Exchange code → tokens, store in Supabase google_ads_tokens.
//   5. Redirect back to the app with ?connected=googleads.
//
// Why HMAC state and not just `state=tenantId`?
//   Without it, anyone could craft a callback URL pointing back at our
//   redirect URI with `state=<victim tenantId>` and a `code` they obtained
//   themselves — and our handler would happily store their tokens under the
//   victim's row. HMAC binds the state to a value we signed at connect time.
//
// Required env vars:
//   GOOGLE_ADS_CLIENT_ID
//   GOOGLE_ADS_CLIENT_SECRET
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY
//   OAUTH_STATE_SECRET  — any high-entropy string; signs OAuth state blobs

import { requireAuth, signState, verifyState } from "./lib/auth.js";

export const config = { runtime: "edge" };

const TOKEN_URL  = "https://oauth2.googleapis.com/token";
const ADS_API    = "https://googleads.googleapis.com/v18";
const APP_ORIGIN = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const STATE_TTL_SECONDS = 10 * 60; // 10-minute window between consent and callback

// Google Ads scopes needed for full campaign management
const SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function buildAuthUrl(state, redirectUri) {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_ADS_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code, redirectUri) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data;
}

async function fetchCustomerId(accessToken) {
  const res = await fetch(`${ADS_API}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization:      `Bearer ${accessToken}`,
      "developer-token":  process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to fetch customer IDs: ${JSON.stringify(data.error)}`);
  const resourceNames = data.resourceNames || [];
  if (!resourceNames.length) throw new Error("No accessible Google Ads accounts found for this Google account.");
  return resourceNames.map(n => n.replace("customers/", ""));
}

async function storeTokens(tenantId, refreshToken, customerIds) {
  const payload = {
    tenant_id:     tenantId,
    refresh_token: refreshToken,
    customer_id:   customerIds[0],
    all_customer_ids: customerIds,
    updated_at:    new Date().toISOString(),
  };
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/google_ads_tokens`, {
    method: "POST",
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type":       "application/json",
      "Prefer":      "resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upsert failed: ${err}`);
  }
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

export default async function handler(req) {
  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

  const stateSecret = process.env.OAUTH_STATE_SECRET;
  if (!stateSecret) {
    return new Response(JSON.stringify({ error: "OAUTH_STATE_SECRET not configured" }), { status: 500 });
  }

  // ── connect: mint a signed state blob and return the OAuth consent URL ───
  // Authenticated — tenantId comes from the JWT, never from the URL.
  if (req.method === "GET" && action === "connect") {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;

    const now   = Math.floor(Date.now() / 1000);
    const state = await signState(
      { tenantId: auth.tenantId, nonce: randomNonce(), exp: now + STATE_TTL_SECONDS },
      stateSecret,
    );
    const redirectUri = `${APP_ORIGIN}/api/google-ads-auth`;
    const authUrl     = buildAuthUrl(state, redirectUri);
    return new Response(JSON.stringify({ authUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── callback from Google ─────────────────────────────────────────────────
  // Cannot use requireAuth here — Google does the redirect, no user JWT in
  // play. The HMAC-signed state is what gates this entry.
  if (req.method === "GET" && url.searchParams.get("code")) {
    const code  = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";
    const error = url.searchParams.get("error");

    if (error) {
      return Response.redirect(`${APP_ORIGIN}/?error=google_ads_denied`, 302);
    }

    let payload;
    try {
      payload = await verifyState(state, stateSecret);
    } catch (e) {
      console.error("[google-ads-auth] state verify failed:", e.message);
      return Response.redirect(`${APP_ORIGIN}/?error=google_ads_state_invalid`, 302);
    }
    const tenantId = payload.tenantId;
    if (!tenantId) {
      return Response.redirect(`${APP_ORIGIN}/?error=google_ads_state_no_tenant`, 302);
    }

    try {
      const redirectUri = `${APP_ORIGIN}/api/google-ads-auth`;
      const tokens      = await exchangeCode(code, redirectUri);
      const customerIds = await fetchCustomerId(tokens.access_token);
      await storeTokens(tenantId, tokens.refresh_token, customerIds);

      const successUrl = customerIds.length > 1
        ? `${APP_ORIGIN}/?connected=googleads&pick_account=1&customers=${customerIds.join(",")}`
        : `${APP_ORIGIN}/?connected=googleads`;
      return Response.redirect(successUrl, 302);
    } catch (err) {
      console.error("[google-ads-auth]", err);
      return Response.redirect(`${APP_ORIGIN}/?error=google_ads_auth_failed&msg=${encodeURIComponent(err.message)}`, 302);
    }
  }

  // ── POST — set active customer ID after the user picks from multiple ─────
  if (req.method === "POST") {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;
    const { customerId } = await req.json();
    if (!customerId) {
      return new Response(JSON.stringify({ error: "customerId required" }), { status: 400 });
    }
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/google_ads_tokens?tenant_id=eq.${encodeURIComponent(auth.tenantId)}`,
      {
        method: "PATCH",
        headers: {
          apikey:        process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customer_id: customerId }),
      },
    );
    if (!res.ok) return new Response(JSON.stringify({ error: "Update failed" }), { status: 500 });
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response("Not found", { status: 404 });
}
