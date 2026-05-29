/**
 * FlowOS Reach — Account health (Zernio)
 * Vercel Edge Function: POST /api/zernio-health
 *
 * Thin proxy over Zernio's /v1/accounts/health endpoints, scoped to the
 * authenticated tenant's Zernio profile.
 *
 * Actions:
 *   account_health_all  — GET /v1/accounts/health?profileId={tenant profile}
 *                         → { summary, accounts[] }
 *   account_health_one  — { accountId } → GET /v1/accounts/{accountId}/health
 *                         → detailed health record
 *
 * Auth: dual — user JWT (UI calls) OR cron secret (account-health cron).
 *       When called by cron the tenantId must be in the body so we know which
 *       Zernio profile to scope to; the cron stamps it from its own tenant
 *       iteration list.
 */

import { requireAuthOrCron } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import { zernioFetch, getCachedZernioProfile } from "./lib/zernioClient.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST")    return errResponse("Method not allowed", 405);

  let body;
  try { body = await req.json(); }
  catch { return errResponse("Invalid JSON body", 400); }

  const auth = await requireAuthOrCron(req, body.tenantId);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;

  const { action } = body || {};
  if (!action) return errResponse("action required", 400);

  try {
    if (action === "account_health_all") {
      const profileId = await getCachedZernioProfile(tenantId);
      // No profile = the tenant has never connected a Zernio platform — return
      // an empty result rather than 422 so the cron can iterate cleanly.
      if (!profileId) {
        return jsonResponse({ ok: true, summary: { total: 0 }, accounts: [] });
      }
      const data = await zernioFetch(
        `/accounts/health?profileId=${encodeURIComponent(profileId)}`
      );
      return jsonResponse({
        ok:       true,
        summary:  data.summary  || {},
        accounts: data.accounts || [],
      });
    }

    if (action === "account_health_one") {
      const { accountId } = body;
      if (!accountId) return errResponse("accountId required", 400);
      const data = await zernioFetch(
        `/accounts/${encodeURIComponent(accountId)}/health`
      );
      return jsonResponse({ ok: true, health: data });
    }

    return errResponse(`Unknown action: ${action}`, 400);
  } catch (e) {
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(e.message || "Zernio health request failed", status);
  }
}
