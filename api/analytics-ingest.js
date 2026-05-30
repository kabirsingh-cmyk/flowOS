/**
 * FlowOS Reach — Analytics Ingestion + Insight Generation
 * Vercel Edge Function: POST /api/analytics-ingest
 *
 * Flow:
 *   1. Receive { tenantId, period? } — period defaults to "30d"
 *   2. Fetch tenant's connected apps from Composio
 *   3. Pull metrics for each connected platform via Composio tools
 *   4. Upsert raw metrics into analytics_snapshots
 *   5. Call Claude to generate summary, insights, recommended_actions
 *   6. Upsert into analytics_insights
 *   7. Return { snapshots, insights }
 */

import { getConnectedAccountSlugs, executeComposioTool as runComposioTool } from './lib/composio.js';
import { sbHeaders, fetchBrandProfile } from './lib/supabase.js';
import { requireAuthOrCron } from './lib/auth.js';
import { getModel } from './lib/anthropic.js';

export const config = { runtime: "edge" };

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const SUPABASE_URL   = process.env.SUPABASE_URL;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;

// ─── Composio helpers ─────────────────────────────────────────────────────────

// analytics-ingest needs null-on-error behaviour
const runTool = (name, input, tenantId) => runComposioTool(name, input, tenantId, { onError: "null" });

// ─── Supabase helpers ──────────────────────────────────────────────────────────

async function upsertSnapshot(tenantId, channel, period, metrics, source = "live") {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/analytics_snapshots`,
    {
      method: "POST",
      headers: { ...sbHeaders(), "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ tenant_id: tenantId, channel, period, metrics, source, fetched_at: new Date().toISOString() }),
    }
  );
  return res.ok;
}

// NOTE: upsert requires a unique constraint on (tenant_id, period) in analytics_insights
async function upsertInsights(tenantId, period, summary, insights, recommended_actions) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/analytics_insights`,
    {
      method: "POST",
      headers: { ...sbHeaders(), "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ tenant_id: tenantId, period, summary, insights, recommended_actions, generated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) throw new Error(`Failed to save insights: ${res.status}`);
  return await res.json();
}

// ─── Platform metric fetchers ────────────────────────────────────────────────
// Each returns { channel, metrics } or null if platform not connected/fails.
// period: "7d" | "30d" | "90d"

function periodDays(period) {
  return period === "7d" ? 7 : period === "90d" ? 90 : 30;
}

function dateRange(period) {
  const end   = new Date();
  const start = new Date();
  start.setDate(end.getDate() - periodDays(period));
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10),
  };
}

// ── Meta Ads ─────────────────────────────────────────────────────────────────
async function fetchMetaAds(tenantId, period) {
  const { start, end } = dateRange(period);
  const data = await runTool("FACEBOOK_ADS_GET_AD_ACCOUNT_INSIGHTS", {
    date_preset: period === "7d" ? "last_7_days" : period === "90d" ? "last_90_days" : "last_30_days",
    fields: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "reach", "frequency", "actions", "action_values", "roas"].join(","),
    level: "account",
  }, tenantId);
  if (!data) return null;

  const d = Array.isArray(data) ? data[0] : data;
  return {
    channel: "meta_ads",
    metrics: {
      spend:        parseFloat(d?.spend || 0),
      impressions:  parseInt(d?.impressions || 0),
      clicks:       parseInt(d?.clicks || 0),
      ctr:          parseFloat(d?.ctr || 0),
      cpc:          parseFloat(d?.cpc || 0),
      cpm:          parseFloat(d?.cpm || 0),
      reach:        parseInt(d?.reach || 0),
      frequency:    parseFloat(d?.frequency || 0),
      roas:         parseFloat(d?.purchase_roas?.[0]?.value || 0),
      conversions:  (d?.actions || []).filter(a => a.action_type === "purchase").reduce((s, a) => s + parseInt(a.value || 0), 0),
      revenue:      parseFloat((d?.action_values || []).find(a => a.action_type === "purchase")?.value || 0),
      period,
      date_start: start,
      date_end:   end,
    },
  };
}

