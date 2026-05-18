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
 *
 * `secretKind` defaults to "api_key" — pass "oauth_tokens" when storing a
 * JSON blob of OAuth credentials (see saveOAuthCredential below).
 */
export async function saveCredential({ tenantId, platform, apiKey, note, secretKind }) {
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
        secret_kind:  secretKind || "api_key",
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

// ─── OAuth credential helpers ─────────────────────────────────────────────────
//
// OAuth providers return an access_token + refresh_token + expiry — we serialise
// the bundle as JSON into the same secret_value column (secret_kind = "oauth_tokens"),
// mirroring how WordPress stores its 3-tuple. Downstream callers go through
// loadOAuthCredential() which auto-refreshes when expiry is within 60s.

const OAUTH_REFRESH_LEEWAY_MS = 60_000;

/**
 * Persist OAuth tokens for a tenant + flip the channel to connected.
 * `tokens` is the full bag we want round-tripped to callers — typically
 * { access_token, refresh_token, expires_at, scope, token_type, extra }.
 * `expires_at` is epoch-ms; callers can compute from the provider's
 * `expires_in` (seconds) via Date.now() + expires_in * 1000.
 */
export async function saveOAuthCredential({ tenantId, platform, tokens, note }) {
  return saveCredential({
    tenantId,
    platform,
    secretKind: "oauth_tokens",
    apiKey:     JSON.stringify(tokens || {}),
    note,
  });
}

/**
 * Read + parse OAuth tokens for a tenant. If they've expired (or are within
 * OAUTH_REFRESH_LEEWAY_MS of doing so) and a refresher is supplied, the
 * refresher is called with the current tokens and the returned bundle is
 * persisted before being returned. The refresher should return a complete
 * `tokens` object — same shape as what saveOAuthCredential takes.
 *
 * Returns null if no credential is stored.
 */
export async function loadOAuthCredential({ tenantId, platform, refresh }) {
  const raw = await loadCredential({ tenantId, platform });
  if (!raw) return null;
  let tokens;
  try { tokens = JSON.parse(raw); }
  catch { return null; }

  const expiresAt = Number(tokens?.expires_at || 0);
  const needsRefresh = expiresAt > 0 && Date.now() + OAUTH_REFRESH_LEEWAY_MS >= expiresAt;
  if (!needsRefresh || typeof refresh !== "function") return tokens;
  if (!tokens?.refresh_token) return tokens;

  try {
    const refreshed = await refresh(tokens);
    if (refreshed?.access_token) {
      await saveOAuthCredential({ tenantId, platform, tokens: refreshed });
      return refreshed;
    }
  } catch (e) {
    console.warn(`[loadOAuthCredential] refresh failed for ${platform}: ${e.message}`);
  }
  return tokens;
}

// ─── OAuth state signing ──────────────────────────────────────────────────────
//
// The `state` param on an OAuth round-trip carries tenantId + a CSRF nonce.
// We HMAC it so the callback can't be forged into hijacking another tenant's
// credentials. OAUTH_STATE_SECRET is preferred; we fall back to a SHA-256 of
// SUPABASE_SERVICE_KEY so the helper works in dev/preview without extra config.

async function stateKey() {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (secret) return new TextEncoder().encode(secret);
  if (!process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("OAUTH_STATE_SECRET or SUPABASE_SERVICE_KEY required to sign OAuth state");
  }
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(process.env.SUPABASE_SERVICE_KEY));
  return new Uint8Array(hash);
}

function b64urlFromBytes(bytes) {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlFromString(str) {
  return b64urlFromBytes(new TextEncoder().encode(str));
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(keyBytes, payloadStr) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadStr));
  return b64urlFromBytes(new Uint8Array(sig));
}

/**
 * Sign a state payload for an OAuth round-trip. `payload` should be a plain
 * object — typically { tenantId, platform, n: <random nonce> }.
 *
 * Returns "<b64url-payload>.<b64url-hmac>".
 */
export async function signOAuthState(payload) {
  const body = b64urlFromString(JSON.stringify({ ...payload, t: Date.now() }));
  const sig  = await hmacSha256(await stateKey(), body);
  return `${body}.${sig}`;
}

/**
 * Verify + decode a state token. Returns the decoded payload on success,
 * throws on tamper or expiry.
 *
 * `maxAgeMs` defaults to 10 minutes — long enough for the user to complete
 * the provider's consent screen but short enough that a stolen token can't
 * be replayed indefinitely.
 */
export async function verifyOAuthState(stateStr, { maxAgeMs = 10 * 60 * 1000 } = {}) {
  if (!stateStr || typeof stateStr !== "string" || !stateStr.includes(".")) {
    throw new Error("Missing or malformed state");
  }
  const [body, sig] = stateStr.split(".", 2);
  const expected = await hmacSha256(await stateKey(), body);
  // Constant-time compare.
  if (expected.length !== sig.length) throw new Error("State signature mismatch");
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) throw new Error("State signature mismatch");

  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))); }
  catch { throw new Error("State body unreadable"); }

  if (!payload?.t || Date.now() - payload.t > maxAgeMs) {
    throw new Error("State expired");
  }
  return payload;
}

// ─── Shared response helpers ──────────────────────────────────────────────────

export const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export function err(message, status = 400) {
  return json({ ok: false, error: message }, status);
}
