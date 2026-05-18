/**
 * FlowOS — Higgsfield connector (Direct API, per-tenant API key)
 * Vercel Edge Function: POST /api/higgsfield
 *
 * Actions:
 *   initiate_connection — validate API key via GET /models, persist to
 *                         connector_credentials, flip channels to connected
 *   disconnect          — drop credential + flip channels to disconnected
 *
 * Higgsfield's REST API (api.higgsfield.ai) does not expose an /account or
 * /me endpoint. The cheapest token-validating call is GET /models, which
 * returns the available cinematic-video models (Kling, Studio 3.0, etc.) and
 * requires a valid Bearer token. A 401/403 means the key is bad; any 2xx
 * confirms it.
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";

export const config = { runtime: "edge" };

const HIGGSFIELD_BASE = "https://api.higgsfield.ai";

async function validateKey(apiKey) {
  const res = await fetch(`${HIGGSFIELD_BASE}/models`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Higgsfield rejected the API key (401/403). Check it at higgsfield.ai/account/api-keys.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Higgsfield validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = await res.json().catch(() => ({}));
  const count = Array.isArray(data) ? data.length : (data?.models?.length ?? data?.items?.length ?? null);
  return count != null ? `${count} models available` : "key validated";
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
    platform: "higgsfield",
    apiKey,
    note:     `connected · ${note}`,
  });

  return json({ ok: true, mode: "api_key", note });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "higgsfield" });
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
    console.error("[higgsfield]", e);
    return err(`Higgsfield error: ${e.message}`, 502);
  }
}
