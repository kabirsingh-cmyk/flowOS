/**
 * FlowOS — Inbox hydration endpoint
 * GET /api/inbox
 *
 * Pulls DMs and comments from Zernio for each connected v1 platform
 * (Instagram, Facebook, LinkedIn, X), upserts new items into inbox_events
 * (preserving replied/archived status on conflicts), and returns the tenant's
 * open inbox items with Supabase UUIDs so the frontend archive/reply handlers
 * work without modification.
 *
 * DM-capable platforms (per Zernio docs): instagram, facebook, x (twitter)
 * Comment-capable platforms: instagram, facebook, linkedin, x
 *
 * Caveats:
 * - GET /v1/inbox/comments without postId is assumed; falls back to [] if Zernio
 *   doesn't support inbox-wide comment listing (webhook path still delivers them).
 * - LinkedIn DMs are skipped — not listed as supported by Zernio's DM endpoint.
 * - ai_draft and ai_triage_note are empty for pull-fetched items (v1).
 */

import { requireAuth } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";

export const config = { runtime: "edge" };

const ZERNIO_BASE = "https://zernio.com/api/v1";

// v1 scope — FlowOS connector IDs
const V1_PLATFORMS     = ["ig", "fb", "li", "x"];
const DM_PLATFORMS     = new Set(["ig", "fb", "x"]);   // LinkedIn not DM-capable

const PLATFORM_ID_MAP  = {
  ig: "instagram",
  fb: "facebook",
  li: "linkedin",
  x:  "twitter",
};

function resolvePlatform(id) {
  return PLATFORM_ID_MAP[id] || id;
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function timeAgoFromMs(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

// ─── Zernio helpers ───────────────────────────────────────────────────────────

function zernioHeaders() {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new Error("ZERNIO_API_KEY not set");
  return { "Authorization": `Bearer ${key}` };
}

async function zernioGet(path) {
  const res  = await fetch(`${ZERNIO_BASE}${path}`, { headers: zernioHeaders() });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.message || `Zernio ${path} ${res.status}`);
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

async function getConnectedPlatforms(tenantId) {
  const inList = V1_PLATFORMS.map(id => `"${id}"`).join(",");
  const url    = `${process.env.SUPABASE_URL}/rest/v1/channels` +
    `?user_id=eq.${encodeURIComponent(tenantId)}` +
    `&platform=in.(${inList})` +
    `&status=eq.connected` +
    `&select=platform,composio_connection_id`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return [];
  return (await res.json()) || [];
}

async function getProfileId(tenantId) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/connector_credentials` +
    `?user_id=eq.${encodeURIComponent(tenantId)}` +
    `&platform=eq.zernio_profile` +
    `&select=secret_value&limit=1`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.secret_value || null;
}

async function upsertInboxEvents(rows) {
  if (!rows.length) return;
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/inbox_events`, {
    method:  "POST",
    headers: {
      ...sbHeaders(),
      "Prefer": "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  // Non-blocking: ignore errors (webhook path is the authoritative writer)
}

async function getOpenEvents(tenantId) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/inbox_events` +
    `?tenant_id=eq.${encodeURIComponent(tenantId)}` +
    `&status=eq.open` +
    `&order=created_at.desc` +
    `&limit=50`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) return [];
  const rows = await res.json();
  return (rows || []).map(row => ({
    id:         row.id,                 // Supabase UUID — used for inbox_events UPDATE
    externalId: row.external_id,        // Zernio ID — used for Zernio API calls
    author:     row.author_name || row.author_handle || "Unknown",
    source:     `${capitalize(row.platform)} · ${row.event_type}`,
    text:       row.text || "",
    risk:       row.risk || "low",
    status:     row.status || "open",
    draft:      row.ai_draft || "",
    reason:     row.ai_triage_note || "",
    timeAgo:    timeAgoFromMs(Date.now() - new Date(row.created_at).getTime()),
    category:   row.event_type,
    platform:   row.platform,
    eventType:  row.event_type,
  }));
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeDm(conv, platform) {
  const lastMsg = Array.isArray(conv.messages) ? conv.messages[conv.messages.length - 1] : null;
  return {
    external_id:   conv._id || conv.id || null,
    event_type:    "dm",
    platform,
    author_name:   conv.participant?.name || null,
    author_handle: conv.participant?.handle || conv.participant?.username || null,
    text:          conv.snippet || lastMsg?.text || "",
    risk:          "low",
    status:        "open",
    raw:           conv,
  };
}

function normalizeComment(comment, platform) {
  return {
    external_id:   comment._id || comment.id || null,
    event_type:    "comment",
    platform,
    author_name:   comment.author?.name || null,
    author_handle: comment.author?.handle || comment.author?.username || null,
    text:          comment.text || comment.message || "",
    risk:          "low",
    status:        "open",
    raw:           comment,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { tenantId } = auth;

  try {
    const [connected, profileId] = await Promise.all([
      getConnectedPlatforms(tenantId),
      getProfileId(tenantId),
    ]);

    if (connected.length === 0) {
      // No v1 platforms connected — return what's already in inbox_events (webhook-delivered)
      const items = await getOpenEvents(tenantId);
      return jsonResponse({ ok: true, items, source: "events_only" });
    }

    // Fan out Zernio fetches — one DM fetch + one comment fetch per platform, all parallel
    const fetches = connected.flatMap(({ platform, composio_connection_id: accountId }) => {
      const resolvedPlatform = resolvePlatform(platform);
      const tasks = [];

      if (DM_PLATFORMS.has(platform) && accountId) {
        const qs = new URLSearchParams({ accountId });
        tasks.push(
          zernioGet(`/inbox/conversations?${qs}`)
            .then(data => (data.data || []).map(c => normalizeDm(c, platform)))
            .catch(() => []),
        );
      }

      if (profileId) {
        const qs = new URLSearchParams({ platform: resolvedPlatform, profileId });
        tasks.push(
          zernioGet(`/inbox/comments?${qs}`)
            .then(data => (data.data || []).map(c => normalizeComment(c, platform)))
            .catch(() => []),
        );
      }

      return tasks;
    });

    const results   = await Promise.all(fetches);
    const pulled    = results.flat().filter(item => item.external_id);

    if (pulled.length > 0) {
      await upsertInboxEvents(pulled.map(item => ({
        tenant_id:    tenantId,
        event_type:   item.event_type,
        platform:     item.platform,
        external_id:  item.external_id,
        author_name:  item.author_name,
        author_handle:item.author_handle,
        text:         item.text,
        risk:         item.risk,
        status:       item.status,
        raw:          item.raw,
      })));
    }

    const items = await getOpenEvents(tenantId);
    return jsonResponse({ ok: true, items, pulled: pulled.length });

  } catch (e) {
    console.error("[inbox]", e);
    return errResponse(`Inbox fetch failed: ${e.message}`, 502);
  }
}
