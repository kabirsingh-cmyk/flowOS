/**
 * FlowOS — AB Tasty connector (Direct API, per-tenant Personal Access Token)
 * Vercel Edge Function: POST /api/abtasty
 *
 * Actions:
 *   initiate_connection — validate PAT via GET /core/me, persist to
 *                         connector_credentials, flip channels to connected
 *   disconnect          — drop credential + flip channels to disconnected
 *
 * AB Tasty's public docs document OAuth 2.0 as the primary auth, but they
 * also expose Personal Access Tokens for server-to-server use (api.abtasty.com
 * → My Account → API Access). PATs are Bearer-prefixed. /core/me returns the
 * authenticated user and is the cheapest validating call; /companies is the
 * fallback for tokens scoped only to org reads.
 *
 * Caveat: AB Tasty's official PAT scope is narrower than full OAuth — some
 * write operations require the OAuth flow. Surfaced at connect time only as
 * "validated"; downstream callers that hit a 403 should surface the upgrade
 * path. See docs/composio_marketing_connectors.md for the OAuth follow-up.
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";

export const config = { runtime: "edge" };

const ABTASTY_BASE = "https://api.abtasty.com";

async function validateKey(apiKey) {
  let res = await fetch(`${ABTASTY_BASE}/core/me`, {
    headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" },
  });

  if (res.status === 404) {
    res = await fetch(`${ABTASTY_BASE}/companies`, {
      headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" },
    });
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("AB Tasty rejected the token (401/403). Mint a Personal Access Token at app.abtasty.com → My Account → API Access.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AB Tasty validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = await res.json().catch(() => ({}));
  return data?.email || data?.name || data?.[0]?.name || "key validated";
}

async function handleInitiate({ tenantId, apiKey }) {
  if (!tenantId) return err("tenantId required");
  if (!apiKey)   return err("apiKey required");

  let note;
  try {
    note = await validateKey(apiKey);
  } catch (e) {
    return err(e.message, 400);
  }

  await saveCredential({
    tenantId,
    platform: "abtasty",
    apiKey,
    note:     `connected · ${note}`,
  });

  return json({ ok: true, mode: "api_key", note });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "abtasty" });
  return json({ ok: true });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return err("POST required", 405);

  let body;
  try { body = await req.json(); }
  catch { return err("Invalid JSON body", 400); }

  try {
    switch (body.action) {
      case "initiate_connection": return handleInitiate(body);
      case "disconnect":          return handleDisconnect(body);
      default:
        return err(`Unknown action "${body.action}". Supported: initiate_connection, disconnect`);
    }
  } catch (e) {
    console.error("[abtasty]", e);
    return err(`AB Tasty error: ${e.message}`, 502);
  }
}
