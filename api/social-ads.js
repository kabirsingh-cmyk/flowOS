// FlowOS — Paid social ads action layer (Zernio-backed)
// Covers: metaads, liads (LinkedIn), ttads (TikTok), xads (X), pinads (Pinterest)
//
// Required env vars:
//   ZERNIO_API_KEY
//   SUPABASE_URL, SUPABASE_SERVICE_KEY — for accountId lookup from channels table

import { requireAuth } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";

export const config = { runtime: "edge" };

const ZERNIO_BASE = "https://zernio.com/api/v1";

// FlowOS platform id → Zernio slug
const PLATFORM_ID_MAP = {
  metaads:  "metaads",
  liads:    "linkedinads",
  ttads:    "tiktokads",
  xads:     "xads",
  pinads:   "pinterestads",
};

// ─── Zernio helpers ──────────────────────────────────────────────────────────

function zernioHeaders() {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new Error("ZERNIO_API_KEY env var not set");
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type":  "application/json",
  };
}

async function zernioFetch(path, options = {}) {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...options,
    headers: { ...zernioHeaders(), ...(options.headers || {}) },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error || data?.message || `Zernio ${path} ${res.status}: ${text.slice(0, 300)}`;
    throw Object.assign(new Error(msg), { status: res.status, zernioCode: data?.code });
  }
  return data;
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    "apikey":        key,
    "Authorization": `Bearer ${key}`,
    "Content-Type":  "application/json",
  };
}

/**
 * Look up the Zernio social account _id for a connected platform.
 * Stored in channels.composio_connection_id at verify-and-persist time.
 */
async function getZernioAccountId(tenantId, platform) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/channels` +
    `?user_id=eq.${encodeURIComponent(tenantId)}&platform=eq.${encodeURIComponent(platform)}` +
    `&select=composio_connection_id&limit=1`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.composio_connection_id || null;
}

/**
 * Resolve the Zernio slug and accountId for the given FlowOS platform id.
 * Throws a user-readable error if the platform is unknown or not connected.
 */
async function resolvePlatform(tenantId, platformId) {
  const zernioSlug = PLATFORM_ID_MAP[platformId];
  if (!zernioSlug) {
    throw new Error(`Unknown platform: ${platformId}. Supported: ${Object.keys(PLATFORM_ID_MAP).join(", ")}`);
  }
  const accountId = await getZernioAccountId(tenantId, platformId);
  if (!accountId) {
    throw new Error(`${platformId} is not connected. Connect it via the Connections panel.`);
  }
  return { zernioSlug, accountId };
}

// ─── Action handlers ─────────────────────────────────────────────────────────

async function listCampaigns({ platform, adAccountId }, tenantId) {
  const { zernioSlug, accountId } = await resolvePlatform(tenantId, platform);
  const qs = new URLSearchParams({ platform: zernioSlug, accountId });
  if (adAccountId) qs.set("adAccountId", String(adAccountId));
  const data = await zernioFetch(`/ads/campaigns?${qs}`, { method: "GET" });
  return data.campaigns || [];
}

async function createCampaign({ platform, adAccountId, name, goal, budget, targeting, creative }, tenantId) {
  const { zernioSlug, accountId } = await resolvePlatform(tenantId, platform);
  if (!name) throw new Error("name is required");
  if (!goal) throw new Error("goal is required");

  const data = await zernioFetch("/ads/create", {
    method: "POST",
    body:   JSON.stringify({
      platform:   zernioSlug,
      accountId,
      adAccountId,
      name,
      goal,
      budget,
      targeting,
      creative,
    }),
  });
  return data.ad || data;
}

async function boostPost({ platform, adAccountId, postId, name, goal, budget, schedule, targeting }, tenantId) {
  const { zernioSlug, accountId } = await resolvePlatform(tenantId, platform);
  if (!postId) throw new Error("postId is required");

  const data = await zernioFetch("/ads/boost", {
    method: "POST",
    body:   JSON.stringify({
      platform:   zernioSlug,
      accountId,
      adAccountId,
      postId,
      name,
      goal,
      budget,
      schedule,
      targeting,
    }),
  });
  return data.ad || data;
}

async function getAnalytics({ platform, campaignId }, tenantId) {
  const { zernioSlug, accountId } = await resolvePlatform(tenantId, platform);
  if (!campaignId) throw new Error("campaignId is required");
  const qs = new URLSearchParams({ platform: zernioSlug, accountId });
  const data = await zernioFetch(`/ads/${encodeURIComponent(campaignId)}/analytics?${qs}`, { method: "GET" });
  return data.analytics || data;
}

async function createAudience({ platform, adAccountId, type, name, lookalikeSource }, tenantId) {
  const { zernioSlug, accountId } = await resolvePlatform(tenantId, platform);
  if (!type) throw new Error("type is required");
  if (!name) throw new Error("name is required");

  const payload = { platform: zernioSlug, accountId, adAccountId, type, name };
  if (type === "lookalike" && lookalikeSource) payload.lookalikeSource = lookalikeSource;

  const data = await zernioFetch("/ads/audiences", {
    method: "POST",
    body:   JSON.stringify(payload),
  });
  return data.audience || data;
}

// ─── Main router ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return errResponse("POST required", 405);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;

  let body;
  try { body = await req.json(); }
  catch { return errResponse("Invalid JSON body", 400); }

  const { action, platform, ...params } = body;

  if (!platform) return errResponse("platform is required");

  try {
    let result;
    switch (action) {
      case "list_campaigns":
        result = await listCampaigns({ platform, ...params }, tenantId);
        break;
      case "create_campaign":
        result = await createCampaign({ platform, ...params }, tenantId);
        break;
      case "boost_post":
        result = await boostPost({ platform, ...params }, tenantId);
        break;
      case "get_analytics":
        result = await getAnalytics({ platform, ...params }, tenantId);
        break;
      case "create_audience":
        result = await createAudience({ platform, ...params }, tenantId);
        break;
      default:
        return errResponse(`Unknown action: ${action}. Supported: list_campaigns, create_campaign, boost_post, get_analytics, create_audience`);
    }

    return jsonResponse({ ok: true, data: result });
  } catch (e) {
    console.error("[social-ads]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(e.message, status);
  }
}
