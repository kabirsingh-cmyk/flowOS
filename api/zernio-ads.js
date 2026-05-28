/**
 * FlowOS — Zernio ads primitives
 * POST /api/zernio-ads
 *
 * Pre-flight + analytics primitives that don't fit the campaign-CRUD shape of
 * /api/paid-social. These are platform-agnostic Zernio endpoints used by the
 * ads-workspace targeting builder and the per-ad analytics drawer.
 *
 * Actions (PR 4a):
 *   targeting_search          — GET  /v1/ads/targeting/search
 *   targeting_reach_estimate  — POST /v1/ads/targeting/reach-estimate
 *   ad_analytics              — GET  /v1/ads/{adId}/analytics
 *
 * Actions (PR 4b):
 *   audiences_list            — GET    /v1/ads/audiences
 *   audiences_create          — POST   /v1/ads/audiences
 *   audiences_get             — GET    /v1/ads/audiences/{audienceId}
 *   audiences_delete          — DELETE /v1/ads/audiences/{audienceId}
 *   audiences_add_users       — POST   /v1/ads/audiences/{audienceId}/users
 *                                (Zernio hashes server-side; we forward raw
 *                                 {email, phone} objects.)
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

// ─── audiences ───────────────────────────────────────────────────────────────
// Per Zernio:
//   - customer_list is supported on Meta, Google, X, LinkedIn, TikTok, Pinterest
//   - website + lookalike are Meta-only
//   - saved_targeting stores a reusable TargetingSpec; no member upload
// We enforce the website/lookalike gate locally to fail fast with a clear
// message rather than waiting for Zernio's 400.

const META_ONLY_AUDIENCE_TYPES = new Set(["website", "lookalike"]);

function assertMetaForAudienceType(platform, type) {
  if (META_ONLY_AUDIENCE_TYPES.has(type) && platform !== "metaads") {
    throw Object.assign(
      new Error(`${type} audiences are Meta-only. Supported platforms: metaads.`),
      { status: 400 }
    );
  }
}

async function audiencesList({ tenantId, platform, adAccountId, type }) {
  if (!adAccountId) throw new Error("adAccountId required");
  const accountId    = await resolveAccountId(tenantId, platform);
  const platformSlug = resolveAdsPlatform(platform);
  const qs = new URLSearchParams({ accountId, adAccountId: String(adAccountId), platform: platformSlug });
  if (type) qs.set("type", type);
  const data = await zernioFetch(`/ads/audiences?${qs}`, { method: "GET" });
  return { audiences: data.audiences || [] };
}

async function audiencesCreate({
  tenantId, platform, adAccountId, name, description, type,
  pixelId, retentionDays, sourceAudienceId, country, ratio, rule, customerFileSource,
  spec,
}) {
  if (!type) throw new Error("type required (customer_list | website | lookalike | saved_targeting)");
  assertMetaForAudienceType(platform, type);

  const accountId = await resolveAccountId(tenantId, platform);

  let payload;
  if (type === "saved_targeting") {
    if (!spec) throw new Error("spec required for saved_targeting audiences");
    payload = { accountId, name, description, type, spec };
  } else {
    if (!adAccountId) throw new Error("adAccountId required for uploaded/derived audiences");
    if (!name)        throw new Error("name required");
    if (type === "website") {
      if (!pixelId)       throw new Error("pixelId required for website audiences");
      if (!retentionDays) throw new Error("retentionDays required for website audiences");
    }
    if (type === "lookalike") {
      if (!sourceAudienceId) throw new Error("sourceAudienceId required for lookalike audiences");
      if (!country)          throw new Error("country required for lookalike audiences");
      if (!Number.isFinite(ratio)) throw new Error("ratio required for lookalike audiences");
    }
    payload = {
      accountId,
      adAccountId: String(adAccountId),
      name,
      type,
      ...(description        ? { description }        : {}),
      ...(pixelId            ? { pixelId }            : {}),
      ...(retentionDays      ? { retentionDays }      : {}),
      ...(sourceAudienceId   ? { sourceAudienceId }   : {}),
      ...(country            ? { country }            : {}),
      ...(Number.isFinite(ratio) ? { ratio }          : {}),
      ...(rule               ? { rule }               : {}),
      ...(customerFileSource ? { customerFileSource } : {}),
    };
  }

  return zernioFetch(`/ads/audiences`, { method: "POST", body: JSON.stringify(payload) });
}

async function audiencesGet({ audienceId }) {
  if (!audienceId) throw new Error("audienceId required");
  return zernioFetch(`/ads/audiences/${encodeURIComponent(audienceId)}`, { method: "GET" });
}

async function audiencesDelete({ audienceId }) {
  if (!audienceId) throw new Error("audienceId required");
  return zernioFetch(`/ads/audiences/${encodeURIComponent(audienceId)}`, { method: "DELETE" });
}

async function audiencesAddUsers({ audienceId, users }) {
  if (!audienceId) throw new Error("audienceId required");
  if (!Array.isArray(users) || users.length === 0) throw new Error("users[] required");
  if (users.length > 10000) throw new Error("Max 10000 users per request — split into chunks.");
  // Each user must have at least email or phone.
  const clean = users
    .map(u => {
      const out = {};
      if (u?.email) out.email = String(u.email).trim().toLowerCase();
      if (u?.phone) out.phone = String(u.phone).trim();
      return out;
    })
    .filter(u => u.email || u.phone);
  if (clean.length === 0) throw new Error("No users with email or phone after cleaning.");
  return zernioFetch(`/ads/audiences/${encodeURIComponent(audienceId)}/users`, {
    method: "POST",
    body:   JSON.stringify({ users: clean }),
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
      case "audiences_list":
        result = await audiencesList({ tenantId, ...params });
        break;
      case "audiences_create":
        result = await audiencesCreate({ tenantId, ...params });
        break;
      case "audiences_get":
        result = await audiencesGet(params);
        break;
      case "audiences_delete":
        result = await audiencesDelete(params);
        break;
      case "audiences_add_users":
        result = await audiencesAddUsers(params);
        break;
      default:
        return errResponse(
          `Unknown action: ${action}. Supported: targeting_search, targeting_reach_estimate, ` +
          `ad_analytics, audiences_list, audiences_create, audiences_get, audiences_delete, audiences_add_users`
        );
    }
    return jsonResponse({ ok: true, data: result });
  } catch (e) {
    console.error("[zernio-ads]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(e.message, status);
  }
}
