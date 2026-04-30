// MVEDA workspaces — part 3: Publishing, Insights, Inbox, Autonomy
const { useState: useState3, useMemo: useMemo3 } = React;

// ────────────────────────────── PUBLISHING QUEUE ──────────────────────────────
function PublishingQueue({ state, actions }) {
  const [editItem, setEditItem] = useState3(null);
  const queue = state.calendar.filter(c => ["approved", "scheduled", "review", "policy", "paused"].includes(c.status));

  const togglePause = (item) => {
    const next = item.status === "paused" ? "scheduled" : "paused";
    actions.updateItem(item.id, { status: next }, {
      logEvent: `${next === "paused" ? "paused" : "resumed"} · '${item.title}'`,
      notify: { tone: "neutral", text: `'${item.title}' ${next === "paused" ? "paused" : "resumed"}` },
    });
  };
  const pauseAll = () => {
    queue.forEach(q => { if (q.status !== "paused") actions.updateItem(q.id, { status: "paused" }); });
    actions.notify("warn", `Paused ${queue.length} items`);
    actions.log("Ana O.", `paused all queued items · ${queue.length}`);
  };
  const sendNow = () => {
    const first = queue.find(q => q.status !== "paused");
    if (!first) return actions.notify("warn", "Nothing to send");
    actions.updateItem(first.id, { status: "sent" }, {
      logEvent: `sent · '${first.title}'`,
      notify: { tone: "ok", text: `Sent '${first.title}' to ${first.channel}` },
    });
  };
  const time = (i) => {
    const base = 9 + i * 1.7;
    const h = Math.floor(base); const m = Math.floor((base - h) * 60);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  };

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>05 · Ship</div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Publishing Queue</h1>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>{queue.length} items scheduled · next send 09:42 · autopause available</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn size="sm" onClick={pauseAll}><Icon name="pause" size={12}/> Pause all</Btn>
          <Btn size="sm" variant="primary" onClick={sendNow}><Icon name="send" size={12}/> Send now</Btn>
        </div>
      </div>

      <div style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "70px 100px 110px 1fr 110px 110px 80px",
          padding: "10px 14px", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)",
          fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          <span>Time</span><span>Channel</span><span>Campaign</span><span>Item</span><span>Tone</span><span>Status</span><span/>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {queue.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Queue is empty.</div>}
          {queue.map((item, i) => {
            const isPaused = item.status === "paused";
            const chip = statusChip(isPaused ? "draft" : item.status);
            return (
              <div key={item.id} className="row-hover" style={{
                display: "grid", gridTemplateColumns: "70px 100px 110px 1fr 110px 110px 80px",
                padding: "12px 14px", borderBottom: "1px solid var(--rule)",
                alignItems: "center", fontSize: 12.5, opacity: isPaused ? 0.5 : 1,
              }}>
                <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{time(i)}</span>
                <span>{item.channel}</span>
                <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{item.campaign}</span>
                <span style={{ fontWeight: 500 }}>{item.title}</span>
                <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{item.tone}</span>
                <span>{isPaused ? <Chip>paused</Chip> : <Chip tone={chip.tone}>{chip.label}</Chip>}</span>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <Btn size="sm" variant="ghost" onClick={() => togglePause(item)}>
                    <Icon name={isPaused ? "play" : "pause"} size={11}/>
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setEditItem(item)}><Icon name="edit" size={11}/></Btn>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Drawer open={!!editItem} onClose={() => setEditItem(null)} title={editItem?.title || ""}
        actions={editItem && <>
          <Btn variant="ghost" onClick={() => setEditItem(null)}>Close</Btn>
          <Btn variant="danger" onClick={() => { actions.removeItem(editItem.id); setEditItem(null); }}>
            <Icon name="x" size={12}/> Remove
          </Btn>
          <Btn variant="primary" onClick={() => {
            actions.updateItem(editItem.id, { status: "sent" }, { logEvent: `sent · '${editItem.title}'`, notify: { tone: "ok", text: `Sent '${editItem.title}'` }});
            setEditItem(null);
          }}><Icon name="send" size={12}/> Send now</Btn>
        </>}>
        {editItem && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Chip tone="accent">{editItem.channel}</Chip>
              <Chip>{editItem.tone}</Chip>
              <Chip tone={statusChip(editItem.status).tone}>{editItem.status}</Chip>
            </div>
            <FormRow label="Scheduled for">
              <Input defaultValue={`${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][editItem.day]} · 09:42`}/>
            </FormRow>
            <FormRow label="Caption">
              <Textarea defaultValue={`Built for the 12th mile, not the first. Stride 03 · now yours.\n\n#trailready #northwarren`}/>
            </FormRow>
            <FormRow label="Campaign"><Input defaultValue={editItem.campaign}/></FormRow>
          </div>
        )}
      </Drawer>
    </div>
  );
}

