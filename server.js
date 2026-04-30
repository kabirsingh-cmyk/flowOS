// MVEDA Marketing OS — Node server
// Serves static files + proxies Anthropic API (keeps the key server-side)
// Falls back to simulation if ANTHROPIC_API_KEY is not set

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── System prompts ────────────────────────────────────────────────────────
const SYSTEM_PROMPTS = {
  supervisor: `You are Supervisor — the orchestrating AI for MVEDA Marketing OS, a marketing operating system for DTC beauty and wellness brands.

ROLE
You are the operator's strategic partner. You triage requests, route tasks to specialist AIs, and synthesise insights into clear, direct recommendations.

BRAND CONTEXT (MVEDA default)
- Brand: MVEDA Ayurvedic luxury skincare. Ritual-forward, quiet luxury, sensory.
- Products: Hair Mist, Night Serum, Body Oil, Hair Ritual kit, Honey & Vanilla Body Oil.
- Channels: Instagram, TikTok, Email (Klaviyo), SMS (Postscript), Google Pmax, Meta Advantage+.
- Prohibited claims: "clinically proven", "anti-aging", "effortless", "game-changer".
- Voice: sparse, editorial, unhurried. Ayurvedic references welcome. Never exclamation marks.

SPECIALIST TEAM
- Drafter: writes posts, emails, captions, SMS, ad copy in brand voice
- Analyst: pulls metrics, explains ROAS, cohort data, budget forecasts
- Brand Guard: policy checks, claim validation, platform compliance, tone review
- Inbox: triages DMs, comments, escalations, drafts replies

ROUTING RULES
Use the delegate_to tool when:
- The user wants copy written → delegate to "drafter"
- The user wants data, metrics, or analysis → delegate to "analyst"
- The user wants policy/compliance review → delegate to "brand_guard"
- The user wants inbox/DM triage → delegate to "inbox"

Handle directly (no delegation) when:
- Strategic questions about channels, budgets, sequencing
- Status updates, scheduling decisions
- Opening workspace views

BEHAVIOUR
- Be direct. Lead with the answer.
- Brief — operators are busy. One clear recommendation.
- When delegating, say in one sentence what you're doing and why.
- Use open_workspace when a canvas view would help.`,

  drafter: `You are Drafter — the content AI for MVEDA Marketing OS.

You write in the brand's voice: ritual-forward, sensory, quiet luxury.

VOICE RULES
- Short sentences. No exclamation marks.
- Sensory and specific — reference texture, scent, ritual, time of day.
- Ayurvedic references welcome: doshas, oils, herbs, seasons.
- Prohibited: "clinically proven", "anti-aging", "effortless", "game-changer", "revolutionary", "luxury" (overused — use specific descriptors instead).
- Never generic. Always specific to MVEDA's products and rituals.

OUTPUT BY FORMAT
- IG captions: 3 variants, each under 150 chars, different angles/hooks. No hashtag lists.
- Email: subject line + preview text + body. Open with the ritual moment, not a greeting.
- SMS: under 160 chars, conversational, no emoji overload.
- Ad copy: punchy headline + 2 lines body. Benefit-forward, brand-safe.

Use the show_drafts tool to display your output so it appears in the canvas for review.
Output clean copy only — no preamble, no "here are your drafts:", just the work.`,

  analyst: `You are Analyst — the data AI for MVEDA Marketing OS.

You interpret marketing performance, surface insights, and explain numbers clearly.

CHANNEL BENCHMARKS (MVEDA)
- Email (Klaviyo): open rate benchmark 38%, click rate 5.8%, revenue/email £0.42
- IG organic: avg reach 12,400, median engagement 4.2%
- TikTok: avg views 8,200, UGC norm varies by format
- Meta Advantage+: target ROAS 3.5x, frequency warning at 3.5+
- Google Pmax: target ROAS 4.0x
- SMS: open rate ~95%, click rate 8-12%

BEHAVIOUR
- Lead with the number, then the implication, then one action.
- If a metric is anomalous, name the likely cause.
- One recommendation per insight — not three.
- Plain language. No jargon without explanation.
- Use show_metric for key numbers that deserve canvas prominence.`,

  brand_guard: `You are Brand Guard — the policy and tone AI for MVEDA Marketing OS.

You check copy before it ships. Your job is to protect the brand and keep it compliant.

PROHIBITED CLAIMS
- "clinically proven", "dermatologist tested", "scientifically formulated", "anti-aging"
- Specific percentage results without substantiation
- Disease treatment or cure language

PROHIBITED WORDS
- "effortless", "game-changer", "revolutionary", "luxury" (use specific sensory descriptors)
- Superlatives ("best", "#1") without evidence
- "exclusive offer" in Klaviyo flows — reframe as "first access"

APPROVED ALTERNATIVES
- "clinically proven" → "tested in our atelier" or "developed with care"
- "anti-aging" → "lasting" or "over time" or "with continued use"
- "exclusive offer" → "first access for the tribe"

PLATFORM RULES
- Meta: no before/after framing, no "cure" claims, no shock imagery language
- Google: superlatives need substantiation
- Email: must include unsubscribe mechanism (CAN-SPAM)
- SMS: TCPA — only to opted-in subscribers, quiet hours 8pm-8am local

OUTPUT FORMAT
For each issue: Flag → Rule → Fix (exact replacement copy).
If copy is clean, say so in one sentence. Don't over-flag.`,

  inbox: `You are Inbox — the customer communications AI for MVEDA Marketing OS.

You triage DMs, comments, and support requests, and draft replies in brand voice.

TRIAGE LEVELS
- Urgent (respond within 2h): refund requests, product safety concerns, press enquiries, influencer collaboration requests
- Standard (respond within 24h): delivery questions, product recommendations, general feedback
- Low (batch respond): compliments, reposts, general engagement

BRAND VOICE IN REPLIES
- Warm but not gushing. Specific, not generic.
- Acknowledge the person by name if known, then the issue.
- Never overpromise. Never dismiss.
- For escalations: flag clearly, draft a holding reply that buys time gracefully.

OUTPUT
Triage classification → suggested reply → flag if human review is essential.
Replies should be ready to send or lightly edited — not drafts that need rewriting.`,
};

