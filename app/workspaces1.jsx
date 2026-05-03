// MVEDA workspaces — part 1: Command Center, Brand Memory
const { useState: useState1, useMemo: useMemo1, useEffect: useEffect1, useRef: useRef1 } = React;

// ────────────────────────────── COMMAND CENTER ──────────────────────────────

const DEMO_ALERTS = [
  { id: "alert_1", type: "alert", priority: 1, time: "08:22", title: "Meta Ads creative fatigue detected", body: "Body Oil Advantage+ frequency hit 4.2×. ROAS dropped from 6.8x → 4.1x over 7 days.", severity: "warn", channel: "Meta Ads", action: "Ask Drafter to generate 3 new variants" },
  { id: "alert_2", type: "alert", priority: 1, time: "07:14", title: "CX spike — Honey & Vanilla Body Oil", body: "14 cap leak reports in 7 days. Auto-paused Meta Ads for this SKU.", severity: "high", channel: "CX", action: "Open CX Signals" },
];

function inferAiCommand(q) {
  const t = q.toLowerCase();
  if (/meta|facebook|instagram/.test(t) && /week|7d/.test(t) && /organic|paid|breakdown|vs/.test(t)) {
    return { agent: "Analyst", text: "Here's MVEDA's Meta performance this week:\n\n**Organic (Instagram)**\nReach: 148,200 (+22% vs last week) · Engagement: 4.8% · Top post: Saffron Ritual Reel (42,100 reach, 2,840 likes)\n\n**Paid (Meta Ads)**\nSpend: $3,840 · Revenue: $26,140 · ROAS: 6.8x\nTop campaign: Saffron Serum Retargeting (8.5x)\n\n⚠️ Flag: Body Oil Advantage+ showing creative fatigue (freq 4.2×, ROAS declining). I'd recommend refreshing creative this week — want me to ask Drafter?" };
  }
  if (/meta|facebook|instagram/.test(t) && /week|7d/.test(t)) {
    return { agent: "Analyst", text: "Meta summary this week:\n• Organic reach: 148,200 (+22%)\n• Paid spend: $3,840 · ROAS: 6.8x blended\n• Top post: Saffron Ritual Reel (42,100 reach)\n• IG follower growth: +340\n\nFlag: Body Oil Advantage+ creative fatigue (4.2× freq). Shall I pull the full breakdown?" };
  }
  if (/review|complaint|negative|bad/.test(t)) {
    return { agent: "Analyst", type: "review_lookup", text: "" };
  }
  if (/spend|budget|roas/.test(t)) {
    return { agent: "Analyst", text: "Budget breakdown this period:\n• Meta Ads: $5,760 spend · 6.8x ROAS · $39,168 revenue\n• Google Search: $540 · 8.0x ROAS · $4,320 revenue\n• TikTok Ads: $720 · 4.5x ROAS · $3,240 revenue\n\nTotal: $7,020 spend · $46,728 revenue · 6.7x blended ROAS\n\nLowest efficiency: TikTok (4.5x). Consider shifting $200/day to Meta retargeting." };
  }
  if (/tiktok/.test(t)) {
    return { agent: "Analyst", text: "TikTok this week:\n• Organic reach: 212,400 (+44% vs last week)\n• Followers: 31,200 (+1,240 this month)\n• Engagement rate: 6.2% (above 3% benchmark)\n• Top video: Abhyanga self-massage (98,200 reach, 8,410 likes)\n\nTikTok is currently your highest-growth channel. The Hair Ritual series is driving most of it." };
  }
  return { agent: "Analyst", text: "I'm analyzing that across your connected channels. What time window should I focus on — this week, 30 days, or a custom range?" };
}

