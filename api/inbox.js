/**
 * FlowOS — Inbox hydration endpoint
 * GET /api/inbox
 *
 * Pulls DMs from Zernio for each connected v1 platform, upserts new items into
 * inbox_events (preserving replied/archived status on conflicts), runs a single
 * Claude call to triage + draft-reply any newly inserted items, and returns the
 * tenant's open inbox items with Supabase UUIDs so the frontend archive/reply
 * handlers work without modification.
 *
 * DM pull (this endpoint): instagram, facebook, x (twitter) — LinkedIn skipped
 * (Zernio doesn't expose LinkedIn DMs).
 *
 * Comments are NOT pulled here — Zernio's `GET /v1/inbox/comments` returns
 * POSTS WITH COMMENT COUNTS, not individual comments, and the per-post
 * `GET /v1/inbox/comments/{postId}` requires knowing post IDs up front.
 * Comments arrive via the `comment.received` webhook (api/webhooks/zernio.js)
 * which is authoritative for fb/ig/li/x/yt/reddit/bluesky.
 *
 * Threads comments have no webhook — handled separately by a cron poller
 * (added in PR K4).
 *
 * Shape contracts verified against Zernio OpenAPI 2026-05-30 — see
 * docs/phase-5-engagement-scoping.md §3.
 */

import { requireAuth } from "./lib/auth.js";
import { corsPreflightResponse, jsonResponse, errResponse } from "./lib/cors.js";
import { fetchBrandProfile } from "./lib/supabase.js";
import { getModel } from "./lib/anthropic.js";
import { INBOX_CAPABILITIES, dmPullPlatforms } from "./lib/inboxCapabilities.js";

export const config = { runtime: "edge" };

const ZERNIO_BASE = "https://zernio.com/api/v1";
const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

// Platforms we attempt DM pull on, derived from the capability matrix.
// Source of truth: api/lib/inboxCapabilities.js. K3 removed the hardcoded
// V1_PLATFORMS / DM_PLATFORMS in favour of the matrix so adding a platform
// is a single-file edit instead of a hunt across the codebase.
const DM_PULL_PLATFORMS = new Set(dmPullPlatforms());

// FlowOS connector IDs → Zernio platform slugs. Centralised in
// api/lib/zernioMap.js for publish paths; mirrored here for inbox paths
// because /api/inbox is independent of /api/zernio. Keeping the inline map
// avoids a circular dependency through zernioClient (which pulls auth +
// account-id helpers we don't need here).
const PLATFORM_ID_MAP  = {
  ig:      "instagram",
  fb:      "facebook",
  li:      "linkedin",
  x:       "twitter",
  yt:      "youtube",
  reddit:  "reddit",
  bluesky: "bluesky",
  threads: "threads",
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
  // Query every platform in the capability matrix; the DM-pull fan-out
  // filters by DM_PULL_PLATFORMS below. Doing the platform filter here too
  // would force two queries when matrix expands (e.g. K4 adds bluesky/reddit
  // DMs); the SQL filter is the cheap side.
  const inList = Object.keys(INBOX_CAPABILITIES).map(id => `"${id}"`).join(",");
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
    id:               row.id,                 // Supabase UUID — used for inbox_events UPDATE
    externalId:       row.external_id,        // Zernio ID — used for Zernio API calls
    parentExternalId: row.parent_external_id, // post_id for comments
    author:           row.author_name || row.author_handle || "Unknown",
    source:           `${capitalize(row.platform)} · ${row.event_type}`,
    text:             row.text || "",
    sourceUrl:        row.source_url || null,
    risk:             row.risk || "low",
    status:           row.status || "open",
    draft:            row.ai_draft || "",
    reason:           row.ai_triage_note || "",
    raw:              row.raw || null,        // Bluesky reply needs cid/rootUri/rootCid
    timeAgo:          timeAgoFromMs(Date.now() - new Date(row.created_at).getTime()),
    category:         row.event_type,
    platform:         row.platform,
    eventType:        row.event_type,
  }));
}

// ─── AI Triage + Draft (inbox_assistant) ──────────────────────────────────────

function buildBrandBlock(brand) {
  if (!brand) return "";
  const name = brand.name || "this brand";
  const voice = brand.voice || {};
  const lines = [`Brand: ${name}`];
  if (voice.tone) lines.push(`Tone: ${voice.tone}`);
  if (voice.personality) lines.push(`Personality: ${voice.personality}`);
  if (Array.isArray(brand.values) && brand.values.length) lines.push(`Values: ${brand.values.join(", ")}`);
  if (Array.isArray(voice.bannedPhrases) && voice.bannedPhrases.length) lines.push(`Never say: ${voice.bannedPhrases.join(", ")}`);
  return lines.join("\n");
}

