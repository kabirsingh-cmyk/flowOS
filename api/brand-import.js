/**
 * FlowOS — Brand Import
 * Vercel Edge Function: POST /api/brand-import
 *
 * 1. Scrape URL via Jina AI reader (markdown, no headless browser needed)
 * 2. Send to Claude for structured brand analysis
 * 3. Return brand object + persist to Supabase brands table
 *
 * Returns:
 *   { ok: true, brand: { name, url, industry, voice, values, claims,
 *     prohibitedTopics, targetAudience, recommendedConnectors,
 *     competitors, palette } }
 */

export const config = { runtime: "edge" };

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const JINA_BASE      = "https://r.jina.ai";

// All connector IDs Claude can recommend
const CONNECTOR_IDS = [
  "ig", "tt", "fb", "li", "yt", "pn", "x", "threads", "reddit", "snap", "bluesky",
  "googleads", "msads", "metaads", "ttads", "liads", "pinads",
  "klaviyo", "klaviyo_sms", "mailchimp", "attentive",
  "shopify", "ga4", "amplitude", "gsc", "ahrefs", "semrush",
  "yelp", "refersion", "impact", "growthbook",
  "heygen", "runware", "luma", "elevenlabs", "runway",
];

// ─── Jina reader ──────────────────────────────────────────────────────────────

