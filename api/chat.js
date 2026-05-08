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

export const config = { runtime: "edge" };

const COMPOSIO_BASE  = "https://backend.composio.dev/api/v2";
const ANTHROPIC_BASE = "https://api.anthropic.com/v1";

// ─── Composio helpers ─────────────────────────────────────────────────────────

function composioHeaders() {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key) throw new Error("COMPOSIO_API_KEY not set");
  return { "Content-Type": "application/json", "x-api-key": key };
}

/**
 * Fetch Anthropic-compatible tool definitions for a tenant's connected accounts.
 * Returns [] gracefully if Composio not configured or tenant has no connections.
 */
async function fetchComposioTools(tenantId) {
  if (!process.env.COMPOSIO_API_KEY || !tenantId) return [];

  try {
    // Get tenant's active connections
    const connRes = await fetch(
      `${COMPOSIO_BASE}/connectedAccounts?entityId=${tenantId}&showActiveOnly=true`,
      { headers: composioHeaders() }
    );
    if (!connRes.ok) return [];

    const connData = await connRes.json();
    const accounts = connData.items || connData.connectedAccounts || [];
    if (accounts.length === 0) return [];

    // Build app list from connected accounts
    const apps = [...new Set(accounts.map(a => a.appName).filter(Boolean))].join(",");

    // Fetch available actions for connected apps
    const actRes = await fetch(
      `${COMPOSIO_BASE}/actions?apps=${apps}&limit=20&filterByAvailableApps=true`,
      { headers: composioHeaders() }
    );
    if (!actRes.ok) return [];

    const actData = await actRes.json();
    const actions = actData.items || actData.actions || [];

    // Map to Anthropic tool format
    return actions.map(action => ({
      name:         action.name,
      description:  action.description || `Execute ${action.name}`,
      input_schema: action.parameters  || { type: "object", properties: {} },
    }));
  } catch (e) {
    console.error("[chat] fetchComposioTools:", e.message);
    return [];
  }
}

/**
 * Execute a Composio tool call against a real platform API.
 */
async function executeComposioTool(toolName, toolInput, tenantId) {
  try {
    const res = await fetch(`${COMPOSIO_BASE}/actions/${toolName}/execute`, {
      method:  "POST",
      headers: composioHeaders(),
      body:    JSON.stringify({ entityId: tenantId, params: toolInput }),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      return { error: data?.message || `Composio execution failed (${res.status})` };
    }
    return data?.response || data?.data || data;
  } catch (e) {
    return { error: e.message };
  }
}

// ─── System prompt builder (tenant-aware) ─────────────────────────────────────

function buildSystemPrompt(specialist, brand, connectedApps) {
  const brandBlock = brand ? `
TENANT BRAND CONTEXT
- Brand: ${brand.name || "Unknown"}
- Industry: ${brand.industry || "Unknown"}
- Voice: ${brand.voice?.tone || "Professional"}
- Banned phrases: ${(brand.voice?.bannedPhrases || []).join(", ") || "none"}
- Connected platforms: ${connectedApps.length > 0 ? connectedApps.join(", ") : "none yet"}
`.trim() : "";

  const toolBlock = connectedApps.length > 0
    ? `You have live tools to act on: ${connectedApps.join(", ")}. When asked to create, update, or report on campaigns — use the tools. Don't describe what to do, do it. Summarise results in plain English.`
    : `No platforms connected yet. If asked to take action on a platform, tell the tenant to connect it in Settings → Connections.`;

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

Otherwise act directly using available tools.

BEHAVIOUR
- Lead with action. If you have tools and the task is clear, use them immediately.
- Summarise tool results in plain English — never show raw JSON.
- One clarifying question max if the request is ambiguous.
- Use open_workspace when a canvas view would help the tenant.`,

    drafter: `You are Drafter — the content AI for FlowOS.
${brandBlock}

Write in the tenant's brand voice. Output clean copy only — no preamble.

Formats:
- Social: 3 variants, each under 150 chars, different angles.
- Email: subject + preview text + body.
- Ad copy: headline + 2 lines body.
- SMS: under 160 chars.

Use show_drafts to display output for review.`,

    analyst: `You are Analyst — the data AI for FlowOS.
${brandBlock}

Interpret marketing performance and surface insights clearly.
Lead with the number → implication → one action.
Use show_metric for headline numbers.`,

    brand_guard: `You are Brand Guard — the policy AI for FlowOS.
${brandBlock}

Check copy against brand guidelines.
For each issue: Flag → Rule → Fix.
If clean, say so in one sentence.`,

    inbox: `You are Inbox — the customer communications AI for FlowOS.
${brandBlock}

Triage: Urgent / Standard / Low.
Output: classification → suggested reply → flag if human review needed.`,
  };

  return prompts[specialist] || prompts.supervisor;
}

// ─── Internal FlowOS tools (always available to supervisor) ───────────────────

const INTERNAL_TOOLS = [
  {
    name: "delegate_to",
    description: "Route this task to the appropriate specialist AI.",
    input_schema: {
      type: "object",
      properties: {
        specialist: { type: "string", enum: ["drafter", "analyst", "brand_guard", "inbox"] },
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
          enum: ["command","studio","emailstudio","searchstudio","organic","planner","inbox","insights","connections","memory","autonomy"],
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
];

// ─── Tool execution loop ──────────────────────────────────────────────────────

const INTERNAL_TOOL_NAMES = new Set(INTERNAL_TOOLS.map(t => t.name));
const MAX_ITERATIONS = 5;

async function runToolLoop({ messages, systemPrompt, tools, tenantId, apiKey }) {
  let currentMessages = [...messages];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
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

      const toolResults = [];
      for (const block of data.content) {
        if (block.type !== "tool_use") continue;

        let result;
        if (INTERNAL_TOOL_NAMES.has(block.name)) {
          // Internal tools are handled by the frontend — just signal success
          result = { ok: true, tool: block.name, action: block.input };
        } else {
          // Composio tool — hit the real platform API
          result = await executeComposioTool(block.name, block.input, tenantId);
        }

        toolResults.push({
          type:        "tool_result",
          tool_use_id: block.id,
          content:     JSON.stringify(result),
        });
      }

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

  let body;
  try { body = await req.json(); }
  catch { return new Response("Bad request", { status: 400 }); }

  const { messages, specialist = "supervisor", tenantId, brand } = body;

  try {
    // Fetch live Composio tools for this tenant
    const composioTools = await fetchComposioTools(tenantId);
    const connectedApps = [...new Set(
      composioTools.map(t => t.name.split("_")[0].toLowerCase())
    )].filter(Boolean);

    // Supervisor gets internal + Composio tools; specialists get neither
    const tools = specialist === "supervisor"
      ? [...INTERNAL_TOOLS, ...composioTools]
      : [];

    const systemPrompt = buildSystemPrompt(specialist, brand || null, connectedApps);

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