async function triageItems(tenantId, items, brand) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || items.length === 0) return [];

  const brandBlock = buildBrandBlock(brand);

  const systemPrompt = `You are Inbox Assistant — the programmatic inbox triage AI for FlowOS Reach.
${brandBlock}

TASK
For every customer message provided, return a structured JSON analysis.

OUTPUT FORMAT — return ONLY a JSON array. No markdown fences, no prose:
[
  {
    "intent": "question | complaint | sales_lead | spam | praise | other",
    "sentiment": number between -1.0 and 1.0,
    "urgency": "low | medium | high",
    "suggested_action": "reply | archive | escalate",
    "triage_note": "One-sentence reasoning for the classification",
    "draft_reply": "A brand-voice-aligned reply draft. Keep it concise and on-brand."
  }
]

RULES
- intent must be exactly one of the enum values.
- sentiment: -1.0 = extremely negative, 0.0 = neutral, 1.0 = extremely positive.
- urgency: high = time-sensitive or escalatory; medium = needs attention today; low = can wait.
- suggested_action: reply = respond directly; archive = no action needed; escalate = human review required.
- draft_reply must match the brand voice above. Never use banned phrases. Address the specific message content.
- Output MUST be valid JSON — no trailing commas, no comments, no markdown code blocks.`;

  const userContent = items.map((it, i) => (
    `Message ${i + 1}:\n` +
    `platform: ${it.platform}\n` +
    `type: ${it.event_type}\n` +
    `author: ${it.author_name || it.author_handle || "Unknown"}\n` +
    `text: "${(it.text || "").replace(/"/g, '\\"')}"`
  )).join("\n\n---\n\n");

  try {
    const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      getModel(),
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) {
      console.error("[inbox] triage Claude error:", res.status);
      return [];
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text || "";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error("[inbox] triage parse error:", e.message);
    return [];
  }
}

async function applyTriageToRows(tenantId, items, triageResults) {
  if (!items.length || !triageResults.length) return;

  for (let i = 0; i < items.length && i < triageResults.length; i++) {
    const item = items[i];
    const t = triageResults[i];
    if (!t || !item.external_id) continue;

    const note = JSON.stringify({
      intent:           t.intent || "other",
      sentiment:        typeof t.sentiment === "number" ? t.sentiment : 0,
      urgency:          t.urgency || "low",
      suggested_action: t.suggested_action || "reply",
      triage_note:      t.triage_note || "",
    });

    const url = `${process.env.SUPABASE_URL}/rest/v1/inbox_events` +
      `?tenant_id=eq.${encodeURIComponent(tenantId)}` +
      `&external_id=eq.${encodeURIComponent(item.external_id)}`;

    await fetch(url, {
      method: "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({
        ai_triage_note: note,
        ai_draft:       t.draft_reply || "",
      }),
    });
  }
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * normalizeDm — Conversation shape per OpenAPI listInboxConversations:
 *   { id, platform, accountId, accountUsername, participantId, participantName,
 *     participantPicture, participantVerifiedType, lastMessage, updatedTime,
 *     status, unreadCount, url, instagramProfile: {...} }
 *
 * NOTE: fields are flat (participantName, not participant.name) and the
 * last-message preview is `lastMessage`, not `snippet`. Previous code read
 * non-existent fields → all author + text values were null in prod.
 */
function normalizeDm(conv, platform) {
  return {
    external_id:   conv.id || null,
    event_type:    "dm",
    platform,
    author_name:   conv.participantName || null,
    author_handle: conv.participantId || null,           // numeric / opaque per platform
    text:          conv.lastMessage || "",
    source_url:    conv.url || null,
    risk:          "low",                                // re-derived from triage urgency at render time
    status:        "open",
    raw:           conv,
  };
}

/**
 * normalizeComment — Comment shape per OpenAPI getInboxPostComments:
 *   { id, message, createdTime, from: {id, name, username, picture, isOwner,
 *     verifiedType}, likeCount, replyCount, platform, url, replies[], canReply,
 *     canDelete, canHide, canLike, isHidden, isLiked, likeUri, cid, parentId,
 *     rootUri, rootCid }
 *
 * NOTE: author lives under `from`, body field is `message` (not `text`). For
 * Bluesky reply we also need `cid`, `rootUri`, `rootCid` — captured into raw
 * and pulled at reply time by api/zernio.js.
 *
 * `postId` is passed in as a second arg from the caller — it isn't on the
 * comment object itself but is needed for reply (POST /v1/inbox/comments/{postId}).
 */
