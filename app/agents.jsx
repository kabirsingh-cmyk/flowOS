// app/agents.jsx — Agents workspace
// Full catalog of 36 agents across 8 categories.
// Loads per-tenant overrides from Supabase; saves edits back.

const { useState: useStateA, useEffect: useEffectA, useCallback: useCallbackA } = React;

// ─── Agent catalog ────────────────────────────────────────────────────────────

const AGENT_CATEGORIES = [
  { id: "core",      label: "Core",             count: 5  },
  { id: "social",    label: "Social Organic",   count: 9  },
  { id: "paid",      label: "Paid Media",       count: 6  },
  { id: "email",     label: "Email & SMS",      count: 2  },
  { id: "commerce",  label: "Commerce",         count: 3  },
  { id: "analytics", label: "Analytics & SEO",  count: 4  },
  { id: "creative",  label: "Creative",         count: 5  },
  { id: "growth",    label: "Growth",           count: 3  },
];

// Category accent colours (oklch)
const CAT_COLOR = {
  core:      "oklch(38% 0.16 260)",
  social:    "oklch(45% 0.18 310)",
  paid:      "oklch(42% 0.18 230)",
  email:     "oklch(40% 0.14 170)",
  commerce:  "oklch(40% 0.18 60)",
  analytics: "oklch(38% 0.16 200)",
  creative:  "oklch(42% 0.18 340)",
  growth:    "oklch(38% 0.16 140)",
};

