// FlowOS — Google Ads API edge function (Zernio-backed)
// Migrated from Composio to Zernio 2026-05-24.
// All 8 frontend actions preserved; response shape ({ ok, data } | { ok:false, error }) unchanged.
//
// Required env vars:
//   ZERNIO_API_KEY      — same key used by api/zernio.js
//   SUPABASE_URL, SUPABASE_SERVICE_KEY — for Zernio profileId + accountId lookup
//   ANTHROPIC_API_KEY   — for generate_copy (Claude-only, no Zernio call)

import { requireAuth } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import { getFastModel } from "./lib/anthropic.js";

export const config = { runtime: "edge" };

const ZERNIO_BASE = "https://zernio.com/api/v1";

// ─── Zernio API helpers ──────────────────────────────────────────────────────

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

async function getZernioProfileId(tenantId) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/connector_credentials` +
    `?user_id=eq.${encodeURIComponent(tenantId)}&platform=eq.zernio_profile` +
    `&select=secret_value&limit=1`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.secret_value || null;
}

/**
 * Load the cached Zernio social account _id for a connected platform.
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

// ─── Google Ads account resolution ───────────────────────────────────────────

/**
 * Resolve the Zernio social account (_id) for this tenant's Google Ads connection.
 * First tries channels.composio_connection_id, then falls back to walking
 * /v1/accounts via the tenant's Zernio profile.
 */
async function resolveGoogleAdsSocialAccount(tenantId) {
  const cached = await getZernioAccountId(tenantId, "googleads");
  if (cached) return cached;

  const profileId = await getZernioProfileId(tenantId);
  if (!profileId) {
    throw new Error("No Google Ads account connected. Connect via the Connections panel.");
  }
  const data = await zernioFetch(
    `/accounts?profileId=${encodeURIComponent(profileId)}&platform=googleads`,
    { method: "GET" },
  );
  const account = (data.accounts || []).find(a => a.platform === "googleads");
  if (!account) {
    throw new Error("No Google Ads account connected. Connect via the Connections panel.");
  }
  return account._id;
}

/**
 * List the platform ad accounts (Google Ads customer IDs) reachable through
 * the tenant's connected Google Ads social account.
 */
async function getGoogleAdsCustomerAccounts(socialAccountId) {
  const data = await zernioFetch(
    `/ads/accounts?accountId=${encodeURIComponent(socialAccountId)}`,
    { method: "GET" },
  );
  return data.accounts || [];
}

// ─── Action handlers ─────────────────────────────────────────────────────────

async function listAccessibleCustomers(tenantId) {
  const socialAccountId = await resolveGoogleAdsSocialAccount(tenantId);
  const accounts = await getGoogleAdsCustomerAccounts(socialAccountId);
  return accounts.map(a => ({
    id:   String(a.id),
    name: a.name || String(a.id),
  }));
}

async function listCampaigns(tenantId, customerId) {
  const socialAccountId = await resolveGoogleAdsSocialAccount(tenantId);
  const qs = new URLSearchParams({ platform: "google", accountId: socialAccountId });
  if (customerId) qs.set("adAccountId", String(customerId));
  const data = await zernioFetch(`/ads/campaigns?${qs}`, { method: "GET" });
  const campaigns = data.campaigns || [];
  return campaigns.map(c => ({
    id:          c.platformCampaignId,
    name:        c.campaignName,
    status:      (c.status || "").toLowerCase().replace(/_/g, "-"),
    type:        null,
    budgetMonth: c.budget?.amount ? Math.round(c.budget.amount * 30.4) : null,
    spend:       c.metrics?.spend   || 0,
    revenue:     c.metrics?.purchaseValue || 0,
    roas:        c.metrics?.roas    || null,
    ctr:         c.metrics?.ctr != null ? +(c.metrics.ctr.toFixed(1)) : 0,
    clicks:      c.metrics?.clicks  || 0,
    impressions: c.metrics?.impressions || 0,
    avgCpc:      c.metrics?.cpc != null ? +(c.metrics.cpc.toFixed(2)) : 0,
    conversions: c.metrics?.conversions || 0,
  }));
}

async function getCampaignDetail({ campaignId }, tenantId) {
  const socialAccountId = await resolveGoogleAdsSocialAccount(tenantId);
  const qs = new URLSearchParams({
    platform:   "google",
    accountId:  socialAccountId,
    campaignId,
  });
  const data = await zernioFetch(`/ads?${qs}`, { method: "GET" });
  const ads = data.ads || [];

  const metrics = aggregateMetrics(ads);
  return {
    ads: ads.map(ad => ({
      id:      ad.platformAdId || ad._id,
      name:    ad.name,
      status:  ad.status,
      type:    ad.adType,
      metrics: ad.metrics || {},
    })),
    keywords: [],
    metrics,
  };
}

function aggregateMetrics(ads) {
  const out = {
    spend: 0, impressions: 0, clicks: 0, conversions: 0,
    reach: 0, cpc: 0, ctr: 0, roas: null, revenue: 0,
  };
  let purchaseValue = 0;
  for (const ad of ads) {
    const m = ad.metrics || {};
    out.spend       += m.spend       || 0;
    out.impressions += m.impressions || 0;
    out.clicks      += m.clicks      || 0;
    out.conversions += m.conversions || 0;
    out.reach       += m.reach       || 0;
    purchaseValue   += m.purchaseValue || 0;
  }
  out.revenue = +purchaseValue.toFixed(2);
  if (out.impressions > 0) {
    out.ctr = +((out.clicks / out.impressions * 100).toFixed(1));
  }
  if (out.clicks > 0) {
    out.cpc = +((out.spend / out.clicks).toFixed(2));
  }
  if (out.spend > 0) {
    out.roas = +(purchaseValue / out.spend).toFixed(2);
  }
  return out;
}

async function createCampaign(params, tenantId) {
  const { customerId, name, channelType, budgetDaily, linkUrl, headline, body } = params;
  const socialAccountId = await resolveGoogleAdsSocialAccount(tenantId);

  // Resolve adAccountId (Google Ads customer ID) — required by Zernio
  let adAccountId = customerId ? String(customerId) : null;
  if (!adAccountId) {
    const accounts = await getGoogleAdsCustomerAccounts(socialAccountId);
    if (accounts.length) adAccountId = accounts[0].id;
  }
  if (!adAccountId) throw new Error("No Google Ads customer ID available.");

  if (!linkUrl) throw new Error("linkUrl is required to create a Google Ads campaign.");

  const goal = channelTypeToGoal(channelType);

  const payload = {
    accountId:   socialAccountId,
    adAccountId,
    name,
    goal,
    budgetAmount: budgetDaily || 10,
    budgetType:   "daily",
    headline:     (headline || name).slice(0, 30),
    body:         (body || "Discover what we have to offer.").slice(0, 90),
    linkUrl,
  };

  const data = await zernioFetch("/ads/create", {
    method: "POST",
    body:   JSON.stringify(payload),
  });

  const ad = data.ad || {};
  const campaignId = ad.platformCampaignId;
  if (!campaignId) {
    throw new Error("Zernio created the ad but returned no platformCampaignId.");
  }

  // Pause immediately so the campaign starts safe (matches old Composio behaviour)
  await zernioFetch(`/ads/campaigns/${encodeURIComponent(campaignId)}/status`, {
    method: "PUT",
    body:   JSON.stringify({ status: "paused", platform: "google" }),
  });

  return { id: campaignId, name, status: "paused" };
}

function channelTypeToGoal(channelType) {
  switch ((channelType || "").toUpperCase()) {
    case "DISPLAY":       return "awareness";
    case "VIDEO":         return "video_views";
    case "MULTI_CHANNEL": return "engagement";
    default:              return "traffic"; // SEARCH and fallback
  }
}

async function updateBudget(params, tenantId) {
  const { customerId, campaignId, dailyBudget } = params;
  if (!campaignId) throw new Error("campaignId required");
  if (dailyBudget == null) throw new Error("dailyBudget required");

  const socialAccountId = await resolveGoogleAdsSocialAccount(tenantId);

  // Campaign-level budget edit is Meta-only (501 on Google).
  // Fall back to updating the first ad in the campaign.
  const qs = new URLSearchParams({
    platform:  "google",
    accountId: socialAccountId,
    campaignId,
    limit:     "1",
  });
  if (customerId) qs.set("adAccountId", String(customerId));

  const list = await zernioFetch(`/ads?${qs}`, { method: "GET" });
  const ad = (list.ads || [])[0];
  if (!ad) throw new Error("No ads found in this campaign; budget cannot be updated.");

  const data = await zernioFetch(`/ads/${encodeURIComponent(ad._id)}`, {
    method: "PUT",
    body:   JSON.stringify({
      budget: {
        amount: dailyBudget,
        type:   "daily",
      },
    }),
  });

  return data;
}

async function setCampaignStatus({ campaignId, status }, _tenantId) {
  if (!campaignId) throw new Error("campaignId required");
  const data = await zernioFetch(
    `/ads/campaigns/${encodeURIComponent(campaignId)}/status`,
    {
      method: "PUT",
      body:   JSON.stringify({ status, platform: "google" }),
    },
  );
  return data;
}

async function getKeywordIdeas() {
  // Zernio does not expose a Google Ads Keyword Planner endpoint.
  // Return an empty array so the UI stays stable.
  return [];
}

// AI campaign recommendation — pre-fills the entire Create campaign form
async function recommendCampaign({ brandName, brandUrl, brandVoice, hint, existingCampaignNames }) {
  const existing = (existingCampaignNames || []).join(", ") || "none";
  const hintLine = hint ? `The user opened the dialog from this recommendation card: "${hint}". Tailor the campaign to address this opportunity.` : "";
  const prompt = `You are a Google Ads strategist. Recommend a complete new search campaign for the brand below.

