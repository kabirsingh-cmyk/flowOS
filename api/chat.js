/**
 * FlowOS — Anthropic API proxy with Composio tool execution
 * Vercel Edge Function: POST /api/chat
 *
 * Flow:
 *   1. Receive tenant message + tenantId + brand context
 *   2. Fetch Composio tools for tenant's connected accounts
 *   3. Call Claude with brand context + all tools
 *   4. If Claude returns tool_use → execute via Composio → loop
 *   5. Return final response as JSON (content blocks)
 */

import { COMPOSIO_BASE, composioHeaders, getConnectedAccountSlugs, executeComposioTool as _execTool } from './lib/composio.js';
import { sbHeaders, fetchBrandProfile } from './lib/supabase.js';
import { requireAuth } from './lib/auth.js';

export const config = { runtime: "edge" };

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

// ─── Brand voice block (appended to supervisor + drafter prompts) ─────────────

function buildBrandVoiceBlock(brand) {
  if (!brand) return '';
  const name = brand.name || 'this brand';
  const voice = brand.voice || {};
  const messaging = brand.messaging || {};
  const terminology = brand.terminology || {};

  // attributes: prefer new structured field; fall back to comma-splitting voice.tone
  const attributes = Array.isArray(voice.attributes) && voice.attributes.length
    ? voice.attributes
    : (typeof voice.tone === 'string' && voice.tone.trim()
        ? voice.tone.split(',').map(s => s.trim()).filter(Boolean)
        : []);

  // anti-attributes: only the new structured field — no clean fallback in current schema
  const antiAttributes = Array.isArray(voice.antiAttributes) && voice.antiAttributes.length
    ? voice.antiAttributes
    : [];

  // approved terminology: only the new structured field
  const approvedTerms = Array.isArray(terminology.approved) && terminology.approved.length
    ? terminology.approved
    : [];

  // prohibited terminology: prefer new structured field; fall back to voice.bannedPhrases
  // (both snake_case and camelCase, since Supabase row is snake_case at the top level
  // but the voice jsonb is camelCase as written by brand-import.js)
  const prohibitedTerms = Array.isArray(terminology.prohibited) && terminology.prohibited.length
    ? terminology.prohibited
    : (Array.isArray(voice.bannedPhrases) && voice.bannedPhrases.length
        ? voice.bannedPhrases
        : (Array.isArray(voice.banned_phrases) && voice.banned_phrases.length
            ? voice.banned_phrases
            : []));

  // value propositions: prefer new structured field; fall back to top-level `values`
  const propositions = Array.isArray(messaging.valuePropositions) && messaging.valuePropositions.length
    ? messaging.valuePropositions
    : (Array.isArray(brand.values) && brand.values.length ? brand.values : []);

  const weAre = attributes.length ? attributes.join(', ') : null;
  const weAreNot = antiAttributes.length ? antiAttributes.join(', ') : null;
  const approved = approvedTerms.length ? approvedTerms.join(', ') : null;
  const prohibited = prohibitedTerms.length ? prohibitedTerms.join(', ') : null;
  const valueProps = propositions.length ? propositions.map((v, i) => `  ${i + 1}. ${v}`).join('\n') : null;
  const lines = [
    `## Brand Voice — ${name}`,
    `Voice is this brand's constant personality. It must not change regardless of channel or content type.`,
    ``,
  ];
  if (weAre) lines.push(`**We are:** ${weAre}`);
  if (weAreNot) lines.push(`**We are not:** ${weAreNot}`);
  lines.push(``, `**Tone flexes by content type:**`);
  lines.push(`- LinkedIn: professional, paragraph-broken, no "I'm excited to share"`);
  lines.push(`- Instagram: visual-first, story-driven, conversational`);
  lines.push(`- X/Twitter: punchy, one idea, under 240 chars`);
  lines.push(`- Email: warm and direct, one CTA, short paragraphs`);
  lines.push(`- Ad copy: benefit-led, outcome first, no filler`);
  lines.push(`- SMS: under 130 chars, one action`);
  lines.push(``);
  if (approved) lines.push(`**Approved terms:** ${approved}`);
  if (prohibited) lines.push(`**Prohibited terms:** ${prohibited} — never use these even if the user asks`);
  if (valueProps) { lines.push(``, `**Value propositions (weave in naturally):**`, valueProps); }
  lines.push(``, `**Rules:**`);
  lines.push(`- Every draft must feel unmistakably like ${name}, not generic AI copy`);
  lines.push(`- If the user's request conflicts with brand voice, flag it and offer both a brand-compliant version and what they asked for`);
  lines.push(`- After every draft, add one line: "Brand note: [which voice attributes you applied]"`);
  return lines.join('\n');
}

// ─── Composio helpers ─────────────────────────────────────────────────────────

// Social toolkits migrated to Zernio — exclude from Composio tool fetching.
// Composio is now scoped to: googleads, ga4, gsc, hubspot, mailchimp,
// ahrefs, moz, elevenlabs, heygen, klaviyo, shopify.
const COMPOSIO_SOCIAL_SLUGS = new Set([
  "linkedin", "li", "liads",
  "facebook", "fb", "metaads",
  "instagram", "ig",
  "twitter", "x", "xads",
  "reddit",
  "youtube", "yt",
  "tiktok", "tt", "ttads",
  "pinterest", "pn", "pinads",
]);

/**
 * Fetch Anthropic-compatible tool definitions for a tenant's connected accounts.
 * Returns [] gracefully if Composio not configured or tenant has no connections.
 * Social platforms are excluded — they route through Zernio.
 */