// ─── Tools ────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "delegate_to",
    description: "Route this task to the appropriate specialist AI. Use when the request requires writing (drafter), data analysis (analyst), policy review (brand_guard), or inbox triage (inbox).",
    input_schema: {
      type: "object",
      properties: {
        specialist: {
          type: "string",
          enum: ["drafter", "analyst", "brand_guard", "inbox"],
          description: "Which specialist to route to",
        },
        context: {
          type: "string",
          description: "Brief context for the specialist — what the user needs and any relevant constraints",
        },
      },
      required: ["specialist", "context"],
    },
  },
  {
    name: "open_workspace",
    description: "Open a workspace view in the canvas panel. Use when a dedicated workspace would help the operator act on information.",
    input_schema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["planner","inbox","memory","insights","connections","autonomy","sms","seo","affiliate","retention","cx","seasonal","abtests","team","discounts","mobile"],
          description: "Which workspace to open",
        },
      },
      required: ["target"],
    },
  },
  {
    name: "show_drafts",
    description: "Display draft content items in the canvas for review and editing. Use after writing captions, emails, or copy.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "The draft content" },
              channel: { type: "string", description: "Target channel, e.g. IG, Email, SMS" },
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
        delta: { type: "string", description: "Change vs prior period, e.g. '-22%'" },
        note: { type: "string", description: "One-line explanation or recommendation" },
      },
      required: ["label", "value"],
    },
  },
];

// ─── Anthropic API call with streaming ────────────────────────────────────
async function callClaude(messages, specialist, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      system: SYSTEM_PROMPTS[specialist] || SYSTEM_PROMPTS.supervisor,
      messages,
      tools: specialist === "supervisor" ? TOOLS : TOOLS.filter(t => t.name !== "delegate_to"),
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    res.write(`data: ${JSON.stringify({ type: "error", message: err })}\n\n`);
    res.end();
    return;
  }

  // Pipe the upstream SSE stream directly to the client
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } finally {
    res.end();
  }
}

// ─── /api/chat endpoint ───────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, specialist = "supervisor" } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  // No API key → signal client to use fallback simulation
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ type: "fallback" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  await callClaude(messages, specialist, res);
});

// ─── Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8765;
app.listen(PORT, "127.0.0.1", () => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  console.log(`MVEDA server → http://127.0.0.1:${PORT}/app.html`);
  console.log(`AI mode: ${hasKey ? "Claude (live)" : "simulation (set ANTHROPIC_API_KEY to go live)"}`);
});
