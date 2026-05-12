/**
 * Shared Composio helpers — imported by chat.js and analytics-ingest.js
 */

export const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";

export function composioHeaders() {
  const key = process.env.COMPOSIO_API_KEY2;
  if (!key) throw new Error("COMPOSIO_API_KEY2 not set");
  return { "Content-Type": "application/json", "x-api-key": key };
}

/**
 * Returns the list of active toolkit slugs for a tenant.
 * Common base used by both fetchComposioTools (chat.js) and getConnectedApps (analytics-ingest.js).
 */
export async function getConnectedAccountSlugs(tenantId) {
  if (!process.env.COMPOSIO_API_KEY2 || !tenantId) return [];
  try {
    const res = await fetch(
      `${COMPOSIO_BASE}/connected_accounts?user_ids=${encodeURIComponent(tenantId)}&statuses=ACTIVE&limit=50`,
      { headers: composioHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const accounts = data.items || data.connected_accounts || data.data || [];
    return [...new Set(
      accounts.map(a => a.toolkit?.slug || a.appName || a.app_name).filter(Boolean)
    )];
  } catch {
    return [];
  }
}

/**
 * Execute a Composio tool against a real platform API.
 * @param {string}  toolName
 * @param {object}  toolInput
 * @param {string}  tenantId
 * @param {object}  opts
 * @param {"object"|"null"} opts.onError  "object" → { error } on failure, "null" → null
 */
export async function executeComposioTool(toolName, toolInput, tenantId, { onError = "object" } = {}) {
  try {
    const res = await fetch(`${COMPOSIO_BASE}/tools/${toolName}/execute`, {
      method:  "POST",
      headers: composioHeaders(),
      body:    JSON.stringify({ user_id: tenantId, input: toolInput }),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
      const msg = data?.message || `Composio execution failed (${res.status})`;
      return onError === "null" ? null : { error: msg };
    }
    return data?.response || data?.data || data;
  } catch (e) {
    return onError === "null" ? null : { error: e.message };
  }
}
