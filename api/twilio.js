/**
 * FlowOS — Twilio direct connector
 * Vercel Edge Function: POST /api/twilio
 *
 * Validates Account SID + Auth Token via Twilio's /2010-04-01/Accounts/{SID}.json,
 * then persists to connector_credentials and flips channels to connected.
 * The credential stored is a JSON blob: { accountSid, authToken }.
 *
 * Actions: initiate_connection, disconnect
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";
import { requireAuth } from "./lib/auth.js";

export const config = { runtime: "edge" };

async function validateCredentials(accountSid, authToken) {
  if (!accountSid || !accountSid.startsWith("AC")) {
    throw new Error("Account SID must start with 'AC'. Find it at console.twilio.com → Dashboard.");
  }
  const creds = btoa(`${accountSid}:${authToken}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (res.status === 401) throw new Error("Twilio rejected the credentials. Check your Account SID and Auth Token.");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const account = await res.json();
  return account?.friendly_name || accountSid;
}

async function handleInitiate({ tenantId, accountSid, authToken }) {
  if (!tenantId)   return err("tenantId required");
  if (!accountSid) return err("accountSid required");
  if (!authToken)  return err("authToken required");

  let accountName;
  try { accountName = await validateCredentials(accountSid, authToken); } catch (e) { return err(e.message, 400); }

  // Store as JSON blob so we can reconstruct Basic auth for downstream calls.
  const credBlob = JSON.stringify({ accountSid, authToken });
  await saveCredential({ tenantId, platform: "twilio", apiKey: credBlob, note: `connected as ${accountName}` });
  return json({ ok: true, mode: "api_key", account: accountName });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "twilio" });
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
    console.error("[twilio]", e);
    return err(`Twilio error: ${e.message}`, 502);
  }
}
