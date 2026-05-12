/**
 * FlowOS — Analytics Ingestion + Insight Generation
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

export const config = { runtime: "edge" };

const COMPOSIO_BASE  = "https://backend.composio.dev/api/v3";
const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const COMPOSIO_KEY   = process.env.COMPOSIO_API_KEY2;

// ─── Supabase helpers ──────────────────────────────────────────────────────────

function sbHeaders() {
  return { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
}

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

async function upsertInsights(tenantId, period, summary, insights, recommended_actions) {
  // Delete old row for this tenant+period, then insert fresh
  await fetch(
    `${SUPABASE_URL}/rest/v1/analytics_insights?tenant_id=eq.${encodeURIComponent(tenantId)}&period=eq.${encodeURIComponent(period)}`,
    { method: "DELETE", headers: sbHeaders() }
  );
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/analytics_insights`,
    {
      method: "POST",
      headers: { ...sbHeaders(), "Prefer": "return=representation" },
      body: JSON.stringify({ tenant_id: tenantId, period, summary, insights, recommended_actions, generated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) throw new Error(`Failed to save insights: ${res.status}`);
  return await res.json();
}

// ─── Composio helpers ─────────────────────────────────────────────────────────

function composioHeaders() {
  return { "Content-Type": "application/json", "x-api-key": COMPOSIO_KEY };
}

async function getConnectedApps(tenantId) {
  if (!COMPOSIO_KEY || !tenantId) return [];
  const res = await fetch(
    `${COMPOSIO_BASE}/connected_accounts?user_ids=${encodeURIComponent(tenantId)}&statuses=ACTIVE&limit=50`,
    { headers: composioHeaders() }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const accounts = data.items || data.connected_accounts || data.data || [];
  return [...new Set(accounts.map(a => a.toolkit?.slug || a.appName || a.app_name).filter(Boolean))];
}

async function runComposioTool(toolName, input, tenantId) {
  try {
    const res = await fetch(`${COMPOSIO_BASE}/tools/${toolName}/execute`, {
      method: "POST",
      headers: composioHeaders(),
      body: JSON.stringify({ user_id: tenantId, input }),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return res.ok ? (data?.response || data?.data || data) : null;
  } catch {
    return null;
  }
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
  const data = await runComposioTool("FACEBOOK_ADS_GET_AD_ACCOUNT_INSIGHTS", {
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
async function fetchGoogleAds(tenantId, period) {
  const days = periodDays(period);
  const data = await runComposioTool("GOOGLEADS_GET_CAMPAIGN_PERFORMANCE_REPORT", {
    date_range_type: "LAST_N_DAYS",
    number_of_days: days,
  }, tenantId);
  if (!data) return null;

  const campaigns = Array.isArray(data) ? data : [data];
  const totals = campaigns.reduce((acc, c) => ({
    spend:       acc.spend       + parseFloat(c.cost_micros || c.cost || 0) / 1e6,
    impressions: acc.impressions + parseInt(c.impressions || 0),
    clicks:      acc.clicks      + parseInt(c.clicks || 0),
    conversions: acc.conversions + parseFloat(c.conversions || 0),
    conv_value:  acc.conv_value  + parseFloat(c.conversions_value || c.conversion_value || 0),
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, conv_value: 0 });

  return {
    channel: "google_ads",
    metrics: {
      ...totals,
      ctr:    totals.impressions ? +(totals.clicks / totals.impressions * 100).toFixed(2) : 0,
      cpc:    totals.clicks      ? +(totals.spend  / totals.clicks).toFixed(2) : 0,
      roas:   totals.spend       ? +(totals.conv_value / totals.spend).toFixed(2) : 0,
      period,
    },
  };
}

// ── Klaviyo (email / owned) ───────────────────────────────────────────────────
async function fetchKlaviyo(tenantId, period) {
  const days = periodDays(period);
  // Klaviyo campaign metrics for the period
  const data = await runComposioTool("KLAVIYO_GET_CAMPAIGNS", {
    filter: `greater-than(send_time,${new Date(Date.now() - days * 86400000).toISOString()})`,
    fields: ["name", "send_time", "status"].join(","),
  }, tenantId);
  if (!data) return null;

  const campaigns = (data?.data || data || []).filter(c => c?.attributes?.status === "sent" || c?.status === "sent");

  // Aggregate basic stats — pull first campaign's report as representative
  let openRate = 0, clickRate = 0, revenue = 0, sends = 0;
  if (campaigns.length > 0) {
    const reportData = await runComposioTool("KLAVIYO_GET_CAMPAIGN_CAMPAIGN_MESSAGE_ASSIGN", {
      campaign_id: campaigns[0]?.id,
    }, tenantId);
    if (reportData) {
      openRate  = parseFloat(reportData?.open_rate || 0);
      clickRate = parseFloat(reportData?.click_rate || 0);
      revenue   = parseFloat(reportData?.revenue || 0);
      sends     = parseInt(reportData?.sent_count || 0);
    }
  }

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
  const data = await runComposioTool("GOOGLEANALYTICS_RUN_REPORT", {
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

// ── Shopify ───────────────────────────────────────────────────────────────────
async function fetchShopify(tenantId, period) {
  const { start, end } = dateRange(period);
  const data = await runComposioTool("SHOPIFY_GET_ORDERS", {
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
  facebook_ads:  (tid, period) => fetchMetaAds(tid, period),
  google_ads:    (tid, period) => fetchGoogleAds(tid, period),
  klaviyo:       (tid, period) => fetchKlaviyo(tid, period),
  googleanalytics: (tid, period) => fetchGA4(tid, period),
  shopify:       (tid, period) => fetchShopify(tid, period),
};

// Map Composio toolkit slugs → our channel names (for display)
const SLUG_TO_CHANNEL = {
  facebook_ads:    "meta_ads",
  google_ads:      "google_ads",
  klaviyo:         "klaviyo",
  googleanalytics: "ga4",
  shopify:         "shopify",
};

// ─── Claude insight generator ─────────────────────────────────────────────────

async function generateInsights(snapshots, brand, period) {
  if (!ANTHROPIC_KEY || snapshots.length === 0) return null;

  const brandName = brand?.name || "this brand";
  const industry  = brand?.industry || "ecommerce";

  const snapshotText = snapshots.map(s => (
    `CHANNEL: ${s.channel}\n${JSON.stringify(s.metrics, null, 2)}`
  )).join("\n\n---\n\n");

  const systemPrompt = `You are Analyst — the data AI for FlowOS, an AI marketing OS for ${brandName} (${industry}).

Analyze the marketing performance data below and produce a structured JSON response.

Response must be valid JSON with these exact keys:
{
  "summary": "2-3 sentence executive brief. Lead with the most important number or trend. Be direct.",
  "recommended_actions": [
    {
      "action": "Short imperative — what to do",
      "reason": "One sentence — why, grounded in the data",
      "priority": "high|medium|low",
      "channel": "channel name or 'all'",
      "workspace": "studio|emailstudio|searchstudio|organic|planner|insights|connections"
    }
  ],
  "insights": [
    {
      "title": "Short observation title",
      "body": "2-3 sentences explaining the insight with specific numbers",
      "channel": "channel name or 'cross-channel'",
      "severity": "warning|ok|info"
    }
  ]
}

Rules:
- Max 3 recommended actions (highest priority first)
- Max 6 insights
- Always reference specific numbers from the data
- severity "warning" = needs attention, "ok" = performing well, "info" = neutral observation
- workspace must be one of the valid enum values above
- Return ONLY the JSON object, no markdown, no prose`;

  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Here is the ${period} marketing performance data:\n\n${snapshotText}\n\nGenerate the JSON analysis now.`,
      }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.content?.[0]?.text || "";
  try {
    // Strip any accidental markdown fences
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { summary: text, insights: [], recommended_actions: [] };
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "Supabase not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response("Bad request", { status: 400 }); }

  const { tenantId, period = "30d" } = body;
  if (!tenantId) {
    return new Response(JSON.stringify({ ok: false, error: "tenantId required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Fetch brand profile + connected apps in parallel
    const [brandRes, connectedApps] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/brands?user_id=eq.${encodeURIComponent(tenantId)}&select=*&limit=1`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.ok ? r.json() : []),
      getConnectedApps(tenantId),
    ]);
    const brand = brandRes?.[0] || null;

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
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
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