Brand: ${brandName || "Unknown brand"}
Website: ${brandUrl || ""}
Brand voice: ${brandVoice || "professional"}
Existing campaigns (avoid duplicating): ${existing}
${hintLine}

Output ONLY valid JSON — no other text:
{
  "name": "Campaign name (concise, ≤60 chars)",
  "type": "search",
  "keywordsRaw": "keyword 1\\nkeyword 2\\nkeyword 3\\nkeyword 4\\nkeyword 5",
  "headlines": ["H1 (≤30 chars)", "H2 (≤30 chars)", "H3 (≤30 chars)"],
  "descriptions": ["Description 1 (≤90 chars)", "Description 2 (≤90 chars)"],
  "budget": "500",
  "bidding": "target-roas",
  "finalUrl": "${brandUrl || ""}"
}

Rules:
- name: descriptive, includes brand or product + intent (e.g. "MVEDA hair oil · intent")
- keywordsRaw: newline-separated, high-intent, relevant to the opportunity
- headlines: max 30 chars each, benefit-led, vary across price / quality / urgency
- descriptions: max 90 chars each, action-oriented with CTA
- budget: monthly USD as a plain number string, realistic for the brand scale
- bidding: one of target-roas | target-cpa | max-clicks | max-conversions | manual-cpc`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-3-5-haiku-20241022",
      max_tokens: 600,
      messages:   [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const raw  = data.content?.[0]?.text || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

// AI email campaign recommendation — pre-fills the Create email campaign form
async function recommendEmailCampaign({ brandName, brandVoice, hint, existingCampaignNames, segments }) {
  const existing = (existingCampaignNames || []).join(", ") || "none";
  const segmentList = (segments || []).join(", ") || "All subscribers";
  const hintLine = hint ? `The user opened the dialog from this recommendation: "${hint}". Tailor the campaign to address this opportunity.` : "";
  const prompt = `You are an email marketing strategist. Recommend a complete new email campaign for the brand below.

