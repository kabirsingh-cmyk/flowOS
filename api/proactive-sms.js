/**
 * FlowOS — Proactive SMS drafts
 * Vercel Edge Function: GET/POST/PATCH /api/proactive-sms
 *
 * Content-creation flavor #1 (Proactive) for the SMS channel.
 *
 * Flow (POST):
 *   1. Load the latest analytics_insights row for the tenant.
 *   2. Classify each recommended_action into one of 4 SMS rules
 *      (S1 win-back · S2 replenish · S3 cart-abandonment · S4 VIP).
 *   3. For each matched rule (max 2 per run), call Claude to produce
 *      a body ≤160 chars in brand voice.
 *   4. Upsert into proactive_sms with idempotency key (tenant, rule, insight).
 *   5. If no insights row exists, emit one fallback demo draft.
 *
 * GET ?tenantId=… → return proactive_draft rows for hydration.
 * PATCH { id, patch } → update status / klaviyo_* fields after client push.
 */

import { fetchBrandProfile, sbHeaders } from './lib/supabase.js';
import { requireAuth, requireAuthOrCron } from './lib/auth.js';

export const config = { runtime: "edge" };

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const SUPABASE_URL   = process.env.SUPABASE_URL;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;

const MAX_DRAFTS_PER_RUN = 2;
const MAX_BODY_CHARS     = 160;

// ─── Rule definitions ─────────────────────────────────────────────────────────

const SMS_RULES = {
  S1_winback:  { label: "Win-back",    audienceFallback: "Lapsed 90d+" },
  S2_replenish:{ label: "Replenishment", audienceFallback: "Past buyers" },
  S3_cart:     { label: "Cart recovery", audienceFallback: "Browse abandoners" },
  S4_vip:      { label: "VIP",          audienceFallback: "VIP (2× buyers)" },
};

// ─── Rule classifier ──────────────────────────────────────────────────────────

function classifySmsAction(action) {
  const text = `${action?.action || ""} ${action?.reason || ""}`.toLowerCase();
  const channel = String(action?.channel || "").toLowerCase();
  // SMS is relevant for broad channels (all/sms) or specific SMS signals
  const smsChannel = !channel || channel === "all" || channel === "sms";
  if (!smsChannel) return null;

  if (/\b(abandon(ed)? cart|cart recovery|checkout abandon|cart aging)\b/.test(text))
    return { rule: "S3_cart",     audienceHint: extractAudience(text) || SMS_RULES.S3_cart.audienceFallback };

  if (/\b(win[- ]?back|lapsed|re[- ]?engage|comeback|inactive|dormant)\b/.test(text))
    return { rule: "S1_winback",  audienceHint: extractAudience(text) || SMS_RULES.S1_winback.audienceFallback };

  if (/\b(replenish|reorder|refill|repurchase|run[- ]?out|subscribe)\b/.test(text))
    return { rule: "S2_replenish",audienceHint: extractAudience(text) || SMS_RULES.S2_replenish.audienceFallback };

  if (/\b(vip|loyal|top spender|repeat|2x buyer|high[- ]?value)\b/.test(text))
    return { rule: "S4_vip",      audienceHint: extractAudience(text) || SMS_RULES.S4_vip.audienceFallback };

  return null;
}

function extractAudience(text) {
  const m = text.match(/\b(\d+d(?:ay)?\+? (?:lapsed|inactive))\b/i)
         || text.match(/\b(vips?(?:\s+\w+)?)\b/i)
         || text.match(/\b(60d|90d|30d)\s+(buyers|lapsed)\b/i);
  return m ? m[0] : null;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function fetchLatestInsight(tenantId) {
  if (!SUPABASE_URL || !tenantId) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/analytics_insights?tenant_id=eq.${encodeURIComponent(tenantId)}&order=generated_at.desc&limit=1`,
      { headers: sbHeaders() }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch { return null; }
}

async function loadProactive(tenantId) {
  if (!SUPABASE_URL || !tenantId) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/proactive_sms?tenant_id=eq.${encodeURIComponent(tenantId)}&status=eq.proactive_draft&order=created_at.desc`,
      { headers: sbHeaders() }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map(rowToClient);
  } catch { return []; }
}