async function fetchComposioTools(tenantId) {
  if (!process.env.COMPOSIO_API_KEY2 || !tenantId) return [];

  try {
    const allSlugs = await getConnectedAccountSlugs(tenantId);
    // Filter out social toolkits — those are now on Zernio.
    const slugs = allSlugs.filter(s => !COMPOSIO_SOCIAL_SLUGS.has(s.toLowerCase()));
    if (slugs.length === 0) return [];
    const apps = slugs.join(",");

    // Fetch available actions for connected toolkits (v3)
    const actRes = await fetch(
      `${COMPOSIO_BASE}/tools?toolkits=${apps}&limit=20`,
      { headers: composioHeaders() }
    );
    if (!actRes.ok) return [];

    const actData = await actRes.json();
    const actions = actData.items || actData.tools || actData.actions || [];

    // Map to Anthropic tool format
    return actions.map(action => ({
      name:         action.name || action.slug,
      description:  action.description || `Execute ${action.name || action.slug}`,
      input_schema: action.parameters || action.input_schema || { type: "object", properties: {} },
    }));
  } catch (e) {
    console.error("[chat] fetchComposioTools:", e.message);
    return [];
  }
}

async function executeComposioTool(toolName, toolInput, tenantId) {
  return _execTool(toolName, toolInput, tenantId, { onError: "object" });
}

// ─── Supabase helpers ──────────────────────────────────────────────────────────

async function fetchAnalyticsInsights(tenantId, period = "30d") {
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supaUrl || !supaKey || !tenantId) return null;
  try {
    const [insRes, snapRes] = await Promise.all([
      fetch(
        `${supaUrl}/rest/v1/analytics_insights?tenant_id=eq.${encodeURIComponent(tenantId)}&period=eq.${encodeURIComponent(period)}&select=*&order=generated_at.desc&limit=1`,
        { headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}` } }
      ),
      fetch(
        `${supaUrl}/rest/v1/analytics_snapshots?tenant_id=eq.${encodeURIComponent(tenantId)}&period=eq.${encodeURIComponent(period)}&select=channel,metrics,fetched_at`,
        { headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}` } }
      ),
    ]);
    const insights  = insRes.ok  ? (await insRes.json())?.[0]  || null : null;
    const snapshots = snapRes.ok ? await snapRes.json() : [];
    return { insights, snapshots };
  } catch {
    return null;
  }
}

