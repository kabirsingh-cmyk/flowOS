/**
 * FlowOS — WordPress connector (Direct API, per-tenant Application Password)
 * Vercel Edge Function: POST /api/wordpress
 *
 * Actions:
 *   initiate_connection — validate Application Password via
 *                         GET <siteUrl>/wp-json/wp/v2/users/me, persist to
 *                         connector_credentials, flip channels to connected
 *   disconnect          — drop credential + flip channels to disconnected
 *
 * WordPress's REST API uses Application Passwords (Users → Profile → App
 * Passwords) over HTTP Basic Auth. Each install lives at its own host, so the
 * credential is a 3-tuple: { siteUrl, username, appPassword }. We serialize
 * the tuple as a JSON blob into connector_credentials.secret_value — the
 * shared helper treats it as opaque text; downstream callers deserialize.
 *
 * Validation hits /wp-json/wp/v2/users/me which is universal across every
 * WordPress install (self-hosted or wordpress.com Jetpack-enabled).
 */

import { saveCredential, deleteCredential, json, err, CORS } from "./lib/directCredentials.js";

export const config = { runtime: "edge" };

function normalizeSiteUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) throw new Error("siteUrl required");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s.replace(/\/+$/, "");
}

async function validateApplicationPassword({ siteUrl, username, appPassword }) {
  const url = `${siteUrl}/wp-json/wp/v2/users/me?context=edit`;
  // Edge runtime supports btoa.
  const basic = btoa(`${username}:${appPassword}`);
  const res = await fetch(url, {
    headers: { "Authorization": `Basic ${basic}`, "Accept": "application/json" },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("WordPress rejected the Application Password (401/403). Mint one at Users → Profile → Application Passwords.");
  }
  if (res.status === 404) {
    throw new Error(`No WP REST API at ${siteUrl}/wp-json. Confirm the site URL and that the REST API isn't blocked by a security plugin.`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WordPress validation failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const user = await res.json().catch(() => ({}));
  return user?.name || user?.slug || username;
}

async function handleInitiate({ tenantId, siteUrl, username, appPassword }) {
  if (!tenantId)     return err("tenantId required");
  if (!username)     return err("username required");
  if (!appPassword)  return err("appPassword required");

  let site, displayName;
  try {
    site = normalizeSiteUrl(siteUrl);
    displayName = await validateApplicationPassword({ siteUrl: site, username, appPassword });
  } catch (e) {
    return err(e.message, 400);
  }

  // Store the 3-tuple as a JSON blob in secret_value — opaque to the helper,
  // deserialized by downstream callers (e.g. a future /api/wordpress publish).
  await saveCredential({
    tenantId,
    platform: "wordpress",
    apiKey:   JSON.stringify({ siteUrl: site, username, appPassword }),
    note:     `connected · ${displayName} @ ${site.replace(/^https?:\/\//, "")}`,
  });

  return json({ ok: true, mode: "application_password", site, user: displayName });
}

async function handleDisconnect({ tenantId }) {
  if (!tenantId) return err("tenantId required");
  await deleteCredential({ tenantId, platform: "wordpress" });
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
    console.error("[wordpress]", e);
    return err(`WordPress error: ${e.message}`, 502);
  }
}
