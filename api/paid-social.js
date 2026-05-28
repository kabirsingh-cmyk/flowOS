/**
 * FlowOS — Paid Social Ads via Zernio
 * POST /api/paid-social
 *
 * Handles all five paid social platforms in a single route.
 * Required body field: platform (metaads | liads | ttads | xads | pinads)
 *
 * Actions:
 *   list_campaigns      — campaigns + metrics for the connected ad account
 *   campaign_detail     — ads + aggregated metrics for a campaign
 *   create_campaign     — create a new ad+campaign (paused by default)
 *   update_budget       — change daily budget on a campaign
 *   enable_campaign     — set status → active
 *   pause_campaign      — set status → paused
 *   generate_copy       — Claude-generated ad copy tailored to platform format
 *   boost_post          — promote an existing post (all platforms via /v1/ads/boost)
 *   create_ad_set       — update / pause / resume an ad set (PUT /v1/ads/ad-sets/{id})
 *   create_ad           — attach a new ad to an existing ad set (POST /v1/ads/create with adSetId)
 *   get_ad_tree         — campaign → ad-set → ad hierarchy with rolled-up metrics
 *   campaign_duplicate  — duplicate a campaign (POST /v1/ads/campaigns/{id}/duplicate)
 *   bulk_status         — pause / resume up to 50 campaigns in one call
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
import { zernioFetch, requireZernioAccountId } from "./lib/zernioClient.js";
import { resolveAdsPlatform, SUPPORTED_PAID_PLATFORMS } from "./lib/zernioMap.js";

export const config = { runtime: "edge" };

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

// ─── Targeting normalization ─────────────────────────────────────────────────
// Frontend passes a single normalized shape:
//   targeting = {
//     countries:    ["US", "CA"],
//     regions:      [{ key, name? }],
//     cities:       [{ key, name?, radius?, distance_unit? }],
//     zips:         [{ key, name? }],
//     metros:       [{ key, name? }],
//     customLocations: [{ latitude, longitude, radius, distanceUnit }],
//     ageMin:       18,
//     ageMax:       65,
//     interests:    [{ id, name }],
//     advantageAudience: 0 | 1,             // Meta only
//     // LinkedIn legacy shorthand still accepted (mapped through):
//     geo, jobFunction, seniority, companySize
//   }
//
// `mode` is "create" (fields go top-level on /v1/ads/create) or "boost"
// (fields nest under `targeting:` on /v1/ads/boost).

function pickGeo(targeting) {
  const t = targeting || {};
  const out = {};
  if (t.countries?.length)       out.countries       = [].concat(t.countries);
  if (t.regions?.length)         out.regions         = t.regions;
  if (t.cities?.length)          out.cities          = t.cities;
  if (t.zips?.length)            out.zips            = t.zips;
  if (t.metros?.length)          out.metros          = t.metros;
  if (t.customLocations?.length) out.customLocations = t.customLocations;
  return out;
}

function pickAge(targeting) {
  const t = targeting || {};
  const out = {};
  if (Number.isFinite(t.ageMin)) out.ageMin = t.ageMin;
  if (Number.isFinite(t.ageMax)) out.ageMax = t.ageMax;
  return out;
}

function pickInterests(targeting) {
  const t = targeting || {};
  return t.interests?.length ? { interests: t.interests } : {};
}

function pickLinkedInLegacy(targeting) {
  const t = targeting || {};
  const out = {};
  if (t.geo)         out.geoLocations = [].concat(t.geo);
  if (t.jobFunction) out.jobFunctions = [].concat(t.jobFunction);
  if (t.seniority)   out.seniorities  = [].concat(t.seniority);
  if (t.companySize) out.companySizes = [].concat(t.companySize);
  return out;
}

function buildTargetingForCreate(platform, targeting) {
  // /v1/ads/create takes geo/age/interests at the TOP LEVEL.
  // LinkedIn-specific job/seniority/company-size still nest under `targeting`.
  const out = { ...pickGeo(targeting), ...pickAge(targeting), ...pickInterests(targeting) };
  if (platform === "metaads" && Number.isFinite(targeting?.advantageAudience)) {
    out.advantage_audience = targeting.advantageAudience;
  }
  if (platform === "liads") {
    const li = pickLinkedInLegacy(targeting);
    if (Object.keys(li).length) out.targeting = li;
  }
  return out;
}

function buildTargetingForBoost(platform, targeting) {
  // /v1/ads/boost nests targeting under `targeting:` with a narrower shape
  // (ageMin/ageMax/countries/interests/advantage_audience).
  if (!targeting) return {};
  const out = {};
  if (Number.isFinite(targeting.ageMin)) out.ageMin = targeting.ageMin;
  if (Number.isFinite(targeting.ageMax)) out.ageMax = targeting.ageMax;
  if (targeting.countries?.length)       out.countries = [].concat(targeting.countries);
  if (targeting.interests?.length)       out.interests = targeting.interests;
  if (platform === "metaads" && Number.isFinite(targeting.advantageAudience)) {
    out.advantage_audience = targeting.advantageAudience;
  }
  return Object.keys(out).length ? { targeting: out } : {};
}

// Per Meta spec: LOWEST_COST_WITH_BID_CAP / COST_CAP need bidAmount;
// LOWEST_COST_WITH_MIN_ROAS needs roasAverageFloor. We pass through whatever
// the caller sent and let Zernio validate — but bail early if the obvious
// combinations are wrong, so the error surfaces locally.
function pickBidFields({ bidStrategy, bidAmount, roasAverageFloor }) {
  const out = {};
  if (bidStrategy)                       out.bidStrategy      = bidStrategy;
  if (Number.isFinite(bidAmount))        out.bidAmount        = bidAmount;
  if (Number.isFinite(roasAverageFloor)) out.roasAverageFloor = roasAverageFloor;
  return out;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function listCampaigns({ tenantId, platform, adAccountId, fromDate, toDate }) {
  const socialAccountId = await requireZernioAccountId(tenantId, platform);
  const platformSlug    = resolveAdsPlatform(platform);
  const qs = new URLSearchParams({ platform: platformSlug, accountId: socialAccountId });
  if (adAccountId) qs.set("adAccountId", String(adAccountId));
  if (fromDate)    qs.set("fromDate",    fromDate);
  if (toDate)      qs.set("toDate",      toDate);

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

async function getCampaignDetail({ tenantId, platform, campaignId, adAccountId, fromDate, toDate }) {
  if (!campaignId) throw new Error("campaignId required");
  const socialAccountId = await requireZernioAccountId(tenantId, platform);
  const platformSlug    = resolveAdsPlatform(platform);
  const qs = new URLSearchParams({ platform: platformSlug, accountId: socialAccountId, campaignId });
  if (adAccountId) qs.set("adAccountId", String(adAccountId));
  if (fromDate)    qs.set("fromDate",    fromDate);
  if (toDate)      qs.set("toDate",      toDate);

  const data = await zernioFetch(`/ads?${qs}`, { method: "GET" });
  const ads  = data.ads || [];
  return {
    ads: ads.map(ad => ({
      id:      ad.platformAdId || ad._id,
      zernioId: ad._id,
      adSetId: ad.platformAdSetId || ad.adSetId,
      name:    ad.name,
      status:  ad.status,
      type:    ad.adType,
      metrics: ad.metrics || {},
      creative: ad.creative || null,
    })),
    metrics: aggregateMetrics(ads),
  };
}

async function getAdTree({ tenantId, platform, adAccountId, fromDate, toDate, status, limit, page, sort }) {
  const socialAccountId = await requireZernioAccountId(tenantId, platform);
  const platformSlug    = resolveAdsPlatform(platform);
  const qs = new URLSearchParams({ platform: platformSlug, accountId: socialAccountId });
  if (adAccountId) qs.set("adAccountId", String(adAccountId));
  if (fromDate)    qs.set("fromDate",    fromDate);
  if (toDate)      qs.set("toDate",      toDate);
  if (status)      qs.set("status",      status);
  if (limit)       qs.set("limit",       String(limit));
  if (page)        qs.set("page",        String(page));
  if (sort)        qs.set("sort",        sort);

  return zernioFetch(`/ads/tree?${qs}`, { method: "GET" });
}

async function createCampaign({
  tenantId, platform, name, budgetDaily, linkUrl, headline, body, adAccountId,
  targeting, currency, schedule, leadGenFormId, imageUrl, video, organizationId,
  bidStrategy, bidAmount, roasAverageFloor, dsaBeneficiary, dsaPayor, promotedObject,
  callToAction, specialAdCategories,
}) {
  if (!linkUrl && !leadGenFormId) {
    throw new Error("linkUrl or leadGenFormId is required to create a campaign.");
  }
  const socialAccountId = await requireZernioAccountId(tenantId, platform);
  const platformSlug    = resolveAdsPlatform(platform);
  const fmt             = COPY_FORMAT[platform] || {};
  const targetingFields = buildTargetingForCreate(platform, targeting);
  const bidFields       = pickBidFields({ bidStrategy, bidAmount, roasAverageFloor });

  const payload = {
    accountId:    socialAccountId,
    platform:     platformSlug,
    name:         name || `FlowOS campaign · ${new Date().toISOString().slice(0, 10)}`,
    goal:         "traffic",
    budgetAmount: budgetDaily || 10,
    budgetType:   "daily",
    headline:     headline ? headline.slice(0, fmt.headline?.max || 100) : (name || "").slice(0, 40),
    body:         body     ? body.slice(0, fmt.body?.max || 500)         : "Discover what we have to offer.",
    ...(linkUrl       ? { linkUrl }       : {}),
    ...(currency      ? { currency }      : {}),
    ...(callToAction  ? { callToAction }  : {}),
    ...(specialAdCategories?.length ? { specialAdCategories } : {}),
    ...(imageUrl      ? { imageUrl }      : {}),
    ...(video         ? { video }         : {}),
    ...(organizationId ? { organizationId } : {}),
    ...(leadGenFormId  ? { leadGenFormId }  : {}),
    ...(promotedObject ? { promotedObject } : {}),
    ...(schedule       ? { schedule }       : {}),
    ...(dsaBeneficiary ? { dsaBeneficiary } : {}),
    ...(dsaPayor       ? { dsaPayor }       : {}),
    ...targetingFields,
    ...bidFields,
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

async function updateBudget({ tenantId, platform, campaignId, dailyBudget, lifetimeBudget, bidStrategy, bidAmount, roasAverageFloor }) {
  if (!campaignId) throw new Error("campaignId required");
  const platformSlug = resolveAdsPlatform(platform);

  // Try the campaign-level update first (CBO). If the campaign is ABO, Zernio
  // returns 409 BUDGET_LEVEL_MISMATCH and we fall back to per-ad-set update
  // via the legacy /ads/{adId} path used previously.
  const updates = {
    platform: platformSlug,
    ...(dailyBudget    != null ? { budget: { amount: dailyBudget,    type: "daily" } } : {}),
    ...(lifetimeBudget != null ? { budget: { amount: lifetimeBudget, type: "lifetime" } } : {}),
    ...pickBidFields({ bidStrategy, bidAmount, roasAverageFloor }),
  };
  if (!updates.budget && !updates.bidStrategy && !Number.isFinite(updates.bidAmount) && !Number.isFinite(updates.roasAverageFloor)) {
    throw new Error("Provide at least one of dailyBudget, lifetimeBudget, bidStrategy, bidAmount, roasAverageFloor.");
  }

  try {
    return await zernioFetch(`/ads/campaigns/${encodeURIComponent(campaignId)}`, {
      method: "PUT",
      body:   JSON.stringify(updates),
    });
  } catch (e) {
    // ABO fallback — fan out to the first ad in the campaign.
    if (e.status !== 409) throw e;
    const socialAccountId = await requireZernioAccountId(tenantId, platform);
    const qs = new URLSearchParams({
      platform: platformSlug, accountId: socialAccountId, campaignId, limit: "1",
    });
    const list = await zernioFetch(`/ads?${qs}`, { method: "GET" });
    const ad   = (list.ads || [])[0];
    if (!ad) throw new Error("No ads found in this campaign; budget cannot be updated.");
    return zernioFetch(`/ads/${encodeURIComponent(ad._id)}`, {
      method: "PUT",
      body:   JSON.stringify(updates.budget ? { budget: updates.budget } : updates),
    });
  }
}

async function setCampaignStatus({ platform, campaignId, status }) {
  if (!campaignId) throw new Error("campaignId required");
  const platformSlug = resolveAdsPlatform(platform);
  return zernioFetch(`/ads/campaigns/${encodeURIComponent(campaignId)}/status`, {
    method: "PUT",
    body:   JSON.stringify({ status, platform: platformSlug }),
  });
}

async function bulkStatus({ status, campaigns }) {
  if (!status || !["active", "paused"].includes(status)) {
    throw new Error("status must be 'active' or 'paused'");
  }
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    throw new Error("campaigns[] required");
  }
  // Translate FlowOS platform ids in each row to Zernio slugs.
  const normalized = campaigns.map(c => ({
    platformCampaignId: c.platformCampaignId || c.campaignId || c.id,
    platform:           resolveAdsPlatform(c.platform) || c.platform,
  })).filter(c => c.platformCampaignId && c.platform);
  if (normalized.length === 0) throw new Error("No valid campaigns to update");

  return zernioFetch(`/ads/campaigns/bulk-status`, {
    method: "POST",
    body:   JSON.stringify({ status, campaigns: normalized }),
  });
}

async function duplicateCampaign({ platform, campaignId, deepCopy, statusOption, startTime, endTime, renameStrategy, renamePrefix, renameSuffix, syncAfter }) {
  if (!campaignId) throw new Error("campaignId required");
  const platformSlug = resolveAdsPlatform(platform);
  return zernioFetch(`/ads/campaigns/${encodeURIComponent(campaignId)}/duplicate`, {
    method: "POST",
    body:   JSON.stringify({
      platform: platformSlug,
      ...(deepCopy       != null ? { deepCopy }       : {}),
      ...(statusOption   ?         { statusOption }   : {}),
      ...(startTime      ?         { startTime }      : {}),
      ...(endTime        ?         { endTime }        : {}),
      ...(renameStrategy ?         { renameStrategy } : {}),
      ...(renamePrefix   ?         { renamePrefix }   : {}),
      ...(renameSuffix   ?         { renameSuffix }   : {}),
      ...(syncAfter      != null ? { syncAfter }      : {}),
    }),
  });
}

// PUT /v1/ads/ad-sets/{adSetId} — budget / status / bid strategy updates.
async function updateAdSet({ platform, adSetId, budget, status, bidStrategy, bidAmount, roasAverageFloor }) {
  if (!adSetId) throw new Error("adSetId required");
  const platformSlug = resolveAdsPlatform(platform);
  const payload = {
    platform: platformSlug,
    ...(budget ? { budget } : {}),
    ...(status ? { status } : {}),
    ...pickBidFields({ bidStrategy, bidAmount, roasAverageFloor }),
  };
  if (Object.keys(payload).length === 1) {
    throw new Error("Provide at least one of budget, status, bidStrategy, bidAmount, roasAverageFloor.");
  }
  return zernioFetch(`/ads/ad-sets/${encodeURIComponent(adSetId)}`, {
    method: "PUT",
    body:   JSON.stringify(payload),
  });
}

// POST /v1/ads/create with adSetId — attach a new ad to an existing ad set.
async function createAd({
  tenantId, platform, adSetId, name, headline, body, linkUrl, callToAction,
  imageUrl, video, adAccountId,
}) {
  if (!adSetId) throw new Error("adSetId required");
  const socialAccountId = await requireZernioAccountId(tenantId, platform);
  const platformSlug    = resolveAdsPlatform(platform);
  const fmt             = COPY_FORMAT[platform] || {};

  const payload = {
    accountId:   socialAccountId,
    adAccountId: adAccountId ? String(adAccountId) : undefined,
    platform:    platformSlug,
    name:        name || `Ad · ${new Date().toISOString().slice(0, 10)}`,
    adSetId,
    headline:    headline ? headline.slice(0, fmt.headline?.max || 100) : undefined,
    body:        body     ? body.slice(0, fmt.body?.max || 500)         : undefined,
    ...(linkUrl      ? { linkUrl }      : {}),
    ...(callToAction ? { callToAction } : {}),
    ...(imageUrl     ? { imageUrl }     : {}),
    ...(video        ? { video }        : {}),
  };
  // Strip undefined values so Zernio doesn't see null fields.
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];

  return zernioFetch("/ads/create", { method: "POST", body: JSON.stringify(payload) });
}

// POST /v1/ads/boost — promote an existing post on ANY supported platform.
async function boostPost({
  tenantId, platform, postId, platformPostId, name, goal, budgetDaily, budgetLifetime,
  currency, schedule, targeting, bidStrategy, bidAmount, roasAverageFloor,
  tracking, specialAdCategories, dsaBeneficiary, dsaPayor, adAccountId,
  // TikTok Spark Ads — wired here; UI exposure lands in PR 4c
  sparkAuthCode, linkUrl, callToAction,
}) {
  if (!postId && !platformPostId) {
    throw new Error("postId or platformPostId required");
  }
  const socialAccountId = await requireZernioAccountId(tenantId, platform);
  const platformSlug    = resolveAdsPlatform(platform);

  const budget = budgetLifetime != null
    ? { amount: budgetLifetime, type: "lifetime" }
    : { amount: budgetDaily || 10, type: "daily" };

  const payload = {
    accountId:   socialAccountId,
    adAccountId: adAccountId ? String(adAccountId) : undefined,
    name:        name || `Boost · ${new Date().toISOString().slice(0, 10)}`,
    goal:        goal || "engagement",
    budget,
    ...(postId         ? { postId }         : {}),
    ...(platformPostId ? { platformPostId } : {}),
    ...(currency       ? { currency }       : {}),
    ...(schedule       ? { schedule }       : {}),
    ...(tracking       ? { tracking }       : {}),
    ...(specialAdCategories?.length ? { specialAdCategories } : {}),
    ...(dsaBeneficiary ? { dsaBeneficiary } : {}),
    ...(dsaPayor       ? { dsaPayor }       : {}),
    ...buildTargetingForBoost(platform, targeting),
    ...pickBidFields({ bidStrategy, bidAmount, roasAverageFloor }),
    // TikTok Spark Ad passthrough — Zernio ignores these on other platforms.
    ...(sparkAuthCode ? { sparkAuthCode } : {}),
    ...(linkUrl       ? { linkUrl }       : {}),
    ...(callToAction  ? { callToAction }  : {}),
    platform: platformSlug,
  };
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];

  const data = await zernioFetch("/ads/boost", { method: "POST", body: JSON.stringify(payload) });
  const ad   = data.ad || {};
  const campaignId = ad.platformCampaignId || ad._id;
  if (!campaignId) throw new Error("Zernio created the boost but returned no campaign ID.");

  // Start paused — caller enables explicitly via enable_campaign.
  await zernioFetch(`/ads/campaigns/${encodeURIComponent(campaignId)}/status`, {
    method: "PUT",
    body:   JSON.stringify({ status: "paused", platform: platformSlug }),
  });

  return { id: campaignId, name: payload.name, status: "paused", postId, platformPostId };
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
  const p = platform.toLowerCase();
  if (!SUPPORTED_PAID_PLATFORMS.has(p)) {
    return errResponse(`Unsupported platform: ${platform}. Supported: ${[...SUPPORTED_PAID_PLATFORMS].join(", ")}`);
  }

  try {
    let result;
    switch (action) {
      case "list_campaigns":
        result = await listCampaigns({ tenantId, platform: p, ...params });
        break;
      case "campaign_detail":
        result = await getCampaignDetail({ tenantId, platform: p, ...params });
        break;
      case "get_ad_tree":
        result = await getAdTree({ tenantId, platform: p, ...params });
        break;
      case "create_campaign":
        result = await createCampaign({ tenantId, platform: p, ...params });
        break;
      case "update_budget":
        result = await updateBudget({ tenantId, platform: p, ...params });
        break;
      case "enable_campaign":
        result = await setCampaignStatus({ platform: p, ...params, status: "active" });
        break;
      case "pause_campaign":
        result = await setCampaignStatus({ platform: p, ...params, status: "paused" });
        break;
      case "bulk_status":
        result = await bulkStatus({ ...params });
        break;
      case "campaign_duplicate":
        result = await duplicateCampaign({ platform: p, ...params });
        break;
      case "create_ad_set":
        result = await updateAdSet({ platform: p, ...params });
        break;
      case "create_ad":
        result = await createAd({ tenantId, platform: p, ...params });
        break;
      case "generate_copy":
        result = await generateAdCopy({ platform: p, ...params });
        break;
      case "boost_post":
        result = await boostPost({ tenantId, platform: p, ...params });
        break;
      default:
        return errResponse(
          `Unknown action: ${action}. Supported: list_campaigns, campaign_detail, get_ad_tree, ` +
          `create_campaign, update_budget, enable_campaign, pause_campaign, bulk_status, ` +
          `campaign_duplicate, create_ad_set, create_ad, generate_copy, boost_post`
        );
    }
    return jsonResponse({ ok: true, data: result });
  } catch (e) {
    console.error("[paid-social]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(e.message, status);
  }
}
