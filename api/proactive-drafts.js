/**
 * FlowOS — Proactive draft generation
 * Vercel Edge Function: POST /api/proactive-drafts
 *
 * Takes a tenant's brand profile and generates a week of ready-to-edit
 * content drafts across their active channels. Called by:
 *   - The Publishing Queue "Generate drafts" button (UI-triggered)
 *   - /api/cron/proactive-drafts (daily, 07:00 UTC)
 *
 * Returns:
 *   { ok: true, drafts: [{ platform, contentType, copy, imagePrompt, suggestedDay, suggestedTime }] }
 */

import { fetchBrandProfile, sbHeaders } from './lib/supabase.js';
import { requireAuth, requireAuthOrCron } from './lib/auth.js';

export const config = { runtime: "edge" };

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

// ─── Fallback drafts (returned when API key is absent or Claude fails) ────────
// Brand-aware: uses the tenant's name/industry so non-MVEDA tenants don't see
// Ayurveda content. All copy is intentionally generic — it's a placeholder,
// not a finished draft.

function buildFallbackDrafts(brand, count = 7) {
  const name     = brand?.name     || "our brand";
  const industry = brand?.industry || "our industry";
  const handle   = name.replace(/\s+/g, "").toLowerCase();

  const all = [
    {
      platform: "instagram", contentType: "Post",
      copy: `Behind every product is a story worth telling.\n\nHere's ours — and why it matters to us.\n\n#${handle} #brand #story`,
      imagePrompt: `Clean product flat lay for ${name}, natural light, minimal styling, editorial photography`,
      suggestedDay: 0, suggestedTime: "09:00",
    },
    {
      platform: "linkedin", contentType: "Post",
      copy: `What does it mean to build something you truly believe in?\n\nAt ${name}, it starts with one question: what problem are we actually solving?\n\nHere's what we've learned.`,
      imagePrompt: null,
      suggestedDay: 1, suggestedTime: "09:00",
    },
    {
      platform: "x", contentType: "Post",
      copy: `the best version of what we do has always started with listening to the people who use it.`,
      imagePrompt: null,
      suggestedDay: 2, suggestedTime: "12:00",
    },
    {
      platform: "instagram", contentType: "Carousel",
      copy: `3 things we wish more people knew about ${industry}.\n\nSwipe to see what we've learned building ${name}.`,
      imagePrompt: `Clean carousel slide template for ${name}, consistent brand palette, minimal design`,
      suggestedDay: 2, suggestedTime: "10:00",
    },
    {
      platform: "tiktok", contentType: "Video",
      copy: `A behind-the-scenes look at how we make what we make at ${name}. No filter.\n\n#behindthescenes #${handle} #authentic`,
      imagePrompt: `Behind-the-scenes video thumbnail for ${name}, candid and authentic feel`,
      suggestedDay: 3, suggestedTime: "18:00",
    },
    {
      platform: "email", contentType: "Email",
      copy: `Subject: Something we've been working on\nPreview: We think you'll like this.\n\nWe don't send many emails. When we do, it's because there's something worth sharing.\n\nToday: a look at what we've been building at ${name} — and why it matters to you.\n\n→ Read more`,
      imagePrompt: null,
      suggestedDay: 3, suggestedTime: "10:00",
    },
    {
      platform: "pinterest", contentType: "Pin",
      copy: `Discover the story behind ${name} — and why the details matter more than you think.`,
      imagePrompt: `Vertical editorial pin for ${name}, styled flat lay, clean aesthetic, Pinterest-optimised composition`,
      suggestedDay: 5, suggestedTime: "10:00",
    },
  ];
  return all.slice(0, count);
}

// ─── Supabase persistence helpers ─────────────────────────────────────────────

async function loadPending(tenantId) {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) return [];
  try {
    const res = await fetch(
      `${sbUrl}/rest/v1/proactive_drafts?tenant_id=eq.${encodeURIComponent(tenantId)}&status=eq.pending&order=created_at.desc`,
      { headers: sbHeaders() }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map(r => ({
      id:            r.id,
      platform:      r.platform,
      contentType:   r.content_type,
      copy:          r.copy,
      imagePrompt:   r.image_prompt,
      suggestedDay:  r.suggested_day,
      suggestedTime: r.suggested_time,
      source:        r.source,
    }));
  } catch {
    return [];
  }
}

