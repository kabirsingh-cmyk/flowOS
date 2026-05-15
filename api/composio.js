/**
 * FlowOS — Composio connector
 * Vercel Edge Function: POST /api/composio
 *
 * Composio v3 API (backend.composio.dev/api/v3).
 * Key v2→v3 changes:
 *   - entityId        → user_id
 *   - integrationId   → auth_config_id
 *   - /connectedAccounts → /connected_accounts
 *   - showActiveOnly  → statuses=ACTIVE
 *   - initiate flow   → get/create auth_config, then POST /connected_accounts
 *
 * Actions:
 *   initiate_connection  — start OAuth flow for a tenant + app
 *   connection_status    — check if tenant has connected an app
 *   list_connections     — all connected apps for a tenant
 *   disconnect           — remove a connected account
 */

import { requireAuth } from "./lib/auth.js";

export const config = { runtime: "edge" };

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";

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

// ─── Composio REST helper ─────────────────────────────────────────────────────

function composioHeaders() {
  const key = process.env.COMPOSIO_API_KEY2;
  if (!key) throw new Error("COMPOSIO_API_KEY2 env var not set");
  return {
    "Content-Type": "application/json",
    "x-api-key":    key,
  };
}

async function composioFetch(path, options = {}) {
  const res = await fetch(`${COMPOSIO_BASE}${path}`, {
    ...options,
    headers: { ...composioHeaders(), ...(options.headers || {}) },
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new Error(
      data?.message || data?.error || `Composio ${res.status}: ${text.slice(0, 300)}`
    );
  }
  return data;
}

// ─── App slug mapping ─────────────────────────────────────────────────────────
// Maps FlowOS connector IDs to Composio toolkit slugs.

const APP_MAP = {
  googleads:  "googleads",
  ga4:        "google_analytics",
  metaads:    "facebook",
  liads:      "linkedin",
  li:         "linkedin",
  klaviyo:    "klaviyo",
  shopify:    "shopify",
  yt:         "youtube",
};

function resolveApp(app) {
  return APP_MAP[app?.toLowerCase()] || app?.toLowerCase();
}

// ─── Auth config helper (v3) ──────────────────────────────────────────────────
//
// v3 requires an auth_config_id before creating a connected account.
// This helper finds an existing Composio-managed config for the toolkit,
// or creates one if none exists.

async function getOrCreateAuthConfigId(toolkitSlug) {
  // 1. Try to find an existing managed auth config for this toolkit
  const list = await composioFetch(
    `/auth_configs?toolkit_slug=${encodeURIComponent(toolkitSlug)}&limit=20`
  );

  const items = list.items || list.auth_configs || list.data || [];
  const existing = items.find(c => {
    const slug = c.toolkit?.slug || c.toolkit_slug || c.slug || "";
    const isManaged = c.auth_config?.is_composio_managed ?? c.is_composio_managed ?? true;
    return slug.toLowerCase() === toolkitSlug.toLowerCase() && isManaged;
  });

  if (existing) {
    return existing.auth_config?.id || existing.id;
  }

  // 2. Create a Composio-managed auth config for this toolkit
  const created = await composioFetch("/auth_configs", {
    method: "POST",
    body:   JSON.stringify({
      toolkit:     { slug: toolkitSlug },
      auth_config: { type: "use_composio_managed_auth" },
    }),
  });

  return created.auth_config?.id || created.id;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

/**
 * initiate_connection
 * Starts OAuth for a tenant + app. Returns a redirect URL to send the user to.
 * After OAuth completes, Composio redirects to `redirectUri`.
 *
 * v3 flow:
 *   1. Get/create managed auth_config for the toolkit
 *   2. POST /connected_accounts → get redirectUrl from connectionData
 */
async function handleInitiateConnection({ tenantId, app, redirectUri }) {
  if (!tenantId)    return err("tenantId required");
  if (!app)         return err("app required");
  if (!redirectUri) return err("redirectUri required");

  const toolkitSlug  = resolveApp(app);
  const authConfigId = await getOrCreateAuthConfigId(toolkitSlug);

  const data = await composioFetch("/connected_accounts", {
    method: "POST",
    body:   JSON.stringify({
      auth_config: { id: authConfigId },
      connection:  {
        user_id:      tenantId,
        callback_url: redirectUri,
      },
    }),
  });

  // v3 nests the redirect URL: connectionData.val.redirectUrl
  const redirectUrl =
    data?.connectionData?.val?.redirectUrl ||
    data?.connectionData?.redirectUrl      ||
    data?.redirectUrl                      ||
    data?.redirect_url                     ||
    null;

  if (!redirectUrl) {
    throw new Error(
      `No redirectUrl in Composio response. Status: ${data?.status}. ` +
      `Connection may require API key auth instead of OAuth.`
    );
  }

  return json({
    ok:           true,
    redirectUrl,
    connectionId: data?.id || null,
  });
}

/**
 * connection_status
 * Check if a tenant has an active connection for a specific app.
 */
async function handleConnectionStatus({ tenantId, app }) {
  if (!tenantId) return err("tenantId required");
  if (!app)      return err("app required");

  const toolkitSlug = resolveApp(app);

  const data = await composioFetch(
    `/connected_accounts?user_ids=${encodeURIComponent(tenantId)}&statuses=ACTIVE&limit=50`
  );

  const accounts = data.items || data.connected_accounts || data.data || [];
  const match = accounts.find(a => {
    const slug = a.toolkit?.slug || a.appName || a.app_name || "";
    return slug.toLowerCase() === toolkitSlug.toLowerCase();
  });

  return json({
    ok:        true,
    connected: !!match,
    accountId: match?.id || null,
    status:    match?.status || "not_connected",
    app,
  });
}

/**
 * list_connections
 * All active connected accounts for a tenant — used to build the tool manifest.
 */
async function handleListConnections({ tenantId }) {
  if (!tenantId) return err("tenantId required");

  const data = await composioFetch(
    `/connected_accounts?user_ids=${encodeURIComponent(tenantId)}&statuses=ACTIVE&limit=100`
  );

  const accounts = (data.items || data.connected_accounts || data.data || []).map(a => ({
    id:     a.id,
    app:    a.toolkit?.slug || a.appName || a.app_name,
    status: a.status,
    handle: a.account_handle || a.accountHandle || null,
  }));

  return json({ ok: true, connections: accounts });
}

/**
 * disconnect
 * Remove a connected account for a tenant.
 */
async function handleDisconnect({ accountId }) {
  if (!accountId) return err("accountId required");

  await composioFetch(`/connected_accounts/${accountId}`, { method: "DELETE" });
  return json({ ok: true });
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") return err("POST required", 405);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await req.json(); }
  catch { return err("Invalid JSON body", 400); }

  // Server-trusted tenantId — overrides any client-supplied value.
  body = { ...body, tenantId: auth.tenantId };
  const { action } = body;

  try {
    switch (action) {
      case "initiate_connection": return handleInitiateConnection(body);
      case "connection_status":   return handleConnectionStatus(body);
      case "list_connections":    return handleListConnections(body);
      case "disconnect":          return handleDisconnect(body);
      default:
        return err(`Unknown action "${action}". Supported: initiate_connection, connection_status, list_connections, disconnect`);
    }
  } catch (e) {
    console.error("[composio]", e);
    return err(`Composio error: ${e.message}`, 502);
  }
}
