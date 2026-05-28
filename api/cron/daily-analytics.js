/**
 * FlowOS Reach — Daily analytics cron
 * Vercel Cron: GET /api/cron/daily-analytics — runs at 06:00 UTC every day
 *
 * 1. Verify Vercel cron secret
 * 2. Fetch all distinct tenant IDs from the brands table
 * 3. Per tenant:
 *    a. Fetch connected Zernio platforms from channels table
 *    b. Fan out to platform analytics endpoints in parallel (Promise.allSettled)
 *    c. Persist raw payloads into analytics_snapshots
 *    d. Run cross-platform primitives in parallel
 *    e. Persist primitive results into analytics_primitives
 *    f. POST to /api/analytics-ingest for Composio data + Claude insights
 * 4. Return a run summary
 */

import { requireCron } from "../lib/auth.js";

export const config = { runtime: "edge" };

// Map FlowOS platform short IDs → the analytics endpoints we want to call.
const PLATFORM_ENDPOINTS = {
  fb:        ["facebook_page_insights"],
  ig:        ["instagram_account_insights", "instagram_follower_history", "instagram_demographics"],
  li:        ["linkedin_org_aggregate"],
  tt:        ["tiktok_account_insights"],
  yt:        ["youtube_channel_insights"],
  gbusiness: ["gmb_performance", "gmb_search_keywords"],
};

const PRIMITIVE_ACTIONS = [
  "best_time",
  "content_decay",
  "posting_frequency",
  "daily_metrics",
];

