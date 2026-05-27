/**
 * FlowOS Reach — Klaviyo push
 * Vercel Edge Function: POST /api/klaviyo
 *
 * Actions:
 *   - create_draft_campaign  → pushes a chat-authored email into Klaviyo as a
 *                               draft template + draft campaign (not sent).
 *                               Auto-resolves audience name → list/segment id.
 *   - create_draft_sms       → pushes a chat-authored SMS into Klaviyo as a
 *                               draft SMS campaign (not sent). No template
 *                               object — SMS content lives on the
 *                               campaign-message directly.
 *   - list_audiences         → returns lists + segments for picker UI.
 *
 * All Klaviyo calls go through Composio (same path analytics-ingest uses).
 */

import { executeComposioTool } from './lib/composio.js';
import { requireAuth } from './lib/auth.js';
import { corsHeaders } from './lib/cors.js';

export const config = { runtime: "edge" };

const runTool = (name, input, tenantId) =>
  executeComposioTool(name, input, tenantId, { onError: "object" });

// ─── helpers ──────────────────────────────────────────────────────────────────

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function normalize(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Score by token overlap. Returns 0..1.
function nameScore(hint, name) {
  const h = normalize(hint).split(/\s+/).filter(Boolean);
  const n = normalize(name).split(/\s+/).filter(Boolean);
  if (!h.length || !n.length) return 0;
  const nSet = new Set(n);
  let hits = 0;
  for (const tok of h) if (nSet.has(tok)) hits++;
  return hits / h.length;
}

function extractRows(data) {
  // Composio responses vary; handle the common shapes.
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data?.response?.data)) return data.response.data;
  if (Array.isArray(data?.data?.data)) return data.data.data;
  return [];
}

function audienceLabel(row) {
  return row?.attributes?.name || row?.name || row?.id || "untitled";
}

function audienceSize(row) {
  return (
    row?.attributes?.profile_count ??
    row?.profile_count ??
    row?.attributes?.member_count ??
    0
  );
}

