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
import { corsHeaders } from "./lib/cors.js";

export const config = { runtime: "edge" };

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";

const CORS = corsHeaders();

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
// Maps FlowOS connector IDs → Composio toolkit slugs.
// Source of truth for the canonical 50 lives in app/seed.jsx. Only IDs with
// provider: "composio" need mapping here (32 of 50). Shared-auth platforms
// resolve to the same Composio toolkit (e.g. metaads + fb + ig → facebook;
// liads + li → linkedin) — Composio manages one connection per toolkit.
//
// Verify slugs at runtime by POSTing { action: "list_toolkits" }. If a slug
// is wrong, /auth_configs lookup fails and the user sees a clear error.

const APP_MAP = {
  // Paid Search / Ads
  googleads:    "googleads",

  // Paid Social (metaads, liads, ttads, xads) — REMOVED (migrated to Zernio, b_a002 2026-05-24)

  // Organic Social — REMOVED (all migrated to Zernio 2026-05-24)

  // Email Marketing
  mailchimp:    "mailchimp",
  klaviyo:      "klaviyo",

  // SMS — Klaviyo SMS shares the Klaviyo toolkit
  klaviyo_sms:  "klaviyo",

  // Email Verification
  neverbounce:  "neverbounce",
  kickbox:      "kickbox",
  listclean:    "listclean",

  // SEO & Search
  gsc:          "google_search_console",
  ahrefs:       "ahrefs",
  moz:          "moz",
  neuronwriter: "neuronwriter",

  // E-commerce
  shopify:      "shopify",

  // AI Video / Image + Audio
  heygen:       "heygen",
  elevenlabs:   "elevenlabs",

  // Analytics
  ga4:          "google_analytics",

  // CRM
  hubspot:      "hubspot",
  salesforce:   "salesforce",
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
  // 1. Find any existing OAuth auth_config for this toolkit — managed OR
  // user-supplied custom OAuth (registered via the Composio dashboard when
  // the toolkit has no managed credentials, e.g. Shopify, TikTok, Twitter).
  // Skip API_KEY-scheme configs — those belong to the custom-auth path
  // (getOrCreateCustomAuthConfigId).
  const list = await composioFetch(
    `/auth_configs?toolkit_slug=${encodeURIComponent(toolkitSlug)}&limit=20`
  );
  const items = list.items || list.auth_configs || list.data || [];
  const existing = items.find(c => {
    const slug = c.toolkit?.slug || c.toolkit_slug || c.slug || "";
    if (slug.toLowerCase() !== toolkitSlug.toLowerCase()) return false;
    const scheme = c.auth_config?.auth_scheme || c.authScheme || c.auth_scheme || "";
    if (/api[_-]?key/i.test(scheme)) return false;
    return true;
  });
  if (existing) return existing.auth_config?.id || existing.id;

  // 2. None exists → try to create a Composio-managed auth_config. This
  // succeeds for toolkits with managed credentials (LinkedIn, GitHub, etc.)
  // and fails with code 306 for toolkits that require BYO OAuth credentials
  // (Shopify, TikTok, Twitter, …). The caller maps 306 to a 409 with a
  // dashboard-configuration hint.
  const created = await composioFetch("/auth_configs", {
    method: "POST",
    body:   JSON.stringify({
      toolkit:     { slug: toolkitSlug },
      auth_config: { type: "use_composio_managed_auth" },
    }),
  });

  return created.auth_config?.id || created.id;
}