async function fetchAgentOverride(tenantId, agentId) {
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supaUrl || !supaKey || !tenantId || !agentId) return null;
  try {
    const res = await fetch(
      `${supaUrl}/rest/v1/agent_overrides?tenant_id=eq.${encodeURIComponent(tenantId)}&agent_id=eq.${encodeURIComponent(agentId)}&select=custom_name,system_prompt,enabled&limit=1`,
      { headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

// ─── System prompt builder (tenant-aware) ─────────────────────────────────────

function buildSystemPrompt(specialist, brand, connectedApps, agentOverride, analyticsData) {
  // brand may be the full Supabase row (snake_case) or the lightweight
  // preset object from the frontend — normalise both shapes here.
  const name       = brand?.name                                   || "Unknown";
  const industry   = brand?.industry                               || null;
  const audience   = brand?.target_audience   || brand?.targetAudience || null;
  const voiceTone  = brand?.voice?.tone                            || null;
  const voicePerso = brand?.voice?.personality                     || null;
  const banned     = brand?.voice?.bannedPhrases
    || (brand?.voice?.banned_phrases)
    || [];
  const values     = brand?.values                                 || [];
  const claims     = brand?.claims                                 || [];
  const prohibited = brand?.prohibited_topics || brand?.prohibitedTopics || [];

  const brandBlock = brand ? `
BRAND CONTEXT
Name: ${name}${industry ? `\nIndustry: ${industry}` : ""}${audience ? `\nTarget audience: ${audience}` : ""}

VOICE${voiceTone ? `\nTone: ${voiceTone}` : ""}${voicePerso ? `\nPersonality: ${voicePerso}` : ""}${banned.length ? `\nNever say: ${banned.join(", ")}` : ""}
${values.length ? `\nVALUES\n${values.map(v => `- ${v}`).join("\n")}` : ""}
${claims.length ? `\nVERIFIED CLAIMS (use these — do not invent others)\n${claims.map(c => `- ${c}`).join("\n")}` : ""}
${prohibited.length ? `\nPROHIBITED TOPICS\n${prohibited.map(p => `- ${p}`).join("\n")}` : ""}
`.trim() : "";

  const brandVoiceBlock = buildBrandVoiceBlock(brand);

  const toolBlock = connectedApps.length > 0
    ? `You have live tools to act on: ${connectedApps.join(", ")}. These are non-social tools (analytics, ads, CRM, email). When asked to create, update, or report on campaigns — use the tools. Don't describe what to do, do it. Summarise results in plain English. Note: social publishing (LinkedIn, Facebook, Instagram, X, Reddit, TikTok, Pinterest, Threads, Bluesky, YouTube, and more) goes through Zernio — use the create_draft tool to generate content and the user publishes from the Publishing Queue.`
    : `No non-social platforms connected yet. Social publishing (all platforms) goes through Zernio and is handled from the Publishing Queue. For ads, analytics, email, or CRM actions, tell the tenant to connect those in Settings → Connections.`;

  const prompts = {
    supervisor: `You are Flow — the AI marketing operator for FlowOS.

${brandBlock}

ROLE
Take natural language instructions from the tenant and turn them into real actions on their connected marketing platforms.

${toolBlock}

DELEGATE TO SPECIALISTS when:
- Writing content → delegate_to "drafter"
- Interpreting metrics → delegate_to "analyst"
- Checking copy compliance → delegate_to "brand_guard"
- Customer message triage → delegate_to "inbox"
- If the user wants to plan a campaign, build a campaign brief, create a marketing plan, or map out a product launch → delegate to campaign_planner
- If the user asks for a drip campaign, nurture sequence, onboarding emails, re-engagement series, win-back campaign, email automation, or any multi-email flow → delegate to drafter with intent to call create_email_sequence
- If the user asks for an SEO audit, keyword research, content gap analysis, technical SEO check, or competitor SEO comparison → delegate to seo_auditor

Otherwise act directly using available tools.

BEHAVIOUR
- Lead with action. If you have tools and the task is clear, use them immediately.
- Summarise tool results in plain English — never show raw JSON.
- One clarifying question max if the request is ambiguous.
- Use open_workspace when a canvas view would help the tenant.

${brandVoiceBlock}`,

    drafter: `You are Drafter — the content AI for FlowOS.
${brandBlock}

Write in the tenant's brand voice. Output clean copy only — no preamble, no meta-commentary.

TOOL CHOICE
- For email (Klaviyo campaigns, flows, newsletters): call create_email_draft.
  This produces a structured email artifact with first-class subject, preheader,
  and body, plus a "Push to Klaviyo" action that creates the draft template +
  campaign in Klaviyo automatically.
- For SMS (Klaviyo SMS, transactional text, win-back text, cart-abandon nudge):
  call create_sms_draft. This produces a structured SMS artifact with a "Push
  to Klaviyo SMS" action that creates a draft SMS campaign in Klaviyo.
- For everything else: call create_draft.
- One tool call per piece of content. If the user asks for 3 variants, make 3 calls.
- Never output draft copy as plain text — always go through a tool.

Formats:
- Social post: caption + relevant hashtags. Under 300 chars unless the platform supports long-form.
- Ad copy: headline + body in the copy field.
- SMS: under 160 chars, link at end. Use create_sms_draft, not create_draft.
- Reel/video: script as copy, shot direction in imagePrompt field.

For create_draft: always include an imagePrompt for visual formats (post, reel, story, carousel, pin). Leave it empty for SMS.
For create_email_draft: write a concrete subject line (≤ 60 chars), a preheader (≤ 110 chars) that complements (not repeats) the subject, and a full body in plain text with paragraph breaks. Infer the audienceHint from the user's request ("new subscribers", "VIPs", "lapsed 90d+", etc.) — leave blank if no audience was implied.
For create_sms_draft: body must be ≤ 160 chars (hard cap — count carefully, GSM-7). Be concrete and on-brand. Do NOT auto-append "Reply STOP to opt out" unless the user explicitly asks — the brand/legal team decides whether the STOP footer is added at send. Infer audienceHint same as email. Avoid emoji unless the user asks (emoji silently halves the SMS char budget to 70).

${brandVoiceBlock}

## Channel Format Rules

When writing any draft, identify the platform first and follow these rules exactly.

LINKEDIN
- First line: one strong hook — bold claim, specific number, or counterintuitive statement. Never "I'm excited to share."
- Short paragraphs, 1-3 lines each. Never a wall of text.
- 150-300 words for posts.
- End with a question OR a CTA, not both.
- 3-5 hashtags on their own line at the bottom.
- No emoji unless the brand voice uses them.

INSTAGRAM
- First line must stand alone before the 125-character cutoff — this is the hook.
- Story-driven and visual. Write as if describing what the viewer is seeing.
- 2-5 emoji, placed purposefully, not as filler.
- 5-15 hashtags in a block at the end.
- For reels: first line = hook, last line = CTA or question.

X / TWITTER
- Hard limit: 240 characters.
- One idea per tweet. No preamble.
- No hashtags in body. One at the end if truly necessary.
- Lead with the outcome, not the feature name.

FACEBOOK
- 40-80 words.
- Conversational and community-oriented.
- Ask a question or suggest a poll.
- 1-2 hashtags max.

EMAIL
- Always provide exactly 3 subject line options. Label them:
  - Option A: benefit-driven (what's in it for them)
  - Option B: curiosity / open loop
  - Option C: direct / urgent
- Subject lines under 50 characters.
- Preview text: 40-90 characters, must complement the subject line, not repeat it.
- Body: short paragraphs (2-3 sentences max), one primary CTA.
- CTA button text must be action-oriented — "Get your report" not "Click here."

SMS
- Maximum 130 characters.
- One sentence. One action. No jargon.
- Always end with a link or a reply instruction.
- Do not write the STOP footer — it is added automatically.

BLOG POST
- Provide 3 headline options:
  - Option A: How-to or numbered list
  - Option B: Question-based
  - Option C: Bold claim
- Primary keyword in headline and first 100 words.
- 3-5 H2 sections with descriptive subheadings.
- End with a specific CTA relevant to the content.
- Include: one meta description under 160 characters.

AD COPY
- Google: 3 headlines (30 chars each) + 2 descriptions (90 chars each).
- Meta: Primary text (125 chars) + Headline (40 chars) + Description (30 chars).
- Every ad needs one clear CTA.
- Never use unsubstantiated superlatives like "best" or "world-class."

## Email Sequence Rules

When create_email_sequence is called, use these as your starting templates:

ONBOARDING — 5-7 emails over 14-21 days:
Email 1 (Day 0): Welcome, set expectations, one quick win action
Email 2 (Day 2): Guide to first value moment
Email 3 (Day 5): Core feature deep dive
Email 4 (Day 9): Advanced tip or integration
Email 5 (Day 14): Social proof or case study
Email 6 (Day 18): Check-in, surface help resources
Email 7 (Day 21): Upgrade or next step prompt

LEAD NURTURE — 4-6 emails over 3-4 weeks:
Email 1 (Day 0): Value-first educational content, no pitch
Email 2 (Day 5): Name the pain point specifically
Email 3 (Day 10): Solution positioning with proof
Email 4 (Day 16): Social proof, results
Email 5 (Day 21): Soft CTA — trial, demo, resource
Email 6 (Day 28): Direct CTA — buy, book, sign up

RE-ENGAGEMENT — 3-4 emails over 10-14 days:
Email 1 (Day 0): "We miss you" with a compelling reason to return
Email 2 (Day 4): Value reminder — what they're missing
Email 3 (Day 8): Incentive or exclusive offer
Email 4 (Day 12): Last chance with a clear deadline

WIN-BACK — 3-5 emails over 30 days:
Email 1 (Day 0): Friendly check-in, ask what went wrong
Email 2 (Day 7): What's new since they left
Email 3 (Day 14): Special offer or incentive
Email 4 (Day 21): Feedback request
Email 5 (Day 30): Final goodbye with door open

PRODUCT LAUNCH — 4-6 emails over 2-3 weeks:
Email 1 (Day -7): Teaser or pre-announcement
Email 2 (Day 0): Launch announcement with full details
Email 3 (Day 3): Feature spotlight or use case
Email 4 (Day 7): Social proof and early results
Email 5 (Day 12): Limited-time offer
Email 6 (Day 14): Last chance reminder

Performance benchmarks:
- Onboarding: 50-70% open, 10-20% CTR, 15-30% conversion
- Lead nurture: 20-30% open, 3-7% CTR, 2-5% conversion
- Re-engagement: 15-25% open, 2-5% CTR, 3-8% conversion
- Win-back: 15-20% open, 2-4% CTR, 1-3% conversion

Rules for every email in a sequence:
- 3 subject line options per email: label as Benefit-driven / Curiosity / Direct
- Preview text 40-90 chars, must not repeat the subject line
- Short paragraphs, 2-3 sentences max, one primary CTA
- Define what happens if they open but don't click
- Define what action triggers early exit from the sequence`,

    analyst: (() => {
      let analyticsBlock = "";
      if (analyticsData?.insights || analyticsData?.snapshots?.length > 0) {
        const parts = [];
        if (analyticsData.insights?.summary) {
          parts.push(`LATEST ANALYSIS SUMMARY:\n${analyticsData.insights.summary}`);
        }
        if (analyticsData.snapshots?.length > 0) {
          parts.push("LIVE METRICS DATA:\n" + analyticsData.snapshots.map(s =>
            `${s.channel.toUpperCase()}:\n${JSON.stringify(s.metrics, null, 2)}`
          ).join("\n\n"));
        }
        analyticsBlock = parts.length > 0
          ? `\n\nANALYTICS CONTEXT (real data — always reference specific numbers)\n${parts.join("\n\n")}`
          : "";
      }

      return `You are Analyst — the data AI for FlowOS.
${brandBlock}${analyticsBlock}

Interpret marketing performance and surface insights clearly.
Lead with the number → implication → one action.
When analytics data is provided above, always ground your answers in those specific numbers.
If no data is available, tell the user to click Refresh in the Analytics tab to pull live metrics.
Use show_metric for headline numbers.`;
    })(),

    brand_guard: `You are Brand Guard — the policy AI for FlowOS.
${brandBlock}

Check copy against brand guidelines.
For each issue: Flag → Rule → Fix.
If clean, say so in one sentence.`,

    inbox: `You are Inbox — the customer communications AI for FlowOS.
${brandBlock}

Triage: Urgent / Standard / Low.
Output: classification → suggested reply → flag if human review needed.`,

    campaign_planner: `You are FlowOS's campaign planning specialist. Generate complete, structured marketing campaign briefs that a solo marketer or small team can execute immediately.

${brandBlock}

When activated, first check if the user has provided:
- Campaign goal (required)
- Target audience (required)
- Timeline (required)
- Budget (optional)
- Product or service being promoted (optional)

If any required field is missing, ask for all missing fields in a single message before generating anything.

Once you have the inputs, generate a campaign brief with these exact sections:

**1. Campaign Overview**
- Suggested campaign name
- One-sentence summary
- Primary objective — must be specific and measurable (use SMART framework)
- Secondary objectives if applicable

**2. Target Audience**
Write the primary audience profile in this exact format:
"[Role] at [company type] who is struggling with [pain point] and looking for [desired outcome]. They discover solutions through [channels] and care most about [priorities]."
Also note buying stage: awareness / consideration / decision.

**3. Key Messages**
- Core campaign message (one sentence)
- 3 supporting messages tied to specific audience pain points
- One proof point per supporting message (data, case study, or placeholder)
- Message hierarchy: Why care → What is it → Why us → What to do

**4. Channel Strategy**
Pick 3-5 channels that actually fit this audience and goal. For each:
- Why this channel fits
- What content format to use
- Effort level: low / medium / high
- Budget % if budget was provided
Explain briefly why you excluded other channels.

Consider: email, blog, LinkedIn, Instagram, X, paid search, paid social, PR, community, influencer, events.

**5. Content Calendar**
Week-by-week table in this exact format:
| Week | Content Piece | Channel | Priority | Dependencies | Status |
Mark priorities as Must-have or Nice-to-have. Call out dependencies explicitly (e.g. "Landing page must be live before paid ads launch").

**6. Content Assets Needed**
Every asset required for the campaign:
- Asset name and type
- One-line description of what it must contain
- Priority: must-have or nice-to-have
- Effort estimate

**7. Success Metrics**
- Primary KPI with a target number
- 3-5 secondary KPIs
- How each is tracked
- Reporting cadence

Benchmarks by campaign type to inform targets:
- Awareness: reach, impressions, brand mentions, direct traffic lift
- Lead gen: total leads, MQLs, CPL, lead-to-MQL rate
- Product launch: signups, activation rate, media coverage, social buzz
- Retention: churn change, NPS, upsell revenue

**8. Risks and Mitigations**
2-3 realistic risks with a mitigation for each.

**9. Next Steps**
Immediate actions to start this week. Approvals needed. Key decision points.

After generating the brief, you MUST do both of the following, in this order:
1. Call create_campaign_plan with title, summary, itemCount, goal, audience, timeline, budget (or ""), channels (array), and brief — where the brief field carries the COMPLETE markdown brief you just wrote (all nine sections, in the exact format above). The canvas renders this; if you abbreviate, the canvas will be empty.
2. Call open_workspace with target "planner" to open the CampaignPlanner canvas.

End every brief with: "Would you like me to draft specific content pieces from the calendar, adjust for a different budget, or build the email sequence for this campaign?"

${brandVoiceBlock}`,

    seo_auditor: `You are FlowOS's SEO specialist. You conduct SEO audits, keyword research, content gap analysis, and competitor comparisons.

${brandBlock}

When activated, ask for:
- URL or domain to audit (required)
- Audit type if specified: full_audit / keyword_research / content_gap / technical_check / competitor_comparison (default to full_audit)
- Target keywords if they have them (optional)
- Competitors to compare against (optional — if not provided, find 2-3 via web search)

Use web search throughout to research the actual keyword landscape, competitor content, and technical signals. Do not make up data — if web_search returns nothing for a section, leave that section's array empty rather than inventing rows.

OUTPUT CONTRACT
Do NOT write the audit as markdown in the chat. Instead, call create_seo_audit with the full structured payload — the FlowOS chat renders it as a first-class SeoAuditCard artifact with collapsible tables.

Required call sequence at the end of every audit:
1. create_seo_audit — fill every applicable field. Required: url, executiveSummary, overallAssessment, keywords, quickWins. Pass [] for sections that genuinely don't apply (e.g. competitors when none were named and none were discovered).
2. open_workspace target="seo" — opens SEO Studio so the tenant can drill in.

Field expectations:
- overallAssessment: one of strong_foundation / needs_work / critical_issues
- executiveSummary: 3-5 sentences, prose — biggest strength, top 3 priorities, headline verdict
- keywords: 15-25 rows sorted by opportunity high → low. Intent ∈ {informational, commercial, transactional, navigational}. Difficulty ∈ {easy, moderate, hard}.
- onPageIssues: severity ∈ {Critical, High, Medium, Low}. Critical = blocks indexation or directly hurts rankings.
- contentGaps: priority ∈ {high, medium, low}. effort ∈ {quick_win, moderate, substantial}.
- technicalChecks: cover page speed, mobile, structured data, robots.txt, sitemap, canonical tags, HTTPS, broken links, Core Web Vitals signals, duplicate content. Status ∈ {Pass, Fail, Warning}.
- competitors + competitorNames: omit / empty array if no competitors. competitorNames is the ordered display names (e.g. ["Competitor A","Competitor B"] mapped to actual brand names).
- quickWins: actions under 2 hours with immediate impact. Each needs action + expectedImpact + effort.
- strategicInvestments: higher-effort quarterly work. Each needs action + expectedImpact + effort + (optional) dependencies.

After both tool calls, write one short paragraph (2-3 sentences max) in chat introducing the audit and asking: "Would you like me to draft content briefs for the top keyword opportunities, write optimized title tags and meta descriptions, or build a content calendar from the gap analysis?" The card carries the detail — do not restate the sections in prose.

${brandVoiceBlock}`,
  };

  const defaultPrompt = prompts[specialist] || prompts.supervisor;

  // If the tenant has saved a custom system prompt for this agent, use it
  // (brand context block is always included regardless)
  if (agentOverride?.system_prompt) {
    return `${brandBlock ? brandBlock + "\n\n" : ""}${agentOverride.system_prompt}`;
  }

  return defaultPrompt;
}

// ─── Internal FlowOS tools (always available to supervisor) ───────────────────

const INTERNAL_TOOLS = [
  {
    name: "delegate_to",
    description: "Route this task to the appropriate specialist AI.",
    input_schema: {
      type: "object",
      properties: {
        specialist: { type: "string", enum: ["drafter", "analyst", "brand_guard", "inbox", "campaign_planner", "seo_auditor"] },
        context:    { type: "string", description: "What to pass to the specialist" },
      },
      required: ["specialist", "context"],
    },
  },
  {
    name: "open_workspace",
    description: "Open a workspace view in the canvas panel for the tenant.",
    input_schema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["command","studio","emailstudio","searchstudio","organic","planner","inbox","insights","connections","memory","autonomy","seo"],
        },
      },
      required: ["target"],
    },
  },
  {
    name: "show_drafts",
    description: "Display draft content items in the canvas for review.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title:   { type: "string" },
              channel: { type: "string" },
              body:    { type: "string" },
            },
            required: ["title"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "show_metric",
    description: "Display a key metric prominently in the canvas.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string" },
        value: { type: "string" },
        delta: { type: "string" },
        note:  { type: "string" },
      },
      required: ["label", "value"],
    },
  },
  {
    name: "create_draft",
    description: "Create a publishable content draft and surface it inline in the chat thread with a 'Send to queue' action. Call this whenever the user asks you to write, draft, or create content for a specific platform or format.",
    input_schema: {
      type: "object",
      properties: {
        platform:    { type: "string", description: "Target platform slug: instagram, tiktok, linkedin, facebook, x, youtube, pinterest, threads, bluesky, reddit, snapchat, discord, telegram, whatsapp, gbusiness, email, sms" },
        contentType: { type: "string", description: "Content format: Post, Reel, Carousel, Story, Email, SMS, Video, Short, Pin, Thread, Article, Ad" },
        copy:        { type: "string", description: "The full draft copy — body text, caption, email body, or script. Write in the brand voice. No preamble." },
        imagePrompt: { type: "string", description: "Optional Runware image-generation prompt if a visual is needed for this format. Describe the scene, not the brand." },
      },
      required: ["platform", "contentType", "copy"],
    },
  },
];