async function resolveAudience(tenantId, hint) {
  const [listsRes, segsRes] = await Promise.all([
    runTool("KLAVIYO_GET_LISTS", {}, tenantId),
    runTool("KLAVIYO_GET_SEGMENTS", {}, tenantId),
  ]);
  const lists    = extractRows(listsRes).map(r => ({ ...r, _kind: "list" }));
  const segments = extractRows(segsRes).map(r => ({ ...r, _kind: "segment" }));
  const all = [...lists, ...segments];

  if (!all.length) {
    return { ok: false, reason: "no_audiences_returned", lists: 0, segments: 0 };
  }

  const ranked = all
    .map(r => ({ row: r, score: nameScore(hint, audienceLabel(r)) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const picked = best.score > 0
    ? best.row
    // fallback: largest audience overall
    : [...all].sort((a, b) => audienceSize(b) - audienceSize(a))[0];

  return {
    ok:        true,
    id:        picked.id || picked?.attributes?.id,
    name:      audienceLabel(picked),
    kind:      picked._kind, // "list" | "segment"
    matched:   best.score,
    fallback:  best.score === 0,
    candidates: ranked.slice(0, 5).map(r => ({
      id:    r.row.id,
      name:  audienceLabel(r.row),
      kind:  r.row._kind,
      score: r.score,
    })),
  };
}

function bodyToHtml(bodyText, bodyHtml) {
  if (bodyHtml && /[<][a-z]/i.test(bodyHtml)) return bodyHtml;
  const text = bodyHtml || bodyText || "";
  // Minimal text → HTML: paragraphs on blank lines, <br> on single newlines.
  const paragraphs = text.split(/\n\s*\n/).map(p =>
    `<p style="margin:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">${
      p.replace(/\n/g, "<br/>")
    }</p>`
  ).join("\n");
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f7f5;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;border-radius:6px;">
${paragraphs}
</div></body></html>`;
}

// ─── action: create_draft_campaign ───────────────────────────────────────────

async function handleCreateDraftCampaign(req) {
  const { tenantId, subject, preheader = "", bodyHtml, bodyText, audienceHint = "", fromName, fromEmail } = req;

  if (!tenantId)              return json(400, { ok: false, error: "tenantId required" });
  if (!subject)               return json(400, { ok: false, error: "subject required" });
  if (!bodyHtml && !bodyText) return json(400, { ok: false, error: "bodyHtml or bodyText required" });

  // 1. Resolve audience
  const aud = await resolveAudience(tenantId, audienceHint);
  if (!aud.ok) {
    return json(502, { ok: false, error: "audience_resolution_failed", detail: aud });
  }

  // 2. Create email template
  const html = bodyToHtml(bodyText, bodyHtml);
  const templateName = `FlowOS Reach · ${subject}`.slice(0, 140);
  const tplRes = await runTool("KLAVIYO_CREATE_EMAIL_TEMPLATE", {
    name:    templateName,
    html,
    editor_type: "CODE",
  }, tenantId);

  const templateId =
    tplRes?.data?.id ||
    tplRes?.id ||
    tplRes?.data?.data?.id;

  if (!templateId) {
    return json(502, { ok: false, error: "template_create_failed", detail: tplRes });
  }

  // 3. Create draft campaign
  const campaignRes = await runTool("KLAVIYO_CREATE_CAMPAIGN", {
    name:       `FlowOS Reach · ${subject}`.slice(0, 140),
    subject_line: subject,
    preview_text: preheader,
    from_label: fromName  || undefined,
    from_email: fromEmail || undefined,
    audiences:  { included: [aud.id] },
    channel:    "email",
  }, tenantId);

  const campaignId =
    campaignRes?.data?.id ||
    campaignRes?.id ||
    campaignRes?.data?.data?.id;

  const messageId =
    campaignRes?.data?.relationships?.["campaign-messages"]?.data?.[0]?.id ||
    campaignRes?.data?.attributes?.campaign_messages?.[0]?.id ||
    campaignRes?.data?.included?.find?.(x => x.type === "campaign-message")?.id;

  if (!campaignId) {
    return json(502, { ok: false, error: "campaign_create_failed", detail: campaignRes, templateId });
  }
  if (!messageId) {
    return json(502, { ok: false, error: "campaign_message_id_missing", detail: campaignRes, templateId, campaignId });
  }

  // 4. Bind template to campaign message
  const assignRes = await runTool("KLAVIYO_ASSIGN_TEMPLATE_TO_CAMPAIGN_MESSAGE", {
    id:          messageId,
    template_id: templateId,
  }, tenantId);

  if (assignRes?.error) {
    return json(502, { ok: false, error: "template_assign_failed", detail: assignRes, templateId, campaignId, messageId });
  }

  const klaviyoUrl = `https://www.klaviyo.com/campaign/${campaignId}/reports/overview`;

  return json(200, {
    ok:         true,
    templateId,
    campaignId,
    messageId,
    audience:   { id: aud.id, name: aud.name, kind: aud.kind, fallback: aud.fallback, matched: aud.matched },
    klaviyoUrl,
  });
}

// ─── action: create_draft_sms ────────────────────────────────────────────────

async function handleCreateDraftSms(req) {
  const { tenantId, body, audienceHint = "", campaignName, includeStopFooter = false, fromNumber } = req;

  if (!tenantId) return json(400, { ok: false, error: "tenantId required" });
  if (!body)     return json(400, { ok: false, error: "body required" });

  let smsBody = String(body);
  if (includeStopFooter && !/stop/i.test(smsBody)) {
    smsBody = `${smsBody} Reply STOP to opt out.`.trim();
  }

  if (smsBody.length > 160) {
    return json(400, { ok: false, error: "body_too_long", detail: { length: smsBody.length, max: 160 } });
  }

  // 1. Resolve audience (same pool as email — SMS eligibility is per-profile
  //    in Klaviyo, not per-list, so we don't pre-filter here).
  const aud = await resolveAudience(tenantId, audienceHint);
  if (!aud.ok) {
    return json(502, { ok: false, error: "audience_resolution_failed", detail: aud });
  }

  const name = (campaignName || smsBody).slice(0, 140);

  // 2. Create draft SMS campaign with inline message content.
  //    Klaviyo SMS has no template object — content lives on the
  //    campaign-message under definition.content.body.
  const campaignRes = await runTool("KLAVIYO_CREATE_CAMPAIGN", {
    name:       `FlowOS Reach · SMS · ${name}`.slice(0, 140),
    audiences:  { included: [aud.id] },
    channel:    "sms",
    "campaign-messages": {
      data: [{
        type: "campaign-message",
        attributes: {
          definition: {
            channel: "sms",
            content: {
              body: smsBody,
            },
          },
        },
      }],
    },
    from_number: fromNumber || undefined,
  }, tenantId);

  // Structured log only — full response may contain audience PII.
  console.log("[klaviyo-sms]", {
    status:     campaignRes?.data?.attributes?.status,
    campaignId: campaignRes?.data?.id || campaignRes?.id || null,
  });

  const campaignId =
    campaignRes?.data?.id ||
    campaignRes?.id ||
    campaignRes?.data?.data?.id;

  const messageId =
    campaignRes?.data?.relationships?.["campaign-messages"]?.data?.[0]?.id ||
    campaignRes?.data?.attributes?.campaign_messages?.[0]?.id ||
    campaignRes?.data?.included?.find?.(x => x.type === "campaign-message")?.id;

  if (!campaignId) {
    return json(502, { ok: false, error: "campaign_create_failed", detail: campaignRes });
  }

  const warnings = {};
  if (!/stop/i.test(smsBody)) warnings.missingStopFooter = true;
  if (!messageId)              warnings.messageIdMissing  = true;

  const klaviyoUrl = `https://www.klaviyo.com/campaign/${campaignId}/reports/overview`;

  return json(200, {
    ok:         true,
    campaignId,
    messageId:  messageId || null,
    audience:   { id: aud.id, name: aud.name, kind: aud.kind, fallback: aud.fallback, matched: aud.matched },
    klaviyoUrl,
    body:       smsBody,
    length:     smsBody.length,
    warnings,
  });
}

// ─── action: list_audiences ──────────────────────────────────────────────────

async function handleListAudiences(req) {
  const { tenantId } = req;
  if (!tenantId) return json(400, { ok: false, error: "tenantId required" });
  const [listsRes, segsRes] = await Promise.all([
    runTool("KLAVIYO_GET_LISTS", {}, tenantId),
    runTool("KLAVIYO_GET_SEGMENTS", {}, tenantId),
  ]);
  const lists    = extractRows(listsRes).map(r => ({ id: r.id, name: audienceLabel(r), size: audienceSize(r), kind: "list" }));
  const segments = extractRows(segsRes).map(r => ({ id: r.id, name: audienceLabel(r), size: audienceSize(r), kind: "segment" }));
  return json(200, { ok: true, lists, segments });
}

// ─── handler ─────────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return json(405, { ok: false, error: "POST only" });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "invalid JSON" }); }

  body = { ...body, tenantId: auth.tenantId };
  const action = body.action || "create_draft_campaign";
  try {
    if (action === "create_draft_campaign") return await handleCreateDraftCampaign(body);
    if (action === "create_draft_sms")      return await handleCreateDraftSms(body);
    if (action === "list_audiences")        return await handleListAudiences(body);
    return json(400, { ok: false, error: `unknown action: ${action}` });
  } catch (e) {
    return json(500, { ok: false, error: e.message || "internal error" });
  }
}
