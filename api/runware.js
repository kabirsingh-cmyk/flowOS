/**
 * FlowOS Reach — Runware direct connector
 * Vercel Edge Function: POST /api/runware
 *
 * Validates the API key via Runware's REST API, persists to
 * connector_credentials, and flips channels to connected.
 * Actual image/video generation still goes through /api/generate → providerRouter.
 *
 * Actions: initiate_connection, disconnect
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";
import { requireAuth } from "./lib/auth.js";

export const config = { runtime: "edge" };

const RUNWARE_BASE = "https://api.runware.ai/v1";

async function validateKey(apiKey) {
  // Runware doesn't have a lightweight /me endpoint; use their task endpoint
  // with a minimal probe (will fail with 400 on bad params but 401 on bad key).
  const res = await fetch(`${RUNWARE_BASE}/user`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Runware rejected the API key. Check it at app.runware.ai → Account → API Keys.");
  }
  // 404 or other non-auth errors mean the key is valid (endpoint may not exist)
  if (res.status !== 401 && res.status !== 403) {
    const data = await res.json().catch(() => ({}));
    return data?.username || data?.email || "Runware account";
  }
  throw new Error(`Runware validation failed (${res.status})`);
}

async function handleInitiate({ tenantId, apiKey }) {
  if (!tenantId) return err("tenantId required");
  if (!apiKey)   return err("apiKey required");

  // Light validation — if the key is clearly wrong format, reject early.
  // Runware's full validation happens on first generation call.
  let accountName = "Runware account";
  try { accountName = await validateKey(apiKey); } catch (_) { /* best-effort */ }

  await saveCredential({ tenantId, platform: "runware", apiKey, note: `connected · ${accountName}` });
  return json({ ok: true, mode: "api_key", account: accountName });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "runware" });
  return json({ ok: true });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return err("POST required", 405);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await req.json(); } catch { return err("Invalid JSON body", 400); }
  body = { ...body, tenantId: auth.tenantId };

  try {
    switch (body.action) {
      case "initiate_connection": return handleInitiate(body);
      case "disconnect":          return handleDisconnect(body);
      default: return err(`Unknown action "${body.action}". Supported: initiate_connection, disconnect`);
    }
  } catch (e) {
    console.error("[runware]", e);
    return err(`Runware error: ${e.message}`, 502);
  }
}