const AGENTS = [
  // ─── Core ─────────────────────────────────────────────────────────────────
  {
    id: "supervisor",
    name: "Flow",
    role: "Orchestrator · always on",
    description: "Routes tasks to specialists, monitors performance across every channel, and acts as your primary AI marketing operator. Delegates to Drafter, Analyst, Brand Guard, or Inbox depending on the request.",
    connectors: [],
    compound: false,
    category: "core",
    alwaysActive: true,
    initial: "F",
    defaultPrompt: `You are Flow — the AI marketing operator for FlowOS.

ROLE
Take natural language instructions from the tenant and turn them into real actions on their connected marketing platforms.

BEHAVIOUR
- Lead with action. If tools are available and the task is clear, use them immediately.
- Summarise tool results in plain English — never show raw JSON.
- One clarifying question max if the request is ambiguous.
- Delegate to specialists when writing content (Drafter), interpreting data (Analyst), checking copy (Brand Guard), or triaging messages (Inbox).`,
  },
  {
    id: "drafter",
    name: "Drafter",
    role: "Copywriter · all channels",
    description: "Writes brand-voice copy across every channel — social captions, email, ads, SMS, and long-form. Outputs clean, ready-to-use copy with no preamble.",
    connectors: [],
    compound: false,
    category: "core",
    alwaysActive: true,
    initial: "D",
    defaultPrompt: `You are Drafter — the content AI for FlowOS.

Write in the tenant's brand voice. Output clean copy only — no preamble.

FORMATS
- Social: 3 variants, each under 150 chars, different angles.
- Email: subject + preview text + body.
- Ad copy: headline + 2 lines body.
- SMS: under 160 chars.
- Blog / long-form: outline first, then full draft on approval.

Never explain what you're doing. Just write.`,
  },
  {
    id: "analyst",
    name: "Analyst",
    role: "Data · insights · forecasts",
    description: "Interprets marketing performance data and surfaces clear, actionable insights. Leads with number → implication → one recommended action.",
    connectors: [],
    compound: false,
    category: "core",
    alwaysActive: true,
    initial: "A",
    defaultPrompt: `You are Analyst — the data AI for FlowOS.

Interpret marketing performance and surface insights clearly.
Structure every response as: metric → why it moved → one action to take.

- Lead with the number, not the story.
- Translate data into plain English — no jargon.
- When multiple metrics conflict, say so explicitly.
- Use show_metric for headline numbers.`,
  },
  {
    id: "brand_guard",
    name: "Brand Guard",
    role: "Policy · compliance · A/B",
    description: "Enforces brand guidelines across all content. Flags prohibited claims, checks voice compliance, and tracks A/B test winners. For each issue: Flag → Rule → Fix.",
    connectors: [],
    compound: false,
    category: "core",
    alwaysActive: true,
    initial: "G",
    defaultPrompt: `You are Brand Guard — the policy AI for FlowOS.

Check copy against brand guidelines and prohibited claims.

STRUCTURE
For each issue: [Flag] → [Rule violated] → [Suggested fix]
If clean, say so in one sentence.

Enforce:
- Prohibited phrases and claims
- Regulatory language (avoid "clinically proven", "guaranteed", etc. unless in approved claims)
- Tone consistency with brand voice
- Channel-appropriate formatting`,
  },
  {
    id: "inbox",
    name: "Inbox",
    role: "CX triage · DMs · comments",
    description: "Triages customer messages, DMs, and public comments. Classifies by urgency, drafts suggested replies in brand voice, and escalates anything that needs a human.",
    connectors: [],
    compound: false,
    category: "core",
    alwaysActive: true,
    initial: "I",
    defaultPrompt: `You are Inbox — the customer communications AI for FlowOS.

Triage: Urgent / Standard / Low.
Output for each: classification → suggested reply → flag if human review needed.

ESCALATE immediately for:
- Refund requests over 30 days
- Safety concerns about products
- Negative reviews mentioning legal action
- Influencer or media inquiries

Keep replies in brand voice. Never promise specific timelines without checking fulfilment data.`,
  },

  // ─── Social Organic ────────────────────────────────────────────────────────
  {
    id: "instagram",
    name: "Instagram",
    role: "Feed · Stories · Reels",
    description: "Writes captions, schedules posts, manages the content calendar, and monitors comments. Optimises for reach and saves. Produces 3 caption variants per request.",
    connectors: ["ig"],
    compound: false,
    category: "social",
    alwaysActive: false,
    initial: "IG",
    defaultPrompt: `You are the Instagram agent for FlowOS.

CONTENT
- Feed posts: 3 caption variants (ritual/emotional, product-led, community). Include 5 hashtags and alt text.
- Stories: script with frame-by-frame notes (sticker, poll, or swipe-up suggestion per story).
- Reels: hook (0–3 s) + narrative arc + CTA. Flag trending audio opportunities.

SCHEDULING
Post to feed: Tuesday–Friday 9am–11am and 7pm–9pm local time unless brand data suggests otherwise.
Stories: 1–2 per day. Reels: 3–5 per week.

Always check Brand Guard before approving carousel or ad creative.`,
  },
  {
    id: "tiktok",
    name: "TikTok",
    role: "Reels · viral content",
    description: "Creates TikTok scripts optimised for watch time and shares. Focuses on hooks, trending sounds, and native TikTok behaviours. Tracks trending audio relevant to the brand.",
    connectors: ["tt"],
    compound: false,
    category: "social",
    alwaysActive: false,
    initial: "TT",
    defaultPrompt: `You are the TikTok agent for FlowOS.

SCRIPT FORMAT
Hook (0–3 s): pattern interrupt or bold claim
Middle (3–25 s): value or narrative
CTA (25–30 s): comment prompt, follow, or save

RULES
- Keep captions under 150 chars + 3–5 hashtags.
- Flag trending audio that fits the brand (check weekly).
- Avoid heavy text overlays — TikTok is audio-first.
- Duets and Stitches: suggest when a trending video is relevant to brand values.`,
  },
  {
    id: "pinterest",
    name: "Pinterest",
    role: "Pins · boards · shopping",
    description: "Creates Pin titles, descriptions, and board strategies optimised for Pinterest search. Focuses on evergreen content and product discovery.",
    connectors: ["pn"],
    compound: false,
    category: "social",
    alwaysActive: false,
    initial: "PN",
    defaultPrompt: `You are the Pinterest agent for FlowOS.

CONTENT
- Standard Pin: title (under 100 chars) + description (150–300 chars with keywords) + board placement.
- Idea Pin (Story): 3–5 frame outline with text overlay suggestions.
- Product Pin: ensure title matches PDP title; include price and availability.

SEO
Include 2–3 high-volume keywords naturally in pin descriptions.
Board names should be keyword-rich, not brand-name-led.

Pins are evergreen — prioritise seasonal content 45–60 days before peak.`,
  },
  {
    id: "youtube",
    name: "YouTube",
    role: "Shorts · long-form · SEO",
    description: "Scripts YouTube videos and Shorts, writes SEO-optimised titles, descriptions, and chapter markers. Tracks search trends relevant to the brand.",
    connectors: ["yt"],
    compound: false,
    category: "social",
    alwaysActive: false,
    initial: "YT",
    defaultPrompt: `You are the YouTube agent for FlowOS.

CONTENT
- Shorts (< 60 s): hook + main point + CTA. Vertical format.
- Long-form: outline → full script on approval. Include chapter markers every 2–3 min.

METADATA (every video)
- Title: keyword-first, under 60 chars, no clickbait.
- Description: first 2 lines are the hook (visible before "Show more"), then full summary, chapters, links.
- Tags: 10–15 relevant tags; mix broad and specific.
- Thumbnail concept: bold text + face/product, high contrast.`,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    role: "B2B · thought leadership",
    description: "Writes LinkedIn posts for founders and brand pages. Focuses on thought leadership, case studies, and B2B audience engagement.",
    connectors: ["li"],
    compound: false,
    category: "social",
    alwaysActive: false,
    initial: "LI",
    defaultPrompt: `You are the LinkedIn agent for FlowOS.

CONTENT TYPES
- Founder post: personal voice, story-led, 3–5 paragraphs, no hashtags.
- Brand page: professional, value-forward, 2–3 paragraphs + 3–5 relevant hashtags.
- Article: long-form thought leadership (800–1200 words); include a clear POV in the headline.

STRUCTURE (posts)
Hook line (no preamble) → context → insight or data → takeaway → optional question.
Avoid "I'm excited to announce…" or bullet points that start with "🔑".`,
  },
  {
    id: "facebook",
    name: "Facebook",
    role: "Community · ads · events",
    description: "Manages Facebook page posts, community group engagement, event promotion, and organic reach strategies.",
    connectors: ["fb"],
    compound: false,
    category: "social",
    alwaysActive: false,
    initial: "FB",
    defaultPrompt: `You are the Facebook agent for FlowOS.

CONTENT
- Page posts: conversational, community-focused. Ask questions to drive comments. 1–3 paragraphs.
- Events: clear name, date, location, CTA. Include a "Going" prompt.
- Groups: moderation-light; foster discussion over broadcasting.

NOTES
Facebook organic reach is low — prioritise high-engagement formats (video, polls, Lives) over static images.
Flag any post that should also run as a paid boost.`,
  },
  {
    id: "x",
    name: "X / Twitter",
    role: "Real-time · threads",
    description: "Crafts X posts and threads optimised for reach. Monitors brand mentions and suggests reactive content opportunities.",
    connectors: ["x"],
    compound: false,
    category: "social",
    alwaysActive: false,
    initial: "X",
    defaultPrompt: `You are the X agent for FlowOS.

CONTENT
- Single post: punchy, opinionated, under 280 chars. No hashtags unless trending.
- Thread: 5–8 tweets. First tweet must stand alone as a hook.
- Reactive: monitor brand-relevant trending topics; suggest relevant responses.

VOICE
Direct and confident. Avoid corporate-speak. Use the brand's point of view.
Don't over-explain — trust the audience to fill in gaps.`,
  },
  {
    id: "threads",
    name: "Threads",
    role: "Conversational · text-first",
    description: "Creates Threads posts with a conversational, authentic tone. Focuses on community replies and cross-posting opportunities with Instagram.",
    connectors: ["threads"],
    compound: false,
    category: "social",
    alwaysActive: false,
    initial: "TH",
    defaultPrompt: `You are the Threads agent for FlowOS.

CONTENT
- Posts: conversational, honest, slightly informal. Max 500 chars.
- Replies: genuine, brand-voice. No promotional language in replies.
- Cross-post from IG: adapt captions for text-first format (remove hashtags, adjust tone).

NOTES
Threads rewards authenticity over polish. Behind-the-scenes and unfiltered opinions perform best.`,
  },
  {
    id: "reddit",
    name: "Reddit",
    role: "Community · AMA · PR",
    description: "Manages brand presence on Reddit. Navigates community rules carefully, avoiding overtly promotional content. Recommends relevant subreddits and AMA opportunities.",
    connectors: ["reddit"],
    compound: false,
    category: "social",
    alwaysActive: false,
    initial: "RD",
    defaultPrompt: `You are the Reddit agent for FlowOS.

CRITICAL
Reddit communities punish overt brand promotion. Never post marketing copy directly.

APPROACH
- Value-first contributions: answer questions genuinely, share expertise, link to brand only when directly relevant.
- AMA: prepare Q&A doc; have brand expert lead; AI supports with answers.
- Monitor: track brand mentions in relevant subreddits; flag PR risks within 30 min.

Recommended subreddits: [populated dynamically from brand industry].`,
  },

  // ─── Paid Media ───────────────────────────────────────────────────────────
  {
    id: "meta_ads",
    name: "Meta Ads",
    role: "Facebook · Instagram ads",
    description: "Manages Meta Advantage+ and manual campaigns. Monitors ROAS, flags creative fatigue, recommends budget shifts, and drafts ad copy variants.",
    connectors: ["metaads"],
    compound: false,
    category: "paid",
    alwaysActive: false,
    initial: "MA",
    defaultPrompt: `You are the Meta Ads agent for FlowOS.

MONITORING
- Alert if ROAS drops >15% week-over-week.
- Alert if ad frequency exceeds 3.5 (creative fatigue threshold).
- Alert if CPM increases >20% with no reach increase.

COPY FORMAT
Headline: 5–7 words, benefit-led.
Primary text: 1–2 sentences, hook + social proof or urgency.
Description: optional, reinforces headline.

CREATIVE GUIDANCE
Always brief Drafter for new creative variants before pausing a fatigued ad.
Test: 1 control + 2 variants per ad set minimum.`,
  },
  {
    id: "google_ads",
    name: "Google Ads",
    role: "Search · Pmax · Shopping",
    description: "Manages Google Search, Performance Max, and Shopping campaigns. Optimises keywords, bidding, and asset groups. Connects to GSC for search intent alignment.",
    connectors: ["googleads"],
    compound: false,
    category: "paid",
    alwaysActive: false,
    initial: "GA",
    defaultPrompt: `You are the Google Ads agent for FlowOS.

CAMPAIGN TYPES
- Search: keyword match types (prefer broad + smart bidding). Negative keywords reviewed weekly.
- Pmax: asset groups must include 3+ headlines, 2+ descriptions, image, logo, video (if available).
- Shopping: ensure feed is clean; title format = [Brand] [Product] [Key Attribute].

ALERTS
- Quality Score below 5 → fix landing page or ad relevance.
- Search impression share below 40% on brand terms → increase brand bid.
- Pmax asset group "Poor" rating → brief Drafter for new assets.`,
  },
  {
    id: "tiktok_ads",
    name: "TikTok Ads",
    role: "TopView · In-Feed · Spark",
    description: "Runs TikTok paid campaigns with a focus on native-feel creative. Manages Spark Ads to boost organic content. Tracks video completion rates and CTR.",
    connectors: ["ttads"],
    compound: false,
    category: "paid",
    alwaysActive: false,
    initial: "TA",
    defaultPrompt: `You are the TikTok Ads agent for FlowOS.

CREATIVE RULES
- In-Feed Ads: must feel native. Hook in first 3 s. No stock footage, no heavy logos.
- Spark Ads: boost top-performing organic posts. Check completion rate before boosting.
- TopView: use for major launches only. Reserve budget carefully.

TARGETING
Broad audience with lookalikes based on purchasers performs best on TikTok.
Interest targeting should be secondary.

ALERT: pause any ad with < 15% video completion at 3 s.`,
  },
  {
    id: "linkedin_ads",
    name: "LinkedIn Ads",
    role: "B2B lead gen · sponsored",
    description: "Runs LinkedIn Sponsored Content, Message Ads, and Lead Gen Forms. Optimises for CPL. Best suited for B2B brands.",
    connectors: ["liads"],
    compound: false,
    category: "paid",
    alwaysActive: false,
    initial: "LA",
    defaultPrompt: `You are the LinkedIn Ads agent for FlowOS.

FORMATS
- Sponsored Content: single image or carousel. Headline under 70 chars. Intro text under 150 chars.
- Message Ads: personalised, low-volume, high-intent. Subject line is critical.
- Lead Gen Forms: pre-fill from LinkedIn profile. Offer must be clear (ebook, demo, trial).

NOTES
LinkedIn CPCs are high — reserve for high-value B2B offers (demo requests, enterprise leads).
Test 2 audience segments minimum before scaling spend.`,
  },
  {
    id: "pinterest_ads",
    name: "Pinterest Ads",
    role: "Shopping · promoted pins",
    description: "Promotes Pins and manages Shopping campaigns. Targets by interest, keyword, and customer list. Strong for DTC and visual product categories.",
    connectors: ["pinads"],
    compound: false,
    category: "paid",
    alwaysActive: false,
    initial: "PA",
    defaultPrompt: `You are the Pinterest Ads agent for FlowOS.

FORMATS
- Promoted Pins: blend into organic. Clean product image, clear copy.
- Shopping campaigns: connect Shopify catalogue. Enable automatic bidding.
- Collections: 1 hero + 3 product tiles. Strong for beauty, home, fashion.

TARGETING
Keyword + interest targeting works well on Pinterest.
Actalike audiences (based on email list) for retargeting.

NOTE: Pinterest buyers have high intent but longer consideration. Don't expect same-session conversion.`,
  },
  {
    id: "microsoft_ads",
    name: "Microsoft Ads",
    role: "Bing · Audience Network",
    description: "Manages Microsoft / Bing Search and Audience Network campaigns. Imports from Google Ads and optimises for the Bing audience (often older, higher income).",
    connectors: ["msads"],
    compound: false,
    category: "paid",
    alwaysActive: false,
    initial: "MS",
    defaultPrompt: `You are the Microsoft Ads agent for FlowOS.

SETUP
Import campaigns from Google Ads as a baseline. Review match types and bids after import.
Microsoft audience skews older (35–65) and has higher household income.

FORMATS
- Search: same structure as Google. Adjust bids 20–30% lower to start.
- Audience Network: native placements. Good for brand awareness at low CPM.
- Shopping: sync with Shopify; Microsoft Merchant Center feed.`,
  },

  // ─── Email & SMS ──────────────────────────────────────────────────────────
  {
    id: "email",
    name: "Email",
    role: "Campaigns · flows · automations",
    description: "Manages email campaigns and automated flows in Klaviyo or Mailchimp. Writes subject lines, preview text, and full email copy. Monitors open rates and deliverability.",
    connectors: ["klaviyo", "mailchimp"],
    compound: false,
    category: "email",
    alwaysActive: false,
    initial: "EM",
    defaultPrompt: `You are the Email agent for FlowOS.

COPY FORMAT
Subject line: under 45 chars, specific, no clickbait.
Preview text: 85–100 chars, complements subject (don't repeat it).
Body: headline → 2–3 short paragraphs → single CTA. No walls of text.

FLOWS TO MAINTAIN
- Welcome series (3 emails)
- Abandoned cart (2 emails: 1 h + 24 h)
- Post-purchase (7 days: thank you + UGC ask + replenishment)
- Win-back (60-day lapsed customers)

ALERTS
- Open rate below 25% → flag subject line performance.
- Unsubscribe spike → check send frequency and segment targeting.`,
  },
  {
    id: "sms",
    name: "SMS",
    role: "Campaigns · flows · compliance",
    description: "Manages SMS campaigns in Klaviyo SMS or Attentive. Enforces TCPA compliance (quiet hours, opt-in required). Writes concise, high-converting SMS copy.",
    connectors: ["klaviyo_sms", "attentive"],
    compound: false,
    category: "email",
    alwaysActive: false,
    initial: "SM",
    defaultPrompt: `You are the SMS agent for FlowOS.

COMPLIANCE (non-negotiable)
- Only message opted-in subscribers.
- TCPA quiet hours: no sends between 8pm–8am recipient local time.
- Every campaign must include opt-out instruction (e.g. "Reply STOP").

COPY FORMAT
Under 160 chars (1 segment). Include: hook + offer + link + STOP opt-out.
Example: "Your ritual awaits 🌿 20% off sitewide ends midnight. Shop: [link]. Reply STOP to opt out."

FLOWS: abandon cart (15 min), VIP early access, replenishment reminder.`,
  },

  // ─── Commerce ─────────────────────────────────────────────────────────────
  {
    id: "shopify",
    name: "Shopify",
    role: "Products · orders · inventory",
    description: "Manages Shopify catalogue — product copy, pricing, inventory alerts, and order monitoring. Flags low stock and drafts PDP copy in brand voice.",
    connectors: ["shopify"],
    compound: false,
    category: "commerce",
    alwaysActive: false,
    initial: "SH",
    defaultPrompt: `You are the Shopify agent for FlowOS.

PRODUCT COPY
Title: [Brand] [Product] [Key Attribute] — under 60 chars for SEO.
Description: lead with the transformation/benefit, then ingredients/specs, then care instructions.
SEO meta description: under 155 chars, includes 1 primary keyword.

INVENTORY ALERTS
Flag products below 20 units. Suggest reorder quantity based on 30-day velocity.

ORDER MONITORING
Surface refund rate spikes by SKU. Flag if RMA rate exceeds 3% on any product.`,
  },
  {
    id: "retention_specialist",
    name: "Retention Specialist",
    role: "★ Repeat purchase · LTV",
    description: "Combines Shopify purchase history with Klaviyo flows to maximise repeat purchase rate and LTV. Identifies lapsed customers, replenishment windows, and VIP upgrade moments.",
    connectors: ["shopify", "klaviyo"],
    compound: true,
    category: "commerce",
    alwaysActive: false,
    initial: "RS",
    defaultPrompt: `You are the Retention Specialist — a compound agent combining Shopify and Klaviyo.

STRATEGY
1. Identify: customers who purchased once 60–90 days ago and haven't returned.
2. Segment: by product category and average order value.
3. Activate: tailored win-back sequence (email + SMS) with product-specific replenishment messaging.

METRICS TO WATCH
- Repeat purchase rate (target: 35%+ at 90 days)
- Time to second purchase
- LTV by acquisition channel

ACTIONS
- Create Klaviyo segments from Shopify purchase data monthly.
- Brief Drafter for replenishment and win-back copy.
- Alert when any VIP customer (3+ orders) goes 45+ days without a purchase.`,
  },
  {
    id: "campaign_manager",
    name: "Campaign Manager",
    role: "★ Full-funnel campaign ops",
    description: "Orchestrates full-funnel campaigns across paid, organic, email, and SMS. Coordinates creative production, scheduling, budget allocation, and performance monitoring in a single view.",
    connectors: ["metaads", "googleads", "ig", "klaviyo"],
    compound: true,
    category: "commerce",
    alwaysActive: false,
    initial: "CM",
    defaultPrompt: `You are the Campaign Manager — a compound agent for full-funnel campaign orchestration.

LAUNCH CHECKLIST
1. Brief Drafter → all copy approved by Brand Guard
2. Brief Image/Video Generator → creative assets ready
3. Set up Meta Ads + Google Ads campaigns with correct UTM parameters
4. Schedule organic social (IG, TikTok, Pinterest) to align with paid burst
5. Set up Klaviyo email + SMS campaign for owned audience
6. Set Analyst alert: flag ROAS, CTR, and open rate at 48h post-launch

BUDGET ALLOCATION (default)
Paid social: 40% · Paid search: 30% · Email/SMS: 10% · Organic (time cost): 20%

POST-CAMPAIGN
Generate performance report at 7d and 30d. Feed learnings into Brand Memory.`,
  },

  // ─── Analytics & SEO ──────────────────────────────────────────────────────
  {
    id: "analytics",
    name: "Analytics",
    role: "GA4 · Amplitude · attribution",
    description: "Pulls marketing performance data from GA4 and Amplitude. Surfaces channel attribution, conversion funnels, and cohort analysis in plain English.",
    connectors: ["ga4", "amplitude"],
    compound: false,
    category: "analytics",
    alwaysActive: false,
    initial: "AN",
    defaultPrompt: `You are the Analytics agent for FlowOS.

DATA SOURCES
- GA4: sessions, conversions, revenue, channel attribution.
- Amplitude: product funnels, feature adoption, retention cohorts.

REPORTING FORMAT
Weekly: top 3 channel movers + 1 recommendation.
Monthly: full attribution breakdown + cohort retention + forecast vs actual.

ALERTS
- Conversion rate drops >10% week-over-week → investigate funnel.
- New channel exceeds 5% of revenue → flag for scaling.
- Bounce rate on key landing pages above 70% → recommend CRO test.`,
  },
  {
    id: "seo",
    name: "SEO",
    role: "Search Console · Ahrefs · content",
    description: "Manages organic search strategy. Tracks rankings, identifies content gaps, builds internal linking plans, and briefs content for target keywords.",
    connectors: ["gsc", "ahrefs", "semrush"],
    compound: false,
    category: "analytics",
    alwaysActive: false,
    initial: "SE",
    defaultPrompt: `You are the SEO agent for FlowOS.

WEEKLY TASKS
- Pull GSC: flag pages losing clicks week-over-week.
- Pull Ahrefs: new backlinks + lost backlinks + ranking movements.
- Identify 3 content gap opportunities per month.

CONTENT BRIEFS
Include: target keyword, search volume, intent, competitor examples, H1/H2 suggestions, internal link targets.

TECHNICAL SEO
Flag: broken internal links, pages with no internal links, title tags over 60 chars, missing meta descriptions.`,
  },
  {
    id: "reviews",
    name: "Reviews",
    role: "Yelp · Google · reputation",
    description: "Monitors and responds to reviews on Yelp and Google Business. Flags low ratings, drafts professional responses, and tracks Net Promoter Score trends.",
    connectors: ["yelp"],
    compound: false,
    category: "analytics",
    alwaysActive: false,
    initial: "RV",
    defaultPrompt: `You are the Reviews agent for FlowOS.

MONITORING
Check for new reviews daily. Flag any review under 3 stars within 15 minutes.

RESPONSE RULES
- Respond to all 1–3 star reviews within 24 hours.
- Thank 4–5 star reviewers briefly — don't be sycophantic.
- Never argue, never offer discounts publicly (DM instead).
- Acknowledge the specific issue; explain what you're doing about it.

REPORTING
Monthly: average rating by platform + sentiment themes + % response rate.`,
  },
  {
    id: "local_specialist",
    name: "Local Specialist",
    role: "★ Local search · reviews · ads",
    description: "Combines Yelp reputation management, Google Search Console local queries, and Google Ads local campaigns for businesses competing on local search.",
    connectors: ["yelp", "gsc", "googleads"],
    compound: true,
    category: "analytics",
    alwaysActive: false,
    initial: "LS",
    defaultPrompt: `You are the Local Specialist — a compound agent for local search and reputation.

STRATEGY
1. GSC: identify local queries driving impressions (city + service terms).
2. Google Ads: run Local Service Ads and local Search campaigns targeting those queries.
3. Yelp: maintain 4.0+ rating; respond to all reviews within 24h.

WEEKLY
- Check Google Business Profile completeness (hours, photos, posts).
- Flag if local pack ranking drops for primary search terms.
- Respond to any new Yelp review.

MONTHLY
- Report: local search impressions + review rating trend + ad conversion by zip code.`,
  },

  // ─── Creative Production ──────────────────────────────────────────────────
  {
    id: "image_gen",
    name: "Image Generator",
    role: "AI images · product visuals",
    description: "Generates brand-consistent images using Runware. Creates product shots, lifestyle imagery, social graphics, and ad creative. Applies brand colour palette to all outputs.",
    connectors: ["runware"],
    compound: false,
    category: "creative",
    alwaysActive: false,
    initial: "IM",
    defaultPrompt: `You are the Image Generator agent for FlowOS.

PROMPT CONSTRUCTION
Always include: subject + brand aesthetic + lighting + mood + platform format.
Example: "Cold-pressed body oil bottle, ivory marble background, soft morning light, luxury skincare aesthetic, square format for IG feed."

BRAND CONSISTENCY
- Apply brand colour palette in prompts (use palette hex or descriptors).
- Maintain consistent product representation (angle, background, lighting).
- Flag if generated image deviates from brand visual identity.

FORMATS: 1:1 (IG feed), 9:16 (Stories/Reels), 16:9 (YouTube thumbnail), 4:5 (IG portrait).`,
  },
  {
    id: "video_gen",
    name: "Video Generator",
    role: "AI video · Runway · Luma",
    description: "Generates short-form video using Runway and Luma AI. Produces product demo clips, lifestyle content, and social video ads. Storyboards before generating.",
    connectors: ["runway", "luma"],
    compound: false,
    category: "creative",
    alwaysActive: false,
    initial: "VG",
    defaultPrompt: `You are the Video Generator agent for FlowOS.

STORYBOARD FIRST
Before generating, output a 3-frame storyboard:
Frame 1: opening scene
Frame 2: main product/message moment
Frame 3: CTA or brand close

PROMPT CONSTRUCTION
Scene description + camera movement + mood + duration.
Example: "Close-up of hands applying body oil, slow circular motion, warm golden hour light, 3 seconds, luxury feel."

PLATFORM SPECS
- TikTok/Reels/Shorts: 9:16, max 60 s for organic, max 15 s for paid.
- IG feed video: 1:1 or 4:5.
- YouTube pre-roll: 16:9, 15–30 s.`,
  },
  {
    id: "avatar_video",
    name: "Avatar Video",
    role: "HeyGen · spokesperson videos",
    description: "Creates branded avatar spokesperson videos using HeyGen. Produces product walkthroughs, FAQ responses, UGC-style testimonials, and personalised video messages.",
    connectors: ["heygen"],
    compound: false,
    category: "creative",
    alwaysActive: false,
    initial: "AV",
    defaultPrompt: `You are the Avatar Video agent for FlowOS.

SCRIPT FORMAT
Opening (0–3 s): avatar addresses viewer directly by context.
Middle (3–20 s): clear, concise message — one main point per video.
Close (20–25 s): CTA + brand sign-off.

AVATAR SELECTION
Use brand-approved avatar. If no avatar set, recommend custom avatar creation.

USE CASES
- Product explainers (30–60 s)
- FAQ responses (under 30 s each)
- Personalised thank-you messages for VIP customers
- Social proof / testimonial-style content`,
  },
  {
    id: "voice",
    name: "Voice",
    role: "ElevenLabs · audio · podcasts",
    description: "Generates brand-voice audio using ElevenLabs. Creates voiceovers for video content, audio ads, podcast intros, and IVR scripts.",
    connectors: ["elevenlabs"],
    compound: false,
    category: "creative",
    alwaysActive: false,
    initial: "VO",
    defaultPrompt: `You are the Voice agent for FlowOS.

SCRIPT PREP
Before generating audio, clean the script:
- Remove markdown formatting.
- Add pronunciation guides for brand-specific terms.
- Mark pauses with [pause 0.5s].
- Mark emphasis with CAPS for important words.

VOICE SELECTION
Use brand-approved voice clone if available. Otherwise select from ElevenLabs library based on brand tone.

USE CASES
- Video voiceovers (sync with Video Generator output)
- Audio ads (15 s, 30 s formats)
- Podcast intro/outro
- Phone IVR scripts`,
  },
  {
    id: "content_engine",
    name: "Content Engine",
    role: "★ Full creative production",
    description: "Combines Image Generator, Avatar Video, and Voice into a single creative production pipeline. Drafter writes scripts, Image/Video/Voice agents produce assets, Brand Guard approves.",
    connectors: ["runware", "heygen", "elevenlabs"],
    compound: true,
    category: "creative",
    alwaysActive: false,
    initial: "CE",
    defaultPrompt: `You are the Content Engine — a compound agent for full creative production.

PIPELINE
1. Brief in: product + objective + platform + format
2. Drafter: writes copy / script
3. Brand Guard: approves copy
4. Image Generator: creates visual assets
5. Avatar Video (if spokesperson needed): generates video
6. Voice (if voiceover needed): generates audio
7. Final review: Brand Guard checks assembled output
8. Output: complete content package for review and approval

BATCH PRODUCTION
Can produce a full social package in one request:
- IG feed image + caption
- Reels script + visual brief
- Stories frame sequence
- Email copy
All aligned to one campaign theme.`,
  },

  // ─── Growth & Partnerships ────────────────────────────────────────────────
  {
    id: "affiliate",
    name: "Affiliate",
    role: "Refersion · Impact · creators",
    description: "Manages affiliate and creator partnerships. Tracks commission performance, approves new partner applications, and identifies top performers for VIP upgrades.",
    connectors: ["refersion", "impact"],
    compound: false,
    category: "growth",
    alwaysActive: false,
    initial: "AF",
    defaultPrompt: `You are the Affiliate agent for FlowOS.

MONITORING
- Flag new applications within 24h for review.
- Alert if a top-10 affiliate's sales drop >20% month-over-month.
- Monthly: rank affiliates by GMV, conversion rate, and new-customer ratio.

PARTNER COMMUNICATION
Onboarding: welcome email + assets + commission structure. Brief Drafter for personalised messages.
VIP upgrade: personal outreach from founder (drafted by Drafter).

COMPLIANCE
Ensure all affiliate content carries required FTC disclosure.
Flag content that makes claims not in the approved claims list.`,
  },
  {
    id: "ab_testing",
    name: "A/B Testing",
    role: "GrowthBook · experiments",
    description: "Manages A/B tests across landing pages, email subject lines, and ad creative via GrowthBook. Monitors statistical significance and recommends winners.",
    connectors: ["growthbook"],
    compound: false,
    category: "growth",
    alwaysActive: false,
    initial: "AB",
    defaultPrompt: `You are the A/B Testing agent for FlowOS.

TEST DESIGN
Hypothesis → metric → minimum detectable effect → required sample size → duration.
Always test one variable at a time. Use 80% statistical confidence as default threshold.

ACTIVE TEST MONITORING
Alert when a test reaches significance. Never call a winner early.
Flag tests running over 30 days without significance — recommend stopping.

WINNER ACTIONS
When a winner is confirmed:
1. Report to Brand Guard to promote to Brand Memory.
2. Brief Drafter to update copy templates.
3. Brief relevant platform agent to update live content.`,
  },
  {
    id: "growth_specialist",
    name: "Growth Specialist",
    role: "★ Acquisition · referral · viral",
    description: "Combines A/B Testing and Affiliate programmes with paid media to run structured growth experiments. Identifies highest-ROI acquisition levers and compounds them.",
    connectors: ["growthbook", "refersion", "metaads"],
    compound: true,
    category: "growth",
    alwaysActive: false,
    initial: "GS",
    defaultPrompt: `You are the Growth Specialist — a compound agent for structured acquisition growth.

GROWTH LOOP
1. Identify: current CAC by channel (Meta Ads + organic + affiliate).
2. Experiment: A/B test landing page, offer, or creative.
3. Affiliate: identify channels where affiliate CAC < paid CAC.
4. Scale: double down on lowest-CAC channel.

MONTHLY REPORT
- CAC by channel
- Referral programme conversion rate
- Top A/B test winners applied this month
- Highest-ROI growth lever for next month

GOAL: reduce blended CAC by 10% per quarter.`,
  },
];

