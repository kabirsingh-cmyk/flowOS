/**
 * FlowOS — Paid Social Ads via Zernio
 * POST /api/paid-social
 *
 * Handles all five paid social platforms in a single route.
 * Required body field: platform (metaads | liads | ttads | xads | pinads)
 *
 * Actions (mirrors api/google-ads.js contract):
 *   list_campaigns   — campaigns + metrics for the connected ad account
 *   create_campaign  — create a new campaign (paused by default)
 *   update_budget    — change daily budget on a campaign
 *   enable_campaign  — set status → active
 *   pause_campaign   — set status → paused
 *   campaign_detail  — ads + aggregated metrics for a campaign
 *   generate_copy    — Claude-generated ad copy tailored to platform format
 *
 * Response shape: { ok: true, data } | { ok: false, error }
 *
 * Required env vars:
 *   ZERNIO_API_KEY               — same key used by api/zernio.js
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 *   ANTHROPIC_API_KEY            — generate_copy only
 */

import { requireAuth } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import { getFastModel } from "./lib/anthropic.js";

export const config = { runtime: "edge" };

const ZERNIO_BASE = "https://zernio.com/api/v1";

// ─── FlowOS ID → Zernio platform slug ────────────────────────────────────────
// Zernio's ads endpoints accept the organic platform name (meta, linkedin, etc.)
// rather than the ads-specific slug (metaads, linkedinads, etc.).

const PLATFORM_SLUG = {
  metaads: "meta",
  liads:   "linkedin",
  ttads:   "tiktok",
  xads:    "twitter",
  pinads:  "pinterest",
};

const SUPPORTED = new Set(Object.keys(PLATFORM_SLUG));

function resolvePlatformSlug(platform) {
  return PLATFORM_SLUG[platform?.toLowerCase()] || platform?.toLowerCase();
}

// ─── Copy format hints per platform ──────────────────────────────────────────

const COPY_FORMAT = {
  metaads: {
    headline: { max: 40,  label: "Primary text" },
    body:     { max: 125, label: "Description" },
    cta:      true,
    note:     "Include emoji where natural. Meta rewards curiosity and scroll-stopping hooks.",
  },
  liads: {
    headline: { max: 70,  label: "Headline" },
    body:     { max: 600, label: "Introductory text" },
    cta:      true,
    note:     "Professional tone. Lead with the business outcome, not the product.",
  },
  ttads: {
    headline: { max: 100, label: "Ad text" },
    body:     { max: 0,   label: "" },
    cta:      true,
    note:     "TikTok is native-feel, not ad-feel. Short punchy hook (≤5 words), action-forward CTA.",
  },
  xads: {
    headline: { max: 280, label: "Tweet text" },
    body:     { max: 0,   label: "" },
    cta:      false,
    note:     "Reads like an organic tweet. Avoid corporate language. Hashtags only if truly relevant.",
  },
  pinads: {
    headline: { max: 100, label: "Title" },
    body:     { max: 500, label: "Description" },
    cta:      false,
    note:     "Inspirational framing. Focus on the result / aesthetic — Pinterest users are in discovery mode.",
  },
};

// ─── Zernio helpers ───────────────────────────────────────────────────────────

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

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    "apikey":        key,
    "Authorization": `Bearer ${key}`,
    "Content-Type":  "application/json",
  };
}

