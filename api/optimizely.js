/**
 * FlowOS — Optimizely connector (Direct API, per-tenant API key)
 * Vercel Edge Function: POST /api/optimizely
 *
 * Actions:
 *   initiate_connection — validate Personal Access Token via GET /v2/projects,
 *                         persist to connector_credentials, flip channels to connected
 *   disconnect          — drop credential + flip channels to disconnected
 *
 * Optimizely's REST API (api.optimizely.com) uses Bearer auth with a Personal
 * Access Token minted at app.optimizely.com → Profile → API Access. The
 * /v2/projects endpoint is the cheapest token-validating call — returns the
 * list of projects the token can see, surfaced as the connection note.
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";
import { requireAuth } from "./lib/auth.js";

export const config = { runtime: "edge" };

const OPTIMIZELY_BASE = "https://api.optimizely.com/v2";

async function validateKey(apiKey) {
  const res = await fetch(`${OPTIMIZELY_BASE}/projects`, {
    headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Optimizely rejected the token (401/403). Mint a Personal Access Token at app.optimizely.com → Profile → API Access.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Optimizely validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = await res.json().catch(() => []);
  const projects = Array.isArray(data) ? data : (data?.items || []);
  return `${projects.length} project${projects.length === 1 ? "" : "s"} visible`;
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
    platform: "optimizely",
    apiKey,
    note:     `connected · ${note}`,
  });

  return json({ ok: true, mode: "api_key", note });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "optimizely" });
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

  body = { ...body, tenantId: auth.tenantId };

  try {
    switch (body.action) {
      case "initiate_connection": return handleInitiate(body);
      case "disconnect":          return handleDisconnect(body);
      default:
        return err(`Unknown action "${body.action}". Supported: initiate_connection, disconnect`);
    }
  } catch (e) {
    console.error("[optimizely]", e);
    return err(`Optimizely error: ${e.message}`, 502);
  }
}