// ── Google Ads ────────────────────────────────────────────────────────────────
// Routed through Zernio (migrated from Composio 2026-05-24)
async function fetchGoogleAds(tenantId, period) {
  const ORIGIN = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.APP_ORIGIN || "http://localhost:3000");
  let data;
  try {
    const res = await fetch(`${ORIGIN}/api/zernio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ action: "get_analytics", tenantId, platform: "googleads", period, metric: "campaign_performance" }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    data = json?.analytics;
  } catch { return null; }
  if (!data) return null;

  const campaigns = data?.campaigns || (Array.isArray(data) ? data : []);
  const totals = campaigns.reduce((acc, c) => ({
    spend:       acc.spend       + parseFloat(c.cost || c.spend || 0),
    impressions: acc.impressions + parseInt(c.impressions || 0),
    clicks:      acc.clicks      + parseInt(c.clicks || 0),
    conversions: acc.conversions + parseFloat(c.conversions || 0),
    conv_value:  acc.conv_value  + parseFloat(c.conversions_value || c.conversion_value || 0),
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, conv_value: 0 });

  return {
    channel: "google_ads",
    metrics: {
      ...totals,
      ctr:  totals.impressions ? +(totals.clicks / totals.impressions * 100).toFixed(2) : 0,
      cpc:  totals.clicks      ? +(totals.spend  / totals.clicks).toFixed(2) : 0,
      roas: totals.spend       ? +(totals.conv_value / totals.spend).toFixed(2) : 0,
      period,
    },
  };
}

// ── Klaviyo (email / owned) ───────────────────────────────────────────────────
async function fetchKlaviyo(tenantId, period) {
  const days = periodDays(period);
  // Klaviyo campaign metrics for the period
  const data = await runTool("KLAVIYO_GET_CAMPAIGNS", {
    filter: `greater-than(send_time,${new Date(Date.now() - days * 86400000).toISOString()})`,
    fields: ["name", "send_time", "status"].join(","),
  }, tenantId);
  if (!data) return null;

  const campaigns = (data?.data || data || []).filter(c => c?.attributes?.status === "sent" || c?.status === "sent");

  // Fetch reports for up to 5 recent campaigns in parallel
  const recentCampaigns = campaigns.slice(0, 5);
  const reports = await Promise.all(
    recentCampaigns.map(c =>
      runTool("KLAVIYO_GET_CAMPAIGN_CAMPAIGN_MESSAGE_ASSIGN", { campaign_id: c?.id }, tenantId)
        .catch(() => null)
    )
  );
  // Aggregate across reports
  const validReports = reports.filter(Boolean);
  const openRate  = validReports.length ? validReports.reduce((s, r) => s + parseFloat(r?.open_rate || 0), 0) / validReports.length : 0;
  const clickRate = validReports.length ? validReports.reduce((s, r) => s + parseFloat(r?.click_rate || 0), 0) / validReports.length : 0;
  const revenue   = validReports.reduce((s, r) => s + parseFloat(r?.revenue || 0), 0);
  const sends     = validReports.reduce((s, r) => s + parseInt(r?.sent_count || 0), 0);

  return {
    channel: "klaviyo",
    metrics: {
      campaigns_sent: campaigns.length,
      open_rate:      openRate,
      click_rate:     clickRate,
      revenue:        revenue,
      sends:          sends,
      period,
    },
  };
}

// ── GA4 / Web (organic) ───────────────────────────────────────────────────────
async function fetchGA4(tenantId, period) {
  const days = periodDays(period);
  const data = await runTool("GOOGLEANALYTICS_RUN_REPORT", {
    date_ranges: [{ start_date: `${days}daysAgo`, end_date: "today" }],
    dimensions:  [{ name: "sessionDefaultChannelGroup" }],
    metrics:     [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "bounceRate" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
      { name: "conversions" },
      { name: "totalRevenue" },
    ],
  }, tenantId);
  if (!data) return null;

  // Sum all channel rows
  const rows = data?.rows || [];
  const totals = rows.reduce((acc, r) => {
    const vals = r.metricValues || [];
    return {
      sessions:          acc.sessions          + parseInt(vals[0]?.value || 0),
      active_users:      acc.active_users      + parseInt(vals[1]?.value || 0),
      conversions:       acc.conversions       + parseFloat(vals[5]?.value || 0),
      revenue:           acc.revenue           + parseFloat(vals[6]?.value || 0),
    };
  }, { sessions: 0, active_users: 0, conversions: 0, revenue: 0 });

  const bounceRow  = rows.find(r => r.metricValues?.[2]);
  const engageRow  = rows.find(r => r.metricValues?.[3]);
  const durationRow= rows.find(r => r.metricValues?.[4]);

  return {
    channel: "ga4",
    metrics: {
      ...totals,
      bounce_rate:      parseFloat(bounceRow?.metricValues?.[2]?.value || 0),
      engagement_rate:  parseFloat(engageRow?.metricValues?.[3]?.value || 0),
      avg_session_dur:  parseFloat(durationRow?.metricValues?.[4]?.value || 0),
      period,
    },
  };
}

// ── Google Search Console ─────────────────────────────────────────────────────
async function fetchGSC(tenantId, period) {
  const { start, end } = dateRange(period);
  const data = await runTool("GOOGLESEARCHCONSOLE_SEARCH_ANALYTICS_QUERY", {
    site_url: "sc-domain:",   // Composio resolves to tenant's verified property
    start_date: start,
    end_date:   end,
    dimensions: ["query"],
    row_limit:  10,
  }, tenantId);
  if (!data) return null;

  const rows = data?.rows || (Array.isArray(data) ? data : []);
  if (rows.length === 0) return null;

  const totals = rows.reduce((acc, r) => ({
    clicks:      acc.clicks      + parseInt(r.clicks || 0),
    impressions: acc.impressions + parseInt(r.impressions || 0),
    ctr:         acc.ctr         + parseFloat(r.ctr || 0),
    position:    acc.position    + parseFloat(r.position || 0),
  }), { clicks: 0, impressions: 0, ctr: 0, position: 0 });

  return {
    channel: "gsc",
    metrics: {
      clicks:       totals.clicks,
      impressions:  totals.impressions,
      avg_ctr:      +(totals.ctr / rows.length * 100).toFixed(2),
      avg_position: +(totals.position / rows.length).toFixed(1),
      top_queries:  rows.slice(0, 5).map(r => r.keys?.[0] || r.query).filter(Boolean),
      period,
      date_start: start,
      date_end:   end,
    },
  };
}

// ── Shopify ───────────────────────────────────────────────────────────────────
async function fetchShopify(tenantId, period) {
  const { start, end } = dateRange(period);
  const data = await runTool("SHOPIFY_GET_ORDERS", {
    created_at_min: `${start}T00:00:00Z`,
    created_at_max: `${end}T23:59:59Z`,
    status: "any",
    limit: 250,
  }, tenantId);
  if (!data) return null;

  const orders = data?.orders || (Array.isArray(data) ? data : []);
  const revenue    = orders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
  const refunds    = orders.reduce((s, o) => s + parseFloat(o.total_refunded || 0), 0);
  const aov        = orders.length ? revenue / orders.length : 0;

  // Unique customers
  const customers  = new Set(orders.map(o => o.customer?.id || o.email).filter(Boolean)).size;

  return {
    channel: "shopify",
    metrics: {
      orders:        orders.length,
      revenue:       +revenue.toFixed(2),
      net_revenue:   +(revenue - refunds).toFixed(2),
      aov:           +aov.toFixed(2),
      unique_customers: customers,
      refunds:       +refunds.toFixed(2),
      period,
      date_start: start,
      date_end:   end,
    },
  };
}

// ─── Channel dispatcher ───────────────────────────────────────────────────────

const CHANNEL_FETCHERS = {
  facebook_ads:          (tid, period) => fetchMetaAds(tid, period),
  google_ads:            (tid, period) => fetchGoogleAds(tid, period),
  klaviyo:               (tid, period) => fetchKlaviyo(tid, period),
  google_analytics:      (tid, period) => fetchGA4(tid, period),       // was: googleanalytics (slug mismatch fix)
  google_search_console: (tid, period) => fetchGSC(tid, period),
  shopify:               (tid, period) => fetchShopify(tid, period),
};

// Map Composio toolkit slugs → our channel names (for display/storage)
const SLUG_TO_CHANNEL = {
  facebook_ads:          "meta_ads",
  google_ads:            "google_ads",
  klaviyo:               "klaviyo",
  google_analytics:      "ga4",           // was: googleanalytics (slug mismatch fix)
  google_search_console: "gsc",
  shopify:               "shopify",
};

// ─── Claude insight generator ─────────────────────────────────────────────────

const FALLBACK_INSIGHTS = {
  summary: "Not enough data to generate insights. Connect a marketing platform or click Refresh after data is available.",
  insights: [
    {
      title: "No data",
      body: "Connect a platform in Settings → Connections to see analytics.",
      channel: "cross-channel",
      severity: "info",
    },
  ],
  recommended_actions: [
    {
      action: "Connect a platform",
      reason: "Analytics require at least one connected data source.",
      priority: "high",
      channel: "all",
      workspace: "connections",
    },
  ],
};

function validateInsightShape(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (typeof obj.summary !== "string") return false;
  if (!Array.isArray(obj.insights)) return false;
  if (!Array.isArray(obj.recommended_actions)) return false;
  // Validate insights entries
  for (const ins of obj.insights) {
    if (typeof ins?.title !== "string" || typeof ins?.body !== "string") return false;
    if (!["warning", "ok", "info"].includes(ins?.severity)) return false;
  }
  // Validate actions entries
  for (const act of obj.recommended_actions) {
    if (typeof act?.action !== "string" || typeof act?.reason !== "string") return false;
    if (!["high", "medium", "low"].includes(act?.priority)) return false;
  }
  return true;
}

function parseInsightJson(text) {
  if (!text) return null;
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const parsed = JSON.parse(clean);
    if (validateInsightShape(parsed)) return parsed;
  } catch { /* invalid JSON */ }
  return null;
}

async function callClaude(systemPrompt, userContent) {
  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getModel(),
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.content?.[0]?.text || "";
}

async function generateInsights(snapshots, brand, period) {
  if (!ANTHROPIC_KEY) return FALLBACK_INSIGHTS;
  if (snapshots.length === 0) return FALLBACK_INSIGHTS;

  const brandName = brand?.name || "this brand";
  const industry  = brand?.industry || "ecommerce";

  const snapshotText = snapshots.map(s => (
    `CHANNEL: ${s.channel}\n${JSON.stringify(s.metrics, null, 2)}`
  )).join("\n\n---\n\n");

  const schemaBlock = JSON.stringify({
    summary: "string (2-3 sentence executive brief)",
    recommended_actions: [
      {
        action: "string (short imperative)",
        reason: "string (one sentence, grounded in data)",
        priority: "high | medium | low",
        channel: "string (channel name or 'all')",
        workspace: "studio | emailstudio | searchstudio | organic | planner | insights | connections",
      },
    ],
    insights: [
      {
        title: "string (short observation title)",
        body: "string (2-3 sentences with specific numbers)",
        channel: "string (channel name or 'cross-channel')",
        severity: "warning | ok | info",
      },
    ],
  }, null, 2);

  const systemPrompt = `You are Analyst — the data AI for FlowOS Reach, an AI marketing OS for ${brandName} (${industry}).

Analyze the marketing performance data below and produce a structured JSON response.

REQUIRED JSON SCHEMA:
${schemaBlock}

RULES
- Max 3 recommended actions (highest priority first).
- Max 6 insights.
- Always reference specific numbers from the data.
- severity "warning" = needs attention, "ok" = performing well, "info" = neutral observation.
- workspace must be one of the valid enum values above.
- Return ONLY the JSON object. No markdown fences, no prose, no trailing commas.`;

  const userContent = `Here is the ${period} marketing performance data:\n\n${snapshotText}\n\nGenerate the JSON analysis now.`;

  // Attempt 1
  const text1 = await callClaude(systemPrompt, userContent);
  const parsed1 = parseInsightJson(text1);
  if (parsed1) return parsed1;

  // Attempt 2 — stronger reminder
  const retryContent = `${userContent}\n\n[REMINDER] Your previous response was not valid JSON. Return ONLY a valid JSON object matching the schema exactly. No markdown, no prose.`;
  const text2 = await callClaude(systemPrompt, retryContent);
  const parsed2 = parseInsightJson(text2);
  if (parsed2) return parsed2;

  // Fallback
  console.error("[analytics-ingest] Claude returned unparseable JSON after retry. Using fallback.");
  return FALLBACK_INSIGHTS;
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "Supabase not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response("Bad request", { status: 400 }); }

  // Dual-auth: user JWT (tenantId from token) OR cron secret (tenantId
  // must be supplied in body — daily-analytics cron iterates the brands
  // table server-side and stamps it).
  const { tenantId: bodyTenantId } = body;
  const auth = await requireAuthOrCron(req, bodyTenantId);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;
  const { period = "30d" } = body;

  try {
    // 1. Fetch brand profile + connected apps in parallel
    const [brand, connectedApps] = await Promise.all([
      fetchBrandProfile(tenantId),
      getConnectedAccountSlugs(tenantId),
    ]);

    // 2. Fetch metrics for each connected platform in parallel
    const fetchPromises = connectedApps
      .filter(slug => CHANNEL_FETCHERS[slug])
      .map(slug => CHANNEL_FETCHERS[slug](tenantId, period).catch(() => null));

    const results = await Promise.all(fetchPromises);
    const snapshots = results.filter(Boolean);

    // 3. Upsert raw snapshots into Supabase
    await Promise.all(
      snapshots.map(s => upsertSnapshot(tenantId, s.channel, period, s.metrics, "live"))
    );

    // 4. If no live data (no Composio connections), load existing snapshots from DB
    let snapshotsForInsights = snapshots;
    if (snapshots.length === 0) {
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/analytics_snapshots?tenant_id=eq.${encodeURIComponent(tenantId)}&period=eq.${encodeURIComponent(period)}&select=*`,
        { headers: sbHeaders() }
      );
      if (existingRes.ok) {
        const existing = await existingRes.json();
        snapshotsForInsights = existing.map(row => ({ channel: row.channel, metrics: row.metrics }));
      }
    }

    // 5. Generate Claude insights
    const insightData = await generateInsights(snapshotsForInsights, brand, period);

    // 6. Save insights
    let savedInsights = null;
    if (insightData) {
      savedInsights = await upsertInsights(
        tenantId, period,
        insightData.summary,
        insightData.insights,
        insightData.recommended_actions
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      period,
      channels_fetched: snapshots.map(s => s.channel),
      insights: insightData,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[analytics-ingest] error:", e.message);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