Brand: ${brandName || "Unknown brand"}
Brand voice: ${brandVoice || "conversational, benefit-led"}
Available audience segments: ${segmentList}
Existing campaigns (avoid duplicating): ${existing}
${hintLine}

Output ONLY valid JSON — no other text:
{
  "name": "Campaign name (concise, ≤60 chars)",
  "type": "campaign",
  "subject": "Subject line (≤60 chars, personalisation token {{first_name}} where natural)",
  "previewText": "Preview text shown in inbox (≤90 chars)",
  "segment": "Best matching segment from the available list",
  "body": "Full email body (2–4 short paragraphs, brand voice, clear CTA, sign-off)"
}

Rules:
- name: descriptive, includes audience or goal (e.g. "Win-back · 90d lapsed")
- subject: compelling, benefit or curiosity-led, no clickbait
- previewText: extends the subject naturally
- segment: must exactly match one of the available segments listed above
- body: conversational, on-brand, ends with a clear CTA link placeholder →`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-3-5-haiku-20241022",
      max_tokens: 700,
      messages:   [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const raw  = data.content?.[0]?.text || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

// AI social post caption recommendation — returns { caption } tuned to platform + format
async function recommendSocialPost({ brandName, brandVoice, brandUrl, platform, postType, hint }) {
  const platformGuide = {
    instagram: "engaging, visual-first, 1–3 sentences + 3–5 relevant hashtags, emoji encouraged",
    tiktok:    "punchy hook in first line, casual tone, trending-aware, 1–2 sentences + 3 hashtags",
    linkedin:  "professional, insight-led, 2–3 short paragraphs, no more than 2 hashtags",
    facebook:  "conversational, community-first, 2–3 sentences, 1–2 hashtags optional",
    x:         "concise, max 280 chars total, punchy opinion or fact, 1 hashtag max",
    pinterest: "descriptive, keyword-rich for discovery, 2–3 sentences, no hashtags",
    youtube:   "compelling hook for description or script intro, 3–4 sentences, benefit-led",
    reddit:    "genuine, community-aware, no marketing speak, 2–3 sentences, no hashtags",
  }[platform] || "engaging, on-brand, 2–3 sentences";

  const hintLine = hint ? `Context hint: "${hint}".` : "";
  const prompt = `You are a social media copywriter. Write a single ${platform} ${postType || "post"} caption for the brand below.

