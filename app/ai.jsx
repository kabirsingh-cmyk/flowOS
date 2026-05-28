// MVEDA — AI layer: JSON client for /api/chat tool-execution loop
// api/chat.js returns { ok, content: [...blocks] } — not SSE.
// Supervisor runs tools (delegate_to, open_workspace, show_drafts, show_metric,
// + live Composio platform tools).  Specialists get plain text back.

const SPECIALIST_LABEL = {
  supervisor:       "Flow",
  drafter:          "Drafter",
  analyst:          "Analyst",
  brand_guard:      "Brand Guard",
  inbox:            "Inbox",
  campaign_planner: "Planner",
  seo_auditor:      "SEO Auditor",
};

// ─── Format thread history for Anthropic messages array ───────────────────
function buildMessages(threadMessages, newUserText) {
  const out = [];
  for (const m of threadMessages) {
    if (m.kind === "user" && m.text) {
      out.push({ role: "user", content: m.text });
    } else if (m.kind === "agent" && m.text && !m.streaming) {
      out.push({ role: "assistant", content: `[${m.author}]: ${m.text}` });
    }
  }
  // Keep last 12 turns
  const context = out.slice(-12);
  context.push({ role: "user", content: newUserText });
  return context;
}

// ─── Extract text from content blocks ─────────────────────────────────────
function extractText(blocks) {
  return (blocks || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("")
    .trim();
}

// ─── Extract tool_use blocks ───────────────────────────────────────────────
function extractTools(blocks) {
  return (blocks || []).filter(b => b.type === "tool_use");
}

// ─── Single specialist call (JSON, not SSE) ───────────────────────────────
// Posts to /api/chat with full context, returns { text, tools, fallback }.
async function callSpecialist({ messages, specialist, brand }) {
  let response;
  try {
    response = await apiFetch("/api/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ messages, specialist, brand }),
    });
  } catch {
    return { text: "", tools: [], fallback: true };
  }

  if (!response.ok) {
    // Server error — fall through to simulation
    return { text: "", tools: [], fallback: true };
  }

  let data;
  try { data = await response.json(); } catch { return { text: "", tools: [], fallback: true }; }

  if (!data.ok) return { text: "", tools: [], fallback: true };

  return {
    text:     extractText(data.content),
    tools:    extractTools(data.content),
    pmMeta:   data.pmMeta || null,
    fallback: false,
  };
}

