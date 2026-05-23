/**
 * FlowOS — Replicate connector (Direct API, per-tenant API key)
 * Vercel Edge Function: POST /api/replicate
 *
 * Actions:
 *   initiate_connection — validate API key via GET /v1/account, persist to
 *                         connector_credentials, flip channels to connected
 *   disconnect          — drop credential + flip channels to disconnected
 *
 * Replicate keys are scoped to a single account (personal or org) — the /v1/account
 * GET both validates the token and returns the account name, which we surface as
 * a connection note so the user can confirm they're on the right account.
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";
import { requireAuth } from "./lib/auth.js";

export const config = { runtime: "edge" };

const REPLICATE_BASE = "https://api.replicate.com/v1";

async function validateKey(apiKey) {
  const res = await fetch(`${REPLICATE_BASE}/account`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Replicate rejected the API key (401/403). Check it at replicate.com/account/api-tokens.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const account = await res.json();
  return account?.username || account?.name || "Replicate account";
}

async function handleInitiate({ tenantId, apiKey }) {
  if (!tenantId) return err("tenantId required");
  if (!apiKey)   return err("apiKey required");

  let accountName;
  try {
    accountName = await validateKey(apiKey);
  } catch (e) {
    return err(e.message, 400);
  }

  await saveCredential({
    tenantId,
    platform: "replicate",
    apiKey,
    note:     `connected as ${accountName}`,
  });

  return json({ ok: true, mode: "api_key", account: accountName });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "replicate" });
  return json({ ok: true });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return err("POST required", 405);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await req.json(); }
  catch { return err("Invalid JSON body", 400); }

  // Server-trusted tenantId — overrides any client-supplied value.
  body = { ...body, tenantId: auth.tenantId };

  try {
    switch (body.action) {
      case "initiate_connection": return handleInitiate(body);
      case "disconnect":          return handleDisconnect(body);
      default:
        return err(`Unknown action "${body.action}". Supported: initiate_connection, disconnect`);
    }
  } catch (e) {
    console.error("[replicate]", e);
    return err(`Replicate error: ${e.message}`, 502);
  }
}