INTERNAL_TOOLS.push({
  name: "create_email_draft",
  description: "Produce an email artifact (subject, preheader, body) and surface it inline in the chat with a 'Push to Klaviyo' action. Call this for any email content — campaigns, flows, newsletters, win-backs, welcome series. Do not use create_draft for emails.",
  input_schema: {
    type: "object",
    properties: {
      subject:      { type: "string", description: "Subject line. Concrete, ≤ 60 chars, in brand voice." },
      preheader:    { type: "string", description: "Preheader / preview text. ≤ 110 chars. Complements the subject — does not repeat it." },
      body:         { type: "string", description: "Full email body in plain text with paragraph breaks. No HTML." },
      audienceHint: { type: "string", description: "Free-text audience hint inferred from the user's request (e.g. 'new subscribers', 'VIP buyers', 'lapsed 90d+'). Leave blank if not implied." },
      campaignName: { type: "string", description: "Optional short internal name for this campaign. Defaults to subject if omitted." },
    },
    required: ["subject", "body"],
  },
});

INTERNAL_TOOLS.push({
  name: "create_sms_draft",
  description: "Produce an SMS artifact (body, audience hint) and surface it inline in the chat with a 'Push to Klaviyo SMS' action. Call this for any SMS content — promotional, transactional, win-back, cart-abandon. Do not use create_draft for SMS.",
  input_schema: {
    type: "object",
    properties: {
      body:         { type: "string", description: "SMS body, plain text, hard cap 160 chars (GSM-7). No emoji unless the user asked." },
      audienceHint: { type: "string", description: "Free-text audience hint inferred from the user's request (e.g. 'cart abandoners', 'VIPs', 'lapsed 90d+'). Leave blank if not implied." },
      campaignName: { type: "string", description: "Optional short internal name for this campaign. Defaults to a truncated body if omitted." },
      includeStopFooter: { type: "boolean", description: "Whether the user explicitly asked for a 'Reply STOP to opt out' footer. Default false — the brand decides at send time." },
    },
    required: ["body"],
  },
});