function rowToClient(r) {
  return {
    id:           r.id,
    rule:         r.rule,
    ruleLabel:    SMS_RULES[r.rule]?.label || r.rule,
    body:         r.body_text,
    audienceHint: r.audience_hint,
    reason:       r.reason,
    source:       r.source,
    status:       r.status,
    klaviyoUrl:   r.klaviyo_url,
    klaviyoCampaignId: r.klaviyo_campaign_id,
    klaviyoMessageId:  r.klaviyo_message_id,
    audience:     r.audience,
    createdAt:    r.created_at,
  };
}

async function insertDraft(row) {
  if (!SUPABASE_URL) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/proactive_sms`,
    {
      method:  "POST",
      headers: { ...sbHeaders(), "Prefer": "return=representation,resolution=ignore-duplicates" },
      body:    JSON.stringify(row),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    console.warn("[proactive-sms] insert failed", res.status, txt.slice(0, 200));
    return null;
  }
  const out = await res.json();
  return Array.isArray(out) ? out[0] : out;
}

async function patchDraft(id, tenantId, patch) {
  if (!SUPABASE_URL || !id || !tenantId) return null;
  const body = { ...patch, updated_at: new Date().toISOString() };
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/proactive_sms?id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(tenantId)}`,
    {
      method:  "PATCH",
      headers: { ...sbHeaders(), "Prefer": "return=representation" },
      body:    JSON.stringify(body),
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSmsPrompt(brand, rule, signal) {
  const name      = brand?.name || "the brand";
  const tone      = brand?.voice?.tone || null;
  const values    = brand?.values || [];
  const claims    = brand?.claims || [];
  const prohibited = brand?.prohibited_topics || brand?.prohibitedTopics || [];

  const brandBlock = `BRAND: ${name}
${tone ? `VOICE TONE: ${tone}` : ""}
${values.length ? `VALUES: ${values.join(", ")}` : ""}
${claims.length ? `APPROVED CLAIMS: ${claims.join(" · ")}` : ""}
${prohibited.length ? `NEVER MENTION: ${prohibited.join(", ")}` : ""}`.trim();

  const angleByRule = {
    S1_winback:  "Warm, brief win-back. One sentence acknowledgment, one clear action. No discount unless it naturally fits brand voice.",
    S2_replenish:"Helpful reorder nudge. Reference the product naturally. One-tap reorder feel.",
    S3_cart:     "Cart recovery. Direct and helpful — not pushy. Single CTA. No urgency language unless the brand voice supports it.",
    S4_vip:      "Exclusive early access or quiet appreciation for a loyal customer. Make them feel seen. No generic discount language.",
  };

  return `You are a senior SMS copywriter for ${name}. Write a proactive SMS draft for human review before sending.

${brandBlock}

ANALYTICS SIGNAL (why this draft was triggered):
${signal}

ANGLE (${SMS_RULES[rule]?.label}):
${angleByRule[rule] || "Write a brand-appropriate SMS."}

Return ONLY valid JSON — no markdown fences, no commentary. Exactly this shape:

{
  "body": "The full SMS body. Must be ≤ 138 characters — leave 22 chars for a STOP footer. No line breaks. End with a short URL or CTA phrase."
}

Constraints:
- Write in ${name}'s voice — match VOICE TONE and VALUES above.
- Never invent unapproved claims.
- 138 character maximum (hard limit). Count carefully.
- Conversational. Read like a text from a real person, not a marketing robot.
- No ALL-CAPS words. No excessive punctuation.`;
}

// ─── Demo fallback ────────────────────────────────────────────────────────────

function demoDraft(rule, brand) {
  const isErickson = (brand?.name || "").toLowerCase().includes("erickson");

  const mveda = {
    S1_winback: {
      body:         "It's been a while. Your ritual is still here when you're ready — three drops, quiet morning. → mveda.co/ritual",
      audienceHint: "Lapsed 90d+",
      reason:       "Demo signal · 847 customers lapsed 90+ days",
    },
    S3_cart: {
      body:         "You left the Bhringraj oil behind. Still here if you want it. → mveda.co/cart",
      audienceHint: "Browse abandoners",
      reason:       "Demo signal · cart abandonment rate up 12% this week",
    },
  };

  const erickson = {
    S1_winback: {
      body:         "Summer peak load is 6 weeks out. Free pre-season inspection for past Erickson clients — reply YES to book.",
      audienceHint: "Lapsed accounts (18mo+)",
      reason:       "Demo signal · 340 accounts inactive 18+ months",
    },
    S3_cart: {
      body:         "Your PM contract quote is still on file. One reply locks in pre-season pricing. Reply YES or call (206) 789-4722.",
      audienceHint: "Quote requests (30d)",
      reason:       "Demo signal · 23 open quotes with no follow-up",
    },
  };

  const set = isErickson ? erickson : mveda;
  return set[rule] || set.S1_winback;
}

// ─── Claude generator ─────────────────────────────────────────────────────────

async function generateSms(brand, rule, signal) {
  if (!ANTHROPIC_KEY) return null;
  const prompt = buildSmsPrompt(brand, rule, signal);
  try {
    const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages:   [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.warn("[proactive-sms] claude", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const raw  = data.content?.[0]?.text || "";
    const json = raw
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im,    "")
      .replace(/\s*```$/im,    "")
      .trim();
    const parsed = JSON.parse(json);
    if (!parsed.body) return null;
    // Hard-enforce char limit — model sometimes overshoots.
    const body = String(parsed.body).slice(0, MAX_BODY_CHARS);
    return { body };
  } catch (e) {
    console.warn("[proactive-sms] generate error:", e.message);
    return null;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === "GET") {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;
    const drafts = await loadProactive(auth.tenantId);
    return json(200, { ok: true, drafts });
  }

  if (req.method === "PATCH") {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;
    let body; try { body = await req.json(); } catch { return json(400, { ok: false, error: "Invalid JSON" }); }
    const { id, patch } = body;
    if (!id || !patch) return json(400, { ok: false, error: "id and patch required" });
    // Allowlist patch keys — never let the client overwrite tenant_id,
    // source_insight_id, rule, or any other immutable field.
    const ALLOWED = ["status", "klaviyo_campaign_id", "klaviyo_message_id", "sent_at"];
    const safePatch = Object.fromEntries(
      Object.entries(patch).filter(([k]) => ALLOWED.includes(k))
    );
    if (Object.keys(safePatch).length === 0) return json(400, { ok: false, error: "no patchable fields" });
    const row = await patchDraft(id, auth.tenantId, safePatch);
    if (!row) return json(500, { ok: false, error: "patch failed" });
    return json(200, { ok: true, draft: rowToClient(row) });
  }

  if (req.method !== "POST") return json(405, { ok: false, error: "GET, POST, or PATCH required" });

  let body; try { body = await req.json(); } catch { return json(400, { ok: false, error: "Invalid JSON" }); }
  const { tenantId: bodyTenantId } = body;
  const auth = await requireAuthOrCron(req, bodyTenantId);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;

  const brand = await fetchBrandProfile(tenantId);

  // 1. Latest insight
  const insight = await fetchLatestInsight(tenantId);

  // 2. Classify into SMS rules
  const matches = [];
  if (insight?.recommended_actions && Array.isArray(insight.recommended_actions)) {
    for (const action of insight.recommended_actions) {
      const m = classifySmsAction(action);
      if (m) {
        matches.push({
          rule:         m.rule,
          audienceHint: m.audienceHint,
          reason:       `${action.action} — ${action.reason || ""}`.trim().slice(0, 400),
        });
        if (matches.length >= MAX_DRAFTS_PER_RUN) break;
      }
    }
  }

  // 3. Demo fallback
  const usingFallback = matches.length === 0;
  if (usingFallback) {
    matches.push({
      rule:         "S1_winback",
      audienceHint: SMS_RULES.S1_winback.audienceFallback,
      reason:       "Demo fallback · no analytics_insights row for this tenant yet",
    });
  }

  // 4. Generate + persist
  const created = [];
  for (const m of matches) {
    let copy = null;
    if (!usingFallback) copy = await generateSms(brand, m.rule, m.reason);
    if (!copy) copy = demoDraft(m.rule, brand);

    const row = {
      tenant_id:         tenantId,
      rule:              m.rule,
      body_text:         copy.body,
      audience_hint:     m.audienceHint || copy.audienceHint || "",
      reason:            copy.reason || m.reason,
      source_insight_id: usingFallback ? null : insight?.id || null,
      source:            usingFallback ? "fallback" : "claude",
      status:            "proactive_draft",
    };
    const inserted = await insertDraft(row);
    if (inserted) created.push(rowToClient(inserted));
  }

  return json(200, {
    ok:           true,
    tenantId,
    matched:      matches.length,
    inserted:     created.length,
    usingFallback,
    drafts:       created,
  });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export { classifySmsAction, buildSmsPrompt, SMS_RULES };
