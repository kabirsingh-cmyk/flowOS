// FlowOS — Google Ads API edge function
// Supports: list campaigns, create campaign, update budget, pause/enable, keyword ideas, AI ad copy
// Google Ads API v18 (REST)
//
// Required env vars:
//   GOOGLE_ADS_DEVELOPER_TOKEN   — from Google Ads API Center (manager account)
//   GOOGLE_ADS_CLIENT_ID         — OAuth2 client ID (from Google Cloud Console)
//   GOOGLE_ADS_CLIENT_SECRET     — OAuth2 client secret
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY
//   ANTHROPIC_API_KEY            — for AI ad copy generation

import { requireAuth } from "./lib/auth.js";

export const config = { runtime: "edge" };

const ADS_API_BASE = "https://googleads.googleapis.com/v18";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// ─── OAuth token refresh ────────────────────────────────────────────────────

async function getAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function getTokensForTenant(tenantId) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/google_ads_tokens?tenant_id=eq.${tenantId}&select=refresh_token,customer_id&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey:        process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    },
  });
  const rows = await res.json();
  if (!rows?.length) throw new Error("No Google Ads token found. Connect Google Ads in Connections first.");
  return rows[0]; // { refresh_token, customer_id }
}

// ─── Google Ads REST helpers ─────────────────────────────────────────────────

function adsHeaders(accessToken, developerToken, customerId) {
  return {
    Authorization:             `Bearer ${accessToken}`,
    "developer-token":          developerToken,
    "login-customer-id":        customerId,
    "Content-Type":             "application/json",
  };
}

async function adsPost(path, body, accessToken, customerId) {
  const dev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const res = await fetch(`${ADS_API_BASE}/customers/${customerId}${path}`, {
    method:  "POST",
    headers: adsHeaders(accessToken, dev, customerId),
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.error || data));
  return data;
}

