// FlowOS — Google Ads API edge function (Composio-backed)
// Hard cutover from direct Google Ads REST + Flow-owned OAuth → Composio managed OAuth.
// All 8 frontend actions preserved; response shape ({ ok, data } | { ok:false, error })
// is identical so studio.jsx callers do not change.
//
// Required env vars:
//   COMPOSIO_API_KEY2   — Composio API key (already used by other routes)
//   ANTHROPIC_API_KEY   — for the AI ad-copy generation action

import { executeComposioTool } from "./lib/composio.js";
import { requireAuth } from "./lib/auth.js";
import { corsHeaders } from "./lib/cors.js";

export const config = { runtime: "edge" };

// Composio Google Ads toolkit slugs. Names follow the GOOGLEADS_<ACTION> convention.
// If Composio renames any of these, only this constant needs to change.
const TOOLS = {
  search:           "GOOGLEADS_SEARCH_STREAM",
  listCustomers:    "GOOGLEADS_LIST_ACCESSIBLE_CUSTOMERS",
  createCampaign:   "GOOGLEADS_CREATE_CAMPAIGN",
  mutateCampaign:   "GOOGLEADS_MUTATE_CAMPAIGN",
  mutateBudget:     "GOOGLEADS_MUTATE_CAMPAIGN_BUDGET",
  keywordIdeas:     "GOOGLEADS_GENERATE_KEYWORD_IDEAS",
};

// ─── Composio helpers ────────────────────────────────────────────────────────

async function runGAQL(query, tenantId, customerId) {
  const out = await executeComposioTool(
    TOOLS.search,
    { customer_id: customerId, query },
    tenantId
  );
  if (out?.error) throw new Error(out.error);
  return out?.results || out?.data?.results || [];
}

async function composioMutate(toolName, input, tenantId) {
  const out = await executeComposioTool(toolName, input, tenantId);
  if (out?.error) throw new Error(out.error);
  return out;
}

// ─── Action handlers ─────────────────────────────────────────────────────────

