/**
 * FlowOS Reach — Account health cron
 * Vercel Cron: GET /api/cron/account-health — runs every 15 min.
 *
 * For each tenant that has at least one Zernio-backed channel row:
 *   1. POST /api/zernio-health { action: "account_health_all", tenantId }
 *   2. Map each returned account → FlowOS channel row by accountId
 *      (channels.composio_connection_id) and UPSERT channels.health_status.
 *
 * Status mapping:
 *   Zernio "healthy" → FlowOS "healthy"
 *   Zernio "warning" → FlowOS "degraded"
 *   Zernio "error"   → FlowOS "reconnect"  (or anything with needsReconnect)
 *
 * The cron is platform-blind: it only refreshes rows whose accountId Zernio
 * already knows about. A revoked-outside-FlowOS account stays in Zernio's
 * /accounts/health response (now status=error), so its tile flips on the
 * next tick. New connects show up as soon as the next cron run.
 */

import { requireCron } from "../lib/auth.js";

export const config = { runtime: "edge" };

const ZERNIO_TO_FLOWOS_STATUS = {
  healthy: "healthy",
  warning: "degraded",
  error:   "reconnect",
};

export default async function handler(req) {
  const cronAuth = requireCron(req);
  if (cronAuth instanceof Response) return cronAuth;

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) {
    return json(500, { ok: false, error: "Supabase env vars not configured" });
  }

  // ── List tenants that have a Zernio profile (anyone we can ask about) ────
  let tenantIds;
  try {
    const res = await fetch(
      `${sbUrl}/rest/v1/connector_credentials?platform=eq.zernio_profile&select=user_id`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
    );
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const rows = await res.json();
    tenantIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
  } catch (e) {
    return json(500, { ok: false, error: `Could not fetch tenants: ${e.message}` });
  }

  if (tenantIds.length === 0) {
    return json(200, { ok: true, processed: 0, message: "No Zernio tenants" });
  }

  const origin  = new URL(req.url).origin;
  const results = [];

  for (const tenantId of tenantIds) {
    const start = Date.now();
    try {
      const res = await fetch(`${origin}/api/zernio-health`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ action: "account_health_all", tenantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        results.push({ tenantId, ok: false, error: data.error || `HTTP ${res.status}` });
        continue;
      }

      const accounts = Array.isArray(data.accounts) ? data.accounts : [];
      const now = new Date().toISOString();
      let updated = 0;
      for (const acc of accounts) {
        if (!acc?.accountId) continue;
        const flowosStatus = ZERNIO_TO_FLOWOS_STATUS[acc.status] || "healthy";
        const needsReconnect = !!acc.needsReconnect || flowosStatus === "reconnect";
        const message = needsReconnect
          ? "Needs reconnect"
          : (acc.issues?.[0] || (flowosStatus === "degraded" ? "Permissions limited" : "Connected"));

        const health = {
          status:         flowosStatus,
          lastChecked:    now,
          message,
          needsReconnect,
        };

        // Patch the channels row keyed by the Zernio accountId we stamped at
        // connect time. user_id scoping prevents cross-tenant collisions if
        // two tenants happen to surface the same accountId from Zernio.
        const patchRes = await fetch(
          `${sbUrl}/rest/v1/channels?user_id=eq.${encodeURIComponent(tenantId)}` +
          `&composio_connection_id=eq.${encodeURIComponent(acc.accountId)}`,
          {
            method:  "PATCH",
            headers: {
              apikey:         sbKey,
              Authorization:  `Bearer ${sbKey}`,
              "Content-Type": "application/json",
              Prefer:         "return=minimal",
            },
            body: JSON.stringify({ health_status: health, updated_at: now }),
          }
        );
        if (patchRes.ok) updated++;
      }

      results.push({
        tenantId,
        ok:       true,
        elapsed:  `${Date.now() - start}ms`,
        accounts: accounts.length,
        updated,
      });
    } catch (e) {
      results.push({ tenantId, ok: false, error: e.message });
    }
  }

  const passed = results.filter(r => r.ok).length;
  console.log(`[cron/account-health] ${passed}/${results.length} ok`, results);
  return json(200, {
    ok:        results.every(r => r.ok),
    processed: results.length,
    passed,
    failed:    results.length - passed,
    results,
  });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