function normalizeComment(comment, platform, postId) {
  return {
    external_id:        comment.id || null,
    parent_external_id: postId || null,
    event_type:         "comment",
    platform,
    author_name:        comment.from?.name || null,
    author_handle:      comment.from?.username || null,
    text:               comment.message || "",
    source_url:         comment.url || null,
    risk:               "low",
    status:             "open",
    raw:                comment,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return corsPreflightResponse();

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { tenantId } = auth;

  try {
    const [connected, profileId, brand] = await Promise.all([
      getConnectedPlatforms(tenantId),
      getProfileId(tenantId),
      fetchBrandProfile(tenantId),
    ]);

    if (connected.length === 0) {
      // No v1 platforms connected — return what's already in inbox_events (webhook-delivered)
      const items = await getOpenEvents(tenantId);
      return jsonResponse({ ok: true, items, source: "events_only" });
    }

    // Fan out Zernio DM fetches — one per DM-capable connected platform.
    // Comments come via the comment.received webhook (authoritative for 7
    // platforms); Threads comments are pulled separately by the K4 cron.
    let inboxAddonDisabled = false;
    const fetches = connected.flatMap(({ platform, composio_connection_id: accountId }) => {
      if (!DM_PULL_PLATFORMS.has(platform) || !accountId) return [];
      const resolvedPlatform = resolvePlatform(platform);
      const qs = new URLSearchParams({ platform: resolvedPlatform, accountId });
      if (profileId) qs.set("profileId", profileId);
      return [
        zernioGet(`/inbox/conversations?${qs}`)
          .then(data => (data.data || []).map(c => normalizeDm(c, platform)))
          .catch(e => {
            // Defensive 403 surfacing — flag the missing Inbox addon to caller
            if (/\b403\b/.test(e.message)) inboxAddonDisabled = true;
            else console.error(`[inbox] ${platform} DM fetch:`, e.message);
            return [];
          }),
      ];
    });

    const results   = await Promise.all(fetches);
    const pulled    = results.flat().filter(item => item.external_id);

    if (pulled.length > 0) {
      await upsertInboxEvents(pulled.map(item => ({
        tenant_id:          tenantId,
        event_type:         item.event_type,
        platform:           item.platform,
        external_id:        item.external_id,
        parent_external_id: item.parent_external_id || null,
        author_name:        item.author_name,
        author_handle:      item.author_handle,
        text:               item.text,
        source_url:         item.source_url || null,
        risk:               item.risk,
        status:             item.status,
        raw:                item.raw,
      })));
    }

    // ── AI triage + draft for newly inserted items ───────────────────────────
    if (pulled.length > 0 && process.env.ANTHROPIC_API_KEY) {
      // Query which of the pulled items still need triage (webhook may have pre-populated)
      const extIds = pulled.map(p => p.external_id).filter(Boolean);
      if (extIds.length > 0) {
        const inList = extIds.map(id => `"${id}"`).join(",");
        const checkUrl = `${process.env.SUPABASE_URL}/rest/v1/inbox_events` +
          `?tenant_id=eq.${encodeURIComponent(tenantId)}` +
          `&external_id=in.(${inList})` +
          `&ai_triage_note=is.null` +
          `&select=external_id`;
        const checkRes = await fetch(checkUrl, { headers: sbHeaders() });
        const needTriageIds = checkRes.ok ? (await checkRes.json()).map(r => r.external_id) : [];
        const needTriageItems = pulled.filter(p => needTriageIds.includes(p.external_id));

        if (needTriageItems.length > 0) {
          const triageResults = await triageItems(tenantId, needTriageItems, brand);
          await applyTriageToRows(tenantId, needTriageItems, triageResults);
        }
      }
    }

    const items = await getOpenEvents(tenantId);
    return jsonResponse({
      ok: true,
      items,
      pulled: pulled.length,
      ...(inboxAddonDisabled ? { warning: "ZERNIO_INBOX_ADDON_DISABLED" } : {}),
    });

  } catch (e) {
    console.error("[inbox]", e);
    return errResponse(`Inbox fetch failed: ${e.message}`, 502);
  }
}
