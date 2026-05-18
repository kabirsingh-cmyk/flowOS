/**
 * FlowOS — Pipedream Connect connector
 * Vercel Edge Function: POST /api/pipedream
 *
 * Pipedream Connect (api.pipedream.com/v1/connect) is Pipedream's hosted OAuth
 * + API-key product, analogous to Composio's managed auth. FlowOS calls it
 * server-side to mint short-lived Connect Tokens for end users; the user then
 * opens the returned `connect_link_url` in a popup to authorize.
 *
 * Auth model:
 *   1. Server-to-server: OAuth client_credentials grant against
 *      https://api.pipedream.com/v1/oauth/token → 1-hour Bearer access_token.
 *   2. Per-user: POST /v1/connect/{project_id}/tokens with external_user_id +
 *      app slug → returns connect_link_url for the popup.
 *
 * Actions (mirrors /api/composio actions):
 *   initiate_connection  — start Pipedream Connect flow for a tenant + app
 *   connection_status    — check whether the tenant has an active account
 *   list_connections     — all connected accounts for a tenant
 *   disconnect           — remove an account
 *   list_apps            — debug: list apps Pipedream knows about
 *   verify_app           — debug: confirm a slug resolves
 *
 * Env vars (all required):
 *   PIPEDREAM_PROJECT_ID    proj_XXXXXX from project's Connect → Configuration
 *   PIPEDREAM_CLIENT_ID     OAuth client id from account settings → API
 *   PIPEDREAM_CLIENT_SECRET OAuth client secret (rotate-only)
 *
 * Optional:
 *   PIPEDREAM_ENVIRONMENT   "development" | "production" (default "production")
 */

export const config = { runtime: "edge" };