async function persistDrafts(tenantId, drafts, source) {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey || !tenantId) return null;
  try {
    // Archive existing pending batch for this tenant
    await fetch(
      `${sbUrl}/rest/v1/proactive_drafts?tenant_id=eq.${encodeURIComponent(tenantId)}&status=eq.pending`,
      {
        method:  "PATCH",
        headers: { ...sbHeaders(), "Prefer": "return=minimal" },
        body:    JSON.stringify({ status: "archived" }),
      }
    );
    // Insert new batch, ask Supabase to return the persisted rows (with UUIDs)
    const rows = drafts.map(d => ({
      tenant_id:     tenantId,
      platform:      d.platform,
      content_type:  d.contentType,
      copy:          d.copy,
      image_prompt:  d.imagePrompt || null,
      suggested_day: d.suggestedDay ?? null,
      suggested_time: d.suggestedTime || null,
      status:        "pending",
      source:        source || "claude",
    }));
    const insertRes = await fetch(
      `${sbUrl}/rest/v1/proactive_drafts`,
      {
        method:  "POST",
        headers: { ...sbHeaders(), "Prefer": "return=representation" },
        body:    JSON.stringify(rows),
      }
    );
    if (!insertRes.ok) return null;
    return await insertRes.json(); // array of inserted rows with server-assigned UUIDs
  } catch (e) {
    console.warn("[proactive-drafts] persist failed:", e.message);
    return null;
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(brand, days, count) {
  const name      = brand?.name || "the brand";
  const industry  = brand?.industry || null;
  const audience  = brand?.target_audience || brand?.targetAudience || null;
  const tone      = brand?.voice?.tone || null;
  const values    = brand?.values || [];
  const claims    = brand?.claims || [];
  const prohibited = brand?.prohibited_topics || brand?.prohibitedTopics || [];
  const summary   = brand?.summary || null;

  const brandBlock = `BRAND: ${name}${industry ? ` · ${industry}` : ""}
${audience ? `AUDIENCE: ${audience}` : ""}
${tone ? `VOICE TONE: ${tone}` : ""}
${values.length ? `VALUES: ${values.join(", ")}` : ""}
${claims.length ? `APPROVED CLAIMS (use only these): ${claims.join(" · ")}` : ""}
${prohibited.length ? `NEVER MENTION: ${prohibited.join(", ")}` : ""}
${summary ? `BRAND BRIEF: ${summary}` : ""}`.trim();

  return `You are a content strategist. Generate exactly ${count} social media drafts for the next ${days} days for ${name}.

${brandBlock}

Return ONLY valid JSON — an array of objects, no markdown fences, no commentary.

Use this exact structure for every item:
[
  {
    "platform": "instagram",
    "contentType": "Reel",
    "copy": "The full caption or copy. Write in the brand's voice. Include relevant hashtags for social posts.",
    "imagePrompt": "Runware image generation prompt describing scene, mood, lighting, style. Leave null for email and sms.",
    "suggestedDay": 0,
    "suggestedTime": "08:00"
  }
]

PLATFORM DISTRIBUTION (spread across these, mix don't repeat):
- Instagram: 2 items (one Reel/video, one Carousel or Post)
- TikTok: 1 item (Video)
- LinkedIn: 1 item (Post — professional, longer form)
- Pinterest: 1 item (Pin — aspirational, discovery-intent)
- Email: 1 item (subject line + preview text + body, all in the copy field)
- X: 1 item (Post — short, punchy, ≤280 chars)

CONTENT PILLARS (vary these — don't repeat the same pillar):
- Ingredient story (what's in it, why it matters)
- Ritual & lifestyle (how to use, the experience)
- Brand values / origin (why the brand exists)
- Social proof (community, results, real use)
- Educational (Ayurveda tradition, science, process)

SCHEDULING:
- suggestedDay: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
- Instagram: morning 07:00–09:00 or evening 18:00–20:00
- TikTok: evening 18:00–21:00
- LinkedIn: weekday morning 08:00–10:00
- Pinterest: weekend morning 09:00–11:00, or Tue/Thu
- Email: Tue/Thu morning 09:00–10:00
- X: midday 11:00–13:00

Do not repeat the same platform + suggestedDay combination.
Write copy in the brand voice. No preamble. No explanations. Only the JSON array.`;
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {

  // ── GET: return persisted pending drafts for a tenant ────────────────────────
  if (req.method === "GET") {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;
    const drafts = await loadPending(auth.tenantId);
    return json(200, { ok: true, drafts, source: "supabase" });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "GET or POST required" });
  }

  // ── POST: generate + persist drafts ──────────────────────────────────────────
  let body;
  try { body = await req.json(); }
  catch { return json(400, { ok: false, error: "Invalid JSON" }); }

  // Dual-auth: user JWT (UI "Generate drafts" button) OR cron secret (the
  // proactive-drafts cron iterates brands server-side and stamps tenantId).
  const { tenantId: bodyTenantId } = body;
  const auth = await requireAuthOrCron(req, bodyTenantId);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;
  const { days = 7, count = 7 } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Helper: persist then return
  const finalize = async (drafts, source, extra = {}) => {
    const persisted = await persistDrafts(tenantId, drafts, source);
    // Merge server-assigned UUIDs back so client can deduplicate on reload
    if (Array.isArray(persisted) && persisted.length === drafts.length) {
      drafts = drafts.map((d, i) => ({ ...d, id: persisted[i].id }));
    }
    return json(200, { ok: true, drafts, source, ...extra });
  };

  // Brand profile from Supabase only — never trust client-supplied brand data.
  const brand = tenantId ? await fetchBrandProfile(tenantId) : null;

  // If no API key, return brand-aware fallback drafts immediately
  if (!apiKey) {
    return finalize(buildFallbackDrafts(brand, count), "fallback");
  }

  const prompt = buildPrompt(brand, days, count);

  try {
    const claudeRes = await fetch(`${ANTHROPIC_BASE}/messages`, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-opus-4-5",
        max_tokens: 3000,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude ${claudeRes.status}: ${err.slice(0, 200)}`);
    }

    const claudeData = await claudeRes.json();
    const rawText    = claudeData.content?.[0]?.text || "";

    // Strip markdown fences if Claude added them
    const jsonStr = rawText
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im,    "")
      .replace(/\s*```$/im,    "")
      .trim();

    let drafts;
    try {
      drafts = JSON.parse(jsonStr);
      if (!Array.isArray(drafts)) throw new Error("Not an array");
    } catch {
      console.error("[proactive-drafts] JSON parse failed:", rawText.slice(0, 200));
      return finalize(buildFallbackDrafts(brand, count), "fallback", {
        warn: "Claude returned malformed JSON — using fallback drafts",
      });
    }

    return finalize(drafts, "claude");

  } catch (e) {
    console.error("[proactive-drafts] error:", e.message);
    return finalize(buildFallbackDrafts(brand, count), "fallback", { warn: e.message });
  }
}

// Named exports for unit tests
export { buildPrompt, buildFallbackDrafts };
