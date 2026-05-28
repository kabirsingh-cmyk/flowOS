/**
 * FlowOS Reach — Zernio Analytics proxy
 * Vercel Edge Function: POST /api/zernio-analytics
 *
 * Wraps Zernio's analytics endpoints for per-platform insights and
 * cross-platform primitives. All actions require user JWT auth except
 * when called from cron (requireAuthOrCron).
 *
 * Per-platform actions (need connected account):
 *   facebook_page_insights, instagram_account_insights,
 *   instagram_follower_history, instagram_demographics,
 *   linkedin_org_aggregate, linkedin_post_analytics,
 *   linkedin_post_reactions, linkedin_mentions,
 *   tiktok_account_insights, youtube_channel_insights,
 *   youtube_daily_views, youtube_demographics,
 *   gmb_performance, gmb_search_keywords
 *
 * Cross-platform primitives:
 *   best_time, content_decay, posting_frequency,
 *   post_timeline, daily_metrics
 *
 * Drill-down actions:
 *   post_analytics, ad_analytics, linkedin_personal_aggregate
 */

import { requireAuthOrCron } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import { zernioFetch, requireZernioAccountId } from "./lib/zernioClient.js";

export const config = { runtime: "edge" };

// ─── Action registry ──────────────────────────────────────────────────────────

const PLATFORM_ANALYTICS = {
  facebook_page_insights:     { path: "/analytics/facebook/page-insights",      needsAccount: true },
  instagram_account_insights: { path: "/analytics/instagram/account-insights",  needsAccount: true },
  instagram_follower_history: { path: "/analytics/instagram/follower-history",  needsAccount: true },
  instagram_demographics:     { path: "/analytics/instagram/demographics",      needsAccount: true },
  linkedin_org_aggregate:     { path: "/analytics/linkedin/org-aggregate-analytics", needsAccount: true },
  linkedin_post_analytics:    { path: (a) => `/accounts/${a}/linkedin-post-analytics`,    needsAccount: true, needsUrn: true },
  linkedin_post_reactions:    { path: (a) => `/accounts/${a}/linkedin-post-reactions`,    needsAccount: true, needsUrn: true },
  linkedin_mentions:          { path: (a) => `/accounts/${a}/linkedin-mentions`,          needsAccount: true, needsUrl: true },
  tiktok_account_insights:    { path: "/analytics/tiktok/account-insights",    needsAccount: true },
  youtube_channel_insights:   { path: "/analytics/youtube/channel-insights",   needsAccount: true },
  youtube_daily_views:        { path: "/analytics/youtube/daily-views",        needsAccount: true, needsVideoId: true },
  youtube_demographics:       { path: "/analytics/youtube/demographics",       needsAccount: true },
  gmb_performance:            { path: "/analytics/googlebusiness/performance", needsAccount: true },
  gmb_search_keywords:        { path: "/analytics/googlebusiness/search-keywords", needsAccount: true },
};

const PRIMITIVES = {
  best_time:         { path: "/analytics/best-time",         needsPostId: false },
  content_decay:     { path: "/analytics/content-decay",     needsPostId: false },
  posting_frequency: { path: "/analytics/posting-frequency", needsPostId: false },
  post_timeline:     { path: "/analytics/post-timeline",     needsPostId: true },
  daily_metrics:     { path: "/analytics/daily-metrics",     needsPostId: false },
};

const DRILL_DOWNS = {
  post_analytics: {
    path: "/analytics",
    params: ["postId","platform","profileId","accountId","source","fromDate","toDate","limit","page","sortBy","order"],
  },
  ad_analytics: {
    path: (adId) => `/ads/${encodeURIComponent(adId)}/analytics`,
    needsAdId: true,
    params: ["fromDate","toDate","breakdowns"],
  },
  linkedin_personal_aggregate: {
    path: (accountId) => `/accounts/${encodeURIComponent(accountId)}/linkedin-aggregate-analytics`,
    needsAccountId: true,
    params: ["aggregation","startDate","endDate","metrics"],
  },
};

const VALID_ACTIONS = [
  ...Object.keys(PLATFORM_ANALYTICS),
  ...Object.keys(PRIMITIVES),
  ...Object.keys(DRILL_DOWNS),
];

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return errResponse("POST required", 405);

  let body;
  try { body = await req.json(); } catch { return errResponse("Invalid JSON body", 400); }

  const { action } = body;
  if (!action) return errResponse("action required", 400);
  if (!VALID_ACTIONS.includes(action)) {
    return errResponse(`Invalid action. Supported: ${VALID_ACTIONS.join(", ")}`, 400);
  }

  const auth = await requireAuthOrCron(req, body.tenantId);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;
  body = { ...body, tenantId };

  try {
    if (PLATFORM_ANALYTICS[action]) {
      return await handlePlatform(body, PLATFORM_ANALYTICS[action]);
    }
    if (PRIMITIVES[action]) {
      return await handlePrimitive(body, PRIMITIVES[action]);
    }
    return await handleDrillDown(body, DRILL_DOWNS[action]);
  } catch (e) {
    console.error("[zernio-analytics]", e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return errResponse(`Zernio error: ${e.message}`, status);
  }
}

