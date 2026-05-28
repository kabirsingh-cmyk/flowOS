/**
 * FlowOS — Zernio ads primitives
 * POST /api/zernio-ads
 *
 * Pre-flight + analytics primitives that don't fit the campaign-CRUD shape of
 * /api/paid-social. These are platform-agnostic Zernio endpoints used by the
 * ads-workspace targeting builder and the per-ad analytics drawer.
 *
 * Actions (PR 4a):
 *   targeting_search          — GET /v1/ads/targeting/search
 *   targeting_reach_estimate  — POST /v1/ads/targeting/reach-estimate
 *   ad_analytics              — GET /v1/ads/{adId}/analytics
 *
 * Response shape: { ok: true, data } | { ok: false, error }
 *
 * Required env vars:
 *   ZERNIO_API_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { requireAuth } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import { zernioFetch, requireZernioAccountId } from "./lib/zernioClient.js";
import { resolveAdsPlatform, SUPPORTED_PAID_PLATFORMS } from "./lib/zernioMap.js";

export const config = { runtime: "edge" };

const ALLOWED_DIMENSIONS = new Set(["geo", "interest", "behavior", "income"]);
const ALLOWED_GEO_TYPES  = new Set(["country", "region", "city", "zip", "metro"]);

// ─── Resolve the social-account ID for a paid-platform request ───────────────
// All three actions need to know which connected ad account to target. The
// caller passes `platform` (FlowOS short id, e.g. "metaads"); we resolve to
// the cached Zernio accountId stored on the channels row.
async function resolveAccountId(tenantId, platform) {
  if (!platform) throw new Error("platform required");
  const p = String(platform).toLowerCase();
  if (!SUPPORTED_PAID_PLATFORMS.has(p)) {
    throw new Error(`Unsupported platform: ${platform}. Supported: ${[...SUPPORTED_PAID_PLATFORMS].join(", ")}`);
  }
  return requireZernioAccountId(tenantId, p);
}

// ─── targeting_search ────────────────────────────────────────────────────────

async function targetingSearch({ tenantId, platform, q, dimension, geoType, countryCode, limit }) {
  if (!q || !String(q).trim()) throw new Error("q (search query) required");
  const dim = dimension || "interest";
  if (!ALLOWED_DIMENSIONS.has(dim)) {
    throw new Error(`Unsupported dimension: ${dimension}. Supported: ${[...ALLOWED_DIMENSIONS].join(", ")}`);
  }
  if (dim === "geo" && geoType && !ALLOWED_GEO_TYPES.has(geoType)) {
    throw new Error(`Unsupported geoType: ${geoType}. Supported: ${[...ALLOWED_GEO_TYPES].join(", ")}`);
  }

  const accountId = await resolveAccountId(tenantId, platform);
  const qs = new URLSearchParams({ accountId, q: String(q).trim(), dimension: dim });
  if (dim === "geo" && geoType)   qs.set("geoType",     geoType);
  if (countryCode)                qs.set("countryCode", String(countryCode).toUpperCase().slice(0, 2));
  if (Number.isFinite(limit))     qs.set("limit",       String(Math.max(1, Math.min(100, limit))));

  const data = await zernioFetch(`/ads/targeting/search?${qs}`, { method: "GET" });
  return { results: data.results || [] };
}

// ─── targeting_reach_estimate ────────────────────────────────────────────────

async function reachEstimate({ tenantId, platform, spec, optimizationGoal }) {
  if (!spec || typeof spec !== "object") throw new Error("spec (TargetingSpec) required");
  const accountId = await resolveAccountId(tenantId, platform);

  const payload = {
    accountId,
    spec,
    ...(optimizationGoal ? { optimizationGoal } : {}),
  };
  return zernioFetch(`/ads/targeting/reach-estimate`, {
    method: "POST",
    body:   JSON.stringify(payload),
  });
}

// ─── ad_analytics ────────────────────────────────────────────────────────────

async function adAnalytics({ adId, fromDate, toDate, breakdowns }) {
  if (!adId) throw new Error("adId required");
  const qs = new URLSearchParams();
  if (fromDate)   qs.set("fromDate",   fromDate);
  if (toDate)     qs.set("toDate",     toDate);
  if (breakdowns) qs.set("breakdowns", Array.isArray(breakdowns) ? breakdowns.join(",") : String(breakdowns));
  const suffix = qs.toString() ? `?${qs}` : "";
  return zernioFetch(`/ads/${encodeURIComponent(adId)}/analytics${suffix}`, { method: "GET" });
}

// ─── Main router ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST")    return errResponse("POST required", 405);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;

  let body;
  try { body = await req.json(); }
  catch { return errResponse("Invalid JSON body", 400); }

  const { action, ...params } = body;

  try {
    let result;
    switch (action) {
      case "targeting_search":
        result = await targetingSearch({ tenantId, ...params });
        break;
      case "targeting_reach_estimate":
        result = await reachEstimate({ tenantId, ...params });
        break;
      case "ad_analytics":
        // ad_analytics doesn't need tenantId — the adId is opaque to Zernio
        // and the bearer key authorises the read. But we still required auth
        // above so unauthenticated clients can't fan out arbitrary adId reads.
        result = await adAnalytics(params);
        break;
      default:
        return errResponse(`Unknown action: ${action}. Supported: targeting_search, targeting_reach_estimate, ad_analytics`);
    }
    return jsonResponse({ ok: true, data: result });
  } catch (e) {
    console.error("[zernio-ads]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(e.message, status);
  }
}
