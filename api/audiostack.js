/**
 * FlowOS — AudioStack connector (Direct API, per-tenant API key)
 * Vercel Edge Function: POST /api/audiostack
 *
 * Actions:
 *   initiate_connection — validate API key via GET /organisation, persist to
 *                         connector_credentials, flip channels to connected
 *   disconnect          — drop credential + flip channels to disconnected
 *
 * AudioStack's REST API (v2.api.audio) authenticates with `x-api-key`. Keys
 * are minted at app.audiostack.ai → Settings → API. /organisation returns
 * the calling org and is the cheapest token-validating call; we fall back to
 * /script if the org endpoint isn't enabled on the plan.
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";

export const config = { runtime: "edge" };

const AUDIOSTACK_BASE = "https://v2.api.audio";

async function validateKey(apiKey) {
  let res = await fetch(`${AUDIOSTACK_BASE}/organisation`, {
    headers: { "x-api-key": apiKey, "Accept": "application/json" },
  });

  if (res.status === 404) {
    res = await fetch(`${AUDIOSTACK_BASE}/script?limit=1`, {
      headers: { "x-api-key": apiKey, "Accept": "application/json" },
    });
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("AudioStack rejected the key (401/403). Mint a key at app.audiostack.ai → Settings → API.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AudioStack validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = await res.json().catch(() => ({}));
  return data?.data?.name || data?.name || data?.organisation?.name || "key validated";
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
    platform: "audiostack",
    apiKey,
    note:     `connected · ${note}`,
  });

  return json({ ok: true, mode: "api_key", note });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "audiostack" });
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
    console.error("[audiostack]", e);
    return err(`AudioStack error: ${e.message}`, 502);
  }
}