async function jinaFetch(url) {
  try {
    const res = await fetch(`${JINA_BASE}/${url}`, {
      headers: {
        "Accept":          "text/plain",
        "X-Return-Format": "markdown",
        "X-Timeout":       "10",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 7000); // cap per page
  } catch {
    return null;
  }
}

// ─── Supabase upsert ──────────────────────────────────────────────────────────

async function upsertBrand(tenantId, brand) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/brands`;
  const key  = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;

  await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        key,
      "Authorization": `Bearer ${key}`,
      "Prefer":        "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id:                tenantId,
      name:                   brand.name,
      industry:               brand.industry,
      website:                brand.url,
      palette:                brand.palette,       // legacy compat
      palette_vars:           brand.palette?.vars, // new CSS vars format
      voice:                  brand.voice,
      values:                 brand.values,
      claims:                 brand.claims,
      prohibited_topics:      brand.prohibitedTopics,
      target_audience:        brand.targetAudience,
      recommended_connectors: brand.recommendedConnectors,
      competitors:            brand.competitors,
      brand_analysis:         brand,
      updated_at:             new Date().toISOString(),
    }),
  });
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST required" }), { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: "ANTHROPIC_API_KEY not configured" }), { status: 500 });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400 }); }

  const { url, tenantId } = body;
  if (!url) return new Response(JSON.stringify({ ok: false, error: "url required" }), { status: 400 });

  // Normalize URL
  const cleanUrl  = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const fullUrl   = `https://${cleanUrl}`;

  // Scrape homepage + about in parallel
  const [mainContent, aboutContent, contactContent] = await Promise.all([
    jinaFetch(fullUrl),
    jinaFetch(`${fullUrl}/about`),
    jinaFetch(`${fullUrl}/contact`),
  ]);

  if (!mainContent) {
    return new Response(JSON.stringify({
      ok:    false,
      error: "Could not read the website. Check the URL is correct and the site is publicly accessible.",
    }), { status: 422 });
  }

  const combinedContent = [
    `=== HOMEPAGE ===\n${mainContent}`,
    aboutContent  ? `\n=== ABOUT PAGE ===\n${aboutContent.slice(0, 3000)}`   : "",
    contactContent ? `\n=== CONTACT PAGE ===\n${contactContent.slice(0, 1000)}` : "",
  ].join("");

  // ─── Claude analysis prompt ────────────────────────────────────────────────

  const prompt = `You are a senior brand strategist and marketing analyst. Analyze this website and return comprehensive brand intelligence.

Website: ${fullUrl}

SCRAPED CONTENT:
${combinedContent}

Return ONLY valid JSON — no markdown fences, no commentary, no extra text. Use this exact structure:

{
  "name": "Brand Name",
  "url": "${cleanUrl}",
  "industry": "Industry · Sub-category (e.g. 'DTC Skincare · Luxury body care' or 'B2B SaaS · HR Tech')",
  "targetAudience": "2-3 sentence description of the primary customer — who they are, what they care about, what problem this brand solves for them",
  "voice": {
    "tone": "3–5 word voice descriptor (e.g. 'Ritualistic, opulent, quietly confident' or 'Direct, data-driven, no-fluff')",
    "personality": "2–3 sentence description of brand personality and how it communicates",
    "bannedPhrases": ["cliché or phrase this brand would never say", "another banned phrase"]
  },
  "values": ["core brand value — specific, not generic", "another value", "another value"],
  "claims": ["specific verifiable claim from the site", "another factual claim"],
  "prohibitedTopics": ["topic this brand must never discuss", "another prohibited topic"],
  "summary": "2–3 sentence brand brief. Lead with who they are and what they do. Note 2–3 key facts pulled from the site. Close with a channel or guardrail observation. Factual and direct — no flowery language, no adjectives about quality or passion. Example: 'Erickson is a locally-owned commercial refrigeration and HVAC business that's been operating across the Pacific Northwest since 1977. Key facts we picked up: union-certified technicians, EPA certified, 24-hour emergency service across WA, OR and ID. For channels, we're recommending Facebook, LinkedIn, Google Ads, Yelp and Google Search Console — the right mix for a B2B service business where local search and reputation drive decisions.'",
  "recommendedConnectors": ["connector_id_1", "connector_id_2"],
  "competitors": [
    {
      "name": "Competitor Brand Name",
      "url": "competitor.com",
      "positioning": "One sentence on how they compete and differ from this brand"
    }
  ],
  "palette": {
    "id": "custom",
    "name": "Brand palette",
    "vars": {
      "--paper":       "oklch(L% C H)",
      "--paper-2":     "oklch(L% C H)",
      "--paper-3":     "oklch(L% C H)",
      "--ink":         "oklch(L% C H)",
      "--ink-2":       "oklch(L% C H)",
      "--muted":       "oklch(L% C H)",
      "--muted-2":     "oklch(L% C H)",
      "--rule":        "oklch(L% C H)",
      "--rule-strong": "oklch(L% C H)",
      "--accent":      "oklch(L% C H)",
      "--accent-ink":  "oklch(L% C H)",
      "--accent-wash": "oklch(L% C H)"
    }
  }
}

CONNECTOR IDs (pick 5–8 most relevant for this brand's marketing mix):
${CONNECTOR_IDS.join(", ")}

PALETTE RULES — use OKLCH format oklch(L% C H):
- Infer colors from the brand's aesthetic, product descriptions, and visual language in the content
- --paper: main background. Light brands: L 95–99, C 0.003–0.015. Dark/luxury: L 10–18, C 0.008–0.015
- --paper-2: slightly darker than paper (L -2 to -4)
- --paper-3: slightly darker still (L -4 to -7)
- --ink: primary text. Light bg → dark (L 15–25). Dark bg → light (L 88–96)
- --ink-2: secondary text, softer (L +12 from ink direction)
- --muted: placeholder/disabled (midpoint between paper and ink)
- --muted-2: even softer muted
- --rule: subtle borders, low chroma (C 0.006–0.014)
- --rule-strong: stronger borders (L 5–8 darker than rule)
- --accent: brand primary color — the main brand hue, C 0.12–0.25
- --accent-ink: darker accent for text on light bg (L -15 from accent)
- --accent-wash: very faint tint of accent for wash backgrounds (L 92–96, C 0.02–0.05)

EXAMPLES:
- Luxury skincare: warm ivory background, saffron/gold accent (H 45–70), dark oud ink
- SaaS startup: clean white, cobalt/electric blue accent (H 240–265)
- Eco/natural brand: parchment background, forest green accent (H 140–160)
- Premium dark brand: near-black background, champagne/gold accent`;

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
        max_tokens: 2048,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude ${claudeRes.status}: ${errText.slice(0, 200)}`);
    }

    const claudeData = await claudeRes.json();
    const rawText    = claudeData.content?.[0]?.text || "";

    // Strip markdown fences if Claude added them
    const jsonStr = rawText
      .replace(/^```json\s*/im, "")
      .replace(/^```\s*/im,    "")
      .replace(/\s*```$/im,    "")
      .trim();

    let brand;
    try {
      brand = JSON.parse(jsonStr);
    } catch {
      throw new Error("Analysis returned malformed data. Please try again.");
    }

    // Persist to Supabase (best-effort — don't fail the request if this errors)
    if (tenantId) {
      upsertBrand(tenantId, brand).catch(e =>
        console.error("[brand-import] Supabase upsert:", e.message)
      );
    }

    return new Response(JSON.stringify({ ok: true, brand }), {
      status:  200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[brand-import] error:", e.message);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