// ────────────────────────────── INSIGHTS CENTER ──────────────────────────────
function InsightsCenter({ state, actions }) {
  const byTone = [
    { name: "Direct",  saves: 2840, reach: 58200, ctr: 3.8, posts: 42, fill: "var(--accent)" },
    { name: "Witness", saves: 3410, reach: 44100, ctr: 2.9, posts: 28, fill: "oklch(58% 0.11 200)" },
    { name: "Invite",  saves: 1120, reach: 18400, ctr: 4.1, posts: 18, fill: "oklch(62% 0.11 155)" },
    { name: "Wink",    saves: 1880, reach: 31200, ctr: 1.9, posts: 12, fill: "oklch(72% 0.1 85)" },
  ];
  const max = Math.max(...byTone.map(t => t.saves));
  const mult = { "7d": 0.5, "30d": 1, "90d": 2.4, "YTD": 5.1 }[state.dateRange] || 1;

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>06 · Learn</div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Insights Center</h1>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>Trailing {state.dateRange} · all channels · analytics refreshed 1m ago</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["7d", "30d", "90d", "YTD"].map(r => (
            <Btn key={r} size="sm" variant={state.dateRange === r ? "primary" : "default"} onClick={() => actions.setDateRange(r)}>{r}</Btn>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--gap)" }}>
        <Kpi label="Reach" value={`${(151.9*mult).toFixed(1)}k`} delta={12} unit="%" sparkline={[0.3,0.35,0.5,0.45,0.55,0.5,0.6,0.65,0.7,0.75,0.8]}/>
        <Kpi label="Saves" value={Math.round(9250*mult).toLocaleString()} delta={8} unit="%" sparkline={[0.4,0.5,0.45,0.6,0.55,0.65,0.7,0.68,0.75,0.8,0.85]}/>
        <Kpi label="Email CTR" value="4.1" unit="%" delta={0.4} sparkline={[0.5,0.55,0.6,0.5,0.65,0.7,0.68,0.72,0.78,0.8,0.82]}/>
        <Kpi label="Influenced rev" value={`£${(48.2*mult).toFixed(1)}k`} delta={15} unit="%" sparkline={[0.2,0.3,0.4,0.45,0.5,0.6,0.65,0.7,0.78,0.82,0.88]}/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--gap)" }}>
        <Card title="Performance by tone mode" meta={`saves · ${state.dateRange}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            {byTone.map(t => (
              <div key={t.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 500 }}>{t.name} <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>· {t.posts} posts</span></span>
                  <span className="mono" style={{ color: "var(--muted)", letterSpacing: "0.03em" }}>{Math.round(t.saves*mult).toLocaleString()} saves · {t.ctr}% CTR · {(t.reach*mult/1000).toFixed(1)}k reach</span>
                </div>
                <div style={{ height: 8, borderRadius: 2, background: "var(--paper-2)", overflow: "hidden" }}>
                  <div style={{ width: `${(t.saves/max)*100}%`, height: "100%", background: t.fill, transition: "width .5s ease" }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Staleness detection" meta="intelligence">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ padding: 12, border: "1px solid var(--rule)", borderRadius: 5, background: "var(--warn-wash)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>'Wink' tone overused on TikTok</span>
                <Chip tone="warn">4 weeks</Chip>
              </div>
              <div style={{ color: "var(--ink-2)", fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
                Saves declined 23% since week 13. Supervisor recommends rotating to 'Witness' or 'Direct' next cycle.
              </div>
            </div>
            <div style={{ padding: 12, border: "1px solid var(--rule)", borderRadius: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>LinkedIn cadence below plan</span>
                <Chip>2 weeks</Chip>
              </div>
              <div style={{ color: "var(--ink-2)", fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
                Shipped 1.4 posts/week vs. 3 planned. Consider repurposing long-form Witness content.
              </div>
            </div>
            <div style={{ padding: 12, border: "1px solid var(--rule)", borderRadius: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>Email subject freshness ok</span>
                <Chip tone="ok">healthy</Chip>
              </div>
              <div style={{ color: "var(--ink-2)", fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>
                No repeated patterns in last 8 sends. Open rate holding at 38%.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Trend brief · week 17" meta="trend scout · click to change status">
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {state.trendBrief.map((t, i) => (
            <div key={t.id} style={{
              display: "grid", gridTemplateColumns: "60px 1fr 140px 240px",
              padding: "12px 0", borderTop: i === 0 ? 0 : "1px solid var(--rule)",
              alignItems: "center", gap: 12, fontSize: 13,
            }}>
              <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: t.status === "ignore" ? "var(--muted)" : "var(--ink)", letterSpacing: "0.02em" }}>{t.score}</div>
              <div>
                <div style={{ fontWeight: 500 }}>{t.title}</div>
                <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 3 }}>{t.note}</div>
              </div>
              <div style={{ height: 6, borderRadius: 2, background: "var(--paper-2)", overflow: "hidden" }}>
                <div style={{ width: `${t.score}%`, height: "100%", background: "var(--accent)" }}/>
              </div>
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                {["incorporate", "monitor", "ignore"].map(s => (
                  <button key={s} onClick={() => actions.setTrendStatus(t.id, s)}
                    style={{
                      padding: "3px 8px", fontSize: 10.5,
                      fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase",
                      border: `1px solid ${t.status === s ? "var(--ink)" : "var(--rule)"}`,
                      background: t.status === s ? "var(--ink)" : "var(--paper)",
                      color: t.status === s ? "var(--paper)" : "var(--ink-2)",
                      borderRadius: 3, cursor: "pointer",
                    }}>{s}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ────────────────────────────── INBOX & ESCALATION ──────────────────────────────
function InboxEscalation({ state, actions }) {
  const open = state.inbox.filter(i => i.status !== "replied" && i.status !== "archived");
  const [selectedId, setSelectedId] = useState3(open[0]?.id || state.inbox[0]?.id);
  const [draft, setDraft] = useState3("");
  const selected = state.inbox.find(i => i.id === selectedId) || open[0];

  React.useEffect(() => { if (selected) setDraft(selected.draft); }, [selectedId, selected?.id]);

  if (!selected) return <div style={{ padding: 40, color: "var(--muted)" }}>Inbox empty.</div>;

  const riskTone = selected.risk === "high" ? "danger" : selected.risk === "medium" ? "warn" : "ok";

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>07 · Listen</div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Inbox &amp; Escalation</h1>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>{open.length} inbound · {open.filter(i => i.risk !== "low").length} need a human</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "var(--gap)", flex: 1, minHeight: 0 }}>
        <div style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", overflow: "auto" }}>
          {state.inbox.map((item, i) => {
            if (item.status === "replied" || item.status === "archived") return null;
            const rt = item.risk === "high" ? "danger" : item.risk === "medium" ? "warn" : "ok";
            return (
              <div key={item.id} onClick={() => setSelectedId(item.id)} className="cell-btn"
                style={{
                  padding: "14px 16px",
                  borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                  background: selected?.id === item.id ? "var(--paper-2)" : "transparent",
                  cursor: "pointer",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em" }}>{item.source}</span>
                  <Chip tone={rt}>{item.risk}</Chip>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{item.author}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {item.text}
                </div>
              </div>
            );
          })}
          {open.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Inbox clear.</div>}
        </div>

        <div key={selected.id} className="anim-slide" style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", padding: 22, overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{selected.source} · {selected.category}</div>
              <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.015em", marginTop: 4 }}>{selected.author}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Chip tone={riskTone}>risk: {selected.risk}</Chip>
              {selected.risk !== "low" && <Chip tone="accent">human required</Chip>}
            </div>
          </div>

          <div style={{ padding: 16, background: "var(--paper-2)", borderRadius: 5, border: "1px solid var(--rule)", marginBottom: 20, fontSize: 14, lineHeight: 1.55, color: "var(--ink)" }}>
            {selected.text}
          </div>

          <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Drafted response</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>Supervisor · tone: {selected.risk === "low" ? "Wink" : "Direct"}</div>
          </div>
          {selected.risk === "high" ? (
            <div style={{
              padding: 16, border: "1px solid var(--rule)",
              borderLeft: "3px solid var(--danger)", borderRadius: 5,
              fontSize: 14, lineHeight: 1.55, marginBottom: 18,
              color: "var(--muted)", fontStyle: "italic",
            }}>
              — routing to press contact — <br/>
              <span style={{ fontSize: 12 }}>Press/PR is a hard boundary. No AI reply permitted. Draft handed to comms lead.</span>
            </div>
          ) : (
            <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
              style={{ marginBottom: 18, borderLeft: "3px solid var(--accent)" }}/>
          )}

          <div style={{ padding: 14, background: "var(--paper-2)", borderRadius: 5, marginBottom: 20, fontSize: 12 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              <Icon name="shield" size={11}/> Policy Guard · decision
            </div>
            {selected.risk === "low" && <div><Chip tone="ok">allow</Chip> <span style={{ color: "var(--ink-2)", marginLeft: 8 }}>low-risk · product question · confidence 0.91 · auto-reply permitted</span></div>}
            {selected.risk === "medium" && <div><Chip tone="warn">require approval</Chip> <span style={{ color: "var(--ink-2)", marginLeft: 8 }}>medium-risk category · service/partnership · must route to human</span></div>}
            {selected.risk === "high" && <div><Chip tone="danger">require approval</Chip> <span style={{ color: "var(--ink-2)", marginLeft: 8 }}>hard boundary · press/PR · no AI-drafted reply permitted</span></div>}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn size="sm" variant="ghost" onClick={() => actions.updateInbox(selected.id, { status: "archived" }, {
              logEvent: `archived inbox · ${selected.author}`, notify: { tone: "neutral", text: `Archived message from ${selected.author}` }
            })}><Icon name="x" size={12}/> Archive</Btn>
            <Btn size="sm" variant={selected.risk === "high" ? "default" : "primary"} disabled={selected.risk === "high"}
              onClick={() => actions.updateInbox(selected.id, { status: "replied", draft }, {
                logEvent: `replied · ${selected.source} · ${selected.author}`,
                notify: { tone: "ok", text: `Reply sent to ${selected.author}` }
              })}>
              <Icon name="send" size={12}/> {selected.risk === "low" ? "Send reply" : "Approve & send"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── AUTONOMY SETTINGS ──────────────────────────────
function AutonomySettings({ state, actions }) {
  const modes = [
    { id: "manual", name: "Manual / Copilot", desc: "Drafts and recommendations only. Nothing leaves the building without you.", risk: "lowest" },
    { id: "assisted", name: "Assisted Autonomous", desc: "Low-risk tasks run automatically. High-risk routes to approval.", risk: "recommended" },
    { id: "auto", name: "Autonomous with guardrails", desc: "Approved patterns publish within configured limits. Full audit.", risk: "advanced" },
  ];

  const cycleRule = (name, field, current) => {
    const options = field === "ai"
      ? ["review", "auto", "n/a"]
      : field === "reply"
        ? ["human", "auto", "n/a"]
        : ["human", "auto"];
    const avail = options.filter(o => o !== "n/a" || current === "n/a");
    if (current === "n/a") return;
    const idx = avail.indexOf(current);
    const next = avail[(idx + 1) % avail.length];
    actions.setChannelRule(name, field, next);
  };

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24, height: "100%", overflow: "auto" }}>
      <div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>08 · Control</div>
        <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Autonomy Settings</h1>
        <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>Global mode sets defaults. Channel rules can override within bounds.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--gap)" }}>
        {modes.map(m => (
          <button key={m.id} onClick={() => actions.setAutonomyMode(m.id)}
            style={{
              textAlign: "left", padding: 20,
              border: `1px solid ${state.autonomyMode === m.id ? "var(--ink)" : "var(--rule)"}`,
              background: state.autonomyMode === m.id ? "var(--paper-2)" : "var(--paper)",
              borderRadius: 6, cursor: "pointer",
              transition: "all .12s ease",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{m.risk}</span>
              {state.autonomyMode === m.id && <Chip tone="ink">active</Chip>}
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.015em" }}>{m.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{m.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
        <Card title="Channel rules" meta="click to cycle">
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 90px 90px 80px",
            fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)",
            textTransform: "uppercase", letterSpacing: "0.06em",
            padding: "6px 0", borderBottom: "1px solid var(--rule)",
          }}>
            <span>Channel</span><span>Publish</span><span>Reply</span><span>AI assets</span>
          </div>
          {state.channelRules.map(c => (
            <div key={c.name} style={{
              display: "grid", gridTemplateColumns: "1fr 90px 90px 80px",
              padding: "10px 0", borderBottom: "1px solid var(--rule)",
              alignItems: "center", fontSize: 12.5,
            }}>
              <span style={{ fontWeight: 500 }}>{c.name}</span>
              <span><button onClick={() => cycleRule(c.name, "publish", c.publish)} style={ruleBtn(c.publish === "auto")}>{c.publish}</button></span>
              <span>{c.reply === "n/a" ? <span style={{ color: "var(--muted-2)" }}>—</span> : <button onClick={() => cycleRule(c.name, "reply", c.reply)} style={ruleBtn(c.reply === "auto")}>{c.reply}</button>}</span>
              <span>{c.ai === "n/a" ? <span style={{ color: "var(--muted-2)" }}>—</span> : <button onClick={() => cycleRule(c.name, "ai", c.ai)} style={ruleBtn(c.ai === "auto", c.ai === "review")}>{c.ai}</button>}</span>
            </div>
          ))}
        </Card>

        <Card title="Hard boundaries" meta="always require a human">
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              "Strategy changes", "Paid spend changes", "Crisis, legal, or PR responses",
              "Core brand memory edits", "New tone mode creation",
              "AI-generated video asset publish", "Custom high-risk actions (set by owner)",
            ].map((t, i) => (
              <div key={t} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 0", borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                fontSize: 13,
              }}>
                <Icon name="lock" size={12}/>
                <span style={{ flex: 1 }}>{t}</span>
                <Chip>enforced</Chip>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Thresholds" meta="confidence + limits · drag to change">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          <ThresholdSlider label="Auto-reply confidence" suffix="min" unit=""
            value={state.thresholds.confidence} min={50} max={99}
            onChange={v => actions.setThreshold("confidence", v)}/>
          <ThresholdSlider label="Daily auto-publish cap" suffix="posts" unit=""
            value={state.thresholds.dailyCap} min={1} max={40}
            onChange={v => actions.setThreshold("dailyCap", v)}/>
          <ThresholdSlider label="Approval SLA" suffix="then escalate" unit="min"
            value={state.thresholds.sla} min={15} max={240}
            onChange={v => actions.setThreshold("sla", v)}/>
        </div>
      </Card>
    </div>
  );
}

function ruleBtn(isAuto, isReview) {
  const bg = isAuto ? "var(--success-wash)" : isReview ? "var(--warn-wash)" : "var(--paper-3)";
  const fg = isAuto ? "oklch(35% 0.1 155)" : isReview ? "oklch(38% 0.1 75)" : "var(--ink-2)";
  return {
    background: bg, color: fg, border: "0", borderRadius: 3,
    padding: "2px 7px", fontSize: 10.5, fontFamily: "var(--font-mono)",
    letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500,
    cursor: "pointer",
  };
}

function ThresholdSlider({ label, value, unit, suffix, min, max, onChange }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1 }}>{value}{unit}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em" }}>{suffix}</div>
      </div>
      <Slider value={value} onChange={onChange} min={min} max={max}/>
    </div>
  );
}

Object.assign(window, { PublishingQueue, InsightsCenter, InboxEscalation, AutonomySettings });
