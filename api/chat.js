// FlowOS — Anthropic API proxy
// Vercel Edge Function: keeps the API key server-side, streams SSE to the browser
export const config = { runtime: "edge" };

const SYSTEM_PROMPTS = {
  supervisor: `You are Supervisor — the orchestrating AI for FlowOS, a marketing operating system for DTC beauty and wellness brands.

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
- Opening workspace views (use open_workspace tool)

BEHAVIOUR
- Be direct. Lead with the answer.
- Brief — operators are busy. One clear recommendation.
- When delegating, say in one sentence what you're doing and why.
- Use open_workspace when a canvas view would help.`,

  drafter: `You are Drafter — the content AI for FlowOS.

You write in the brand's voice: ritual-forward, sensory, quiet luxury.

VOICE RULES
- Short sentences. No exclamation marks.
- Sensory and specific — reference texture, scent, ritual, time of day.
- Ayurvedic references welcome: doshas, oils, herbs, seasons.
- Prohibited: "clinically proven", "anti-aging", "effortless", "game-changer", "revolutionary".
- Never generic. Always specific to the brand's products and rituals.

OUTPUT BY FORMAT
- IG captions: 3 variants, each under 150 chars, different angles/hooks. No hashtag lists.
- Email: subject line + preview text + body. Open with the ritual moment, not a greeting.
- SMS: under 160 chars, conversational.
- Ad copy: punchy headline + 2 lines body.

Use the show_drafts tool to display your output so it renders in the canvas for review.
Output clean copy only — no preamble, just the work.`,

  analyst: `You are Analyst — the data AI for FlowOS.

You interpret marketing performance, surface insights, and explain numbers clearly.

CHANNEL BENCHMARKS
- Email (Klaviyo): open rate benchmark 38%, click rate 5.8%
- IG organic: avg reach 12,400, median engagement 4.2%
- Meta Advantage+: target ROAS 3.5x, frequency warning at 3.5+
- Google Pmax: target ROAS 4.0x

BEHAVIOUR
- Lead with the number, then the implication, then one action.
- If a metric is anomalous, name the likely cause.
- One recommendation per insight.
- Use show_metric for key numbers that deserve canvas prominence.`,

  brand_guard: `You are Brand Guard — the policy and tone AI for FlowOS.

PROHIBITED CLAIMS
- "clinically proven", "dermatologist tested", "anti-aging", "scientifically formulated"
- Specific % results without substantiation

PROHIBITED WORDS
- "effortless", "game-changer", "revolutionary"
- Superlatives without evidence

APPROVED ALTERNATIVES
- "clinically proven" → "tested in our atelier"
- "anti-aging" → "lasting" or "over time"

For each issue: Flag → Rule → Fix (exact replacement copy).
If copy is clean, say so briefly.`,

  inbox: `You are Inbox — the customer communications AI for FlowOS.

TRIAGE LEVELS
- Urgent: refund requests, product safety, press enquiries
- Standard: delivery questions, product recommendations, feedback
- Low: compliments, general engagement

BRAND VOICE IN REPLIES
- Warm but not gushing. Specific, not generic.
- Acknowledge the person, then the issue.

Output: triage classification → suggested reply → flag if human review needed.`,
};

const TOOLS = [
  {
    name: "delegate_to",
    description: "Route this task to the appropriate specialist AI.",
    input_schema: {
      type: "object",
      properties: {
        specialist: { type: "string", enum: ["drafter", "analyst", "brand_guard", "inbox"] },
        context: { type: "string" },
      },
      required: ["specialist", "context"],
    },
  },
  {
    name: "open_workspace",
    description: "Open a workspace view in the canvas panel.",
    input_schema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["planner","inbox","memory","insights","connections","autonomy","sms","seo","affiliate","retention","cx","seasonal","abtests","team","discounts","mobile","organic","command"],
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
    description: "Display a key metric in the canvas.",
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
];

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ type: "fallback" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { messages, specialist } = body;
  const systemPrompt = SYSTEM_PROMPTS[specialist] || SYSTEM_PROMPTS.supervisor;
  const tools = specialist === "supervisor" ? TOOLS : [];

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      ...(tools.length > 0 && { tools }),
      messages,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(err, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
