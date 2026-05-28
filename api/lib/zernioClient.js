/**
 * FlowOS — Zernio HTTP client + shared persistence helpers
 *
 * Every call to https://zernio.com/api/v1 should go through zernioFetch().
 * Every per-tenant profile/account resolution should go through
 * getOrCreateZernioProfile() / getZernioAccountId().
 *
 * Both api/zernio.js and api/paid-social.js import from this module — no
 * provider HTTP, no Supabase REST URLs should be inlined anywhere else.
 */

import { flowOSId } from "./zernioMap.js";

export const ZERNIO_BASE = "https://zernio.com/api/v1";

// ─── HTTP ─────────────────────────────────────────────────────────────────────

export function zernioHeaders() {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new Error("ZERNIO_API_KEY env var not set");
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type":  "application/json",
  };
}

/**
 * Thin wrapper around fetch() for Zernio's REST API.
 * Normalises errors: throws an Error whose .status carries the HTTP code and
 * .zernioCode carries Zernio's machine-readable error code (e.g.
 * "ads_connection_required") when present.
 *
 * Callers can inspect those fields to map to user-actionable messages.
 */
export async function zernioFetch(path, options = {}) {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...options,
    headers: { ...zernioHeaders(), ...(options.headers || {}) },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error || data?.message ||
      `Zernio ${path} ${res.status}: ${text.slice(0, 300)}`;
    throw Object.assign(new Error(msg), {
      status:     res.status,
      zernioCode: data?.code,
      body:       data,
    });
  }
  return data;
}

// ─── Supabase REST helpers ────────────────────────────────────────────────────

export function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    "apikey":        key,
    "Authorization": `Bearer ${key}`,
    "Content-Type":  "application/json",
  };
}

function sbUrl(path) {
  return `${process.env.SUPABASE_URL}/rest/v1${path}`;
}

// ─── Profile management (one Zernio profile per tenant) ──────────────────────

async function getZernioProfileId(tenantId) {
  const url = sbUrl(
    `/connector_credentials` +
    `?user_id=eq.${encodeURIComponent(tenantId)}` +
    `&platform=eq.zernio_profile&select=secret_value&limit=1`
  );
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.secret_value || null;
}

async function storeZernioProfileId(tenantId, profileId) {
  await fetch(sbUrl(`/connector_credentials`), {
    method:  "POST",
    headers: { ...sbHeaders(), "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id:      tenantId,
      platform:     "zernio_profile",
      secret_kind:  "profile_id",
      secret_value: profileId,
      validated_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }),
  });
}

/**
 * Returns the cached Zernio profileId for a tenant, creating one if absent.
 * Each FlowOS tenant gets exactly one Zernio profile (named by tenantId).
 */
export async function getOrCreateZernioProfile(tenantId) {
  const cached = await getZernioProfileId(tenantId);
  if (cached) return cached;

  const data = await zernioFetch("/profiles", {
    method: "POST",
    body:   JSON.stringify({ name: tenantId, description: "FlowOS tenant" }),
  });
  const profileId = data.profile?._id || data._id;
  if (!profileId) throw new Error("Zernio profile creation returned no _id");
  await storeZernioProfileId(tenantId, profileId);
  return profileId;
}

/**
 * Read the cached profileId without creating one. Useful when "no profile"
 * is a valid state (e.g. connection_status before first connect).
 */
export async function getCachedZernioProfile(tenantId) {
  return getZernioProfileId(tenantId);
}

// ─── Channel / account resolution ─────────────────────────────────────────────

/**
 * Load the Zernio accountId (_id from GET /accounts) for a connected platform.
 * Stored in channels.composio_connection_id at verify-and-persist time.
 * Accepts either a Zernio slug ("linkedin") or FlowOS short ID ("li") — both
 * are normalised via flowOSId() before the DB lookup.
 */
export async function getZernioAccountId(tenantId, platform) {
  const channelPlatform = flowOSId(platform);
  const url = sbUrl(
    `/channels` +
    `?user_id=eq.${encodeURIComponent(tenantId)}` +
    `&platform=eq.${encodeURIComponent(channelPlatform)}` +
    `&select=composio_connection_id&limit=1`
  );
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.composio_connection_id || null;
}

/**
 * Same as getZernioAccountId but throws a 422-style error with a clear
 * remediation hint when no account is connected. Useful for action handlers
 * that need to short-circuit with a user-visible "Reconnect and try again."
 */
export async function requireZernioAccountId(tenantId, platform) {
  const id = await getZernioAccountId(tenantId, platform);
  if (!id) {
    const err = new Error(
      `No connected account found for ${platform}. Connect it in Connections and try again.`
    );
    err.status = 422;
    err.zernioCode = "no_connected_account";
    throw err;
  }
  return id;
}