const PD_BASE = "https://api.pipedream.com/v1";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function err(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

function requireEnv() {
  const projectId    = process.env.PIPEDREAM_PROJECT_ID;
  const clientId     = process.env.PIPEDREAM_CLIENT_ID;
  const clientSecret = process.env.PIPEDREAM_CLIENT_SECRET;
  const environment  = process.env.PIPEDREAM_ENVIRONMENT || "production";
  if (!projectId)    throw new Error("PIPEDREAM_PROJECT_ID env var not set");
  if (!clientId)     throw new Error("PIPEDREAM_CLIENT_ID env var not set");
  if (!clientSecret) throw new Error("PIPEDREAM_CLIENT_SECRET env var not set");
  return { projectId, clientId, clientSecret, environment };
}

// ─── Pipedream auth + REST helper ────────────────────────────────────────────

async function getAccessToken({ clientId, clientSecret }) {
  const res = await fetch(`${PD_BASE}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      grant_type:    "client_credentials",
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Pipedream /oauth/token ${res.status}: ${text.slice(0, 300)}`);
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Pipedream /oauth/token non-JSON: ${text.slice(0, 200)}`); }
  if (!data.access_token) throw new Error("Pipedream /oauth/token missing access_token");
  return data.access_token;
}

async function pdFetch(path, options = {}, accessToken) {
  const res = await fetch(`${PD_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type":  "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Pipedream ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

// ─── App slug mapping ─────────────────────────────────────────────────────────
// Maps FlowOS connector IDs → Pipedream app slugs. Verify with
// `node scripts/verify-pipedream.mjs`; adjust on slug mismatch.

const APP_MAP = {
  // Paid Social
  pinads:         "pinterest",         // Pinterest Ads shares the Pinterest app
  // Organic Social
  pn:             "pinterest",
  // Email Marketing
  sendgrid:       "sendgrid",
  // SMS
  twilio:         "twilio",
  // AI Video / Image
  runware:        "runware",
  // NB: WooCommerce + WordPress are NOT in Pipedream's catalog (verified via
  // /v1/apps substring search). They're reclassified to provider:"direct" in
  // seed.jsx — wired via their own REST APIs (WooCommerce consumer key/secret,
  // WordPress Application Passwords or OAuth).
};

function resolveApp(app) {
  return APP_MAP[app?.toLowerCase()] || app?.toLowerCase();
}

// ─── Action handlers ──────────────────────────────────────────────────────────

/**
 * initiate_connection
 * Mints a Pipedream Connect Token for the tenant and returns the connect_link_url
 * (the page the user opens in a popup to authorize).
 */
async function handleInitiateConnection({ tenantId, app, redirectUri }) {
  if (!tenantId) return err("tenantId required");
  if (!app)      return err("app required");

  const env = requireEnv();
  const slug = resolveApp(app);
  const accessToken = await getAccessToken(env);

  // Allowed origins: include the redirectUri origin if supplied; Pipedream uses
  // this for postMessage when the connect popup completes.
  const allowedOrigins = [];
  if (redirectUri) {
    try { allowedOrigins.push(new URL(redirectUri).origin); } catch {}
  }

  const data = await pdFetch(
    `/connect/${encodeURIComponent(env.projectId)}/tokens`,
    {
      method:  "POST",
      headers: { "x-pd-environment": env.environment },
      body:    JSON.stringify({
        external_user_id: tenantId,
        allowed_origins:  allowedOrigins,
      }),
    },
    accessToken,
  );

  const connectToken = data?.token || data?.connect_token;
  let   connectUrl   = data?.connect_link_url || data?.connectLinkUrl;
  if (!connectToken) throw new Error("Pipedream /tokens returned no token");
  if (!connectUrl) {
    // Fallback: construct from token
    connectUrl = `https://pipedream.com/_static/connect.html?token=${encodeURIComponent(connectToken)}&connectLink=true`;
  }

  // Pre-select the app so the user lands directly on the right authorization page.
  const sep = connectUrl.includes("?") ? "&" : "?";
  const redirectUrl = `${connectUrl}${sep}app=${encodeURIComponent(slug)}`;

  return json({
    ok:          true,
    mode:        "oauth",
    redirectUrl,
    connectionId: null, // Pipedream issues this only once the account is created
    token:       connectToken,
  });
}

/**
 * connection_status
 * Polls Pipedream for an account matching the tenant + app slug.
 */
async function handleConnectionStatus({ tenantId, app }) {
  if (!tenantId) return err("tenantId required");
  if (!app)      return err("app required");

  const env  = requireEnv();
  const slug = resolveApp(app);
  const accessToken = await getAccessToken(env);

  const data = await pdFetch(
    `/connect/${encodeURIComponent(env.projectId)}/accounts?external_user_id=${encodeURIComponent(tenantId)}`,
    { method: "GET", headers: { "x-pd-environment": env.environment } },
    accessToken,
  );

  const accounts = data?.data || data?.accounts || data?.items || [];
  const match = accounts.find(a => {
    const s = (a.app?.name_slug || a.app?.slug || a.app_slug || a.app || "").toLowerCase();
    return s === slug.toLowerCase();
  });

  return json({
    ok:        true,
    connected: !!match,
    accountId: match?.id || null,
    status:    match ? "ACTIVE" : "not_connected",
    app,
  });
}

/**
 * list_connections
 * All Pipedream accounts for a tenant.
 */
async function handleListConnections({ tenantId }) {
  if (!tenantId) return err("tenantId required");

  const env = requireEnv();
  const accessToken = await getAccessToken(env);

  const data = await pdFetch(
    `/connect/${encodeURIComponent(env.projectId)}/accounts?external_user_id=${encodeURIComponent(tenantId)}`,
    { method: "GET", headers: { "x-pd-environment": env.environment } },
    accessToken,
  );

  const accounts = (data?.data || data?.accounts || data?.items || []).map(a => ({
    id:     a.id,
    app:    a.app?.name_slug || a.app?.slug || a.app_slug || a.app,
    status: a.healthy === false ? "unhealthy" : "ACTIVE",
    handle: a.name || a.external_id || null,
  }));

  return json({ ok: true, connections: accounts });
}

/**
 * disconnect
 * Remove a Pipedream account.
 */
async function handleDisconnect({ accountId }) {
  if (!accountId) return err("accountId required");

  const env = requireEnv();
  const accessToken = await getAccessToken(env);

  await pdFetch(
    `/connect/${encodeURIComponent(env.projectId)}/accounts/${encodeURIComponent(accountId)}`,
    { method: "DELETE", headers: { "x-pd-environment": env.environment } },
    accessToken,
  );

  return json({ ok: true });
}

/**
 * list_apps  — debug. Lists every app slug Pipedream Connect supports.
 * Returns: { ok, count, apps: [{ slug, name }] }
 */
async function handleListApps() {
  const env = requireEnv();
  const accessToken = await getAccessToken(env);
  const all = [];
  let cursor = null;
  for (let i = 0; i < 30; i++) {
    const url = `/apps?limit=200${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`;
    const data = await pdFetch(url, { method: "GET" }, accessToken);
    const items = data?.data || data?.apps || data?.items || [];
    for (const a of items) {
      all.push({
        slug: (a.name_slug || a.slug || a.id || "").toLowerCase(),
        name: a.name || a.display_name || null,
        auth: a.auth_type || a.type || null,
      });
    }
    cursor = data?.page_info?.end_cursor || data?.next_cursor || null;
    if (!cursor || items.length === 0) break;
  }
  return json({ ok: true, count: all.length, apps: all });
}

/**
 * verify_app — debug. Mirror of /api/composio verify_app.
 * Confirms a FlowOS connector id resolves to a Pipedream slug that exists.
 */
async function handleVerifyApp({ app }) {
  if (!app) return err("app required");

  const env  = requireEnv();
  const slug = resolveApp(app);
  const accessToken = await getAccessToken(env);

  const data = await pdFetch(`/apps?q=${encodeURIComponent(slug)}&limit=50`, { method: "GET" }, accessToken);
  const items = data?.data || data?.apps || data?.items || [];
  const exists = items.some(a => {
    const s = (a.name_slug || a.slug || a.id || "").toLowerCase();
    return s === slug.toLowerCase();
  });

  return json({ ok: true, app, slug, exists });
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return err("POST required", 405);

  let body;
  try { body = await req.json(); }
  catch { return err("Invalid JSON body", 400); }

  const { action } = body;

  try {
    switch (action) {
      case "initiate_connection": return handleInitiateConnection(body);
      case "connection_status":   return handleConnectionStatus(body);
      case "list_connections":    return handleListConnections(body);
      case "disconnect":          return handleDisconnect(body);
      case "list_apps":           return handleListApps();
      case "verify_app":          return handleVerifyApp(body);
      default:
        return err(`Unknown action "${action}". Supported: initiate_connection, connection_status, list_connections, disconnect, list_apps, verify_app`);
    }
  } catch (e) {
    console.error("[pipedream]", e);
    return err(`Pipedream error: ${e.message}`, 502);
  }
}