async function adsSearch(query, accessToken, customerId) {
  const dev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const res = await fetch(`${ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
    method:  "POST",
    headers: adsHeaders(accessToken, dev, customerId),
    body:    JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.error || data));
  return data.results || [];
}

// ─── Action handlers ─────────────────────────────────────────────────────────

// List all campaigns with key metrics (last 30 days)
async function listCampaigns(accessToken, customerId) {
  const results = await adsSearch(`
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
  `, accessToken, customerId);

  return results.map(r => ({
    id:          r.campaign?.id,
    name:        r.campaign?.name,
    status:      r.campaign?.status?.toLowerCase().replace("_", "-"), // ENABLED → enabled
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
    conversions: Math.round(r.metrics?.conversions || 0),
  }));
}

// Create campaign + ad group + responsive search ad in one shot
async function createCampaign({ name, type, headlines, descriptions, keywords, budgetMonthly, biddingStrategy, finalUrl, customerId }, accessToken) {
  const dev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  // 1. Create budget
  const budgetRes = await adsPost("/campaignBudgets:mutate", {
    operations: [{
      create: {
        name:          `${name} budget`,
        amountMicros:  Math.round((budgetMonthly / 30.4) * 1_000_000), // daily budget
        deliveryMethod: "STANDARD",
      },
    }],
  }, accessToken, customerId);
  const budgetResourceName = budgetRes.results[0].resourceName;

  // 2. Bidding config
  const biddingMap = {
    "target-roas":  { targetRoas: { targetRoas: 4.0 } },
    "target-cpa":   { targetCpa:  { targetCpaMicros: 20_000_000 } }, // $20 default
    "max-clicks":   { maximizeClicks: {} },
    "manual-cpc":   { manualCpc: { enhancedCpcEnabled: true } },
    "max-conversions": { maximizeConversions: {} },
  };
  const biddingConfig = biddingMap[biddingStrategy] || biddingMap["target-roas"];

  // 3. Campaign type mapping
  const channelTypeMap = {
    search:   "SEARCH",
    pmax:     "PERFORMANCE_MAX",
    rlsa:     "SEARCH",
    shopping: "SHOPPING",
    display:  "DISPLAY",
  };
  const channelType = channelTypeMap[type] || "SEARCH";

  // 4. Create campaign
  const campRes = await adsPost("/campaigns:mutate", {
    operations: [{
      create: {
        name,
        status:                  "PAUSED", // always start paused, user launches explicitly
        advertisingChannelType:  channelType,
        campaignBudget:          budgetResourceName,
        networkSettings: {
          targetGoogleSearch:        true,
          targetSearchNetwork:       true,
          targetContentNetwork:      false,
        },
        ...biddingConfig,
      },
    }],
  }, accessToken, customerId);
  const campaignResourceName = campRes.results[0].resourceName;

  // 5. Create ad group
  const agRes = await adsPost("/adGroups:mutate", {
    operations: [{
      create: {
        name:     `${name} · Ad Group 1`,
        campaign: campaignResourceName,
        status:   "ENABLED",
        type:     channelType === "SEARCH" ? "SEARCH_STANDARD" : "SMART",
      },
    }],
  }, accessToken, customerId);
  const adGroupResourceName = agRes.results[0].resourceName;

  // 6. Add keywords (broad match by default)
  if (keywords?.length && channelType === "SEARCH") {
    const kwOps = keywords.slice(0, 20).map(kw => ({
      create: {
        adGroup:   adGroupResourceName,
        text:      kw.trim(),
        matchType: "BROAD",
        status:    "ENABLED",
      },
    }));
    await adsPost("/adGroupCriteria:mutate", { operations: kwOps }, accessToken, customerId);
  }

  // 7. Create responsive search ad
  await adsPost("/adGroupAds:mutate", {
    operations: [{
      create: {
        adGroup: adGroupResourceName,
        status:  "ENABLED",
        ad: {
          responsiveSearchAd: {
            headlines:    headlines.slice(0, 15).map((t, i) => ({
              text:      t,
              pinnedField: i === 0 ? "HEADLINE_1" : undefined,
            })),
            descriptions: descriptions.slice(0, 4).map(t => ({ text: t })),
            path1: name.split(" ")[0]?.slice(0, 15) || "",
            path2: "",
          },
          finalUrls: [finalUrl || "https://flowos.app"],
        },
      },
    }],
  }, accessToken, customerId);

  return {
    campaignId:   campaignResourceName.split("/").pop(),
    resourceName: campaignResourceName,
    name,
    status:       "paused",
  };
}

// Update campaign budget
async function updateBudget({ campaignId, budgetMonthly }, accessToken, customerId) {
  // First fetch existing budget resource name via GAQL
  const results = await adsSearch(
    `SELECT campaign.id, campaign_budget.resource_name, campaign_budget.amount_micros FROM campaign WHERE campaign.id = ${campaignId}`,
    accessToken, customerId
  );
  if (!results.length) throw new Error(`Campaign ${campaignId} not found`);
  const budgetResourceName = results[0].campaignBudget.resourceName;

  await adsPost("/campaignBudgets:mutate", {
    operations: [{
      update:    { resourceName: budgetResourceName, amountMicros: Math.round((budgetMonthly / 30.4) * 1_000_000) },
      updateMask: "amount_micros",
    }],
  }, accessToken, customerId);
  return { ok: true };
}

// Enable or pause a campaign
async function setCampaignStatus({ campaignId, status }, accessToken, customerId) {
  // status: "ENABLED" | "PAUSED"
  await adsPost("/campaigns:mutate", {
    operations: [{
      update:    { resourceName: `customers/${customerId}/campaigns/${campaignId}`, status },
      updateMask: "status",
    }],
  }, accessToken, customerId);
  return { ok: true, status: status.toLowerCase() };
}

// Keyword ideas via Google Keyword Planner
async function getKeywordIdeas({ seedKeywords, url, language, location }, accessToken, customerId) {
  const dev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const body = {
    keywordSeed: { keywords: seedKeywords },
    language:    language  || "languageConstants/1000", // English
    geoTargetConstants: [location || "geoTargetConstants/21167"], // Washington State
    keywordPlanNetwork: "GOOGLE_SEARCH",
    pageSize: 20,
  };
  if (url) body.urlSeed = { url };

  const res = await fetch(`${ADS_API_BASE}/customers/${customerId}:generateKeywordIdeas`, {
    method:  "POST",
    headers: adsHeaders(accessToken, dev, customerId),
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data.error || data));

  return (data.results || []).slice(0, 30).map(r => ({
    keyword:          r.text,
    avgMonthlySearches: r.keywordIdeaMetrics?.avgMonthlySearches || 0,
    competition:      r.keywordIdeaMetrics?.competition,           // HIGH / MEDIUM / LOW
    lowBidMicros:     r.keywordIdeaMetrics?.lowTopOfPageBidMicros,
    highBidMicros:    r.keywordIdeaMetrics?.highTopOfPageBidMicros,
    lowCpc:           +((r.keywordIdeaMetrics?.lowTopOfPageBidMicros  / 1_000_000 || 0).toFixed(2)),
    highCpc:          +((r.keywordIdeaMetrics?.highTopOfPageBidMicros / 1_000_000 || 0).toFixed(2)),
  }));
}

// Generate AI ad copy using Claude
async function generateAdCopy({ brandName, productName, keywords, tone, url, voiceNote }, accessToken) {
  const prompt = `You are an expert Google Ads copywriter. Generate high-converting responsive search ad copy.

Brand: ${brandName}
Product/Service: ${productName}
Target keywords: ${keywords.join(", ")}
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
      "x-api-key":        process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type":     "application/json",
    },
    body: JSON.stringify({
      model:      "claude-3-5-haiku-20241022",
      max_tokens: 800,
      messages:   [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const raw = data.content?.[0]?.text || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    // Extract JSON from possible markdown fences
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { headlines: [], descriptions: [] };
  }
}

// Get campaign performance breakdown (ads + keywords)
async function getCampaignDetail({ campaignId }, accessToken, customerId) {
  const [adResults, kwResults] = await Promise.all([
    adsSearch(`
      SELECT ad_group_ad.ad.id, ad_group_ad.ad.responsive_search_ad.headlines,
             ad_group_ad.ad.responsive_search_ad.descriptions,
             ad_group_ad.status,
             metrics.clicks, metrics.impressions, metrics.ctr, metrics.cost_micros
      FROM ad_group_ad
      WHERE campaign.id = ${campaignId} AND segments.date DURING LAST_30_DAYS
    `, accessToken, customerId),
    adsSearch(`
      SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
             ad_group_criterion.status,
             metrics.clicks, metrics.impressions, metrics.ctr,
             metrics.cost_micros, metrics.average_cpc
      FROM ad_group_criterion
      WHERE campaign.id = ${campaignId}
        AND ad_group_criterion.type = KEYWORD
        AND segments.date DURING LAST_30_DAYS
    `, accessToken, customerId),
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
      text:       r.adGroupCriterion?.keyword?.text,
      matchType:  r.adGroupCriterion?.keyword?.matchType,
      status:     r.adGroupCriterion?.status?.toLowerCase(),
      clicks:     r.metrics?.clicks || 0,
      impressions: r.metrics?.impressions || 0,
      ctr:        +((r.metrics?.ctr * 100 || 0).toFixed(1)),
      spend:      +((r.metrics?.costMicros / 1_000_000 || 0).toFixed(2)),
      avgCpc:     +((r.metrics?.averageCpc / 1_000_000 || 0).toFixed(2)),
    })),
  };
}