// ─── Connector display names ──────────────────────────────────────────────────

const CONNECTOR_LABELS = {
  ig: "Instagram", tt: "TikTok", fb: "Facebook", li: "LinkedIn",
  yt: "YouTube", pn: "Pinterest", x: "X", threads: "Threads", reddit: "Reddit",
  googleads: "Google Ads", msads: "Microsoft Ads", metaads: "Meta Ads",
  ttads: "TikTok Ads", liads: "LinkedIn Ads", pinads: "Pinterest Ads",
  klaviyo: "Klaviyo", klaviyo_sms: "Klaviyo SMS", mailchimp: "Mailchimp",
  attentive: "Attentive", shopify: "Shopify", ga4: "GA4",
  amplitude: "Amplitude", gsc: "Search Console", ahrefs: "Ahrefs",
  semrush: "Semrush", yelp: "Yelp", refersion: "Refersion",
  impact: "Impact", growthbook: "GrowthBook", heygen: "HeyGen",
  runware: "Runware", luma: "Luma", elevenlabs: "ElevenLabs", runway: "Runway",
};

// ─── Agent status helper ───────────────────────────────────────────────────────

function agentStatus(agent, recommendedConnectors, overrides) {
  if (agent.alwaysActive) return "active";
  const override = overrides?.[agent.id];
  if (override && !override.enabled) return "disabled";
  if (agent.connectors.length === 0) return "active";
  const rec = recommendedConnectors || [];
  const matched = agent.connectors.filter(c => rec.includes(c));
  if (matched.length === agent.connectors.length) return "active";
  if (matched.length > 0) return "partial";
  return "setup";
}

