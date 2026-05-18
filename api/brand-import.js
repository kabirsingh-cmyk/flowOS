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

// Canonical connector IDs Claude can recommend. Must stay aligned with
// SEED.connectorCatalog in app/seed.jsx (the source of truth).
const CONNECTOR_IDS = [
  // Organic Social
  "ig", "tt", "fb", "li", "yt", "pn", "x", "reddit",
  // Paid Search + Paid Audio
  "googleads", "spotifyads",
  // Paid Social
  "metaads", "ttads", "liads", "pinads", "xads",
  // Email + SMS
  "klaviyo", "klaviyo_sms", "mailchimp",
  "sendgrid", "twilio",
  // Email Verification
  "neverbounce", "kickbox", "listclean",
  // Commerce
  "shopify", "wordpress",
  // Analytics + SEO
  "ga4", "gsc", "ahrefs", "moz", "neuronwriter",
  // A/B Testing
  "optimizely",
  // Creative AI
  "heygen", "runware", "luma", "elevenlabs", "replicate", "higgsfield", "audiostack",
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

// Fetch HTML format from Jina to extract embedded hex color codes
async function jinaFetchHTML(url) {
  try {
    const res = await fetch(`${JINA_BASE}/${url}`, {
      headers: {
        "Accept":          "text/html",
        "X-Return-Format": "html",
        "X-Timeout":       "8",
      },
    });
    if (!res.ok) return null;
    return await res.text(); // don't cap — need full HTML for color scan
  } catch {
    return null;
  }
}

/**
 * Extract the most-frequent hex color codes from HTML/CSS content.
 * Returns up to `limit` colors sorted by frequency (most common first).
 * Filters out pure black (#000000, #111111…), pure white (#ffffff, #fefefe…),
 * and very-low-chroma greys so we surface actual brand colours.
 */
function extractColorHints(html, limit = 10) {
  if (!html) return [];

  const hexRe = /#([0-9A-Fa-f]{6})\b/g;
  const freq   = {};
  let m;
  while ((m = hexRe.exec(html)) !== null) {
    const c = m[0].toLowerCase();
    // Skip near-black, near-white, and low-chroma greys
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const maxC   = Math.max(r, g, b);
    const minC   = Math.min(r, g, b);
    const chroma = maxC - minC; // 0–255
    if (maxC < 30 || minC > 225 || chroma < 25) continue; // skip greys/blacks/whites
    freq[c] = (freq[c] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([color]) => color);
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

  // Scrape homepage + about in parallel; also fetch raw HTML for color extraction
  const [mainContent, aboutContent, contactContent, homeHTML] = await Promise.all([
    jinaFetch(fullUrl),
    jinaFetch(`${fullUrl}/about`),
    jinaFetch(`${fullUrl}/contact`),
    jinaFetchHTML(fullUrl),
  ]);

  if (!mainContent) {
    return new Response(JSON.stringify({
      ok:    false,
      error: "Could not read the website. Check the URL is correct and the site is publicly accessible.",
    }), { status: 422 });
  }

  const colorHints = extractColorHints(homeHTML);

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

DETECTED HEX COLORS FROM SITE (extracted from live HTML — strong signal for brand palette):
${colorHints.length > 0 ? colorHints.join("  ") : "none detected"}

If detected colors are present above, use them as your PRIMARY signal for --accent and --paper hues.
Convert hex to OKLCH: multiply sRGB channel values by the appropriate OKLCH transfer function.
Approximate conversion: hex #RRGGBB → find dominant hue angle H (0=red, 60=yellow, 120=green, 180=cyan, 240=blue, 300=magenta), then set C proportional to saturation, L proportional to lightness.

PALETTE RULES — use OKLCH format oklch(L% C H):
- --paper: main background. Light brands: L 95–99, C 0.003–0.015. Dark/luxury: L 10–18, C 0.008–0.015
- --paper-2: slightly darker than paper (L -2 to -4)
- --paper-3: slightly darker still (L -4 to -7)
- --ink: primary text. Light bg → dark (L 15–25). Dark bg → light (L 88–96)
- --ink-2: secondary text, softer (L +12 from ink direction)
- --muted: placeholder/disabled (midpoint between paper and ink)
- --muted-2: even softer muted
- --rule: subtle borders, low chroma (C 0.006–0.014)
- --rule-strong: stronger borders (L 5–8 darker than rule)
- --accent: brand primary color — the dominant brand hue from logo/nav/CTAs, C 0.12–0.25
- --accent-ink: darker accent for text on light bg (L -15 from accent)
- --accent-wash: very faint tint of accent for wash backgrounds (L 92–96, C 0.02–0.05)

CRITICAL: Do NOT infer palette from sustainability content, product category, or nature imagery.
Infer palette ONLY from actual brand identity signals: logo color, navigation bar color, primary CTA button color, hero background.
A brand selling electronics with a sustainability program is NOT an eco brand — it is an electronics brand.

BRAND TYPE → ACCENT HUE REFERENCE (use these as anchors, refine from detected hex colors):
- Consumer electronics / big-box retail: white/light bg, cobalt-to-royal blue accent (H 240–260) or brand-specific
- B2B SaaS / tech: white bg, electric blue or indigo accent (H 240–280)
- Luxury / premium skincare: warm ivory bg, gold/saffron accent (H 45–70), dark ink
- Food / QSR: white bg, bold red or orange accent (H 10–35)
- Eco / sustainability-ONLY brand (primary purpose is eco, not a feature): parchment bg, forest green (H 140–160)
- Fashion / apparel (non-luxury): white bg, black ink, minimal accent
- Healthcare / wellness: white bg, medium teal-blue accent (H 195–220)
- Financial services: white/navy bg, dark blue or green accent (H 140–250)
- Premium dark brand: near-black bg, champagne/gold accent (H 50–70)
- Sports / fitness: white or dark bg, bold accent (brand-specific — often red, orange, or blue)`;

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