INTERNAL_TOOLS.push({
  name: "create_email_sequence",
  description: "Create a complete multi-email sequence. Use when the user asks for a drip campaign, nurture sequence, onboarding flow, re-engagement series, win-back campaign, or any multi-email automation.",
  input_schema: {
    type: "object",
    properties: {
      sequenceType: {
        type: "string",
        enum: ["onboarding", "lead_nurture", "re_engagement", "win_back", "product_launch", "event_followup", "upsell", "educational_drip"]
      },
      goal: { type: "string" },
      audience: { type: "string" },
      emails: {
        type: "array",
        items: {
          type: "object",
          properties: {
            emailNumber: { type: "number" },
            subjectLines: { type: "array", items: { type: "string" }, description: "Exactly 3 options: benefit-driven, curiosity, direct" },
            previewText: { type: "string" },
            purpose: { type: "string", description: "One sentence: why this email exists" },
            body: { type: "string", description: "Full ready-to-use email body" },
            ctaText: { type: "string" },
            timingDays: { type: "number", description: "Days after trigger or previous email" },
            segmentCondition: { type: "string", description: "Who gets this vs who skips it" }
          },
          required: ["emailNumber", "subjectLines", "previewText", "purpose", "body", "ctaText", "timingDays"]
        }
      },
      branchingLogic: { type: "string", description: "Plain English: branching paths and exit conditions" },
      exitCondition: { type: "string" },
      abTestSuggestions: { type: "array", items: { type: "string" } },
      benchmarks: {
        type: "object",
        properties: {
          openRate: { type: "string" },
          clickRate: { type: "string" },
          conversionRate: { type: "string" }
        }
      }
    },
    required: ["sequenceType", "goal", "audience", "emails", "exitCondition"]
  }
});

