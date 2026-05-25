/**
 * Shared helpers for Direct-API connectors (provider: "direct" in seed.jsx).
 *
 * Validate-then-persist flow:
 *   1. Per-provider /api/<provider>.js calls validateKey() against the
 *      provider's REST API to confirm the credential works.
 *   2. On success, the route calls saveCredential() — writes the plaintext key
 *      into public.connector_credentials (service role, no RLS) and upserts
 *      a channels row so the connector tile flips green.
 *   3. disconnect() flips channels to disconnected and deletes the credential.
 *
 * Downstream API routes that need to act on the user's behalf later
 * (e.g. /api/generate for Replicate) read the key with loadCredential() and
 * fall back to the global env-var key if no per-tenant key exists.
 */

import { sbHeaders } from "./supabase.js";
import { corsHeaders } from "./cors.js";

const SUPABASE_URL = process.env.SUPABASE_URL;

function requireEnv() {
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY required");
  }
}

/**
 * Upsert the API key + mark the channel connected.
 * Two writes; channels upsert is best-effort (logged) so a transient failure
 * there doesn't leave the credential orphaned without a tile.
 */
export async function saveCredential({ tenantId, platform, apiKey, note }) {
  requireEnv();
  const now = new Date().toISOString();

  const credRes = await fetch(
    `${SUPABASE_URL}/rest/v1/connector_credentials?on_conflict=user_id,platform`,
    {
      method:  "POST",
      headers: { ...sbHeaders(), "Prefer": "resolution=merge-duplicates,return=minimal" },
      body:    JSON.stringify({
        user_id:      tenantId,
        platform,
        secret_kind:  "api_key",
        secret_value: apiKey,
        validated_at: now,
        updated_at:   now,
      }),
    },
  );
  if (!credRes.ok) {
    const text = await credRes.text();
    throw new Error(`connector_credentials upsert failed (${credRes.status}): ${text.slice(0, 200)}`);
  }

  const chanRes = await fetch(
    `${SUPABASE_URL}/rest/v1/channels?on_conflict=user_id,platform`,
    {
      method:  "POST",
      headers: { ...sbHeaders(), "Prefer": "resolution=merge-duplicates,return=minimal" },
      body:    JSON.stringify({
        user_id:    tenantId,
        platform,
        status:     "connected",
        updated_at: now,
      }),
    },
  );
  if (!chanRes.ok) {
    const text = await chanRes.text();
    console.warn(`[directCredentials] channels upsert non-fatal failure (${chanRes.status}): ${text.slice(0, 200)}`);
  }

  return { ok: true, note: note || "API key validated · direct" };
}

/**
 * Wipe the credential and flip the channel to disconnected.
 */
export async function deleteCredential({ tenantId, platform }) {
  requireEnv();
  const now = new Date().toISOString();

  await fetch(
    `${SUPABASE_URL}/rest/v1/connector_credentials?user_id=eq.${encodeURIComponent(tenantId)}&platform=eq.${encodeURIComponent(platform)}`,
    { method: "DELETE", headers: sbHeaders() },
  ).catch(() => {});

  await fetch(
    `${SUPABASE_URL}/rest/v1/channels?user_id=eq.${encodeURIComponent(tenantId)}&platform=eq.${encodeURIComponent(platform)}`,
    {
      method:  "PATCH",
      headers: { ...sbHeaders(), "Prefer": "return=minimal" },
      body:    JSON.stringify({ status: "disconnected", updated_at: now }),
    },
  ).catch(() => {});

  return { ok: true };
}

/**
 * Read a tenant's stored API key for a Direct-API platform.
 * Used by downstream routes (e.g. /api/generate) that want to call the
 * provider on the tenant's behalf. Returns null if no key is stored —
 * callers should fall back to the global env-var key.
 */
export async function loadCredential({ tenantId, platform }) {
  requireEnv();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/connector_credentials?user_id=eq.${encodeURIComponent(tenantId)}&platform=eq.${encodeURIComponent(platform)}&select=secret_value&limit=1`,
    { headers: sbHeaders() },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.secret_value || null;
}

// ─── Shared response helpers ──────────────────────────────────────────────────

export const CORS = corsHeaders();

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export function err(message, status = 400) {
  return json({ ok: false, error: message }, status);
}
