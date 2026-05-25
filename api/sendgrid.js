/**
 * FlowOS — SendGrid direct connector
 * Vercel Edge Function: POST /api/sendgrid
 *
 * Validates the API key against SendGrid's /v3/user/profile endpoint,
 * then persists to connector_credentials and flips channels to connected.
 *
 * Actions: initiate_connection, disconnect
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";
import { requireAuth } from "./lib/auth.js";

export const config = { runtime: "edge" };

const SG_BASE = "https://api.sendgrid.com";

async function validateKey(apiKey) {
  const res = await fetch(`${SG_BASE}/v3/user/profile`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("SendGrid rejected the API key. Check it at app.sendgrid.com → Settings → API Keys.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendGrid validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const profile = await res.json();
  return profile?.username || profile?.email || "SendGrid account";
}

async function handleInitiate({ tenantId, apiKey }) {
  if (!tenantId) return err("tenantId required");
  if (!apiKey)   return err("apiKey required");

  let accountName;
  try { accountName = await validateKey(apiKey); } catch (e) { return err(e.message, 400); }

  await saveCredential({ tenantId, platform: "sendgrid", apiKey, note: `connected as ${accountName}` });
  return json({ ok: true, mode: "api_key", account: accountName });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "sendgrid" });
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
    console.error("[sendgrid]", e);
    return err(`SendGrid error: ${e.message}`, 502);
  }
}
