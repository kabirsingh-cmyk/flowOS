// FlowOS — Google Ads API edge function (Zernio-backed)
// Migrated from Composio to Zernio 2026-05-24.
// All 8 frontend actions preserved; response shape ({ ok, data } | { ok:false, error }) unchanged.
//
// Required env vars:
//   ZERNIO_API_KEY      — same key used by api/zernio.js
//   SUPABASE_URL, SUPABASE_SERVICE_KEY — for Zernio profileId lookup
//   ANTHROPIC_API_KEY   — for generate_copy (Claude-only, no Zernio call)

import { requireAuth } from "./lib/auth.js";
import { corsHeaders } from "./lib/cors.js";

export const config = { runtime: "edge" };

const ZERNIO_BASE = "https://zernio.com/api/v1";

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
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

// ─── Supabase helper — Zernio profileId lookup ────────────────────────────────

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

// ─── Account resolution ───────────────────────────────────────────────────────

async function getGoogleAdsAccounts(tenantId) {
  const profileId = await getZernioProfileId(tenantId);
  if (!profileId) return [];
  const qs = new URLSearchParams({ platform: "googleads", profileId });
  const data = await zernioFetch(`/accounts?${qs}`, { method: "GET" });
  return (data.accounts || []).filter(a => a.platform === "googleads");
}

/**
 * Resolve the Zernio-internal accountId (_id) for this tenant's Google Ads connection.
 * Pass adAccountId (Google Ads customer ID) to pick a specific sub-account,
 * or omit to use the first connected account.
 */
async function resolveZernioAccountId(tenantId, adAccountId) {
  const accounts = await getGoogleAdsAccounts(tenantId);
  if (!accounts.length) {
    throw new Error("No Google Ads account connected. Connect via the Connections panel.");
  }
  const account = adAccountId
    ? accounts.find(a => {
        const ext = a.adAccountId || a.external_id || a.account_id || a.handle;
        return String(ext) === String(adAccountId);
      })
    : accounts[0];
  if (!account) throw new Error(`Google Ads account ${adAccountId} not found.`);
  return account._id;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function listAccessibleCustomers(tenantId) {
  const accounts = await getGoogleAdsAccounts(tenantId);
  return accounts.map(a => ({
    id:   String(a.adAccountId || a.external_id || a.account_id || a._id),
    name: a.name || a.handle || a._id,
  }));
}

async function listCampaigns(tenantId, customerId) {
  const accountId = await resolveZernioAccountId(tenantId, customerId);
  const qs = new URLSearchParams({ platform: "googleads", accountId });
  if (customerId) qs.set("adAccountId", String(customerId));
  const data = await zernioFetch(`/ads?${qs}`, { method: "GET" });
  const campaigns = data.campaigns || data.ads || data.data || [];
  return campaigns.map(c => ({
    id:          c.id || c.campaign_id,
    name:        c.name,
    status:      (c.status || "").toLowerCase().replace("_", "-"),
    type:        c.type || c.campaign_type,
    budgetMonth: c.budget ? Math.round(c.budget * 30.4) : null,
    spend:       c.metrics?.spend   || c.spend   || 0,
    revenue:     c.metrics?.revenue || c.revenue || 0,
    roas:        c.metrics?.roas    || c.roas    || null,
    ctr:         +((c.metrics?.ctr  || c.ctr     || 0).toFixed(1)),
    clicks:      c.metrics?.clicks  || c.clicks  || 0,
    impressions: c.metrics?.impressions || c.impressions || 0,
    avgCpc:      +((c.metrics?.cpc  || c.avgCpc  || 0).toFixed(2)),
    conversions: c.metrics?.conversions || c.conversions || 0,
  }));
}

async function getCampaignDetail({ campaignId }, tenantId, customerId) {
  const accountId = await resolveZernioAccountId(tenantId, customerId);
  const qs = new URLSearchParams({ platform: "googleads", accountId });
  if (customerId) qs.set("adAccountId", String(customerId));
  const data = await zernioFetch(
    `/ads/${encodeURIComponent(campaignId)}/analytics?${qs}`,
    { method: "GET" },
  );
  return {
    ads:      data.ads      || [],
    keywords: data.keywords || [],
    metrics:  data.metrics  || {},
  };
}

async function createCampaign(params, tenantId) {
  const { customerId, name, channelType, budgetDaily, biddingStrategy } = params;
  const accountId = await resolveZernioAccountId(tenantId, customerId);
  const data = await zernioFetch("/ads/create", {
    method: "POST",
    body: JSON.stringify({
      platform:        "googleads",
      accountId,
      adAccountId:     customerId ? String(customerId) : undefined,
      name,
      campaignType:    channelType || "SEARCH",
      goal:            "traffic",
      budget:          budgetDaily || 0,
      targeting: {
        locations: ["geoTargetConstants/2840"],
        languages: ["languageConstants/1000"],
      },
      biddingStrategy: biddingStrategy || "MAXIMIZE_CONVERSIONS",
      status:          "PAUSED",
    }),
  });
  return { id: data.id || data.campaign_id, name, status: "paused" };
}

async function updateBudget(params, tenantId) {
  const { customerId, campaignId, budgetResourceName, dailyBudget } = params;
  const id = campaignId || budgetResourceName;
  if (!id) throw new Error("campaignId required");
  const accountId = await resolveZernioAccountId(tenantId, customerId);
  return zernioFetch(`/ads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      platform:   "googleads",
      accountId,
      adAccountId: customerId ? String(customerId) : undefined,
      budget:      dailyBudget || 0,
    }),
  });
}

async function setCampaignStatus({ campaignId, campaignResourceName, status, customerId }, tenantId) {
  const id = campaignId || campaignResourceName;
  if (!id) throw new Error("campaignId required");
  const accountId = await resolveZernioAccountId(tenantId, customerId);
  return zernioFetch(`/ads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      platform:   "googleads",
      accountId,
      adAccountId: customerId ? String(customerId) : undefined,
      status,
    }),
  });
}