function ReviewLookupCard({ onApproveSchedule }) {
  const [toastShown, setToastShown] = useState1(false);
  const rows = [
    { name: "Sarah M.", platform: "Google", stars: 2, excerpt: "packaging was damaged...", email: "s.m***@gmail.com" },
    { name: "James K.", platform: "Trustpilot", stars: 1, excerpt: "product leaked in transit...", email: "j.k***@outlook.com" },
    { name: "Tara L.", platform: "Instagram DM", stars: 2, excerpt: "scent different from last time...", email: "t.l***@yahoo.com" },
  ];
  const starStr = (n) => "⭐".repeat(n);
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 10, color: "var(--ink)" }}>Found 3 customers with negative reviews this period</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--rule)" }}>
            {["Name", "Platform", "Rating", "Excerpt", "Email"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "4px 8px 6px 0", color: "var(--muted)", fontWeight: 500, fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--rule)" }}>
              <td style={{ padding: "6px 8px 6px 0" }}>{r.name}</td>
              <td style={{ padding: "6px 8px 6px 0", color: "var(--muted)" }}>{r.platform}</td>
              <td style={{ padding: "6px 8px 6px 0" }}>{starStr(r.stars)}</td>
              <td style={{ padding: "6px 8px 6px 0", color: "var(--ink-2)", fontStyle: "italic" }}>"{r.excerpt}"</td>
              <td style={{ padding: "6px 8px 6px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{r.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Draft apology emails</div>
      <div style={{ background: "var(--paper-2)", border: "1px solid var(--rule)", borderRadius: 5, padding: "10px 12px", fontSize: 12, lineHeight: 1.6, color: "var(--ink-2)", marginBottom: 10 }}>
        Subject: We're sorry about your recent experience with MVEDA<br/><br/>
        Hi [First Name],<br/><br/>
        Thank you for sharing your experience with us. We're truly sorry to hear about the issue with your recent order — this is not the standard we hold ourselves to.<br/><br/>
        We'd love the opportunity to make it right. Please reply to this email and we'll arrange a replacement or full refund at your preference.<br/><br/>
        Warm regards,<br/>The MVEDA Team
      </div>
      <Btn variant="ghost" size="sm" onClick={() => { setToastShown(true); if (onApproveSchedule) onApproveSchedule(); }}>
        {toastShown ? "Scheduled ✓" : "Approve & Schedule send"}
      </Btn>
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Personalized emails drafted for each customer — review individually before sending</div>
    </div>
  );
}

function AiMessageText({ text }) {
  return (
    <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part
      )}
    </span>
  );
}