// ─── Platform-specific analytics ──────────────────────────────────────────────

async function handlePlatform(body, meta) {
  const {
    platform, accountId: bodyAccountId,
    since, until, metrics, metricType, breakdown, timeframe,
    startDate, endDate, startMonth, endMonth,
    urn, url, displayName, videoId, limit, cursor,
  } = body;

  let accountId = bodyAccountId;
  if (meta.needsAccount && !accountId) {
    if (!platform) return errResponse("platform required", 400);
    accountId = await requireZernioAccountId(body.tenantId, platform);
  }

  if (meta.needsUrn && !urn) return errResponse("urn required", 400);
  if (meta.needsUrl && !url) return errResponse("url required", 400);
  if (meta.needsVideoId && !videoId) return errResponse("videoId required", 400);

  const path = typeof meta.path === "function" ? meta.path(accountId) : meta.path;
  const params = new URLSearchParams();

  if (accountId) params.set("accountId", accountId);
  if (since)     params.set("since", since);
  if (until)     params.set("until", until);
  if (metrics)   params.set("metrics", metrics);
  if (metricType)params.set("metricType", metricType);
  if (breakdown) params.set("breakdown", breakdown);
  if (timeframe) params.set("timeframe", timeframe);
  if (startDate) params.set("startDate", startDate);
  if (endDate)   params.set("endDate", endDate);
  if (startMonth)params.set("startMonth", startMonth);
  if (endMonth)  params.set("endMonth", endMonth);
  if (urn)       params.set("urn", urn);
  if (url)       params.set("url", url);
  if (displayName)params.set("displayName", displayName);
  if (videoId)   params.set("videoId", videoId);
  if (limit)     params.set("limit", String(limit));
  if (cursor)    params.set("cursor", cursor);

  const qs = params.toString();
  const data = await zernioFetch(`${path}${qs ? "?" + qs : ""}`, { method: "GET" });
  return jsonResponse({ ok: true, data });
}

// ─── Cross-platform primitives ────────────────────────────────────────────────

async function handlePrimitive(body, meta) {
  const {
    platform, profileId, accountId, postId, source,
    fromDate, toDate, since, until,
  } = body;

  if (meta.needsPostId && !postId) return errResponse("postId required", 400);

  const params = new URLSearchParams();
  if (platform)  params.set("platform", platform);
  if (profileId) params.set("profileId", profileId);
  if (accountId) params.set("accountId", accountId);
  if (postId)    params.set("postId", postId);
  if (source)    params.set("source", source);
  if (fromDate)  params.set("fromDate", fromDate);
  if (toDate)    params.set("toDate", toDate);
  if (since)     params.set("since", since);
  if (until)     params.set("until", until);

  const qs = params.toString();
  const data = await zernioFetch(`${meta.path}${qs ? "?" + qs : ""}`, { method: "GET" });
  return jsonResponse({ ok: true, data });
}

// ─── Drill-down analytics ─────────────────────────────────────────────────────

async function handleDrillDown(body, meta) {
  const {
    adId, accountId: drillAccountId,
    postId, platform, profileId, accountId, source,
    fromDate, toDate, since, until,
    limit, page, sortBy, order,
    breakdowns, aggregation, metrics,
    startDate, endDate,
  } = body;

  if (meta.needsAdId && !adId) return errResponse("adId required", 400);
  if (meta.needsAccountId && !drillAccountId) return errResponse("accountId required", 400);

  const path = typeof meta.path === "function"
    ? meta.path(meta.needsAdId ? adId : drillAccountId)
    : meta.path;

  const params = new URLSearchParams();

  const setIf = (key, val) => { if (val !== undefined && val !== null && val !== "") params.set(key, String(val)); };

  for (const key of meta.params) {
    switch (key) {
      case "postId":      setIf("postId", postId); break;
      case "platform":    setIf("platform", platform); break;
      case "profileId":   setIf("profileId", profileId); break;
      case "accountId":   setIf("accountId", accountId); break;
      case "source":      setIf("source", source); break;
      case "fromDate":    setIf("fromDate", fromDate); break;
      case "toDate":      setIf("toDate", toDate); break;
      case "since":       setIf("since", since); break;
      case "until":       setIf("until", until); break;
      case "limit":       setIf("limit", limit); break;
      case "page":        setIf("page", page); break;
      case "sortBy":      setIf("sortBy", sortBy); break;
      case "order":       setIf("order", order); break;
      case "breakdowns":  setIf("breakdowns", breakdowns); break;
      case "aggregation": setIf("aggregation", aggregation); break;
      case "metrics":     setIf("metrics", metrics); break;
      case "startDate":   setIf("startDate", startDate); break;
      case "endDate":     setIf("endDate", endDate); break;
    }
  }

  const qs = params.toString();
  const data = await zernioFetch(`${path}${qs ? "?" + qs : ""}`, { method: "GET" });
  return jsonResponse({ ok: true, data });
}