async function getZernioAccountId(tenantId, platform) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/channels` +
    `?user_id=eq.${encodeURIComponent(tenantId)}&platform=eq.${encodeURIComponent(platform)}` +
    `&select=composio_connection_id&limit=1`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.composio_connection_id || null;
}

async function resolveAdAccountId(tenantId, platform) {
  const accountId = await getZernioAccountId(tenantId, platform);
  if (accountId) return accountId;
  throw new Error(
    `No ${platform} account connected. Connect it via Connections → Ads.`
  );
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function listCampaigns({ tenantId, platform, adAccountId }) {
  const socialAccountId   = await resolveAdAccountId(tenantId, platform);
  const platformSlug      = resolvePlatformSlug(platform);
  const qs = new URLSearchParams({ platform: platformSlug, accountId: socialAccountId });
  if (adAccountId) qs.set("adAccountId", String(adAccountId));

  const data = await zernioFetch(`/ads/campaigns?${qs}`, { method: "GET" });
  return (data.campaigns || []).map(c => ({
    id:          c.platformCampaignId || c._id,
    name:        c.campaignName || c.name,
    status:      (c.status || "").toLowerCase().replace(/_/g, "-"),
    budgetMonth: c.budget?.amount ? Math.round(c.budget.amount * 30.4) : null,
    spend:       c.metrics?.spend        || 0,
    impressions: c.metrics?.impressions  || 0,
    clicks:      c.metrics?.clicks       || 0,
    ctr:         c.metrics?.ctr   != null ? +(c.metrics.ctr.toFixed(1))   : 0,
    cpc:         c.metrics?.cpc   != null ? +(c.metrics.cpc.toFixed(2))   : 0,
    cpm:         c.metrics?.cpm   != null ? +(c.metrics.cpm.toFixed(2))   : 0,
    conversions: c.metrics?.conversions  || 0,
    roas:        c.metrics?.roas         || null,
  }));
}

async function getCampaignDetail({ tenantId, platform, campaignId, adAccountId }) {
  if (!campaignId) throw new Error("campaignId required");
  const socialAccountId = await resolveAdAccountId(tenantId, platform);
  const platformSlug    = resolvePlatformSlug(platform);
  const qs = new URLSearchParams({ platform: platformSlug, accountId: socialAccountId, campaignId });
  if (adAccountId) qs.set("adAccountId", String(adAccountId));

  const data = await zernioFetch(`/ads?${qs}`, { method: "GET" });
  const ads  = data.ads || [];
  return {
    ads: ads.map(ad => ({
      id:      ad.platformAdId || ad._id,
      name:    ad.name,
      status:  ad.status,
      type:    ad.adType,
      metrics: ad.metrics || {},
    })),
    metrics: aggregateMetrics(ads),
  };
}

async function createCampaign({ tenantId, platform, name, budgetDaily, linkUrl, headline, body, adAccountId, targeting }) {
  if (!linkUrl) throw new Error("linkUrl is required to create a campaign.");
  const socialAccountId = await resolveAdAccountId(tenantId, platform);
  const platformSlug    = resolvePlatformSlug(platform);
  const fmt             = COPY_FORMAT[platform] || {};

  // LinkedIn supports audience targeting by job function, seniority, company
  // size, and geo. Other platforms ignore the targeting field.
  const liTargeting = platform === "liads" && targeting ? {
    targeting: {
      ...(targeting.geo           ? { geoLocations:  [].concat(targeting.geo)           } : {}),
      ...(targeting.jobFunction   ? { jobFunctions:  [].concat(targeting.jobFunction)   } : {}),
      ...(targeting.seniority     ? { seniorities:   [].concat(targeting.seniority)     } : {}),
      ...(targeting.companySize   ? { companySizes:  [].concat(targeting.companySize)   } : {}),
    },
  } : {};

  const payload = {
    accountId:    socialAccountId,
    platform:     platformSlug,
    name:         name || `FlowOS campaign · ${new Date().toISOString().slice(0, 10)}`,
    goal:         "traffic",
    budgetAmount: budgetDaily || 10,
    budgetType:   "daily",
    headline:     headline ? headline.slice(0, fmt.headline?.max || 100) : (name || "").slice(0, 40),
    body:         body     ? body.slice(0, fmt.body?.max || 500)         : "Discover what we have to offer.",
    linkUrl,
    ...liTargeting,
    ...(adAccountId ? { adAccountId: String(adAccountId) } : {}),
  };

  const data = await zernioFetch("/ads/create", {
    method: "POST",
    body:   JSON.stringify(payload),
  });

  const ad         = data.ad || {};
  const campaignId = ad.platformCampaignId || ad._id;
  if (!campaignId) throw new Error("Zernio created the ad but returned no campaign ID.");

  // Always start paused — user enables explicitly
  await zernioFetch(`/ads/campaigns/${encodeURIComponent(campaignId)}/status`, {
    method: "PUT",
    body:   JSON.stringify({ status: "paused", platform: platformSlug }),
  });

  return { id: campaignId, name: payload.name, status: "paused" };
}

async function updateBudget({ tenantId, platform, campaignId, dailyBudget, adAccountId }) {
  if (!campaignId)       throw new Error("campaignId required");
  if (dailyBudget == null) throw new Error("dailyBudget required");

  const socialAccountId = await resolveAdAccountId(tenantId, platform);
  const platformSlug    = resolvePlatformSlug(platform);
  const qs = new URLSearchParams({ platform: platformSlug, accountId: socialAccountId, campaignId, limit: "1" });
  if (adAccountId) qs.set("adAccountId", String(adAccountId));

  const list = await zernioFetch(`/ads?${qs}`, { method: "GET" });
  const ad   = (list.ads || [])[0];
  if (!ad) throw new Error("No ads found in this campaign; budget cannot be updated.");

  return zernioFetch(`/ads/${encodeURIComponent(ad._id)}`, {
    method: "PUT",
    body:   JSON.stringify({ budget: { amount: dailyBudget, type: "daily" } }),
  });
}

async function setCampaignStatus({ tenantId, platform, campaignId, status }) {
  if (!campaignId) throw new Error("campaignId required");
  const platformSlug = resolvePlatformSlug(platform);
  return zernioFetch(`/ads/campaigns/${encodeURIComponent(campaignId)}/status`, {
    method: "PUT",
    body:   JSON.stringify({ status, platform: platformSlug }),
  });
}

// ─── LinkedIn only: promote an existing organic post as sponsored content ─────
// postUrn: LinkedIn share URN ("urn:li:share:1234567890") from the published row.
// Returns { id, name, status } for the new sponsored campaign.

async function boostLinkedInPost({ tenantId, postUrn, budgetDaily, targeting, name, adAccountId }) {
  if (![tenantId, postUrn].every(Boolean)) throw new Error("tenantId and postUrn are required");
  const socialAccountId = await resolveAdAccountId(tenantId, "liads");

  const liTargeting = targeting ? {
    ...(targeting.geo         ? { geoLocations: [].concat(targeting.geo)         } : {}),
    ...(targeting.jobFunction ? { jobFunctions: [].concat(targeting.jobFunction) } : {}),
    ...(targeting.seniority   ? { seniorities:  [].concat(targeting.seniority)   } : {}),
    ...(targeting.companySize ? { companySizes: [].concat(targeting.companySize) } : {}),
  } : {};

  const payload = {
    accountId:    socialAccountId,
    platform:     "linkedin",
    adType:       "sponsored_content",
    postUrn,
    name:         name || `Boost · ${new Date().toISOString().slice(0, 10)}`,
    goal:         "awareness",
    budgetAmount: budgetDaily || 10,
    budgetType:   "daily",
    targeting:    liTargeting,
    ...(adAccountId ? { adAccountId: String(adAccountId) } : {}),
  };

  const data        = await zernioFetch("/ads/create", { method: "POST", body: JSON.stringify(payload) });
  const ad          = data.ad || {};
  const campaignId  = ad.platformCampaignId || ad._id;
  if (!campaignId) throw new Error("Zernio created the boost but returned no campaign ID.");

  // Start paused — user enables explicitly
  await zernioFetch(`/ads/campaigns/${encodeURIComponent(campaignId)}/status`, {
    method: "PUT",
    body:   JSON.stringify({ status: "paused", platform: "linkedin" }),
  });

  return { id: campaignId, name: payload.name, status: "paused", postUrn };
}

async function generateAdCopy({ platform, brandName, productName, keywords, tone, url, voiceNote }) {
  const fmt = COPY_FORMAT[platform] || COPY_FORMAT.metaads;

  const headlineInstruction = fmt.headline?.max
    ? `Headline / primary text: max ${fmt.headline.max} chars (field: "${fmt.headline.label}")`
    : "";
  const bodyInstruction = fmt.body?.max
    ? `Body / description: max ${fmt.body.max} chars (field: "${fmt.body.label}")`
    : "";

  const prompt = `You are an expert paid social ad copywriter.
