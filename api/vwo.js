/**
 * FlowOS — VWO connector (Direct API, per-tenant API token)
 * Vercel Edge Function: POST /api/vwo
 *
 * Actions:
 *   initiate_connection — validate API token via GET /api/v2/account-details
 *                         (or /campaigns as fallback), persist + flip channels
 *   disconnect          — drop credential + flip channels to disconnected
 *
 * VWO's REST API (app.vwo.com/api/v2) authenticates with a token in the
 * `token` HTTP header (not `Authorization: Bearer`). Tokens are minted at
 * app.vwo.com → Settings → API Access. We hit /account-details first; if the
 * deployment doesn't expose that endpoint we fall back to /campaigns?per_page=1
 * which every VWO Testing account has.
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";

export const config = { runtime: "edge" };

const VWO_BASE = "https://app.vwo.com/api/v2";

async function validateKey(apiKey) {
  // Primary probe — returns the account row when supported.
  let res = await fetch(`${VWO_BASE}/account-details`, {
    headers: { "token": apiKey, "Accept": "application/json" },
  });

  // Some VWO product tiers (Insights, FullStack) don't expose /account-details;
  // /campaigns is universal across plans.
  if (res.status === 404) {
    res = await fetch(`${VWO_BASE}/campaigns?per_page=1`, {
      headers: { "token": apiKey, "Accept": "application/json" },
    });
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("VWO rejected the token (401/403). Mint an API token at app.vwo.com → Settings → API Access.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VWO validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = await res.json().catch(() => ({}));
  return data?.account_name || data?.name || data?.account?.name || "key validated";
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
    platform: "vwo",
    apiKey,
    note:     `connected · ${note}`,
  });

  return json({ ok: true, mode: "api_key", note });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "vwo" });
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
    console.error("[vwo]", e);
    return err(`VWO error: ${e.message}`, 502);
  }
}