INTERNAL_TOOLS.push({
  name: "create_seo_audit",
  description: "Persist a complete, structured SEO audit as a first-class artifact and surface it inline in the chat. Call this ONCE at the end of an SEO audit instead of dumping the audit as markdown. Every section must be populated from real research (use web_search). Pair with open_workspace target=\"seo\" so the tenant can drill in.",
  input_schema: {
    type: "object",
    properties: {
      url:              { type: "string", description: "Domain or URL audited (e.g. 'mveda.com', 'https://example.com/pricing')." },
      auditType:        { type: "string", enum: ["full_audit", "keyword_research", "content_gap", "technical_check", "competitor_comparison"], description: "Audit scope. Defaults to full_audit." },
      overallAssessment:{ type: "string", enum: ["strong_foundation", "needs_work", "critical_issues"], description: "Headline verdict for the executive summary." },
      executiveSummary: { type: "string", description: "3-5 sentence executive summary: biggest strength, top 3 priorities, overall assessment in prose." },
      keywords: {
        type: "array",
        description: "15-25 keyword rows sorted by opportunity (high → low). Pull from real research, not invented data.",
        items: {
          type: "object",
          properties: {
            keyword:              { type: "string" },
            difficulty:           { type: "string", enum: ["easy", "moderate", "hard"] },
            opportunity:          { type: "string", enum: ["high", "medium", "low"] },
            currentRanking:       { type: "string", description: "Current SERP position if known (e.g. '#7', 'not ranked', 'page 2')." },
            intent:               { type: "string", enum: ["informational", "commercial", "transactional", "navigational"] },
            recommendedContentType:{ type: "string", description: "What format to publish (e.g. 'long-form guide', 'comparison page', 'product page')." },
          },
          required: ["keyword", "difficulty", "opportunity", "intent"],
        },
      },
      onPageIssues: {
        type: "array",
        description: "Pages with concrete on-page SEO problems. Critical = blocks indexation or directly hurts rankings.",
        items: {
          type: "object",
          properties: {
            page:             { type: "string", description: "URL or page name." },
            issue:            { type: "string" },
            severity:         { type: "string", enum: ["Critical", "High", "Medium", "Low"] },
            recommendedFix:   { type: "string" },
          },
          required: ["page", "issue", "severity", "recommendedFix"],
        },
      },
      contentGaps: {
        type: "array",
        description: "Topics the site doesn't cover but should, based on demand and competitor coverage.",
        items: {
          type: "object",
          properties: {
            topic:    { type: "string" },
            why:      { type: "string", description: "Demand, competitor coverage, funnel position — why this gap matters." },
            format:   { type: "string", description: "Blog, landing page, guide, comparison, etc." },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            effort:   { type: "string", enum: ["quick_win", "moderate", "substantial"], description: "quick_win 1-2h · moderate half-day · substantial multi-day." },
          },
          required: ["topic", "why", "priority"],
        },
      },
      technicalChecks: {
        type: "array",
        description: "Technical SEO checklist. Cover: page speed, mobile, structured data, robots.txt, sitemap, canonical tags, HTTPS, broken links, Core Web Vitals, duplicate content risk.",
        items: {
          type: "object",
          properties: {
            check:   { type: "string", description: "What was checked (e.g. 'XML sitemap', 'Core Web Vitals — LCP')." },
            status:  { type: "string", enum: ["Pass", "Fail", "Warning"] },
            details: { type: "string", description: "Findings and recommended action." },
          },
          required: ["check", "status", "details"],
        },
      },
      competitors: {
        type: "array",
        description: "Optional competitor comparison rows. Omit or leave empty if no competitors were provided or discoverable.",
        items: {
          type: "object",
          properties: {
            dimension:    { type: "string", description: "Row name (e.g. 'Keyword coverage', 'Content depth', 'Backlink signals')." },
            yourSite:     { type: "string" },
            competitorA:  { type: "string" },
            competitorB:  { type: "string" },
            winner:       { type: "string", description: "'You', 'Competitor A', 'Competitor B', or 'Tie'." },
          },
          required: ["dimension", "yourSite"],
        },
      },
      competitorNames: {
        type: "array",
        items: { type: "string" },
        description: "Display names for competitor A/B columns, in order. Empty if no competitors.",
      },
      quickWins: {
        type: "array",
        description: "Actions under 2 hours with immediate impact — do this week.",
        items: {
          type: "object",
          properties: {
            action:         { type: "string", description: "Specific action to take." },
            expectedImpact: { type: "string" },
            effort:         { type: "string", description: "e.g. '30 min', '1-2 hours'." },
          },
          required: ["action", "expectedImpact"],
        },
      },
      strategicInvestments: {
        type: "array",
        description: "Higher-effort actions for long-term growth — do this quarter.",
        items: {
          type: "object",
          properties: {
            action:         { type: "string" },
            expectedImpact: { type: "string" },
            effort:         { type: "string", description: "e.g. '1 week', '2 sprints'." },
            dependencies:   { type: "string", description: "Anything that must happen first. Empty if none." },
          },
          required: ["action", "expectedImpact"],
        },
      },
    },
    required: ["url", "executiveSummary", "overallAssessment", "keywords", "quickWins"],
  },
});