async function listAccessibleCustomers(tenantId) {
  const out = await executeComposioTool(TOOLS.listCustomers, {}, tenantId);
  if (out?.error) throw new Error(out.error);
  const ids = out?.resource_names || out?.customers || out?.results || [];
  // resource_names come back as "customers/1234567890" — strip the prefix
  return ids
    .map(x => (typeof x === "string" ? x : x?.id || x?.resourceName || ""))
    .map(s => s.replace(/^customers\//, ""))
    .filter(Boolean)
    .map(id => ({ id, name: id }));
}

async function listCampaigns(tenantId, customerId) {
  const results = await runGAQL(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.cost_micros,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.cost_micros DESC
  `, tenantId, customerId);

  return results.map(r => ({
    id:          r.campaign?.id,
    name:        r.campaign?.name,
    status:      r.campaign?.status?.toLowerCase().replace("_", "-"),
    type:        r.campaign?.advertisingChannelType,
    budgetMonth: Math.round((r.campaignBudget?.amountMicros || 0) / 1_000_000 * 30.4),
    spend:       Math.round((r.metrics?.costMicros || 0) / 1_000_000),
    revenue:     Math.round(r.metrics?.conversionsValue || 0),
    roas:        r.metrics?.costMicros > 0
                   ? +((r.metrics.conversionsValue / (r.metrics.costMicros / 1_000_000)).toFixed(1))
                   : null,
    ctr:         +((r.metrics?.ctr * 100 || 0).toFixed(1)),
    clicks:      r.metrics?.clicks || 0,
    impressions: r.metrics?.impressions || 0,
    avgCpc:      +((r.metrics?.averageCpc / 1_000_000 || 0).toFixed(2)),
    conversions: r.metrics?.conversions || 0,
  }));
}

async function getCampaignDetail({ campaignId }, tenantId, customerId) {
  const [adResults, kwResults] = await Promise.all([
    runGAQL(`
      SELECT ad_group_ad.ad.id, ad_group_ad.ad.responsive_search_ad.headlines,
             ad_group_ad.ad.responsive_search_ad.descriptions,
             ad_group_ad.status,
             metrics.clicks, metrics.impressions, metrics.ctr, metrics.cost_micros
      FROM ad_group_ad
      WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
    `, tenantId, customerId),
    runGAQL(`
      SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
             ad_group_criterion.status,
             metrics.clicks, metrics.impressions, metrics.ctr,
             metrics.cost_micros, metrics.average_cpc
      FROM ad_group_criterion
      WHERE campaign.id = ${campaignId}
        AND ad_group_criterion.type = KEYWORD
        AND segments.date DURING LAST_30_DAYS
    `, tenantId, customerId),
  ]);

  return {
    ads: adResults.map(r => ({
      headlines:    r.adGroupAd?.ad?.responsiveSearchAd?.headlines?.map(h => h.text) || [],
      descriptions: r.adGroupAd?.ad?.responsiveSearchAd?.descriptions?.map(d => d.text) || [],
      status:       r.adGroupAd?.status?.toLowerCase(),
      clicks:       r.metrics?.clicks || 0,
      impressions:  r.metrics?.impressions || 0,
      ctr:          +((r.metrics?.ctr * 100 || 0).toFixed(1)),
      spend:        +((r.metrics?.costMicros / 1_000_000 || 0).toFixed(2)),
    })),
    keywords: kwResults.map(r => ({
      text:        r.adGroupCriterion?.keyword?.text,
      matchType:   r.adGroupCriterion?.keyword?.matchType,
      status:      r.adGroupCriterion?.status?.toLowerCase(),
      clicks:      r.metrics?.clicks || 0,
      impressions: r.metrics?.impressions || 0,
      ctr:         +((r.metrics?.ctr * 100 || 0).toFixed(1)),
      spend:       +((r.metrics?.costMicros / 1_000_000 || 0).toFixed(2)),
      avgCpc:      +((r.metrics?.averageCpc / 1_000_000 || 0).toFixed(2)),
    })),
  };
}

async function createCampaign(params, tenantId) {
  const { customerId, name, channelType, budgetDaily, biddingStrategy } = params;
  return composioMutate(TOOLS.createCampaign, {
    customer_id:        customerId,
    name,
    advertising_channel_type: channelType || "SEARCH",
    daily_budget_micros: Math.round((budgetDaily || 0) * 1_000_000),
    bidding_strategy:    biddingStrategy || "MAXIMIZE_CONVERSIONS",
    status:              "PAUSED",
  }, tenantId);
}

async function updateBudget(params, tenantId) {
  const { customerId, budgetResourceName, dailyBudget } = params;
  return composioMutate(TOOLS.mutateBudget, {
    customer_id:         customerId,
    resource_name:       budgetResourceName,
    amount_micros:       Math.round((dailyBudget || 0) * 1_000_000),
  }, tenantId);
}

async function setCampaignStatus({ campaignResourceName, status, customerId }, tenantId) {
  return composioMutate(TOOLS.mutateCampaign, {
    customer_id:   customerId,
    resource_name: campaignResourceName,
    status,
  }, tenantId);
}

async function getKeywordIdeas({ keywords, url, locationIds, languageId, customerId }, tenantId) {
  const out = await executeComposioTool(TOOLS.keywordIdeas, {
    customer_id:   customerId,
    keyword_seed:  keywords?.length ? { keywords } : undefined,
    url_seed:      url ? { url } : undefined,
    geo_target_constants: locationIds || ["geoTargetConstants/2840"], // default: US
    language:      languageId || "languageConstants/1000",            // default: English
  }, tenantId);
  if (out?.error) throw new Error(out.error);
  const ideas = out?.results || [];
  return ideas.map(r => ({
    text:             r.text,
    avgMonthlySearches: r.keywordIdeaMetrics?.avgMonthlySearches || 0,
    competition:      r.keywordIdeaMetrics?.competition,
    lowCpc:           +((r.keywordIdeaMetrics?.lowTopOfPageBidMicros  / 1_000_000 || 0).toFixed(2)),
    highCpc:          +((r.keywordIdeaMetrics?.highTopOfPageBidMicros / 1_000_000 || 0).toFixed(2)),
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
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const cors = corsHeaders();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400, headers: cors }); }

  // tenantId comes from requireAuth above — any tenantId in the request
  // body is ignored. customerId comes from the body because the user may
  // have multiple Google Ads accounts under one Google identity.
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
  } catch (err) {
    console.error("[google-ads]", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