Brand: ${brandName || "Unknown brand"}
Website: ${brandUrl || ""}
Brand voice: ${brandVoice || "professional, benefit-led"}
Platform style guide: ${platformGuide}
${hintLine}

Output ONLY valid JSON — no other text:
{ "caption": "complete post caption ready to publish" }

Rules:
- Follow the platform style guide exactly
- Match the brand voice
- Do not include any explanation or wrapper text — only the JSON`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-3-5-haiku-20241022",
      max_tokens: 400,
      messages:   [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const raw  = data.content?.[0]?.text || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { caption: "" };
  }
}

// AI ad copy — no Google credentials, just Claude
async function generateAdCopy({ brandName, productName, keywords, tone, url, voiceNote }) {
  const prompt = `You are an expert Google Ads copywriter. Generate high-converting responsive search ad copy.

Brand: ${brandName}
Product/Service: ${productName}
Target keywords: ${(keywords || []).join(", ")}
Brand tone: ${tone || "professional, benefit-led"}
Landing page: ${url || ""}
${voiceNote ? `Additional context: ${voiceNote}` : ""}

Output ONLY valid JSON in this exact shape — no other text:
{
  "headlines": ["h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8", "h9", "h10", "h11", "h12", "h13", "h14", "h15"],
  "descriptions": ["d1", "d2", "d3", "d4"]
}

Rules:
- Each headline: max 30 characters
- Each description: max 90 characters
- Include keyword insertion variations with {KeyWord:fallback} where natural
- Vary benefit focus across headlines (price, quality, urgency, social proof)
- Make descriptions action-oriented with a clear CTA`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
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
    return match ? JSON.parse(match[0]) : { headlines: [], descriptions: [] };
  }
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

  const { action, customerId, ...params } = body;

  try {
    let result;
    switch (action) {
      case "recommend_campaign":
        result = await recommendCampaign(params);
        break;
      case "recommend_email_campaign":
        result = await recommendEmailCampaign(params);
        break;
      case "recommend_social_post":
        result = await recommendSocialPost(params);
        break;
      case "generate_copy":
        result = await generateAdCopy(params);
        break;
      case "list_customer_ids":
        result = await listAccessibleCustomers(tenantId);
        break;
      case "list_campaigns":
        result = await listCampaigns(tenantId, customerId);
        break;
      case "create_campaign":
        result = await createCampaign({ ...params, customerId }, tenantId);
        break;
      case "update_budget":
        result = await updateBudget({ ...params, customerId }, tenantId);
        break;
      case "enable_campaign":
        result = await setCampaignStatus({ ...params, status: "active" }, tenantId);
        break;
      case "pause_campaign":
        result = await setCampaignStatus({ ...params, status: "paused" }, tenantId);
        break;
      case "keyword_ideas":
        result = await getKeywordIdeas();
        break;
      case "campaign_detail":
        result = await getCampaignDetail({ ...params, customerId }, tenantId);
        break;
      default:
        return errResponse(`Unknown action: ${action}`);
    }

    return jsonResponse({ ok: true, data: result });
  } catch (e) {
    console.error("[google-ads]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(e.message, status);
  }
}