INTERNAL_TOOLS.push({
  name: "create_campaign_plan",
  description: "Persist the campaign brief to the CampaignPlanner canvas and surface a campaign-plan summary card inline in the chat. Call this ONCE after writing the full nine-section brief. Pass the full markdown brief in the `brief` field — the planner canvas renders it.",
  input_schema: {
    type: "object",
    properties: {
      title:        { type: "string", description: "Suggested campaign name from section 1 of the brief." },
      summary:      { type: "string", description: "One-line summary: '<N items> · <N channels> · <date range or timeline>'. Mirrors the brief's overview." },
      itemCount:    { type: "number", description: "Total number of content pieces planned across the calendar (count of rows in the section 5 table)." },
      goal:         { type: "string", description: "Primary objective from section 1 (SMART)." },
      audience:     { type: "string", description: "Primary audience profile from section 2." },
      timeline:     { type: "string", description: "Campaign timeline as supplied by the user (e.g. '4 weeks: May 19 → Jun 16')." },
      budget:       { type: "string", description: "Budget if supplied by the user; empty string otherwise." },
      channels:     { type: "array", items: { type: "string" }, description: "Channel names picked in section 4 (e.g. ['LinkedIn','Email','Paid Search'])." },
      brief:        { type: "string", description: "The COMPLETE nine-section campaign brief, in markdown. Include every section the user reads in chat — overview, audience, key messages, channel strategy, the full content calendar table, content assets, success metrics, risks, next steps. This is what the canvas renders. Do not abbreviate." },
    },
    required: ["title", "summary", "brief"],
  },
});