export default async function handler(req) {
  const cronAuth = requireCron(req);
  if (cronAuth instanceof Response) return cronAuth;

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) {
    return json(500, { ok: false, error: "Supabase env vars not configured" });
  }

  // ── Fetch all active tenants ───────────────────────────────────────────────
  let tenantIds;
  try {
    const res = await fetch(
      `${sbUrl}/rest/v1/brands?select=user_id&order=updated_at.desc`,
      { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
    );
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const rows = await res.json();
    tenantIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
  } catch (e) {
    return json(500, { ok: false, error: `Could not fetch tenants: ${e.message}` });
  }

  if (tenantIds.length === 0) {
    return json(200, { ok: true, message: "No tenants found — nothing to ingest" });
  }

  const origin = new URL(req.url).origin;
  const results = [];

  for (const tenantId of tenantIds) {
    const tenantResult = await processTenant(tenantId, origin, sbUrl, sbKey);
    results.push(tenantResult);
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;

  console.log(`[cron/daily-analytics] ${passed} ok · ${failed} failed`, results);

  return json(200, {
    ok: failed === 0,
    processed: results.length,
    passed,
    failed,
    results,
  });
}

async function processTenant(tenantId, origin, sbUrl, sbKey) {
  const start = Date.now();
  const period = "30d";
  const snapshotRows = [];
  const primitiveRows = [];
  const endpointErrors = [];
  let analyticsIngestOk = false;
  let analyticsIngestError = null;

  try {
    // ── 1. Connected Zernio platforms for this tenant ───────────────────────
    const connectedPlatforms = await fetchConnectedPlatforms(tenantId, sbUrl, sbKey);

    // ── 2. Platform analytics — fan out in parallel ─────────────────────────
    const platformCalls = [];
    for (const platform of connectedPlatforms) {
      const endpoints = PLATFORM_ENDPOINTS[platform];
      if (!endpoints) continue;
      for (const action of endpoints) {
        platformCalls.push(
          callZernioAnalytics(origin, tenantId, action, platform, period)
            .then(data => ({ ok: true, platform, action, data }))
            .catch(err => ({ ok: false, platform, action, error: err.message }))
        );
      }
    }

    const platformResults = await Promise.allSettled(platformCalls);
    for (const r of platformResults) {
      const v = r.value || r.reason;
      if (!v) continue;
      if (v.ok && v.data) {
        snapshotRows.push({
          tenant_id: tenantId,
          channel: platformToChannel(v.platform),
          period,
          endpoint: v.action,
          metrics: v.data,
          source: "live",
          fetched_at: new Date().toISOString(),
        });
      } else {
        endpointErrors.push({ type: "platform", platform: v.platform, action: v.action, error: v.error });
      }
    }

    // ── 3. Cross-platform primitives — fan out in parallel ──────────────────
    const primitiveCalls = PRIMITIVE_ACTIONS.map(action =>
      callZernioAnalytics(origin, tenantId, action, null, period)
        .then(data => ({ ok: true, action, data }))
        .catch(err => ({ ok: false, action, error: err.message }))
    );

    const primitiveResults = await Promise.allSettled(primitiveCalls);
    for (const r of primitiveResults) {
      const v = r.value || r.reason;
      if (!v) continue;
      if (v.ok && v.data) {
        primitiveRows.push({
          tenant_id: tenantId,
          primitive: v.action,
          platform: null,
          period,
          payload: v.data,
          captured_at: new Date().toISOString(),
        });
      } else {
        endpointErrors.push({ type: "primitive", action: v.action, error: v.error });
      }
    }

    // ── 4. Persist snapshots + primitives ───────────────────────────────────
    await Promise.all([
      persistSnapshots(sbUrl, sbKey, snapshotRows),
      persistPrimitives(sbUrl, sbKey, primitiveRows),
    ]);

    // ── 5. Call legacy analytics-ingest for Composio data + insights ────────
    try {
      const ingestRes = await fetchWithRetry(`${origin}/api/analytics-ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ tenantId, period }),
      }, { retries: 1, backoffMs: 500 });
      analyticsIngestOk = ingestRes.ok;
      if (!ingestRes.ok) {
        const ingestData = await ingestRes.json().catch(() => ({}));
        analyticsIngestError = ingestData.error || `HTTP ${ingestRes.status}`;
      }
    } catch (e) {
      analyticsIngestOk = false;
      analyticsIngestError = e.message;
    }

    const elapsed = Date.now() - start;
    return {
      tenantId,
      ok: true,
      elapsed: `${elapsed}ms`,
      snapshots: snapshotRows.length,
      primitives: primitiveRows.length,
      analyticsIngest: analyticsIngestOk,
      analyticsIngestError,
      endpointErrors: endpointErrors.length > 0 ? endpointErrors : undefined,
    };

  } catch (e) {
    return { tenantId, ok: false, error: e.message, endpointErrors: endpointErrors.length > 0 ? endpointErrors : undefined };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchConnectedPlatforms(tenantId, sbUrl, sbKey) {
  const url =
    `${sbUrl}/rest/v1/channels` +
    `?user_id=eq.${encodeURIComponent(tenantId)}` +
    `&status=eq.connected` +
    `&select=platform`;
  const res = await fetch(url, { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } });
  if (!res.ok) return [];
  const rows = await res.json();
  return [...new Set(rows.map(r => r.platform).filter(Boolean))];
}

async function fetchWithRetry(url, init, opts = {}) {
  const { retries = 2, backoffMs = 500 } = opts;
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      // Retry on 5xx or rate-limit (429)
      const status = res.status;
      if (status >= 500 || status === 429) {
        lastErr = new Error(`HTTP ${status}`);
        if (i < retries) {
          await sleep(backoffMs * Math.pow(2, i));
          continue;
        }
      }
      // 4xx (except 429) — don't retry
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await sleep(backoffMs * Math.pow(2, i));
      }
    }
  }
  throw lastErr || new Error("fetch failed after retries");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function callZernioAnalytics(origin, tenantId, action, platform, period) {
  const body = { tenantId, action, period };
  if (platform) body.platform = platform;

  const res = await fetchWithRetry(`${origin}/api/zernio-analytics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify(body),
  }, { retries: 2, backoffMs: 600 });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data;
}

async function persistSnapshots(sbUrl, sbKey, rows) {
  if (rows.length === 0) return;
  const res = await fetchWithRetry(`${sbUrl}/rest/v1/analytics_snapshots`, {
    method: "POST",
    headers: {
      apikey: sbKey,
      Authorization: `Bearer ${sbKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  }, { retries: 1, backoffMs: 400 });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`persistSnapshots failed: ${body.message || res.status}`);
  }
}

async function persistPrimitives(sbUrl, sbKey, rows) {
  if (rows.length === 0) return;
  const res = await fetchWithRetry(`${sbUrl}/rest/v1/analytics_primitives`, {
    method: "POST",
    headers: {
      apikey: sbKey,
      Authorization: `Bearer ${sbKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  }, { retries: 1, backoffMs: 400 });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`persistPrimitives failed: ${body.message || res.status}`);
  }
}

function platformToChannel(platform) {
  // Map FlowOS short IDs to analytics_snapshots channel names.
  const map = {
    fb: "fb_organic",
    ig: "ig_organic",
    li: "li_organic",
    tt: "tt_organic",
    yt: "yt_organic",
    gbusiness: "gmb",
  };
  return map[platform] || platform;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