function CommandCenter({ state, actions, go }) {
  const { kpis, today, user } = SEED;

  const brandId = state?.activeBrandId || state?.brandPreset?.id || "mveda";
  const isErickson = brandId === "erickson";
  const brandName = isErickson ? "Erickson Refrigeration" : "MVEDA";

  const KPIS = isErickson ? [
    { label: "Leads this month",  value: "84",     delta: "+26%", tone: "ok"   },
    { label: "Avg job value",     value: "$1,240",  delta: "+8%",  tone: "ok"   },
    { label: "Google ROAS",       value: "9.2x",    delta: "+0.8x",tone: "ok"   },
    { label: "Pipeline value",    value: "$184k",   delta: "+18%", tone: "ok"   },
    { label: "Jobs booked (mtd)", value: "67",      delta: "+22%", tone: "ok"   },
  ] : [
    { label: "Orders (30d)",      value: "284",    delta: "+18%", tone: "ok"   },
    { label: "Revenue",           value: "$42.4k", delta: "+22%", tone: "ok"   },
    { label: "Blended ROAS",      value: "6.8x",   delta: "-0.4x",tone: "warn" },
    { label: "Subscribers",       value: "24.1k",  delta: "+412", tone: "ok"   },
    { label: "Avg open rate",     value: "40.2%",  delta: "+3.2pp",tone: "ok"  },
  ];

  // ── Feed state ──
  const [feedTab, setFeedTab] = useState1("all");
  const [activeItem, setActiveItem] = useState1(null);

  // ── AI Command Bar state ──
  const [aiOpen, setAiOpen] = useState1(false);
  const [aiInput, setAiInput] = useState1("");
  const [aiMessages, setAiMessages] = useState1([]);
  const aiScrollRef = useRef1(null);
  const aiInputRef = useRef1(null);
  const [toastMsg, setToastMsg] = useState1(null);

  // ── Build feed items ──
  const feedItems = useMemo1(() => {
    const approvalItems = state.approvals.map(a => ({
      id: a.id,
      type: "approval",
      priority: 0,
      time: a.time || "09:00",
      title: a.title,
      preview: a.reason,
      data: a,
    }));

    const postItems = state.calendar.filter(ci => ci.status === "review" || ci.status === "scheduled").slice(0, 6).map(ci => ({
      id: ci.id,
      type: "post",
      priority: 2,
      time: ci.time || ci.date || "",
      title: ci.title || ci.caption?.slice(0, 60) || "Post",
      preview: ci.caption || "",
      data: ci,
    }));

    const activityItems = state.activity.slice(0, 5).map(e => ({
      id: e.id,
      type: "activity",
      priority: 3,
      time: e.t,
      title: `${e.actor} · ${e.event}`,
      preview: "",
      data: e,
    }));

    const all = [...approvalItems, ...DEMO_ALERTS, ...postItems, ...activityItems];
    all.sort((a, b) => a.priority - b.priority || (a.time < b.time ? 1 : -1));
    return all;
  }, [state.approvals, state.calendar, state.activity]);

  const filteredFeed = useMemo1(() => {
    if (feedTab === "approvals") return feedItems.filter(i => i.type === "approval");
    if (feedTab === "posts") return feedItems.filter(i => i.type === "post");
    if (feedTab === "alerts") return feedItems.filter(i => i.type === "alert");
    return feedItems;
  }, [feedItems, feedTab]);

  const approvalCount = feedItems.filter(i => i.type === "approval").length;

  // ── AI send ──
  const sendAiMessage = () => {
    const q = aiInput.trim();
    if (!q) return;
    setAiOpen(true);
    setAiInput("");
    const userMsg = { role: "user", text: q };
    const result = inferAiCommand(q);
    const aiMsg = { role: "ai", agent: result.agent, text: "", fullText: result.text, type: result.type || "text", streaming: result.type !== "review_lookup" };
    setAiMessages(prev => [...prev, userMsg, aiMsg]);
  };

  // ── Streaming effect ──
  useEffect1(() => {
    const last = aiMessages[aiMessages.length - 1];
    if (!last || last.role !== "ai" || !last.streaming || last.text === last.fullText) return;
    const timer = setInterval(() => {
      setAiMessages(prev => {
        const updated = [...prev];
        const msg = { ...updated[updated.length - 1] };
        const nextLen = Math.min(msg.text.length + 3, msg.fullText.length);
        msg.text = msg.fullText.slice(0, nextLen);
        if (msg.text.length >= msg.fullText.length) msg.streaming = false;
        updated[updated.length - 1] = msg;
        return updated;
      });
    }, 20);
    return () => clearInterval(timer);
  }, [aiMessages]);

  // ── Scroll AI to bottom ──
  useEffect1(() => {
    if (aiScrollRef.current) {
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
    }
  }, [aiMessages]);

  // ── Toast helper ──
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2800);
  };

  // ── KPI strip (5 stats) ──
  const kpiStrip = KPIS.map(k => ({ label: k.label, value: k.value, unit: "", delta: k.delta }));

  // ── Card border color by type ──
  const borderByType = { approval: "var(--danger)", alert: "var(--warn)", post: "var(--accent)", activity: "var(--rule-strong)" };

  // ── Render feed card ──
  const renderFeedCard = (item) => {
    const isActive = activeItem?.id === item.id;
    const borderColor = item.type === "alert" && item.severity === "high" ? "var(--danger)" : borderByType[item.type] || "var(--rule-strong)";

    const baseStyle = {
      borderLeft: `3px solid ${borderColor}`,
      padding: "12px 14px",
      background: isActive ? "var(--paper-2)" : "var(--paper)",
      borderRadius: "0 6px 6px 0",
      marginBottom: 8,
      cursor: item.type === "activity" ? "default" : "pointer",
      transition: "background 0.14s",
      borderTop: "1px solid var(--rule)",
      borderRight: "1px solid var(--rule)",
      borderBottom: "1px solid var(--rule)",
    };

    const handleClick = () => {
      if (item.type === "activity") return;
      setActiveItem(isActive ? null : item);
    };

    if (item.type === "approval") {
      const a = item.data;
      return (
        <div key={item.id} style={baseStyle} onClick={handleClick}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>{item.time}</span>
            <Chip tone="danger">approval</Chip>
            {a.source && <Chip>{a.source}</Chip>}
          </div>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
          <div style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.5, marginBottom: 8 }}>{item.preview}</div>
          <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
            <Btn size="sm" variant="primary" onClick={() => { actions.resolveApproval(a.id, "approve"); showToast("Approved"); }}>
              <Icon name="check" size={11}/> Approve
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => { actions.resolveApproval(a.id, "revise"); showToast("Sent for revision"); }}>
              Revise
            </Btn>
          </div>
        </div>
      );
    }

    if (item.type === "alert") {
      return (
        <div key={item.id} style={baseStyle} onClick={handleClick}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>{item.time}</span>
            <Chip tone={item.severity === "high" ? "danger" : "warn"}>{item.channel || "alert"}</Chip>
          </div>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
          <div style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.5 }}>{item.body}</div>
        </div>
      );
    }

    if (item.type === "post") {
      const ci = item.data;
      return (
        <div key={item.id} style={baseStyle} onClick={handleClick}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>{item.time}</span>
            {ci.channel && <Chip tone="accent">{ci.channel}</Chip>}
            <Chip tone={ci.status === "scheduled" ? "ok" : ci.status === "review" ? "warn" : ""}>{ci.status}</Chip>
          </div>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 3 }}>{item.title}</div>
          {item.preview && <div style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.5 }}>{item.preview.slice(0, 100)}{item.preview.length > 100 ? "…" : ""}</div>}
        </div>
      );
    }

    // activity
    return (
      <div key={item.id} style={{ ...baseStyle, cursor: "default", padding: "8px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span className="mono" style={{ color: "var(--muted)", fontSize: 10.5, minWidth: 34 }}>{item.time}</span>
          <span className="mono" style={{ color: "var(--accent-ink)", fontSize: 10.5, letterSpacing: "0.04em" }}>{item.data?.actor}</span>
          <span style={{ color: "var(--ink-2)" }}>{item.data?.event}</span>
        </div>
      </div>
    );
  };

  // ── Render detail drawer body ──
  const renderDrawerBody = () => {
    if (!activeItem) return null;
    const item = activeItem;

    if (item.type === "approval") {
      const a = item.data;
      return (
        <div style={{ padding: "16px 20px" }}>
          <div className="serif" style={{ fontSize: 17, fontStyle: "italic", lineHeight: 1.5, marginBottom: 14, borderLeft: "2px solid var(--accent)", paddingLeft: 12, color: "var(--ink)" }}>
            {a.reason || item.preview}
          </div>
          {a.source && (
            <div style={{ marginBottom: 10 }}>
              <Chip>{a.source}</Chip>
              {a.rule && <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: 8 }}>{a.rule}</span>}
            </div>
          )}
          {a.reason && (
            <div style={{ padding: "10px 12px", background: "var(--paper-2)", borderRadius: 5, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 16 }}>
              {a.reason}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="primary" onClick={() => { actions.resolveApproval(a.id, "approve"); showToast("Approved"); setActiveItem(null); }}>
              <Icon name="check" size={12}/> Approve
            </Btn>
            <Btn variant="ghost" onClick={() => { actions.resolveApproval(a.id, "revise"); showToast("Sent for revision"); setActiveItem(null); }}>
              Revise
            </Btn>
            <Btn variant="ghost" onClick={() => { if (a.itemId) go("studio", { selectId: a.itemId }); }}>
              Edit in Studio
            </Btn>
          </div>
        </div>
      );
    }

    if (item.type === "alert") {
      return (
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{item.title}</div>
          <div style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.6, marginBottom: 16 }}>{item.body}</div>
          <div style={{ background: "var(--accent-wash)", borderRadius: 6, padding: "12px 14px", marginBottom: 16 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--accent-ink)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Recommended action</div>
            <div style={{ fontSize: 13, color: "var(--accent-ink)", lineHeight: 1.5 }}>{item.action}</div>
          </div>
          <Btn variant="primary" onClick={() => showToast(`Action taken: ${item.action}`)}>
            {item.action}
          </Btn>
        </div>
      );
    }

    if (item.type === "post") {
      const ci = item.data;
      return (
        <div style={{ padding: "16px 20px" }}>
          {ci.caption && (
            <div className="serif" style={{ fontSize: 15, fontStyle: "italic", lineHeight: 1.6, marginBottom: 14, color: "var(--ink)" }}>
              "{ci.caption}"
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {ci.channel && <Chip tone="accent">{ci.channel}</Chip>}
            <Chip tone={ci.status === "scheduled" ? "ok" : ci.status === "review" ? "warn" : ""}>{ci.status}</Chip>
          </div>
          {ci.date && (
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>Scheduled: {ci.date}{ci.time ? ` at ${ci.time}` : ""}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="primary" onClick={() => showToast("Post approved")}>
              <Icon name="check" size={12}/> Approve
            </Btn>
            <Btn variant="ghost" onClick={() => { if (ci.id) go("studio", { selectId: ci.id }); }}>
              <Icon name="edit" size={12}/> Edit
            </Btn>
          </div>
        </div>
      );
    }

    if (item.type === "activity") {
      const e = item.data;
      return (
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--accent-ink)", letterSpacing: "0.04em", marginBottom: 4 }}>{e?.actor}</div>
              <div style={{ fontSize: 14, color: "var(--ink-2)" }}>{e?.event}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>{e?.t}</div>
            </div>
          </div>
          {e?.detail && <div style={{ padding: "10px 12px", background: "var(--paper-2)", borderRadius: 5, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>{e.detail}</div>}
        </div>
      );
    }

    return null;
  };

  // ── AI command bar examples ──
  const exampleChips = ["How did Meta perform this week?", "Organic vs paid breakdown", "Budget & ROAS", "TikTok growth"];

  return (
    <div className="anim-fade" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
          background: "var(--ink)", color: "var(--paper)", padding: "8px 18px", borderRadius: 20,
          fontSize: 13, fontWeight: 500, zIndex: 999, pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        }}>{toastMsg}</div>
      )}

      {/* ── TOP: Compact greeting + KPI strip ── */}
      <div style={{ padding: "16px 24px 14px", borderBottom: "1px solid var(--rule)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 10 }}>{today}</span>
            <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.02em" }}>
              Good morning, {user.name.split(" ")[0]}.
            </span>
            <span style={{ color: "var(--muted)", marginLeft: 12, fontSize: 13 }}>
              {brandName} · {state.approvals.length} item{state.approvals.length !== 1 ? "s" : ""} need you · weekly plan ready
            </span>
          </div>
          <Btn size="sm" onClick={() => go("planner", { openNew: true })}><Icon name="plus" size={12}/> New campaign</Btn>
        </div>
        {/* 5 KPI stat strip */}
        <div style={{ display: "flex", gap: 0, borderTop: "1px solid var(--rule)", paddingTop: 12 }}>
          {kpiStrip.map((k, i) => (
            <div key={k.label} style={{
              flex: 1, paddingRight: 20,
              borderRight: i < kpiStrip.length - 1 ? "1px solid var(--rule)" : "none",
              paddingLeft: i > 0 ? 20 : 0,
            }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{k.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>{k.value}{k.unit}</span>
                {k.delta && <span style={{ fontSize: 11, color: String(k.delta).startsWith("-") ? "var(--danger)" : "var(--success)", fontFamily: "var(--font-mono)" }}>{k.delta}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MIDDLE: Feed (left) + Detail Drawer (right) ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Feed column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderRight: activeItem ? "1px solid var(--rule)" : "none" }}>
          {/* Feed tabs */}
          <div style={{ display: "flex", gap: 0, padding: "0 20px", borderBottom: "1px solid var(--rule)", flexShrink: 0, background: "var(--paper)" }}>
            {[
              { key: "all", label: "All" },
              { key: "approvals", label: "Approvals", badge: approvalCount },
              { key: "posts", label: "Posts" },
              { key: "alerts", label: "Alerts" },
            ].map(tab => (
              <button key={tab.key} onClick={() => setFeedTab(tab.key)}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  padding: "10px 14px 8px",
                  fontSize: 13, fontWeight: feedTab === tab.key ? 600 : 400,
                  color: feedTab === tab.key ? "var(--ink)" : "var(--muted)",
                  borderBottom: feedTab === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1,
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "color 0.12s",
                }}>
                {tab.label}
                {tab.badge > 0 && (
                  <span style={{
                    background: "var(--danger)", color: "#fff",
                    borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, lineHeight: 1.4,
                  }}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Feed list */}
          <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
            {filteredFeed.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "20px 0" }}>Nothing here right now.</div>
            )}
            {filteredFeed.map(item => renderFeedCard(item))}
          </div>
        </div>

        {/* Right Detail Drawer */}
        <div style={{ width: activeItem ? 380 : 0, minWidth: activeItem ? 380 : 0, transition: "all 0.22s ease", overflow: "hidden" }}>
          {activeItem && (
            <div style={{ width: 380, height: "100%", display: "flex", flexDirection: "column", overflow: "auto" }}>
              {/* Drawer header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 20px", borderBottom: "1px solid var(--rule)",
                background: "var(--paper)", flexShrink: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Chip tone={
                    activeItem.type === "approval" ? "danger" :
                    activeItem.type === "alert" ? (activeItem.severity === "high" ? "danger" : "warn") :
                    activeItem.type === "post" ? "accent" : ""
                  }>{activeItem.type}</Chip>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{activeItem.title?.slice(0, 42)}{activeItem.title?.length > 42 ? "…" : ""}</span>
                </div>
                <button onClick={() => setActiveItem(null)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1, padding: "2px 6px" }}>
                  ×
                </button>
              </div>
              {/* Drawer body */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {renderDrawerBody()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM: Sticky AI Command Bar ── */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--paper)", borderTop: "1px solid var(--rule)", padding: "12px 20px", flexShrink: 0, zIndex: 10 }}>
        {/* Conversation history */}
        {(aiOpen || aiMessages.length > 0) && aiMessages.length > 0 && (
          <div ref={aiScrollRef} style={{ maxHeight: 260, overflow: "auto", padding: "12px 0", marginBottom: 8 }}>
            {aiMessages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 10,
              }}>
                {msg.role === "user" ? (
                  <div style={{
                    background: "var(--ink)", color: "var(--paper)",
                    borderRadius: 16, padding: "7px 14px",
                    fontSize: 13, maxWidth: "70%", lineHeight: 1.5,
                  }}>{msg.text}</div>
                ) : (
                  <div style={{
                    background: "var(--paper-2)", border: "1px solid var(--rule)",
                    borderRadius: 8, padding: "10px 14px",
                    fontSize: 13, maxWidth: "88%", lineHeight: 1.5,
                  }}>
                    <div className="mono" style={{ fontSize: 10, color: "var(--accent-ink)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                      Agent · {msg.agent}
                    </div>
                    {msg.type === "review_lookup" ? (
                      <ReviewLookupCard onApproveSchedule={() => showToast("Emails scheduled for send")} />
                    ) : (
                      <AiMessageText text={msg.text} />
                    )}
                    {msg.streaming && <span style={{ opacity: 0.4, marginLeft: 2 }}>▋</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, color: "var(--accent-ink)", flexShrink: 0, lineHeight: 1 }}>✦</span>
          <input
            ref={aiInputRef}
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onFocus={() => setAiOpen(true)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }}
            placeholder="Ask anything · how did Meta perform this week?"
            style={{
              flex: 1, background: "var(--paper-2)", border: "1px solid var(--rule)",
              borderRadius: 20, padding: "8px 16px", fontSize: 13,
              color: "var(--ink)", outline: "none", fontFamily: "inherit",
            }}
          />
          <Btn size="sm" variant="primary" onClick={sendAiMessage} disabled={!aiInput.trim()}>
            ↵ Send
          </Btn>
        </div>

        {/* Example chips (only when no messages) */}
        {aiMessages.length === 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {exampleChips.map(chip => (
              <button key={chip} onClick={() => { setAiInput(chip); if (aiInputRef.current) aiInputRef.current.focus(); }}
                style={{
                  background: "var(--paper-2)", border: "1px solid var(--rule)",
                  borderRadius: 12, padding: "3px 10px", fontSize: 11.5,
                  color: "var(--muted)", cursor: "pointer", fontFamily: "inherit",
                  transition: "border-color 0.12s, color 0.12s",
                }}>
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────── BRAND MEMORY ──────────────────────────────
function BrandMemory({ state, actions }) {
  const [activeMode, setActiveMode] = useState1(state.toneModes[0]?.id);
  const [editing, setEditing] = useState1(false);
  const [proposing, setProposing] = useState1(false);
  const mode = state.toneModes.find(m => m.id === activeMode) || state.toneModes[0];

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>02 · Context</div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Brand Memory · {SEED.brand.name}</h1>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>Stable vocabulary, values, claims, and tone modes — versioned and approval-gated.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip tone="ok">v4.2 · approved</Chip>
          <Chip>by Ana O. · 2d ago</Chip>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--gap)" }}>
        <Card title="Brand values" meta="click to remove">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {state.brandValues.map(v => (
              <div key={v} className="row-hover" onClick={() => actions.removeBrandValue(v)} title="click to remove"
                style={{ padding: "6px 8px", borderRadius: 4, fontSize: 13, color: "var(--ink-2)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>— {v}</span>
              </div>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); const v = e.target.v.value.trim(); if (v) { actions.addBrandValue(v); e.target.v.value = ""; } }}
            style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <Input name="v" placeholder="Add a value…" style={{ padding: "6px 9px", fontSize: 12 }}/>
            <Btn size="sm" type="submit"><Icon name="plus" size={11}/></Btn>
          </form>
        </Card>
        <Card title="Approved claims" meta={`${state.approvedClaims.length} · click to remove`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, maxHeight: 180, overflow: "auto" }}>
            {state.approvedClaims.map(c => (
              <div key={c} className="row-hover" onClick={() => actions.removeClaim(c)}
                style={{ padding: "5px 8px", borderRadius: 4, color: "var(--ink-2)", cursor: "pointer" }}>— {c}</div>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); const v = e.target.c.value.trim(); if (v) { actions.addClaim(v); e.target.c.value = ""; } }}
            style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <Input name="c" placeholder="Add a claim…" style={{ padding: "6px 9px", fontSize: 12 }}/>
            <Btn size="sm" type="submit"><Icon name="plus" size={11}/></Btn>
          </form>
        </Card>
        <Card title="Prohibited territory" meta="hard boundary">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {state.prohibited.map(t => <Chip key={t} tone="danger">{t}</Chip>)}
          </div>
        </Card>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Tone mode library</div>
            <div style={{ fontSize: 18, fontWeight: 500, marginTop: 2 }}>{state.toneModes.length} active · 1 default</div>
          </div>
          <Btn size="sm" onClick={() => setProposing(true)}><Icon name="plus" size={12}/> Propose mode <span className="mono" style={{opacity:.6, marginLeft:4}}>requires approval</span></Btn>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "var(--gap)", alignItems: "stretch" }}>
          <div style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", overflow: "hidden" }}>
            {state.toneModes.map((m, i) => (
              <div key={m.id} onClick={() => setActiveMode(m.id)} className="cell-btn"
                style={{
                  padding: "14px 16px", borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                  background: activeMode === m.id ? "var(--paper-2)" : "transparent",
                  cursor: "pointer", display: "flex", flexDirection: "column", gap: 4,
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: 14, letterSpacing: "-0.01em" }}>{m.name}</span>
                  {m.isDefault && <Chip tone="accent">default</Chip>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{m.register}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-2)", marginTop: 2 }}>used {m.usage}% · {m.performance}</div>
              </div>
            ))}
          </div>

          <div key={mode.id} className="anim-slide" style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{mode.id}</div>
                <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 2 }}>{mode.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>{mode.register}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn size="sm" variant="ghost" onClick={() => setEditing(true)}><Icon name="edit" size={12}/> Edit</Btn>
                {!mode.isDefault && <Btn size="sm" variant="ghost" onClick={() => {
                  state.toneModes.forEach(m => actions.updateToneMode(m.id, { isDefault: m.id === mode.id }));
                }}>Set default</Btn>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 8 }}>
              <div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Approved vocabulary</div>
                <EditableList items={mode.approved} tone="ok"
                  onAdd={w => actions.addToneVocab(mode.id, "approved", w)}
                  onRemove={w => actions.removeToneVocab(mode.id, "approved", w)}
                  placeholder="add approved word…"/>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 16, marginBottom: 6 }}>Avoided vocabulary</div>
                <EditableList items={mode.avoided} tone="bad"
                  onAdd={w => actions.addToneVocab(mode.id, "avoided", w)}
                  onRemove={w => actions.removeToneVocab(mode.id, "avoided", w)}
                  placeholder="add avoided word…"/>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 16, marginBottom: 6 }}>Sentence rhythm</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>{mode.rhythm}</div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>When to use</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>{mode.whenToUse}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 14, marginBottom: 6 }}>When not to use</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>{mode.whenNotToUse}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 16, marginBottom: 6 }}>Example caption</div>
                <div className="serif" style={{
                  fontSize: 18, lineHeight: 1.35, color: "var(--ink)",
                  fontStyle: "italic", padding: "14px 16px",
                  background: "var(--paper-2)", borderRadius: 5,
                  borderLeft: "2px solid var(--accent)",
                }}>"{mode.example}"</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ToneEditDrawer open={editing} onClose={() => setEditing(false)} mode={mode} actions={actions}/>
      <ProposeToneDrawer open={proposing} onClose={() => setProposing(false)} actions={actions}/>
    </div>
  );
}

function ToneEditDrawer({ open, onClose, mode, actions }) {
  const [form, setForm] = useState1(mode);
  useEffect1(() => { if (open) setForm(mode); }, [open, mode?.id]);
  if (!form) return null;
  const save = () => {
    actions.updateToneMode(mode.id, { name: form.name, register: form.register, rhythm: form.rhythm, whenToUse: form.whenToUse, whenNotToUse: form.whenNotToUse, example: form.example });
    onClose();
  };
  return (
    <Drawer open={open} onClose={onClose} title={`Edit · ${mode?.name}`} width={540}
      actions={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}><Icon name="check" size={12}/> Save</Btn></>}>
      <FormRow label="Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></FormRow>
      <FormRow label="Emotional register"><Input value={form.register} onChange={e => setForm({ ...form, register: e.target.value })}/></FormRow>
      <FormRow label="Sentence rhythm"><Textarea value={form.rhythm} onChange={e => setForm({ ...form, rhythm: e.target.value })}/></FormRow>
      <FormRow label="When to use"><Textarea value={form.whenToUse} onChange={e => setForm({ ...form, whenToUse: e.target.value })}/></FormRow>
      <FormRow label="When not to use"><Textarea value={form.whenNotToUse} onChange={e => setForm({ ...form, whenNotToUse: e.target.value })}/></FormRow>
      <FormRow label="Example caption"><Textarea value={form.example} onChange={e => setForm({ ...form, example: e.target.value })}/></FormRow>
    </Drawer>
  );
}

function ProposeToneDrawer({ open, onClose, actions }) {
  const [form, setForm] = useState1({ name: "", register: "", rhythm: "", whenToUse: "", whenNotToUse: "", example: "", approved: [], avoided: [] });
  useEffect1(() => { if (open) setForm({ name: "", register: "", rhythm: "", whenToUse: "", whenNotToUse: "", example: "", approved: [], avoided: [] }); }, [open]);
  const save = () => {
    if (!form.name.trim()) return;
    actions.addToneMode(form);
    onClose();
  };
  return (
    <Drawer open={open} onClose={onClose} title="Propose new tone mode" width={540}
      actions={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save} disabled={!form.name.trim()}><Icon name="shield" size={12}/> Submit for approval</Btn></>}>
      <div style={{ padding: 12, background: "var(--accent-wash)", borderRadius: 5, marginBottom: 16, fontSize: 12, color: "var(--accent-ink)" }}>
        <Icon name="lock" size={11}/> Hard boundary — new tone modes require human approval before they go active.
      </div>
      <FormRow label="Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Companion, Craft, Steady…"/></FormRow>
      <FormRow label="Emotional register"><Input value={form.register} onChange={e => setForm({ ...form, register: e.target.value })}/></FormRow>
      <FormRow label="Sentence rhythm"><Textarea value={form.rhythm} onChange={e => setForm({ ...form, rhythm: e.target.value })}/></FormRow>
      <FormRow label="When to use"><Textarea value={form.whenToUse} onChange={e => setForm({ ...form, whenToUse: e.target.value })}/></FormRow>
      <FormRow label="When not to use"><Textarea value={form.whenNotToUse} onChange={e => setForm({ ...form, whenNotToUse: e.target.value })}/></FormRow>
      <FormRow label="Example caption"><Textarea value={form.example} onChange={e => setForm({ ...form, example: e.target.value })}/></FormRow>
    </Drawer>
  );
}

Object.assign(window, { CommandCenter, BrandMemory });
