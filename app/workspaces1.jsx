// MVEDA workspaces — part 1: Command Center, Brand Memory
const { useState: useState1, useMemo: useMemo1, useEffect: useEffect1 } = React;

// ────────────────────────────── COMMAND CENTER ──────────────────────────────
function CommandCenter({ state, actions, go }) {
  const { kpis, today, user } = SEED;
  const connectors = Object.entries(state.connectors)
    .filter(([, v]) => v.connected)
    .map(([id, v]) => ({ name: SEED.connectorCatalog.find(c => c.id === id)?.name || id, status: v.status, note: v.note }));
  const [retrying, setRetrying] = useState1(null);

  const statusCount = useMemo1(() => {
    const c = { approved: 0, scheduled: 0, draft: 0, review: 0, policy: 0 };
    state.calendar.forEach(ci => { c[ci.status] = (c[ci.status]||0)+1; });
    return c;
  }, [state.calendar]);

  const retryConnector = (name) => {
    setRetrying(name);
    setTimeout(() => {
      actions.notify("ok", `${name} reconnected`);
      actions.log("Integration", `${name} · retry successful`);
      setRetrying(null);
    }, 1200);
  };

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{today}</div>
          <h1 style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-0.028em", margin: "6px 0 0", lineHeight: 1 }}>
            Good morning, {user.name.split(" ")[0]}.
          </h1>
          <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 14 }}>
            {state.approvals.length} items need you before 11:00 · weekly plan ready for review
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn size="sm" onClick={() => go("planner", { openNew: true })}><Icon name="plus" size={12}/> New campaign</Btn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--gap)" }}>
        <Kpi label="Acceptance rate" value={kpis.acceptance.v} unit={kpis.acceptance.unit} delta={kpis.acceptance.d}
          sparkline={[0.3,0.4,0.35,0.5,0.45,0.6,0.55,0.7,0.65,0.8,0.75]}/>
        <Kpi label="Shipped this week" value={kpis.shipped.v} unit={kpis.shipped.unit} delta={kpis.shipped.d}
          sparkline={[0.2,0.3,0.5,0.4,0.6,0.7,0.65,0.8,0.75,0.85,0.9]}/>
        <Kpi label="Policy compliance" value={kpis.compliance.v} unit={kpis.compliance.unit} delta={kpis.compliance.d}
          sparkline={[0.7,0.75,0.72,0.8,0.78,0.82,0.85,0.83,0.88,0.9,0.92]}/>
        <Kpi label="Avg. approval time" value={kpis.approval.v} unit={` ${kpis.approval.unit}`} delta={kpis.approval.d}
          sparkline={[0.9,0.85,0.8,0.75,0.7,0.72,0.65,0.6,0.55,0.5,0.45]}/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--gap)" }}>
        <Card title="Pending approvals" meta={`${state.approvals.length} items · policy guard`}>
          {state.approvals.length === 0 && (
            <div style={{ padding: "18px 0", color: "var(--muted)", fontSize: 13 }}>All clear. Nothing waiting on you.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {state.approvals.map((a, i) => (
              <div key={a.id} className="anim-slide" style={{
                display: "grid", gridTemplateColumns: "1fr auto",
                padding: "14px 0", borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                alignItems: "start", gap: 12,
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{a.title}</div>
                    <Chip tone={a.severity === "required" ? "danger" : a.severity === "revise" ? "warn" : "accent"}>{a.severity}</Chip>
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.5 }}>{a.reason}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-2)", marginTop: 6, letterSpacing: "0.04em" }}>{a.source} · {a.rule}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn size="sm" variant="ghost" onClick={() => {
                    if (a.itemId) go("studio", { selectId: a.itemId });
                    else if (a.inboxId) go("inbox", { selectId: a.inboxId });
                    else go("insights");
                  }}><Icon name="eye" size={12}/> Review</Btn>
                  {a.severity !== "required" && <Btn size="sm" variant="primary" onClick={() => actions.resolveApproval(a.id, "approve")}><Icon name="check" size={12}/> Approve</Btn>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Connector health" meta={`${connectors.filter(c=>c.status==="ok").length} ok · ${connectors.filter(c=>c.status!=="ok").length} warn`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 14px" }}>
            {connectors.map(c => (
              <div key={c.name} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 0", fontSize: 12.5,
              }}>
                <Dot status={c.status === "ok" ? "ok" : "warn"} />
                <span style={{ flex: 1 }}>{c.name}</span>
                {c.status !== "ok" ? (
                  <button onClick={() => retryConnector(c.name)} disabled={retrying === c.name}
                    style={{ background: "transparent", border: 0, color: "var(--accent-ink)", fontSize: 10, cursor: "pointer", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase", padding: 0 }}>
                    {retrying === c.name ? "…retrying" : "retry"}
                  </button>
                ) : (
                  <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.03em" }}>{c.note}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--gap)" }}>
        <Card title="Week of Apr 20–26" meta="plan · by status">
          <div style={{ display: "flex", gap: 0, height: 30, borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
            {[
              { k: "approved", fill: "var(--success)" },
              { k: "scheduled", fill: "var(--accent)" },
              { k: "review", fill: "var(--warn)" },
              { k: "policy", fill: "oklch(58% 0.14 40)" },
              { k: "draft", fill: "var(--rule-strong)" },
            ].map(b => (
              <div key={b.k} onClick={() => go("planner", { filterStatus: b.k })} title={`${b.k} ${statusCount[b.k]}`}
                style={{ flex: statusCount[b.k] || 0.001, background: b.fill, cursor: "pointer" }}/>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            <span>Approved {statusCount.approved}</span>
            <span>Scheduled {statusCount.scheduled}</span>
            <span>Review {statusCount.review}</span>
            <span>Policy {statusCount.policy}</span>
            <span>Draft {statusCount.draft}</span>
          </div>
          <div style={{ height: 1, background: "var(--rule)", margin: "20px 0 14px" }}/>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Tone mode mix</div>
          <div style={{ display: "flex", gap: 0, height: 24, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ flex: 3.2, background: "var(--accent)" }}/>
            <div style={{ flex: 2.1, background: "oklch(58% 0.11 200)" }}/>
            <div style={{ flex: 1.4, background: "oklch(70% 0.1 140)" }}/>
            <div style={{ flex: 0.9, background: "oklch(78% 0.09 85)" }}/>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            <span>Direct 42%</span><span>Witness 28%</span><span>Invite 18%</span><span>Wink 12%</span>
          </div>
        </Card>

        <Card title="Activity" meta="live">
          <div style={{ display: "flex", flexDirection: "column", gap: 0, maxHeight: 280, overflow: "auto" }}>
            {state.activity.slice(0, 14).map((e, i) => (
              <div key={e.id} style={{
                display: "grid", gridTemplateColumns: "44px 1fr",
                gap: 10, padding: "7px 0",
                borderTop: i === 0 ? 0 : "1px dashed var(--rule)",
                fontSize: 12,
              }}>
                <span className="mono" style={{ color: "var(--muted)", fontSize: 10.5 }}>{e.t}</span>
                <div>
                  <span className="mono" style={{ color: "var(--accent-ink)", fontSize: 10.5, marginRight: 6, letterSpacing: "0.04em" }}>{e.actor}</span>
                  <span style={{ color: "var(--ink-2)" }}>{e.event}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
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
