/**
 * FlowOS — Composio connector
 * Vercel Edge Function: POST /api/composio
 *
 * Handles per-tenant platform connections via Composio managed OAuth.
 * Each tenant (entityId = tenantId) connects their own accounts.
 * Composio stores and refreshes credentials — we never touch OAuth tokens.
 *
 * Actions:
 *   initiate_connection  — start OAuth flow for a tenant + app
 *   connection_status    — check if tenant has connected an app
 *   list_connections     — all connected apps for a tenant
 *   disconnect           — remove a connected account
 */

export const config = { runtime: "edge" };

const COMPOSIO_BASE = "https://backend.composio.dev/api/v2";

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

// ─── App → Composio integration name mapping ──────────────────────────────────
// Maps the connector names used in FlowOS UI to Composio's integration IDs.

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

// ─── Action handlers ──────────────────────────────────────────────────────────

/**
 * initiate_connection
 * Starts OAuth for a tenant + app. Returns a redirect URL to send the user to.
 * After the user completes OAuth, Composio redirects to `redirectUri`.
 */
async function handleInitiateConnection({ tenantId, app, redirectUri }) {
  if (!tenantId)    return err("tenantId required");
  if (!app)         return err("app required");
  if (!redirectUri) return err("redirectUri required");

  const integrationApp = resolveApp(app);

  const data = await composioFetch("/connectedAccounts", {
    method: "POST",
    body: JSON.stringify({
      integrationId: integrationApp,
      entityId:      tenantId,       // Composio uses entityId for multi-tenancy
      redirectUri,
    }),
  });

  return json({
    ok:          true,
    redirectUrl: data.redirectUrl || data.redirect_url,
    connectionId: data.connectionId || data.id,
  });
}

/**
 * connection_status
 * Check if a tenant has an active connection for a specific app.
 */
async function handleConnectionStatus({ tenantId, app }) {
  if (!tenantId) return err("tenantId required");
  if (!app)      return err("app required");

  const integrationApp = resolveApp(app);

  const data = await composioFetch(
    `/connectedAccounts?entityId=${tenantId}&showActiveOnly=true`
  );

  const accounts = data.items || data.connectedAccounts || [];
  const match = accounts.find(a =>
    a.appName?.toLowerCase() === integrationApp ||
    a.integrationId?.toLowerCase().includes(integrationApp)
  );

  return json({
    ok:          true,
    connected:   !!match,
    accountId:   match?.id || null,
    status:      match?.status || "not_connected",
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
    `/connectedAccounts?entityId=${tenantId}&showActiveOnly=true`
  );

  const accounts = (data.items || data.connectedAccounts || []).map(a => ({
    id:       a.id,
    app:      a.appName,
    status:   a.status,
    handle:   a.accountHandle || null,
  }));

  return json({ ok: true, connections: accounts });
}

/**
 * disconnect
 * Remove a connected account for a tenant.
 */
async function handleDisconnect({ accountId }) {
  if (!accountId) return err("accountId required");

  await composioFetch(`/connectedAccounts/${accountId}`, { method: "DELETE" });
  return json({ ok: true });
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") return err("POST required", 405);

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
      default:
        return err(`Unknown action "${action}". Supported: initiate_connection, connection_status, list_connections, disconnect`);
    }
  } catch (e) {
    console.error("[composio]", e);
    return err(`Composio error: ${e.message}`, 502);
  }
}
