/**
 * FlowOS — Luma AI connector (Direct API, per-tenant API key)
 * Vercel Edge Function: POST /api/luma
 *
 * Actions:
 *   initiate_connection — validate API key via GET /dream-machine/v1/generations,
 *                         persist to connector_credentials, flip channels to connected
 *   disconnect          — drop credential + flip channels to disconnected
 *
 * Luma's Dream Machine API uses Bearer auth on api.lumalabs.ai. The cheapest
 * token-validating call is GET /dream-machine/v1/generations?limit=1, which
 * returns the user's most recent generation (or an empty list for a fresh
 * account). 401/403 means the key is invalid.
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";

export const config = { runtime: "edge" };

const LUMA_BASE = "https://api.lumalabs.ai/dream-machine/v1";

async function validateKey(apiKey) {
  const res = await fetch(`${LUMA_BASE}/generations?limit=1`, {
    headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Luma rejected the API key (401/403). Check it at lumalabs.ai/dream-machine/api-keys.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Luma validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = await res.json().catch(() => ({}));
  const generations = data?.generations || data?.data || (Array.isArray(data) ? data : []);
  return `${generations.length} recent generation${generations.length === 1 ? "" : "s"}`;
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
    platform: "luma",
    apiKey,
    note:     `connected · ${note}`,
  });

  return json({ ok: true, mode: "api_key", note });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "luma" });
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
    console.error("[luma]", e);
    return err(`Luma error: ${e.message}`, 502);
  }
}