Generate high-converting ad copy for ${platform?.toUpperCase() || "paid social"}.

Brand: ${brandName || ""}
Product/Service: ${productName || ""}
Keywords/themes: ${(keywords || []).join(", ")}
Tone: ${tone || "professional, benefit-led"}
Landing page: ${url || ""}
${voiceNote ? `Additional context: ${voiceNote}` : ""}

Platform notes: ${fmt.note || ""}
${headlineInstruction}
${bodyInstruction}
${fmt.cta ? "Include a clear CTA in each variant." : ""}

Output ONLY valid JSON — no other text:
{
  "variants": [
    { "headline": "...", "body": "...", "cta": "..." },
    { "headline": "...", "body": "...", "cta": "..." },
    { "headline": "...", "body": "...", "cta": "..." }
  ]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      model:      getFastModel(),
      max_tokens: 800,
      messages:   [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const raw  = data.content?.[0]?.text || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { variants: [] };
  }
}

function aggregateMetrics(ads) {
  const out = { spend: 0, impressions: 0, clicks: 0, conversions: 0, cpc: 0, ctr: 0, roas: null };
  let revenue = 0;
  for (const ad of ads) {
    const m = ad.metrics || {};
    out.spend       += m.spend       || 0;
    out.impressions += m.impressions || 0;
    out.clicks      += m.clicks      || 0;
    out.conversions += m.conversions || 0;
    revenue         += m.purchaseValue || 0;
  }
  if (out.impressions > 0) out.ctr = +((out.clicks / out.impressions * 100).toFixed(1));
  if (out.clicks      > 0) out.cpc = +((out.spend  / out.clicks).toFixed(2));
  if (out.spend       > 0) out.roas = +(revenue / out.spend).toFixed(2);
  return out;
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

  const { action, platform, ...params } = body;

  if (!platform) return errResponse("platform required (metaads | liads | ttads | xads | pinads)");
  if (!SUPPORTED.has(platform.toLowerCase())) {
    return errResponse(`Unsupported platform: ${platform}. Supported: ${[...SUPPORTED].join(", ")}`);
  }

  const p = platform.toLowerCase();

  try {
    let result;
    switch (action) {
      case "list_campaigns":
        result = await listCampaigns({ tenantId, platform: p, ...params });
        break;
      case "campaign_detail":
        result = await getCampaignDetail({ tenantId, platform: p, ...params });
        break;
      case "create_campaign":
        result = await createCampaign({ tenantId, platform: p, ...params });
        break;
      case "update_budget":
        result = await updateBudget({ tenantId, platform: p, ...params });
        break;
      case "enable_campaign":
        result = await setCampaignStatus({ tenantId, platform: p, ...params, status: "active" });
        break;
      case "pause_campaign":
        result = await setCampaignStatus({ tenantId, platform: p, ...params, status: "paused" });
        break;
      case "generate_copy":
        result = await generateAdCopy({ platform: p, ...params });
        break;
      case "boost_post": {
        if (p !== "liads") return errResponse("boost_post is only supported for liads (LinkedIn Ads)");
        result = await boostLinkedInPost({ tenantId, ...params });
        break;
      }
      default:
        return errResponse(`Unknown action: ${action}. Supported: list_campaigns, campaign_detail, create_campaign, update_budget, enable_campaign, pause_campaign, generate_copy, boost_post`);
    }
    return jsonResponse({ ok: true, data: result });
  } catch (e) {
    console.error("[paid-social]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(e.message, status);
  }
}
