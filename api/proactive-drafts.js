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

export const config = { runtime: "edge" };

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

// ─── Fallback drafts (returned when API key is absent or Claude fails) ────────

const FALLBACK_DRAFTS = [
  {
    platform: "instagram", contentType: "Reel",
    copy: "Warm a few drops between your palms.\nDraw them through damp lengths.\nReturn to it tomorrow — until it becomes yours.\n\n#ayurveda #hairritual #coldpressed",
    imagePrompt: "Amber glass dropper bottle, saffron threads and dried bhringraj leaves on warm ivory linen, soft morning window light, flat lay, editorial, minimal",
    suggestedDay: 0, suggestedTime: "08:00",
  },
  {
    platform: "instagram", contentType: "Carousel",
    copy: "5,000 years of Ayurveda. One bottle. Here's what's actually inside Hair Ritual Oil — and why every ingredient matters.\n\n#ingredients #ayurveda #transparency",
    imagePrompt: "Flat lay of individual botanicals — saffron, bhringraj, amla — each labelled, warm cream background, editorial overhead shot",
    suggestedDay: 2, suggestedTime: "09:00",
  },
  {
    platform: "tiktok", contentType: "Video",
    copy: "POV: you just found the hair ritual your grandmother kept secret 🪷\n\nBhringraj. Saffron. Cold-pressed at source.\nThree drops. That's it.\n\n#haircare #ayurveda #hairoil #hairgrowth",
    imagePrompt: "Close-up of hands warming amber oil between palms, golden backlight, slow-motion aesthetic",
    suggestedDay: 1, suggestedTime: "19:00",
  },
  {
    platform: "linkedin", contentType: "Post",
    copy: "The best-performing products in our portfolio weren't born from trend reports.\n\nThey were born from 5,000 years of Ayurvedic practice — and one question: what did our grandmothers know that we forgot?\n\nAt MVEDA, we cold-press every ingredient at source. Small batches. Nothing added. Here's why that matters for modern skin.",
    imagePrompt: "Overhead of cold-press extraction process, glass vessels, botanicals, clean editorial photography, natural light",
    suggestedDay: 1, suggestedTime: "09:00",
  },
  {
    platform: "pinterest", contentType: "Pin",
    copy: "The Ayurvedic hair ritual that takes 3 minutes and lasts all week. Bhringraj & Saffron Hair Oil, cold-pressed in small batches.\n\nDiscover the MVEDA Hair Ritual ↓",
    imagePrompt: "Vertical flat lay: amber hair oil bottle, copper comb, dried rose petals and saffron, ivory and warm gold palette, styled for Pinterest",
    suggestedDay: 5, suggestedTime: "10:00",
  },
  {
    platform: "email", contentType: "Email",
    copy: "Subject: The ritual starts with three drops.\nPreview: Your hair remembers what your grandmother knew.\n\nWarm three drops of Bhringraj & Saffron Hair Oil between your palms. Draw them slowly through damp lengths. That's it — no 12-step routine, no clinical promises.\n\nJust 5,000 years of Ayurvedic practice, cold-pressed at source, and ready when you are.\n\n→ Shop the Hair Ritual",
    imagePrompt: null,
    suggestedDay: 3, suggestedTime: "10:00",
  },
  {
    platform: "x", contentType: "Post",
    copy: "hair care that doesn't ask you to hustle. just warm it, work it through, and let it do what it's done for centuries.",
    imagePrompt: "Minimal product shot: amber dropper bottle on white stone surface, single saffron thread, clean background",
    suggestedDay: 4, suggestedTime: "12:00",
  },
];

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
    const url      = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId");
    if (!tenantId) return json(400, { ok: false, error: "tenantId required" });
    const drafts = await loadPending(tenantId);
    return json(200, { ok: true, drafts, source: "supabase" });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "GET or POST required" });
  }

  // ── POST: generate + persist drafts ──────────────────────────────────────────
  let body;
  try { body = await req.json(); }
  catch { return json(400, { ok: false, error: "Invalid JSON" }); }

  const { tenantId, brand: brandFromClient, days = 7, count = 7 } = body;

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

  // If no API key, return (and persist) fallback drafts immediately
  if (!apiKey) {
    return finalize(FALLBACK_DRAFTS.slice(0, count), "fallback");
  }

  // Prefer Supabase brand profile; fall back to client-provided
  let brand = brandFromClient;
  if (tenantId && !brand) {
    brand = await fetchBrandProfile(tenantId);
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
      return finalize(FALLBACK_DRAFTS.slice(0, count), "fallback", {
        warn: "Claude returned malformed JSON — using fallback drafts",
      });
    }

    return finalize(drafts, "claude");

  } catch (e) {
    console.error("[proactive-drafts] error:", e.message);
    return finalize(FALLBACK_DRAFTS.slice(0, count), "fallback", { warn: e.message });
  }
}