// ─── Main router ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const cors = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors });
  }

  const { action, ...params } = body;

  try {
    // AI copy gen doesn't need Google credentials
    if (action === "generate_copy") {
      const copy = await generateAdCopy(params);
      return new Response(JSON.stringify(copy), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // All other actions need Google Ads credentials
    const { refresh_token, customer_id } = await getTokensForTenant(tenantId);
    const accessToken = await getAccessToken(refresh_token);
    const customerId  = params.customerId || customer_id; // allow override

    let result;
    switch (action) {
      case "list_campaigns":
        result = await listCampaigns(accessToken, customerId);
        break;

      case "create_campaign":
        result = await createCampaign({ ...params, customerId }, accessToken);
        break;

      case "update_budget":
        result = await updateBudget(params, accessToken, customerId);
        break;

      case "enable_campaign":
        result = await setCampaignStatus({ ...params, status: "ENABLED" }, accessToken, customerId);
        break;

      case "pause_campaign":
        result = await setCampaignStatus({ ...params, status: "PAUSED" }, accessToken, customerId);
        break;

      case "keyword_ideas":
        result = await getKeywordIdeas(params, accessToken, customerId);
        break;

      case "campaign_detail":
        result = await getCampaignDetail(params, accessToken, customerId);
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors });
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
