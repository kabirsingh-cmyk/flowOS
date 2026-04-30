// MVEDA — AI layer: SSE streaming client + two-call orchestration
// Supervisor routes → Specialist responds. Falls back to inferResponse if no server key.
const { useRef: useRefAI } = React;

const SPECIALIST_LABEL = {
  supervisor:  "Supervisor",
  drafter:     "Drafter",
  analyst:     "Analyst",
  brand_guard: "Brand Guard",
  inbox:       "Inbox",
};

// ─── Format thread history for Anthropic messages array ───────────────────
function buildMessages(threadMessages, newUserText) {
  const out = [];
  for (const m of threadMessages) {
    if (m.kind === "user" && m.text) {
      out.push({ role: "user", content: m.text });
    } else if (m.kind === "agent" && m.text && !m.streaming) {
      // Label each specialist so Claude has context on who said what
      out.push({ role: "assistant", content: `[${m.author}]: ${m.text}` });
    }
    // Skip briefings, system messages, still-streaming messages
  }
  // Keep last 12 turns to stay well within context limits
  const context = out.slice(-12);
  context.push({ role: "user", content: newUserText });
  return context;
}

// ─── Parse one Anthropic SSE stream ───────────────────────────────────────
// Calls onToken(text) for each text chunk.
// Returns { fullText, tools: [{ name, input }] } when done.
async function parseAnthropicStream(response, onToken) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const tools = [];
  let currentTool = null; // { name, json }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === "[DONE]") continue;

      let evt;
      try { evt = JSON.parse(raw); } catch { continue; }

      switch (evt.type) {
        case "content_block_start":
          if (evt.content_block?.type === "tool_use") {
            currentTool = { name: evt.content_block.name, json: "" };
          }
          break;

        case "content_block_delta":
          if (evt.delta?.type === "text_delta" && evt.delta.text) {
            fullText += evt.delta.text;
            onToken(evt.delta.text);
          }
          if (evt.delta?.type === "input_json_delta" && currentTool) {
            currentTool.json += evt.delta.partial_json || "";
          }
          break;

        case "content_block_stop":
          if (currentTool) {
            try {
              currentTool.input = JSON.parse(currentTool.json || "{}");
            } catch {
              currentTool.input = {};
            }
            tools.push({ name: currentTool.name, input: currentTool.input });
            currentTool = null;
          }
          break;

        case "error":
          console.error("[FlowOS AI] Anthropic error:", evt.error);
          break;
      }
    }
  }

  return { fullText, tools };
}

// ─── Single specialist call + stream into reducer ─────────────────────────
async function streamSpecialist({ messages, specialist, channelId, t, dispatch, onTool }) {
  const agent = SPECIALIST_LABEL[specialist] || "Supervisor";

  dispatch({ type: "STREAM_START", channel: channelId, agent, time: t });
  dispatch({ type: "SET_TYPING", agent });

  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, specialist }),
    });
  } catch (err) {
    // Network error — fall through to simulation
    dispatch({ type: "STREAM_DONE", channel: channelId });
    return { fullText: "", tools: [], fallback: true };
  }

  // Server has no API key — use simulation
  if (response.headers.get("content-type")?.includes("application/json")) {
    const json = await response.json();
    if (json.type === "fallback") {
      dispatch({ type: "STREAM_DONE", channel: channelId });
      return { fullText: "", tools: [], fallback: true };
    }
  }

  const { fullText, tools } = await parseAnthropicStream(response, (token) => {
    dispatch({ type: "STREAM_TOKEN", channel: channelId, token });
  });

  // Process tool calls
  for (const tool of tools) {
    onTool(tool.name, tool.input, agent, fullText);
  }

  dispatch({ type: "STREAM_DONE", channel: channelId });
  dispatch({ type: "SET_TYPING", agent: null });
  return { fullText, tools, fallback: false };
}

// ─── Main entry: send a user message, orchestrate Supervisor → Specialist ─
async function sendAIMessage({ userText, threadMessages, channelId, dispatch, openWorkspace, openCanvas, t, onFallback }) {
  const messages = buildMessages(threadMessages, userText);

  // ── Call 1: Supervisor ───────────────────────────────────────────────────
  let delegation = null;
  let supervisorText = "";

  const sup = await streamSpecialist({
    messages,
    specialist: "supervisor",
    channelId,
    t,
    dispatch,
    onTool: (name, input, agent, text) => {
      supervisorText = text;
      if (name === "delegate_to") {
        delegation = input; // { specialist, context }
      }
      if (name === "open_workspace") {
        openWorkspace(input.target);
      }
      if (name === "show_metric") {
        openCanvas({ kind: "metric", data: input });
      }
    },
  });

  // No API key — fall back to keyword simulation
  if (sup.fallback) {
    onFallback(userText, t);
    return;
  }

  // ── Call 2: Delegated specialist (if Supervisor routed) ───────────────────
  if (delegation) {
    // Simple handoff: original conversation + Supervisor's reply + delegation context as a new user turn.
    // Avoids tool_use/tool_result blocks (which require the tool to be in the specialist's tools list).
    const delegateMessages = [
      ...messages,
      { role: "assistant", content: supervisorText || "Routing to specialist." },
      { role: "user",      content: delegation.context || "Handle this request." },
    ];

    await streamSpecialist({
      messages: delegateMessages,
      specialist: delegation.specialist,
      channelId,
      t,
      dispatch,
      onTool: (name, input) => {
        if (name === "open_workspace") openWorkspace(input.target);
        if (name === "show_drafts")   openCanvas({ kind: "drafts",  data: input });
        if (name === "show_metric")   openCanvas({ kind: "metric",  data: input });
      },
    });
  }

  dispatch({ type: "SET_TYPING", agent: null });
}

Object.assign(window, { sendAIMessage });