// For API-key Composio connectors. Composio recognises these toolkits but doesn't
// ship managed OAuth credentials — we don't need them, since the user supplies
// their own API key per connection. Create a `use_custom_auth` auth_config that
// declares the API_KEY scheme; credentials land on the connected_account itself.
//
// NB: Composio's API is inconsistent — most fields are snake_case but
// `authScheme` here is camelCase (verified against /auth_configs payload errors).
async function getOrCreateCustomAuthConfigId(toolkitSlug) {
  // 1. Look specifically for an existing `use_custom_auth` config with API_KEY
  // scheme. We must NOT reuse a managed-OAuth config here — connection.data.apiKey
  // would be ignored and Composio would expect an OAuth round-trip instead.
  const list = await composioFetch(
    `/auth_configs?toolkit_slug=${encodeURIComponent(toolkitSlug)}&limit=20`
  );
  const items = list.items || list.auth_configs || list.data || [];
  const existing = items.find(c => {
    const slug = c.toolkit?.slug || c.toolkit_slug || c.slug || "";
    if (slug.toLowerCase() !== toolkitSlug.toLowerCase()) return false;
    const isManaged = c.auth_config?.is_composio_managed ?? c.is_composio_managed ?? false;
    if (isManaged) return false;
    const scheme = c.auth_config?.auth_scheme || c.authScheme || c.auth_scheme || "";
    return /api[_-]?key/i.test(scheme) || scheme === "";
  });
  if (existing) return existing.auth_config?.id || existing.id;

  // 2. Otherwise create a `use_custom_auth` auth_config declaring API_KEY scheme.
  const created = await composioFetch("/auth_configs", {
    method: "POST",
    body:   JSON.stringify({
      toolkit:     { slug: toolkitSlug },
      auth_config: { type: "use_custom_auth", authScheme: "API_KEY" },
    }),
  });
  return created.auth_config?.id || created.id;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

/**
 * initiate_connection
 * Two modes:
 *
 *   1. OAuth (no apiKey supplied) — request a managed auth_config, POST
 *      /connected_accounts with a callback URL, return the OAuth redirectUrl.
 *      Requires Composio to have managed credentials for the toolkit.
 *
 *   2. API key (apiKey supplied) — create or reuse a `use_custom_auth`
 *      auth_config for the toolkit, then POST /connected_accounts with the
 *      caller-provided credentials. No redirect; the connection is active
 *      immediately. Used by Klaviyo, Mailchimp, ElevenLabs, NeverBounce, etc.
 */
async function handleInitiateConnection({ tenantId, app, redirectUri, apiKey, credentials }) {
  if (!tenantId) return err("tenantId required");
  if (!app)      return err("app required");

  const toolkitSlug = resolveApp(app);

  // ── API-key branch ──────────────────────────────────────────────────────────
  // If the caller supplied an apiKey (or credentials object), we treat this as
  // a synchronous custom-auth connection — no OAuth round-trip.
  //
  // Composio expects credentials nested under `connection.data` with field names
  // matching the toolkit's `auth_config_details` schema. Most toolkits use
  // `apiKey` (camelCase). Toolkit-specific overrides can be passed via the
  // `credentials` body field, which replaces the default { apiKey } payload.
  if (apiKey || credentials) {
    const authConfigId = await getOrCreateCustomAuthConfigId(toolkitSlug);
    const data = await composioFetch("/connected_accounts", {
      method: "POST",
      body:   JSON.stringify({
        auth_config: { id: authConfigId },
        connection:  {
          user_id: tenantId,
          data:    credentials || { apiKey },
        },
      }),
    });
    return json({
      ok:           true,
      mode:         "api_key",
      connectionId: data?.id || null,
      status:       data?.status || "ACTIVE",
    });
  }

  // ── OAuth branch ────────────────────────────────────────────────────────────
  if (!redirectUri) return err("redirectUri required for OAuth flow");

  let authConfigId;
  try {
    authConfigId = await getOrCreateAuthConfigId(toolkitSlug);
  } catch (e) {
    // Composio code 306 = "Default auth config not found … no managed credentials"
    if (e.message.includes("306") || /managed credentials/i.test(e.message)) {
      return err(
        `${app} requires a custom OAuth app. Configure a Composio auth_config for "${toolkitSlug}" in the Composio dashboard, or switch the connector to provider:"direct" in seed.jsx and wire a per-provider OAuth route.`,
        409,
      );
    }
    throw e;
  }

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
    mode:         "oauth",
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

/**
 * list_toolkits
 * Debug helper — returns every toolkit slug Composio knows about, so we can
 * verify the FlowOS APP_MAP. Useful when adding new connectors or when an
 * initiate_connection call fails with "No managed auth config".
 *
 * Returns: { ok, toolkits: [{ slug, name, hasManaged }], count }
 */
async function handleListToolkits() {
  const data = await composioFetch("/toolkits?limit=500");
  const items = data.items || data.toolkits || data.data || [];
  const toolkits = items.map(t => ({
    slug:       t.slug || t.toolkit_slug || t.id,
    name:       t.name || t.display_name || t.label || null,
    hasManaged: t.has_managed_auth ?? t.is_composio_managed ?? null,
  }));
  return json({ ok: true, count: toolkits.length, toolkits });
}

/**
 * verify_app
 * Debug helper — verifies that a single FlowOS connector id resolves to a
 * Composio toolkit slug that exists AND has a managed auth config available.
 * Returns { ok, app, toolkitSlug, exists, managedAvailable }
 */
async function handleVerifyApp({ app }) {
  if (!app) return err("app required");
  const toolkitSlug = resolveApp(app);

  // 1. Does the toolkit exist?
  const toolkitList = await composioFetch(`/toolkits?slug=${encodeURIComponent(toolkitSlug)}&limit=5`);
  const items = toolkitList.items || toolkitList.toolkits || toolkitList.data || [];
  const exists = items.some(t => {
    const s = (t.slug || t.toolkit_slug || t.id || "").toLowerCase();
    return s === toolkitSlug.toLowerCase();
  });

  // 2. Is there a managed auth config (or can one be created)?
  let managedAvailable = false;
  let authConfigId    = null;
  let authError       = null;
  if (exists) {
    try {
      authConfigId    = await getOrCreateAuthConfigId(toolkitSlug);
      managedAvailable = !!authConfigId;
    } catch (e) {
      authError = e.message;
    }
  }

  return json({
    ok: true,
    app,
    toolkitSlug,
    exists,
    managedAvailable,
    authConfigId,
    authError,
  });
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
      case "list_toolkits":       return handleListToolkits();
      case "verify_app":          return handleVerifyApp(body);
      default:
        return err(`Unknown action "${action}". Supported: initiate_connection, connection_status, list_connections, disconnect, list_toolkits, verify_app`);
    }
  } catch (e) {
    console.error("[composio]", e);
    return err(`Composio error: ${e.message}`, 502);
  }
}