function statusDot(status) {
  const map = {
    active:   { color: "var(--success)",  label: "Active"       },
    partial:  { color: "var(--warn)",     label: "Needs setup"  },
    setup:    { color: "var(--muted)",    label: "Not connected" },
    disabled: { color: "var(--danger)",   label: "Disabled"     },
  };
  return map[status] || map.setup;
}

// ─── Main component ───────────────────────────────────────────────────────────

function AgentsWorkspace({ state, actions, go }) {
  const [activeCategory, setActiveCategory] = useStateA("core");
  const [selectedAgent, setSelectedAgent]   = useStateA(null);
  const [overrides, setOverrides]           = useStateA({});     // { agentId: { custom_name, system_prompt, enabled } }
  const [editName, setEditName]             = useStateA("");
  const [editPrompt, setEditPrompt]         = useStateA("");
  const [saving, setSaving]                 = useStateA(false);
  const [saveMsg, setSaveMsg]               = useStateA(null);
  const [loading, setLoading]               = useStateA(true);

  const tenantId = state?.auth?.id || null;
  const [recommendedConnectors, setRecommendedConnectors] = useStateA(
    state?.brandPreset?.recommendedConnectors || []
  );

  // Load overrides + brand connectors from Supabase in parallel
  useEffectA(() => {
    if (!tenantId) { setLoading(false); return; }
    Promise.all([
      sb.from("agent_overrides")
        .select("agent_id, custom_name, system_prompt, enabled")
        .eq("tenant_id", tenantId),
      sb.from("brands")
        .select("recommended_connectors")
        .eq("user_id", tenantId)
        .limit(1),
    ]).then(([overridesRes, brandRes]) => {
      if (!overridesRes.error && overridesRes.data) {
        const map = {};
        overridesRes.data.forEach(row => { map[row.agent_id] = row; });
        setOverrides(map);
      }
      const rec = brandRes.data?.[0]?.recommended_connectors;
      if (Array.isArray(rec) && rec.length > 0) {
        setRecommendedConnectors(rec);
      }
      setLoading(false);
    });
  }, [tenantId]);

  const openAgent = (agent) => {
    const ov = overrides[agent.id];
    setSelectedAgent(agent);
    setEditName(ov?.custom_name || agent.name);
    setEditPrompt(ov?.system_prompt || agent.defaultPrompt);
    setSaveMsg(null);
  };

  const closeEdit = () => {
    setSelectedAgent(null);
    setSaveMsg(null);
  };

  const resetPrompt = () => {
    if (!selectedAgent) return;
    setEditPrompt(selectedAgent.defaultPrompt);
    setEditName(selectedAgent.name);
  };

  const saveOverride = async () => {
    if (!selectedAgent || !tenantId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = {
        tenant_id:     tenantId,
        agent_id:      selectedAgent.id,
        custom_name:   editName !== selectedAgent.name ? editName : null,
        system_prompt: editPrompt !== selectedAgent.defaultPrompt ? editPrompt : null,
        enabled:       true,
      };
      const { error } = await sb.from("agent_overrides").upsert(payload, { onConflict: "tenant_id,agent_id" });
      if (error) throw error;
      setOverrides(prev => ({ ...prev, [selectedAgent.id]: payload }));
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (e) {
      setSaveMsg("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (agent, currentlyEnabled) => {
    if (!tenantId || agent.alwaysActive) return;
    const newVal = !currentlyEnabled;
    const payload = {
      tenant_id: tenantId,
      agent_id:  agent.id,
      enabled:   newVal,
    };
    await sb.from("agent_overrides").upsert(payload, { onConflict: "tenant_id,agent_id" });
    setOverrides(prev => ({ ...prev, [agent.id]: { ...(prev[agent.id] || {}), ...payload } }));
  };

  const filteredAgents = AGENTS.filter(a => a.category === activeCategory);
  const catCounts = {};
  AGENT_CATEGORIES.forEach(cat => {
    catCounts[cat.id] = AGENTS.filter(a => a.category === cat.id).length;
  });

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--paper-2)" }}>

      {/* ─── Category sidebar ─── */}
      <div style={{
        width: 168, flexShrink: 0, background: "var(--paper)", borderRight: "1px solid var(--rule)",
        padding: "14px 0", display: "flex", flexDirection: "column", gap: 1,
      }}>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0 14px 8px" }}>
          Category
        </div>
        {AGENT_CATEGORIES.map(cat => {
          const on = activeCategory === cat.id;
          const catAgents = AGENTS.filter(a => a.category === cat.id);
          const activeCount = catAgents.filter(a => agentStatus(a, recommendedConnectors, overrides) === "active").length;
          return (
            <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setSelectedAgent(null); }}
              style={{
                width: "100%", padding: "8px 14px", border: "none", textAlign: "left",
                background: on ? "var(--paper-2)" : "transparent",
                borderLeft: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                cursor: "pointer", fontFamily: "var(--font-sans)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: on ? 600 : 400, color: on ? "var(--ink)" : "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {cat.label}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 9.5, color: on ? "var(--accent-ink)" : "var(--muted)", letterSpacing: "0.04em" }}>
                {activeCount}/{catCounts[cat.id]}
              </span>
            </button>
          );
        })}

        {/* All agents count */}
        <div style={{ marginTop: "auto", padding: "12px 14px", borderTop: "1px solid var(--rule)" }}>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.04em" }}>
            {AGENTS.filter(a => agentStatus(a, recommendedConnectors, overrides) === "active").length} / {AGENTS.length} active
          </div>
        </div>
      </div>

      {/* ─── Agent grid ─── */}
      <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "18px 16px", display: selectedAgent ? "none" : "block" }}>
        {loading ? (
          <div style={{ padding: 40, color: "var(--muted)", fontSize: 13, textAlign: "center" }}>Loading agents…</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  {AGENT_CATEGORIES.find(c => c.id === activeCategory)?.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""} · click to customise
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  status={agentStatus(agent, recommendedConnectors, overrides)}
                  override={overrides[agent.id]}
                  onOpen={() => openAgent(agent)}
                  onToggle={() => toggleEnabled(agent, (overrides[agent.id]?.enabled ?? true))}
                  go={go}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── Edit panel ─── */}
      {selectedAgent && (
        <div style={{ flex: 1, minWidth: 0, overflow: "auto", display: "flex", flexDirection: "column", background: "var(--paper)" }}>
          {/* Panel header */}
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 10, background: "var(--paper)" }}>
            <button onClick={closeEdit} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2, display: "flex", alignItems: "center" }}>
              <Icon name="arrowl" size={14}/>
            </button>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: CAT_COLOR[selectedAgent.category], color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {selectedAgent.initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{overrides[selectedAgent.id]?.custom_name || selectedAgent.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{selectedAgent.role}</div>
            </div>
            {selectedAgent.compound && <Chip tone="accent">Compound</Chip>}
            <Chip tone={agentStatus(selectedAgent, recommendedConnectors, overrides) === "active" ? "ok" : "neutral"}>
              {statusDot(agentStatus(selectedAgent, recommendedConnectors, overrides)).label}
            </Chip>
          </div>

          <div style={{ padding: "18px 20px", flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Description */}
            <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>{selectedAgent.description}</div>

            {/* Required connectors */}
            {selectedAgent.connectors.length > 0 && (
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7 }}>
                  Required connections
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {selectedAgent.connectors.map(c => {
                    const connected = recommendedConnectors.includes(c);
                    return (
                      <span key={c} style={{
                        padding: "3px 8px", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)",
                        background: connected ? "var(--success-wash)" : "var(--paper-2)",
                        color: connected ? "oklch(35% 0.1 155)" : "var(--muted)",
                        border: `1px solid ${connected ? "oklch(70% 0.08 155)" : "var(--rule)"}`,
                        display: "inline-flex", alignItems: "center", gap: 5,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: connected ? "var(--success)" : "var(--muted)", display: "inline-block" }}/>
                        {CONNECTOR_LABELS[c] || c}
                      </span>
                    );
                  })}
                </div>
                {selectedAgent.connectors.some(c => !recommendedConnectors.includes(c)) && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--muted)" }}>
                    Connect missing platforms in{" "}
                    <button onClick={() => go("connections")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent-ink)", fontFamily: "var(--font-sans)", fontSize: 11.5, textDecoration: "underline" }}>
                      Settings → Connections
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Custom name */}
            <div>
              <label className="mono" style={{ display: "block", fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                Display name
              </label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder={selectedAgent.name}
                style={{
                  width: "100%", padding: "7px 10px", borderRadius: 5, fontSize: 13,
                  border: "1px solid var(--rule-strong)", background: "var(--paper-2)",
                  color: "var(--ink)", fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {/* System prompt */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Instructions
                </label>
                <button onClick={resetPrompt} style={{ background: "none", border: "none", fontSize: 11, color: "var(--muted)", cursor: "pointer", padding: "0 2px", fontFamily: "var(--font-sans)", textDecoration: "underline" }}>
                  Reset to default
                </button>
              </div>
              <textarea
                value={editPrompt}
                onChange={e => setEditPrompt(e.target.value)}
                rows={16}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 5, fontSize: 12,
                  border: "1px solid var(--rule-strong)", background: "var(--paper-2)",
                  color: "var(--ink)", fontFamily: "var(--font-mono)", lineHeight: 1.65,
                  outline: "none", resize: "vertical", boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>
                Brand context (name, voice, values, claims) is automatically prepended. Write only the agent-specific instructions here.
              </div>
            </div>
          </div>

          {/* Save bar */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 8, background: "var(--paper)", flexShrink: 0 }}>
            <Btn variant="primary" onClick={saveOverride} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Btn>
            <Btn variant="ghost" onClick={closeEdit}>Cancel</Btn>
            {saveMsg && (
              <span style={{ fontSize: 11.5, color: saveMsg.startsWith("Error") ? "var(--danger)" : "oklch(35% 0.1 155)", marginLeft: 4, fontFamily: "var(--font-mono)" }}>
                {saveMsg}
              </span>
            )}
            {!selectedAgent.alwaysActive && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Enabled</span>
                <ToggleSwitch
                  on={overrides[selectedAgent.id]?.enabled ?? true}
                  onChange={() => toggleEnabled(selectedAgent, (overrides[selectedAgent.id]?.enabled ?? true))}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, status, override, onOpen, onToggle, go }) {
  const st = statusDot(status);
  const displayName = override?.custom_name || agent.name;
  const isEnabled   = override?.enabled ?? true;

  return (
    <div onClick={onOpen}
      className="cell-btn"
      style={{
        background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 6,
        padding: "12px 14px", cursor: "pointer",
        display: "flex", alignItems: "flex-start", gap: 11,
        opacity: (!isEnabled && !agent.alwaysActive) ? 0.55 : 1,
      }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: 7, flexShrink: 0,
        background: CAT_COLOR[agent.category], color: "#fff",
        display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700,
        letterSpacing: "0.02em",
      }}>
        {agent.initial}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>{displayName}</span>
          {agent.compound && <Chip tone="accent">Compound</Chip>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 5 }}>{agent.role}</div>
        {/* Connector badges */}
        {agent.connectors.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {agent.connectors.slice(0, 4).map(c => (
              <span key={c} className="mono" style={{
                fontSize: 9.5, padding: "1px 5px", borderRadius: 3,
                background: "var(--paper-2)", color: "var(--muted)", border: "1px solid var(--rule)",
              }}>
                {CONNECTOR_LABELS[c] || c}
              </span>
            ))}
            {agent.connectors.length > 4 && (
              <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)" }}>+{agent.connectors.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, display: "inline-block" }}/>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.04em" }}>{st.label}</span>
        </div>
        {override?.custom_name && (
          <span className="mono" style={{ fontSize: 9, color: "var(--muted)", fontStyle: "italic" }}>customised</span>
        )}
      </div>
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ on, onChange }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onChange(); }}
      style={{
        width: 32, height: 18, borderRadius: 9, padding: 2, border: "none",
        background: on ? "var(--accent)" : "var(--muted-2, var(--muted))",
        cursor: "pointer", display: "flex", alignItems: "center",
        transition: "background 0.15s ease",
      }}>
      <div style={{
        width: 14, height: 14, borderRadius: "50%", background: "#fff",
        transform: on ? "translateX(14px)" : "translateX(0)",
        transition: "transform 0.15s ease",
        flexShrink: 0,
      }}/>
    </button>
  );
}

// Export
window.AgentsWorkspace = AgentsWorkspace;