async function getKeywordIdeas({ keywords, url, locationIds, languageId, customerId }, tenantId) {
  const accountId = await resolveZernioAccountId(tenantId, customerId);
  const qs = new URLSearchParams({ platform: "googleads", accountId, type: "keywords" });
  if (customerId)     qs.set("adAccountId", String(customerId));
  if (keywords?.length) qs.set("keywords", keywords.join(","));
  if (url)            qs.set("url", url);
  if (locationIds?.length) qs.set("locations", locationIds.join(","));
  if (languageId)     qs.set("language", languageId);
  const data = await zernioFetch(`/ads/interests?${qs}`, { method: "GET" });
  const ideas = data.keywords || data.ideas || data.interests || [];
  return ideas.map(r => ({
    text:               r.text || r.keyword,
    avgMonthlySearches: r.avg_monthly_searches || r.volume || 0,
    competition:        r.competition,
    lowCpc:             +((r.low_cpc  || r.low_bid  || 0).toFixed(2)),
    highCpc:            +((r.high_cpc || r.high_bid || 0).toFixed(2)),
  }));
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
      model:      "claude-3-5-haiku-20241022",
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
  const cors = corsHeaders();

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400, headers: cors }); }

  const { action, customerId, ...params } = body;

  try {
    let result;
    switch (action) {
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
        result = await setCampaignStatus({ ...params, status: "ENABLED", customerId }, tenantId);
        break;
      case "pause_campaign":
        result = await setCampaignStatus({ ...params, status: "PAUSED", customerId }, tenantId);
        break;
      case "keyword_ideas":
        result = await getKeywordIdeas({ ...params, customerId }, tenantId);
        break;
      case "campaign_detail":
        result = await getCampaignDetail({ ...params, customerId }, tenantId);
        break;
      default:
        return new Response(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }), { status: 400, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true, data: result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[google-ads]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