// Tools available to the Drafter specialist
const DRAFTER_TOOLS = INTERNAL_TOOLS.filter(t => t.name === "create_draft" || t.name === "create_email_draft" || t.name === "create_sms_draft" || t.name === "create_email_sequence");

// Tools available to the Campaign Planner specialist
const PLANNER_TOOLS = INTERNAL_TOOLS.filter(t => t.name === "create_campaign_plan" || t.name === "open_workspace");

// Anthropic server tool — web search. Anthropic executes it server-side and
// returns server_tool_use + web_search_tool_result blocks in the same response;
// we do not execute it ourselves. Cap usage per audit to control cost/latency.
const WEB_SEARCH_TOOL = {
  type:     "web_search_20250305",
  name:     "web_search",
  max_uses: 10,
};

// Tools available to the SEO Auditor specialist
const SEO_AUDITOR_TOOLS = [
  ...INTERNAL_TOOLS.filter(t => t.name === "open_workspace" || t.name === "create_seo_audit"),
  WEB_SEARCH_TOOL,
];

// ─── Tool execution loop ──────────────────────────────────────────────────────

const INTERNAL_TOOL_NAMES = new Set(INTERNAL_TOOLS.map(t => t.name));
const MAX_ITERATIONS = 3;

async function runToolLoop({ messages, systemPrompt, tools, tenantId, apiKey }) {
  let currentMessages = [...messages];
  const deadline = Date.now() + 22_000;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (Date.now() > deadline) {
      return [{ type: "text", text: "The request took too long. Please try a simpler task or break it into steps." }];
    }

    const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-opus-4-5",
        max_tokens: 2048,
        system:     systemPrompt,
        tools:      tools.length > 0 ? tools : undefined,
        messages:   currentMessages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();

    // Done — return content blocks
    if (data.stop_reason === "end_turn" || data.stop_reason === "max_tokens") {
      return data.content;
    }

    // Tool call — execute and loop
    if (data.stop_reason === "tool_use") {
      currentMessages.push({ role: "assistant", content: data.content });

      const toolUseBlocks = data.content.filter(b => b.type === "tool_use");
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const result = INTERNAL_TOOL_NAMES.has(block.name)
            ? { ok: true, tool: block.name, action: block.input }
            : await executeComposioTool(block.name, block.input, tenantId);
          return {
            type:        "tool_result",
            tool_use_id: block.id,
            content:     JSON.stringify(result),
          };
        })
      );

      currentMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unknown stop reason
    return data.content;
  }

  return [{
    type: "text",
    text:  "I've completed the maximum number of steps. Please try breaking this into smaller requests.",
  }];
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback for dev without key
    return new Response(JSON.stringify({ ok: true, content: [{ type: "text", text: "API key not configured." }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { tenantId } = auth;

  let body;
  try { body = await req.json(); }
  catch { return new Response("Bad request", { status: 400 }); }

  const { messages, specialist = "supervisor", brand: brandFromClient } = body;

  try {
    // Fetch Composio tools, brand profile, agent override, and analytics data in parallel
    const [composioTools, brandProfile, agentOverride, analyticsData] = await Promise.all([
      fetchComposioTools(tenantId),
      fetchBrandProfile(tenantId),
      fetchAgentOverride(tenantId, specialist),
      specialist === "analyst" ? fetchAnalyticsInsights(tenantId) : Promise.resolve(null),
    ]);

    const connectedApps = [...new Set(
      composioTools.map(t => t.name.split("_")[0].toLowerCase())
    )].filter(Boolean);

    // Prefer full Supabase profile; fall back to lightweight client-side brand
    const brand = brandProfile || brandFromClient || null;

    // Supervisor gets all tools; Drafter gets create_draft; Planner gets create_campaign_plan + open_workspace; others get none
    const tools = specialist === "supervisor"
      ? [...INTERNAL_TOOLS, ...composioTools]
      : specialist === "drafter"
      ? DRAFTER_TOOLS
      : specialist === "campaign_planner"
      ? PLANNER_TOOLS
      : specialist === "seo_auditor"
      ? SEO_AUDITOR_TOOLS
      : [];

    // Build system prompt — agent override replaces the specialist-specific section
    // but brand context is always prepended
    const systemPrompt = buildSystemPrompt(specialist, brand, connectedApps, agentOverride, analyticsData);

    const content = await runToolLoop({ messages, systemPrompt, tools, tenantId, apiKey });

    return new Response(JSON.stringify({ ok: true, content }), {
      status:  200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[chat] error:", e.message);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
