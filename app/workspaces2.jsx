(function () {
// MVEDA workspaces — part 2: Campaign Planner (hero flow), Content Studio
const { useState: useState2, useMemo: useMemo2, useEffect: useEffect2 } = React;

const CAMPAIGN_COLORS = {
  "Spring Launch": "var(--accent)",
  "Community": "oklch(58% 0.11 200)",
  "Trail Stories": "oklch(62% 0.11 155)",
  "Cultural": "oklch(72% 0.1 85)",
};
function colorForCampaign(name) {
  if (CAMPAIGN_COLORS[name]) return CAMPAIGN_COLORS[name];
  let h = 0; for (let i = 0; i < name.length; i++) h = (h*31 + name.charCodeAt(i)) % 360;
  return `oklch(64% 0.12 ${h})`;
}

// ────────────────────────────── BRIEF MARKDOWN RENDERER ──────────────────────
// Minimal renderer for the campaign brief format produced by the campaign_planner
// specialist. Handles only the subset of markdown the brief actually uses:
//   **bold inline**
//   **N. Section Heading** on its own line → h2
//   - bullet point
//   | table | row | with | pipes |   (separator row `|---|---|` is dropped)
//   blank line → paragraph break
// Anything else is rendered as a plain paragraph.
function renderInline(text) {
  // Split on **...** to bold the wrapped runs, leaving everything else as text.
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    return m
      ? <strong key={i} style={{ fontWeight: 600 }}>{m[1]}</strong>
      : <React.Fragment key={i}>{p}</React.Fragment>;
  });
}
function BriefMarkdown({ source }) {
  if (!source) return null;
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  let key = 0;
  const sectionHeading = /^\*\*\d+\.\s+(.+)\*\*\s*$/;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Section heading: **1. Campaign Overview**
    const h = line.match(sectionHeading);
    if (h) {
      blocks.push(
        <h2 key={key++} style={{
          fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
          margin: "22px 0 8px", color: "var(--ink)",
          paddingBottom: 6, borderBottom: "1px solid var(--rule)",
        }}>{h[1]}</h2>
      );
      i++; continue;
    }

    // Other bold-only standalone lines → h3
    const subH = line.match(/^\*\*([^*]+)\*\*\s*$/);
    if (subH) {
      blocks.push(
        <h3 key={key++} style={{ fontSize: 13, fontWeight: 600, margin: "14px 0 4px", color: "var(--ink)" }}>
          {subH[1]}
        </h3>
      );
      i++; continue;
    }

    // Table: a line starting with |, and the next line is the separator
    if (line.trim().startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i]); i++;
      }
      // Drop separator rows (e.g. |---|---|)
      const cleaned = rows.filter(r => !/^\|[\s:|-]+\|\s*$/.test(r.trim()));
      if (cleaned.length > 0) {
        const cells = cleaned.map(r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
        const [header, ...body] = cells;
        blocks.push(
          <div key={key++} style={{ overflowX: "auto", margin: "8px 0 14px" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr>{header.map((c, ci) => (
                  <th key={ci} style={{
                    textAlign: "left", padding: "8px 10px",
                    background: "var(--paper-2)", borderBottom: "1px solid var(--rule-strong)",
                    fontWeight: 600, color: "var(--ink)", fontSize: 11.5,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>{c}</th>
                ))}</tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri}>{row.map((c, ci) => (
                    <td key={ci} style={{
                      padding: "8px 10px", borderBottom: "1px solid var(--rule)",
                      color: "var(--ink-2)", verticalAlign: "top",
                    }}>{renderInline(c)}</td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ margin: "4px 0 12px 18px", padding: 0, color: "var(--ink-2)" }}>
          {items.map((it, ii) => (
            <li key={ii} style={{ marginBottom: 4, lineHeight: 1.5, fontSize: 13 }}>
              {renderInline(it)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Plain paragraph (gather consecutive non-empty, non-special lines)
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !sectionHeading.test(lines[i]) &&
      !/^\*\*([^*]+)\*\*\s*$/.test(lines[i]) &&
      !lines[i].trim().startsWith("|") &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      para.push(lines[i]); i++;
    }
    if (para.length > 0) {
      blocks.push(
        <p key={key++} style={{ margin: "6px 0 10px", lineHeight: 1.55, fontSize: 13, color: "var(--ink-2)" }}>
          {renderInline(para.join(" "))}
        </p>
      );
    }
  }

  return <div>{blocks}</div>;
}

// ────────────────────────────── ACTIVE PLAN VIEW ──────────────────────────────
function ActivePlanView({ plan, actions, go }) {
  const channelList = Array.isArray(plan.channels) && plan.channels.length
    ? plan.channels.join(" · ")
    : "—";
  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>03 · Plan · Campaign brief</div>
          <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>{plan.title || "Untitled campaign"}</h1>
          {plan.summary && (
            <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>{plan.summary}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <Btn size="sm" variant="ghost" onClick={() => go("publish")}>
            <Icon name="calendar" size={12}/> Publishing queue
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => actions.clearActivePlan()}>
            <Icon name="x" size={12}/> Dismiss
          </Btn>
        </div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 8, padding: "12px 14px",
        background: "var(--paper-2)", border: "1px solid var(--rule)", borderRadius: 6,
      }}>
        {[
          { label: "Goal",     value: plan.goal },
          { label: "Audience", value: plan.audience },
          { label: "Timeline", value: plan.timeline },
          { label: "Budget",   value: plan.budget || "—" },
          { label: "Channels", value: channelList },
          { label: "Items",    value: plan.itemCount ? String(plan.itemCount) : "—" },
        ].map(f => (
          <div key={f.label} style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{f.label}</div>
            <div style={{ fontSize: 12.5, color: "var(--ink)", marginTop: 3, lineHeight: 1.4, wordBreak: "break-word" }}>{f.value || "—"}</div>
          </div>
        ))}
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 6,
        padding: "20px 28px",
      }}>
        {plan.brief
          ? <BriefMarkdown source={plan.brief}/>
          : <div style={{ color: "var(--muted)", fontSize: 13 }}>This brief has no body content. Ask Flow to regenerate the campaign plan.</div>}
      </div>
    </div>
  );
}

// ────────────────────────────── CAMPAIGN PLANNER ──────────────────────────────
function CampaignPlanner({ state, actions, payload, go }) {
  const [dialogOpen, setDialogOpen] = useState2(false);
  const [newlyAdded, setNewlyAdded] = useState2(new Set());
  const [filter, setFilter] = useState2(payload?.filterStatus ? null : "all");
  const [statusFilter, setStatusFilter] = useState2(payload?.filterStatus || null);
  const channels = ["Instagram", "LinkedIn", "TikTok", "Email", "Google Ads", "Meta Ads", "YouTube"];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dates = ["20", "21", "22", "23", "24", "25", "26"];

  useEffect2(() => {
    if (payload?.openNew) setDialogOpen(true);
    if (payload?.filterStatus) setStatusFilter(payload.filterStatus);
  }, [payload?.openNew, payload?.filterStatus]);

  let filtered = state.calendar;
  if (filter && filter !== "all") filtered = filtered.filter(ci => ci.channel === filter);
  if (statusFilter) filtered = filtered.filter(ci => ci.status === statusFilter);

  const addCampaign = (tpl, meta) => {
    const prefix = `ci_${Date.now()}_`;
    const next = tpl.mix.map((m, i) => ({
      id: prefix + i,
      day: m.day,
      channel: m.channel,
      tone: m.tone,
      title: m.title,
      status: "draft",
      campaign: meta.name,
      body: m.body,
      scheduledAt: `${String(8 + i).padStart(2,"0")}:${i % 2 ? "30" : "00"}`,
    }));
    actions.addCampaign(next, meta.name);
    setDialogOpen(false);
    setNewlyAdded(new Set(next.map(n => n.id)));
    next.forEach((n, i) => {
      setTimeout(() => {
        setNewlyAdded(prev => { const c = new Set(prev); c.delete(n.id); return c; });
      }, 1600 + i * 80);
    });
  };

  const byDay = useMemo2(() => {
    const g = Array.from({ length: 7 }, () => []);
    filtered.forEach(ci => g[ci.day].push(ci));
    return g;
  }, [filtered]);

  // If the chat has authored a campaign brief, render it instead of the default grid.
  // Hooks above run unconditionally so React's hooks order stays stable as activePlan toggles.
  if (state.activePlan) {
    return <ActivePlanView plan={state.activePlan} actions={actions} go={go}/>;
  }

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>03 · Plan</div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Campaign Planner</h1>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>
            Week of Apr 20–26 · {state.calendar.length} items · {new Set(state.calendar.map(c=>c.campaign)).size} campaigns
            {statusFilter && <> · <span style={{ color: "var(--accent-ink)" }}>filtered: {statusFilter}</span> <button onClick={() => setStatusFilter(null)} style={{ background: "transparent", border: 0, color: "var(--accent-ink)", cursor: "pointer", textDecoration: "underline", fontSize: 12, marginLeft: 4 }}>clear</button></>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", border: "1px solid var(--rule-strong)", borderRadius: 5, padding: 2, background: "var(--paper)" }}>
            {["all", ...channels].map(c => (
              <button key={c} onClick={() => setFilter(c)}
                style={{
                  padding: "4px 10px", border: 0, borderRadius: 3,
                  background: filter === c ? "var(--paper-3)" : "transparent",
                  color: filter === c ? "var(--ink)" : "var(--ink-2)",
                  fontSize: 11.5, fontFamily: "var(--font-sans)", cursor: "pointer",
                  fontWeight: 500,
                }}>{c === "all" ? "All" : c}</button>
            ))}
          </div>
          <Btn size="sm" variant="primary" onClick={() => setDialogOpen(true)}><Icon name="plus" size={12}/> New campaign</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[...new Set(state.calendar.map(c => c.campaign))].map(name => {
          const count = state.calendar.filter(c => c.campaign === name).length;
          return (
            <div key={name} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 10px", border: "1px solid var(--rule)",
              borderRadius: 999, fontSize: 12, background: "var(--paper)",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorForCampaign(name) }}/>
              <span style={{ fontWeight: 500 }}>{name}</span>
              <span className="mono" style={{ color: "var(--muted)", fontSize: 10.5 }}>{count}</span>
            </div>
          );
        })}
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "80px repeat(7, 1fr)",
        border: "1px solid var(--rule)", borderRadius: 6,
        background: "var(--paper)", overflow: "hidden", flex: 1, minHeight: 0,
      }}>
        <div style={{ background: "var(--paper-2)", borderRight: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}/>
        {days.map((d, i) => (
          <div key={d} style={{
            padding: "10px 12px", borderRight: i < 6 ? "1px solid var(--rule)" : 0,
            borderBottom: "1px solid var(--rule)", background: "var(--paper-2)",
          }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{d}</div>
            <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 2 }}>{dates[i]}</div>
          </div>
        ))}

        {channels.map((ch, chIdx) => (
          <React.Fragment key={ch}>
            <div style={{
              padding: "10px 12px", borderRight: "1px solid var(--rule)",
              borderBottom: chIdx < channels.length - 1 ? "1px solid var(--rule)" : 0,
              background: "var(--paper-2)", fontSize: 11.5, color: "var(--muted-2)",
              fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              {ch}
            </div>
            {Array.from({ length: 7 }).map((_, dayIdx) => {
              const items = byDay[dayIdx].filter(i => i.channel === ch);
              return (
                <div key={dayIdx} style={{
                  padding: 6, borderRight: dayIdx < 6 ? "1px solid var(--rule)" : 0,
                  borderBottom: chIdx < channels.length - 1 ? "1px solid var(--rule)" : 0,
                  minHeight: 72,
                  display: "flex", flexDirection: "column", gap: 4,
                }}>
                  {items.map(item => {
                    const isNew = newlyAdded.has(item.id);
                    const chip = statusChip(item.status);
                    return (
                      <div key={item.id}
                        className={isNew ? "anim-slide" : ""}
                        onClick={() => go("studio", { selectId: item.id })}
                        style={{
                          background: "var(--paper)",
                          border: "1px solid var(--rule)",
                          borderLeft: `3px solid ${colorForCampaign(item.campaign)}`,
                          borderRadius: 4, padding: "6px 8px",
                          fontSize: 11.5, cursor: "pointer",
                          boxShadow: isNew ? "0 0 0 2px var(--accent-wash)" : "none",
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.tone}</span>
                          <Chip tone={chip.tone}>{chip.label}</Chip>
                        </div>
                        <div style={{ marginTop: 3, lineHeight: 1.3, color: "var(--ink)", fontWeight: 500, fontSize: 12 }}>{item.title}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <NewCampaignDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreate={addCampaign}/>
    </div>
  );
}

function NewCampaignDialog({ open, onClose, onCreate }) {
  const [name, setName] = useState2("Stride 03 · UK launch");
  const [template, setTemplate] = useState2(SEED.campaignTemplates[0]);
  const [goal, setGoal] = useState2("Drive pre-orders + build shoe-led IG presence");
  const [start, setStart] = useState2("Apr 20");

  useEffect2(() => {
    if (open) { setName("Stride 03 · UK launch"); setTemplate(SEED.campaignTemplates[0]); }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="New campaign" width={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          <span style={{ color: "var(--accent-ink)" }}>● Strategy</span>
          <Icon name="arrow" size={10}/><span>Planning</span>
          <Icon name="arrow" size={10}/><span>Drafting</span>
          <Icon name="arrow" size={10}/><span>Policy</span>
          <Icon name="arrow" size={10}/><span>Queue</span>
        </div>

        <FormRow label="Campaign name"><Input value={name} onChange={e => setName(e.target.value)}/></FormRow>
        <FormRow label="Business objective"><Textarea value={goal} onChange={e => setGoal(e.target.value)} rows={2}/></FormRow>

        <FormRow label="Template">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {SEED.campaignTemplates.map(t => (
              <button key={t.name} onClick={() => setTemplate(t)}
                style={{
                  textAlign: "left", padding: 12,
                  border: `1px solid ${template.name === t.name ? "var(--ink)" : "var(--rule)"}`,
                  background: template.name === t.name ? "var(--paper-2)" : "var(--paper)",
                  borderRadius: 5, cursor: "pointer",
                }}>
                <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.01em" }}>{t.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{t.mix.length} items · {t.pillars.join(" · ")}</div>
              </button>
            ))}
          </div>
        </FormRow>

        <FormRow label="Start week">
          <div style={{ display: "flex", gap: 6 }}>
            {["Apr 20", "Apr 27", "May 04"].map(w => (
              <button key={w} onClick={() => setStart(w)}
                style={{
                  padding: "6px 12px", fontSize: 12,
                  border: `1px solid ${start === w ? "var(--rule-strong)" : "var(--rule)"}`,
                  background: start === w ? "var(--paper-3)" : "var(--paper)",
                  color: "var(--ink)",
                  borderRadius: 4, cursor: "pointer",
                }}>{w}</button>
            ))}
          </div>
        </FormRow>

        <div style={{ background: "var(--paper-2)", border: "1px solid var(--rule)", borderRadius: 6, padding: 14 }}>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Supervisor will produce · {template.mix.length} items across {new Set(template.mix.map(m=>m.channel)).size} channels
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {template.mix.map((m, i) => (
              <div key={i} style={{
                padding: "4px 8px", border: "1px solid var(--rule)", borderRadius: 3,
                fontSize: 11, background: "var(--paper)",
              }}>
                <span className="mono" style={{ color: "var(--muted)", marginRight: 4, letterSpacing: "0.04em" }}>D{m.day}</span>
                <span style={{ fontWeight: 500 }}>{m.channel}</span>
                <span style={{ color: "var(--muted)", marginLeft: 5 }}>· {m.tone}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6 }}>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em" }}>
            <Icon name="shield" size={11}/> Policy Guard will review all outputs before queue
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={() => onCreate(template, { name })}>
              <Icon name="flash" size={12}/> Generate plan
            </Btn>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ────────────────────────────── CONTENT STUDIO ──────────────────────────────
function ContentStudio({ state, actions, payload, go }) {
  const drafts = state.calendar.filter(c => ["draft", "review", "policy"].includes(c.status));
  const [selectedId, setSelectedId] = useState2(payload?.selectId || drafts[0]?.id);
  useEffect2(() => { if (payload?.selectId) setSelectedId(payload.selectId); }, [payload?.selectId]);
  const selected = state.calendar.find(c => c.id === selectedId) || drafts[0];

  const variants = useMemo2(() => {
    if (!selected) return [];
    const toneMap = {
      Direct: [
        "Stride 03. 180g carbon plate. Tested on the Pennine Way.",
        "Built for the 12th mile, not the first. Stride 03 · now yours.",
        "One plate. Six routes. Eleven athletes. Stride 03.",
      ],
      Witness: [
        "Some mornings you run to get somewhere. Others, just to be the one who saw it first.",
        "Fourteen miles out. No one else on the path. The shoe remembered where to go.",
        "Mist, then sun, then mist again. The only constant was the cushion underfoot.",
      ],
      Invite: [
        "Saturday, 6am, the river path. Bring someone who's never tried.",
        "Trail crew is meeting at Clapton Pond. Come as you are.",
        "Week 17's route is posted — come join us, any pace welcome.",
      ],
      Wink: [
        "We made a shoe for people who run in the rain. You know who you are.",
        "Technically we tested it at −8°C. Philosophically, why were we out there?",
        "Stride 03 exists. That's all we'll say for now.",
      ],
    };
    return toneMap[selected.tone] || toneMap.Direct;
  }, [selected]);

  const [active, setActive] = useState2(0);
  useEffect2(() => setActive(0), [selectedId]);

  const approve = () => {
    if (!selected) return;
    actions.updateItem(selected.id, { status: "scheduled", body: variants[active] }, {
      logEvent: `approved · '${selected.title}' → queue`,
      notify: { tone: "ok", text: `'${selected.title}' approved · scheduled` },
    });
  };
  const reject = () => {
    if (!selected) return;
    actions.updateItem(selected.id, { status: "draft" }, {
      logEvent: `rejected · '${selected.title}' · back to drafting`,
      notify: { tone: "warn", text: `'${selected.title}' sent back` },
    });
  };

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>04 · Make</div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Content Studio</h1>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>{drafts.length} drafts open · compare variants side-by-side</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 300px", gap: "var(--gap)", flex: 1, minHeight: 0 }}>
        <div style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", overflow: "auto" }}>
          {drafts.length === 0 && <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>No drafts open.</div>}
          {drafts.map((d, i) => {
            const chip = statusChip(d.status);
            return (
              <div key={d.id} onClick={() => setSelectedId(d.id)} className="cell-btn"
                style={{
                  padding: "12px 14px",
                  borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                  background: selected?.id === d.id ? "var(--paper-2)" : "transparent",
                  cursor: "pointer",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{d.channel} · {d.tone}</span>
                  <Chip tone={chip.tone}>{chip.label}</Chip>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{d.title}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-2)", marginTop: 3, letterSpacing: "0.04em" }}>{d.campaign}</div>
              </div>
            );
          })}
        </div>

        <div key={selected?.id} className="anim-slide" style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", padding: 22, overflow: "auto" }}>
          {selected && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{selected.channel} · {selected.campaign}</div>
                  <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 2, lineHeight: 1.15 }}>{selected.title}</div>
                </div>
                <Chip tone="accent">tone: {selected.tone}</Chip>
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
                {variants.map((_, i) => (
                  <button key={i} onClick={() => setActive(i)}
                    style={{
                      padding: "6px 12px", fontSize: 12,
                      border: `1px solid ${active === i ? "var(--rule-strong)" : "var(--rule)"}`,
                      background: active === i ? "var(--paper-3)" : "var(--paper)",
                      color: "var(--ink)",
                      borderRadius: 4, cursor: "pointer",
                      fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                    }}>
                    Variant {String.fromCharCode(65 + i)}
                  </button>
                ))}
                <div style={{ flex: 1 }}/>
                <Btn size="sm" variant="ghost" onClick={() => { setActive((active + 1) % variants.length); actions.notify("neutral", "Regenerated variants"); }}><Icon name="flash" size={12}/> Regenerate</Btn>
              </div>

              <div key={active} className="anim-slide" style={{
                marginTop: 14, padding: "24px 26px",
                background: "var(--paper-2)", border: "1px solid var(--rule)",
                borderLeft: "3px solid var(--accent)", borderRadius: 5,
              }}>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1.35, color: "var(--ink)", fontStyle: "italic" }}>
                  "{variants[active]}"
                </div>
                <div style={{ height: 1, background: "var(--rule)", margin: "18px 0 12px" }}/>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, fontSize: 12 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Rationale</div>
                    <div style={{ marginTop: 4, color: "var(--ink-2)", lineHeight: 1.45 }}>Uses approved vocabulary, opens with verb, matches rhythm rules for {selected.tone}.</div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Policy check</div>
                    <div style={{ marginTop: 4, color: "var(--ink-2)" }}><Chip tone="ok">allow</Chip> <span style={{ color: "var(--muted)", marginLeft: 4 }}>no claim issues</span></div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Predicted reach</div>
                    <div style={{ marginTop: 4, color: "var(--ink-2)" }}><span style={{ fontWeight: 500, fontSize: 14 }}>14.2k</span> <span style={{ color: "var(--muted)", fontSize: 11 }}>±2.1k</span></div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
                <Btn size="sm" variant="ghost"><Icon name="edit" size={12}/> Edit</Btn>
                <Btn size="sm" variant="default" onClick={reject}><Icon name="x" size={12}/> Reject</Btn>
                <Btn size="sm" variant="primary" onClick={approve}><Icon name="check" size={12}/> Approve &amp; queue</Btn>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          <Card title="Brief" meta="supervisor">
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
              Reintroduce Stride 03 ahead of pre-order. Lean on trail + weather credibility. Avoid superlatives; tie copy to approved testing claims.
            </div>
          </Card>
          <Card title="Assets linked" meta="2 items">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {state.assets.slice(0, 2).map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 4,
                    background: `repeating-linear-gradient(135deg, var(--paper-3), var(--paper-3) 4px, var(--paper-2) 4px, var(--paper-2) 8px)`,
                    border: "1px solid var(--rule)",
                    display: "grid", placeItems: "center",
                    fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em",
                    fontFamily: "var(--font-mono)",
                  }}>{a.kind}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>{a.source} · {a.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Audit trail" meta="this draft">
            <div style={{ fontSize: 11.5, display: "flex", flexDirection: "column", gap: 6 }}>
              <div><span className="mono" style={{ color: "var(--muted)", marginRight: 6 }}>10:31</span>Supervisor produced 3 variants</div>
              <div><span className="mono" style={{ color: "var(--muted)", marginRight: 6 }}>10:31</span>Policy Guard · allow</div>
              <div><span className="mono" style={{ color: "var(--muted)", marginRight: 6 }}>—</span>Awaiting reviewer</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CampaignPlanner, ContentStudio });
})();
