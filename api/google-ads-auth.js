// FlowOS — Google Ads OAuth2 callback
// Handles the redirect from Google after user authorizes
//
// Flow:
//   1. User clicks "Connect Google Ads" in Connections workspace
//   2. Frontend redirects to Google OAuth consent screen with ?state=tenantId
//   3. Google redirects back to /api/google-ads-auth?code=...&state=tenantId
//   4. We exchange the code for tokens and store in Supabase google_ads_tokens table
//   5. We redirect back to the app with ?connected=googleads
//
// Required env vars (same as google-ads.js):
//   GOOGLE_ADS_CLIENT_ID
//   GOOGLE_ADS_CLIENT_SECRET
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY

export const config = { runtime: "edge" };

const TOKEN_URL  = "https://oauth2.googleapis.com/token";
const ADS_API    = "https://googleads.googleapis.com/v18";
const APP_ORIGIN = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

// Google Ads scopes needed for full campaign management
const SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// Build the Google OAuth2 consent URL (called by the frontend)
function buildAuthUrl(tenantId, redirectUri) {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_ADS_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",  // request refresh token
    prompt:        "consent",  // always show consent to ensure refresh_token
    state:         tenantId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Exchange authorization code for tokens
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
  return data; // { access_token, refresh_token, expires_in, scope, token_type }
}

// Fetch the Google Ads Customer ID for this account
// Returns the first accessible customer (manager account users may have multiple)
async function fetchCustomerId(accessToken) {
  const res = await fetch(`${ADS_API}/customers:listAccessibleCustomers`, {
    headers: {
      Authorization:      `Bearer ${accessToken}`,
      "developer-token":  process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to fetch customer IDs: ${JSON.stringify(data.error)}`);

  // data.resourceNames = ["customers/1234567890", ...]
  const resourceNames = data.resourceNames || [];
  if (!resourceNames.length) throw new Error("No accessible Google Ads accounts found for this Google account.");

  // Return all customer IDs — the frontend can let the user pick if there are multiple
  return resourceNames.map(n => n.replace("customers/", ""));
}

// Upsert tokens to Supabase
async function storeTokens(tenantId, refreshToken, customerIds) {
  // Store the first customer ID as default; all IDs in a separate column
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

export default async function handler(req) {
  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

  // ── GET /api/google-ads-auth?action=connect&tenantId=... ─────────────────
  // Returns the Google OAuth consent URL for the frontend to redirect to
  if (req.method === "GET" && action === "connect") {
    const tenantId   = url.searchParams.get("tenantId");
    const redirectUri = `${APP_ORIGIN}/api/google-ads-auth`;
    const authUrl     = buildAuthUrl(tenantId, redirectUri);
    return new Response(JSON.stringify({ authUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── GET /api/google-ads-auth?code=...&state=tenantId ────────────────────
  // OAuth callback from Google
  if (req.method === "GET" && url.searchParams.get("code")) {
    const code       = url.searchParams.get("code");
    const tenantId   = url.searchParams.get("state");
    const error      = url.searchParams.get("error");

    if (error) {
      return Response.redirect(`${APP_ORIGIN}/?error=google_ads_denied`, 302);
    }

    try {
      const redirectUri = `${APP_ORIGIN}/api/google-ads-auth`;
      const tokens      = await exchangeCode(code, redirectUri);
      const customerIds = await fetchCustomerId(tokens.access_token);
      await storeTokens(tenantId, tokens.refresh_token, customerIds);

      // Redirect back to app with success flag
      const successUrl = customerIds.length > 1
        ? `${APP_ORIGIN}/?connected=googleads&pick_account=1&customers=${customerIds.join(",")}`
        : `${APP_ORIGIN}/?connected=googleads`;

      return Response.redirect(successUrl, 302);
    } catch (err) {
      console.error("[google-ads-auth]", err);
      return Response.redirect(`${APP_ORIGIN}/?error=google_ads_auth_failed&msg=${encodeURIComponent(err.message)}`, 302);
    }
  }

  // ── POST /api/google-ads-auth — set active customer ID ───────────────────
  // When user has multiple accounts and picks one from the UI
  if (req.method === "POST") {
    const { tenantId, customerId } = await req.json();
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/google_ads_tokens?tenant_id=eq.${tenantId}`, {
      method: "PATCH",
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ customer_id: customerId }),
    });
    if (!res.ok) return new Response(JSON.stringify({ error: "Update failed" }), { status: 500 });
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response("Not found", { status: 404 });
}