// ─── Main entry: send a user message, orchestrate Supervisor → Specialist ─
async function sendAIMessage({
  userText,
  threadMessages,
  channelId,
  dispatch,
  openWorkspace,
  openCanvas,
  t,
  onFallback,
  brand,
  setActivePlan,
}) {
  const messages = buildMessages(threadMessages, userText);

  // ── Call 1: Supervisor ────────────────────────────────────────────────────
  dispatch({ type: "STREAM_START", channel: channelId, agent: SPECIALIST_LABEL.supervisor, time: t });
  dispatch({ type: "SET_TYPING",   agent: SPECIALIST_LABEL.supervisor });

  const sup = await callSpecialist({ messages, specialist: "supervisor", brand });

  if (sup.fallback) {
    dispatch({ type: "STREAM_DONE", channel: channelId });
    dispatch({ type: "SET_TYPING",  agent: null });
    onFallback(userText, t);
    return;
  }

  // Emit supervisor text (may be empty when it delegates immediately)
  if (sup.text) {
    dispatch({ type: "STREAM_TOKEN", channel: channelId, token: sup.text });
  }
  dispatch({ type: "STREAM_DONE", channel: channelId, pmMeta: sup.pmMeta });

  // ── Handle supervisor tools ────────────────────────────────────────────────
  let delegation = null;

  for (const tool of sup.tools) {
    switch (tool.name) {
      case "delegate_to":
        delegation = tool.input; // { specialist, context }
        break;
      case "open_workspace":
        openWorkspace(tool.input.target);
        break;
      case "show_metric":
        openCanvas({ kind: "metric", data: tool.input });
        break;
      case "show_drafts":
        openCanvas({ kind: "drafts", data: tool.input });
        break;
      // Composio platform tools: result already executed server-side.
      // Surface any useful data from the result text (already in sup.text).
      default:
        break;
    }
  }

  // ── Call 2: Delegated specialist (if Supervisor routed) ───────────────────
  if (delegation) {
    const delegateMessages = [
      ...messages,
      { role: "assistant", content: sup.text || "Routing to specialist." },
      { role: "user",      content: delegation.context || "Handle this request." },
    ];

    const agent = SPECIALIST_LABEL[delegation.specialist] || delegation.specialist;
    dispatch({ type: "STREAM_START", channel: channelId, agent, time: t });
    dispatch({ type: "SET_TYPING",   agent });

    const spec = await callSpecialist({
      messages:   delegateMessages,
      specialist: delegation.specialist,
      brand,
    });

    // Detect create_draft / create_email_draft / create_sms_draft / create_email_sequence / create_campaign_plan / create_seo_audit / create_media_plan / create_discovery_report tool calls — attach as inline artifact.
    // Channel-specific tools win over the generic create_draft when both are present.
    const sequenceTool  = spec.tools.find(t => t.name === "create_email_sequence");
    const emailTool     = spec.tools.find(t => t.name === "create_email_draft");
    const smsTool       = spec.tools.find(t => t.name === "create_sms_draft");
    const unpublishableTool = spec.tools.find(t => t.name === "create_unpublishable_draft");
    const draftTool     = spec.tools.find(t => t.name === "create_draft");
    const planTool      = spec.tools.find(t => t.name === "create_campaign_plan");
    const auditTool     = spec.tools.find(t => t.name === "create_seo_audit");
    const mediaTool     = spec.tools.find(t => t.name === "create_media_plan");
    const discoveryTool = spec.tools.find(t => t.name === "create_discovery_report");
    const draftArtifact = discoveryTool ? {
      type:               "discovery_report",
      title:              discoveryTool.input.title || "Discovery report",
      executiveSummary:   discoveryTool.input.executiveSummary || "",
      researchConfidence: discoveryTool.input.researchConfidence || "training_data",
      market:             discoveryTool.input.market || {},
      positioning:        Array.isArray(discoveryTool.input.positioning)   ? discoveryTool.input.positioning   : [],
      personas:           Array.isArray(discoveryTool.input.personas)      ? discoveryTool.input.personas      : [],
      opportunities:      Array.isArray(discoveryTool.input.opportunities) ? discoveryTool.input.opportunities : [],
      risks:              Array.isArray(discoveryTool.input.risks)         ? discoveryTool.input.risks         : [],
      methodology:        discoveryTool.input.methodology || "",
    } : mediaTool ? {
      type:               "media_plan",
      title:              mediaTool.input.title || "Media plan",
      summary:            mediaTool.input.summary || "",
      goal:               mediaTool.input.goal || "",
      audience:           mediaTool.input.audience || "",
      timeline:           mediaTool.input.timeline || "",
      currency:           mediaTool.input.currency || "USD",
      totalBudgetMonthly: Number(mediaTool.input.totalBudgetMonthly) || 0,
      dataSource:         mediaTool.input.dataSource || "benchmarks_only",
      channels:           Array.isArray(mediaTool.input.channels)    ? mediaTool.input.channels    : [],
      excluded:           Array.isArray(mediaTool.input.excluded)    ? mediaTool.input.excluded    : [],
      risks:              Array.isArray(mediaTool.input.risks)       ? mediaTool.input.risks       : [],
      assumptions:        Array.isArray(mediaTool.input.assumptions) ? mediaTool.input.assumptions : [],
    } : auditTool ? {
      type:                 "seo_audit",
      url:                  auditTool.input.url || "",
      auditType:            auditTool.input.auditType || "full_audit",
      overallAssessment:    auditTool.input.overallAssessment || "needs_work",
      executiveSummary:     auditTool.input.executiveSummary || "",
      keywords:             Array.isArray(auditTool.input.keywords) ? auditTool.input.keywords : [],
      onPageIssues:         Array.isArray(auditTool.input.onPageIssues) ? auditTool.input.onPageIssues : [],
      contentGaps:          Array.isArray(auditTool.input.contentGaps) ? auditTool.input.contentGaps : [],
      technicalChecks:      Array.isArray(auditTool.input.technicalChecks) ? auditTool.input.technicalChecks : [],
      competitors:          Array.isArray(auditTool.input.competitors) ? auditTool.input.competitors : [],
      competitorNames:      Array.isArray(auditTool.input.competitorNames) ? auditTool.input.competitorNames : [],
      quickWins:            Array.isArray(auditTool.input.quickWins) ? auditTool.input.quickWins : [],
      strategicInvestments: Array.isArray(auditTool.input.strategicInvestments) ? auditTool.input.strategicInvestments : [],
    } : sequenceTool ? {
      type:              "email_sequence",
      sequenceType:      sequenceTool.input.sequenceType,
      goal:              sequenceTool.input.goal || "",
      audience:          sequenceTool.input.audience || "",
      emails:            Array.isArray(sequenceTool.input.emails) ? sequenceTool.input.emails : [],
      branchingLogic:    sequenceTool.input.branchingLogic || "",
      exitCondition:     sequenceTool.input.exitCondition || "",
      abTestSuggestions: Array.isArray(sequenceTool.input.abTestSuggestions) ? sequenceTool.input.abTestSuggestions : [],
      benchmarks:        sequenceTool.input.benchmarks || null,
    } : emailTool ? {
      type:         "email_draft",
      subject:      emailTool.input.subject,
      preheader:    emailTool.input.preheader || "",
      body:         emailTool.input.body,
      audienceHint: emailTool.input.audienceHint || "",
      campaignName: emailTool.input.campaignName || emailTool.input.subject,
    } : smsTool ? {
      type:              "sms_draft",
      body:              smsTool.input.body,
      audienceHint:      smsTool.input.audienceHint || "",
      campaignName:      smsTool.input.campaignName || smsTool.input.body.slice(0, 40),
      includeStopFooter: !!smsTool.input.includeStopFooter,
    } : unpublishableTool ? {
      type:           "draft_created",
      platform:       unpublishableTool.input.platform,
      contentType:    unpublishableTool.input.contentType,
      copy:           unpublishableTool.input.copy,
      imagePrompt:    unpublishableTool.input.imagePrompt || null,
      nonPublishable: true,
    } : draftTool ? {
      type:        "draft_created",
      platform:    draftTool.input.platform,
      contentType: draftTool.input.contentType,
      copy:        draftTool.input.copy,
      imagePrompt: draftTool.input.imagePrompt || null,
    } : planTool ? {
      type:      "campaign-plan",
      title:     planTool.input.title,
      summary:   planTool.input.summary,
      itemCount: planTool.input.itemCount,
      goal:      planTool.input.goal || "",
      audience:  planTool.input.audience || "",
      timeline:  planTool.input.timeline || "",
      budget:    planTool.input.budget || "",
      channels:  planTool.input.channels || [],
    } : undefined;

    // Persist the full brief to the store so CampaignPlanner can render it.
    // Done before STREAM_DONE so the canvas is ready by the time open_workspace fires.
    if (planTool && typeof setActivePlan === "function") {
      setActivePlan({
        title:     planTool.input.title || "Untitled campaign",
        summary:   planTool.input.summary || "",
        itemCount: planTool.input.itemCount || 0,
        goal:      planTool.input.goal || "",
        audience:  planTool.input.audience || "",
        timeline:  planTool.input.timeline || "",
        budget:    planTool.input.budget || "",
        channels:  Array.isArray(planTool.input.channels) ? planTool.input.channels : [],
        brief:     planTool.input.brief || "",
      });
    }

    if (spec.text) {
      dispatch({ type: "STREAM_TOKEN", channel: channelId, token: spec.text });
    }
    dispatch({ type: "STREAM_DONE", channel: channelId, artifact: draftArtifact, pmMeta: spec.pmMeta });

    for (const tool of spec.tools) {
      if (tool.name === "open_workspace") openWorkspace(tool.input.target);
      if (tool.name === "show_drafts")    openCanvas({ kind: "drafts", data: tool.input });
      if (tool.name === "show_metric")    openCanvas({ kind: "metric", data: tool.input });
      // create_draft is handled via draftArtifact above — no canvas action needed
    }
  }

  dispatch({ type: "SET_TYPING", agent: null });
}

Object.assign(window, { sendAIMessage });
