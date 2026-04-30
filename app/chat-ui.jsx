// MVEDA Chat-OS — main shell
const { useState: useStateChat, useEffect: useEffectChat, useRef: useRefChat, useMemo: useMemoChat } = React;

// ────────────────────────────── SPECIALIST AVATAR ──────────────────────────────
function SpecialistAvatar({ id, size = 28 }) {
  const sp = SPECIALISTS.find(s => s.id === id) || SPECIALISTS[0];
  return (
    <div title={sp.name} style={{
      width: size, height: size, borderRadius: 5,
      background: sp.color, color: "var(--paper)",
      display: "grid", placeItems: "center",
      fontFamily: "var(--font-serif)", fontSize: size * 0.5, fontWeight: 500,
      flexShrink: 0,
    }}>{sp.glyph}</div>
  );
}

function UserAvatar({ name, size = 28 }) {
  const initials = name.split(/\s+/).map(s => s[0]).slice(0,2).join("");
  return (
    <div style={{
      width: size, height: size, borderRadius: 5,
      background: "var(--paper-3)", color: "var(--ink)",
      border: "1px solid var(--rule)",
      display: "grid", placeItems: "center",
      fontSize: size * 0.42, fontWeight: 500, letterSpacing: "-0.01em",
      flexShrink: 0,
    }}>{initials}</div>
  );
}

// ────────────────────────────── ARTIFACT CARDS (in-thread) ─────────────────────
function ArtifactCard({ artifact, onOpen }) {
  if (!artifact) return null;
  const t = artifact.type;

  if (t === "email") {
    return (
      <button onClick={() => onOpen({ kind: "email", data: artifact })}
        style={{
          display: "block", width: "100%", textAlign: "left",
          marginTop: 8, padding: 14,
          background: "var(--paper)", border: "1px solid var(--rule-strong)",
          borderRadius: 6, cursor: "pointer", transition: "border-color .12s",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="mail" size={13}/>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Email · draft</span>
          <Chip>klaviyo</Chip>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{artifact.subject}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, whiteSpace: "pre-line", maxHeight: 56, overflow: "hidden" }}>{artifact.body}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>Click to expand →</div>
      </button>
    );
  }

  if (t === "policy-review") {
    return (
      <div style={{ marginTop: 8, padding: 14, background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Icon name="shield" size={13}/>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Policy review · {artifact.items.length} items</span>
        </div>
        {artifact.items.map((it, i) => (
          <div key={i} style={{ paddingTop: i ? 12 : 0, borderTop: i ? "1px solid var(--rule)" : 0, marginTop: i ? 12 : 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{it.title}</div>
            <div style={{ fontSize: 11.5, color: "oklch(48% 0.16 25)", marginTop: 3 }}>⚠ {it.flag}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.5 }}><span style={{ color: "var(--muted)" }}>Suggested:</span> {it.suggestion}</div>
          </div>
        ))}
      </div>
    );
  }

  if (t === "calendar-preview" || t === "campaign-plan") {
    return (
      <button onClick={() => onOpen({ kind: "calendar", data: artifact })}
        style={{
          display: "block", width: "100%", textAlign: "left",
          marginTop: 8, padding: 14, cursor: "pointer",
          background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 6,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="calendar" size={13}/>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Campaign plan</span>
          <Chip tone="accent">{artifact.itemCount || 9} items</Chip>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{artifact.title || "Hair Ritual · launch week"}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{artifact.summary || "9 items · 5 channels · Apr 27 → May 3"}</div>
        <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 8, fontWeight: 500 }}>Open in canvas →</div>
      </button>
    );
  }

  if (t === "drafts") {
    return (
      <button onClick={() => onOpen({ kind: "drafts", data: artifact })}
        style={{
          display: "block", width: "100%", textAlign: "left",
          marginTop: 8, padding: 14, cursor: "pointer",
          background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 6,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="edit" size={13}/>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{artifact.items.length} drafts ready</span>
        </div>
        {artifact.items.slice(0,2).map((d, i) => (
          <div key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "var(--ink-2)", marginTop: i ? 6 : 0, paddingTop: i ? 6 : 0, borderTop: i ? "1px dashed var(--rule)" : 0 }}>{d.title}</div>
        ))}
        <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 8, fontWeight: 500 }}>Open all in canvas →</div>
      </button>
    );
  }

  if (t === "strategy") {
    const families = artifact.families || {};
    const colors = {
      "Organic social": "oklch(72% 0.08 80)",
      "Owned (email)":  "oklch(48% 0.04 80)",
      "Paid search":    "oklch(60% 0.13 240)",
      "Paid social":    "oklch(56% 0.16 25)",
    };
    const entries = Object.entries(families).filter(([,v]) => v > 0);
    return (
      <button onClick={() => onOpen({ kind: "strategy" })}
        style={{
          display: "block", width: "100%", textAlign: "left",
          marginTop: 8, padding: 14, cursor: "pointer",
          background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 6,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="target" size={13}/>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Channel strategy · recommendation</span>
          {artifact.version && <Chip tone="accent">v{artifact.version}</Chip>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{artifact.title || "Recommended channel mix"}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4, marginBottom: 10 }}>{artifact.summary}</div>
        <div style={{ display: "flex", height: 22, borderRadius: 3, overflow: "hidden", border: "1px solid var(--rule)" }}>
          {entries.map(([name, pct]) => (
            <div key={name} title={`${name} · ${pct}%`} style={{
              width: `${pct}%`, background: colors[name],
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--paper)", fontSize: 10, fontWeight: 500,
            }}>{pct >= 12 ? `${pct}%` : ""}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
          {entries.map(([name, pct]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--muted-2)" }}>
              <span style={{ width: 8, height: 8, background: colors[name], borderRadius: 2 }}/>
              <span>{name} {pct}%</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 10, fontWeight: 500 }}>Open strategy in canvas →</div>
      </button>
    );
  }

  if (t === "metric") {
    return (
      <div style={{ marginTop: 8, padding: 14, background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 6 }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{artifact.label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="serif" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}>{artifact.value}</span>
          {artifact.delta && <span style={{ fontSize: 12, color: artifact.delta.startsWith("+") ? "var(--success)" : "oklch(48% 0.16 25)" }}>{artifact.delta}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>{artifact.note}</div>
      </div>
    );
  }

  return null;
}

// ────────────────────────────── MESSAGE ROW ──────────────────────────────
function Message({ m, onOpen, onConfirm }) {
  const isUser   = m.kind === "user";
  const isSystem = m.kind === "system";
  return (
    <div style={{
      display: "flex", gap: 10, padding: "10px 18px",
      background: isSystem ? "var(--paper-2)" : "transparent",
      borderLeft: isSystem ? "2px solid var(--accent)" : "2px solid transparent",
    }}>
      {isUser
        ? <UserAvatar name={m.author}/>
        : <SpecialistAvatar id={(m.author || "supervisor").toLowerCase().replace(/\s+/g,"")}/>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>{m.author}</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>{m.time}</span>
          {!isUser && !isSystem && <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>· agent</span>}
          {isSystem && <Chip tone="accent">confirm</Chip>}
        </div>
        {m.text && <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{m.text}</div>}
        {m.artifact && <ArtifactCard artifact={m.artifact} onOpen={onOpen}/>}
        {m.confirm && (
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <Btn size="sm" variant="primary" onClick={() => onConfirm(m, true)}><Icon name="check" size={11}/> {m.confirm.yes}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => onConfirm(m, false)}>{m.confirm.no}</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────── BRIEFING CARD ──────────────────────────────
function BriefingCard({ briefing, onAction }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--rule)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <SpecialistAvatar id="supervisor" size={32}/>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Supervisor</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>06:00 · auto</span>
            <Chip>morning briefing</Chip>
          </div>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1.2, marginTop: 10, fontWeight: 500, letterSpacing: "-0.015em" }}>{briefing.greeting}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{briefing.date}</div>

          <div style={{ marginTop: 16 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Overnight</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {briefing.overnight.map((o, i) => (
                <li key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
                  <span style={{ color: o.kind === "warn" ? "oklch(60% 0.16 60)" : "var(--success)", fontFamily: "var(--font-mono)", fontSize: 10, marginTop: 4 }}>
                    {o.kind === "warn" ? "▲" : "✓"}
                  </span>
                  <span>{o.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Needs you · {briefing.needsYou.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {briefing.needsYou.map(n => (
                <div key={n.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", border: "1px solid var(--rule)",
                  borderRadius: 5, background: "var(--paper)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{n.sub}</div>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={() => onAction(n)}>{n.action} <Icon name="arrow" size={11}/></Btn>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Or, I could…</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {briefing.suggestedMoves.map((s, i) => (
                <button key={i} onClick={() => onAction({ suggested: s })}
                  style={{
                    textAlign: "left", padding: "8px 12px",
                    border: "1px dashed var(--rule)", borderRadius: 4,
                    background: "transparent", cursor: "pointer",
                    fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--font-sans)",
                  }}>
                  <span style={{ color: "var(--accent-ink)", marginRight: 6 }}>→</span>{s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── COMPOSER (multi-modal input) ───────────────────
function Composer({ onSend, channelName }) {
  const [val, setVal] = useStateChat("");
  const [recording, setRecording] = useStateChat(false);
  const [files, setFiles] = useStateChat([]);
  const taRef = useRefChat();

  useEffectChat(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [val]);

  const send = () => {
    if (!val.trim() && !files.length) return;
    onSend({ text: val, files });
    setVal(""); setFiles([]);
  };

  const onPaste = (e) => {
    const url = e.clipboardData.getData("text");
    if (/^https?:\/\//.test(url)) {
      // Attach as URL chip after a tick
    }
  };

  return (
    <div style={{ borderTop: "1px solid var(--rule)", background: "var(--paper)", padding: 12 }}>
      {files.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 8px 4px 6px", border: "1px solid var(--rule)",
              borderRadius: 4, fontSize: 11.5, background: "var(--paper-2)",
            }}>
              <Icon name={f.kind === "url" ? "globe" : "edit"} size={11}/>
              <span>{f.label}</span>
              <button onClick={() => setFiles(files.filter((_,j) => j !== i))}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--muted)", padding: 0, fontSize: 12 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{
        display: "flex", gap: 8, alignItems: "flex-end",
        border: "1px solid var(--rule-strong)", borderRadius: 8,
        padding: "8px 10px", background: "var(--paper)",
      }}>
        <textarea ref={taRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onPaste={onPaste}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={`Message ${channelName} — drag a file, paste a URL, or hold Space to talk`}
          rows={1}
          style={{
            flex: 1, border: 0, resize: "none", outline: "none",
            fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.55,
            background: "transparent", color: "var(--ink)",
            maxHeight: 180, padding: "4px 0",
          }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 4, paddingBottom: 2 }}>
          <button onClick={() => setFiles([...files, { kind: "file", label: "brief-q3.pdf" }])}
            title="Attach file"
            style={btn}><Icon name="plus" size={14}/></button>
          <button onClick={() => setFiles([...files, { kind: "url", label: "mveda.co/products/hair-mist" }])}
            title="Attach URL"
            style={btn}><Icon name="globe" size={14}/></button>
          <button
            onMouseDown={() => setRecording(true)}
            onMouseUp={() => { setRecording(false); setVal(val + (val ? " " : "") + "[transcript: draft a soft launch teaser for the saffron restock]"); }}
            onMouseLeave={() => setRecording(false)}
            title="Hold to dictate"
            style={{ ...btn, background: recording ? "var(--accent)" : "transparent", color: recording ? "var(--paper)" : "var(--ink)" }}>
            <Icon name="dot" size={14}/>
          </button>
        </div>
        <Btn size="sm" variant="primary" onClick={send} disabled={!val.trim() && !files.length}>
          Send <Icon name="arrow" size={11}/>
        </Btn>
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--muted-2)", letterSpacing: "0.04em", marginTop: 6, textAlign: "center" }}>
        ⌘↵ send · ⇧↵ newline · paste any URL to ingest · {recording ? <span style={{ color: "var(--accent)" }}>● recording</span> : "hold mic to dictate"}
      </div>
    </div>
  );
}
const btn = {
  width: 26, height: 26, borderRadius: 4,
  border: 0, background: "transparent", cursor: "pointer",
  display: "grid", placeItems: "center", color: "var(--muted)",
};

Object.assign(window, { SpecialistAvatar, UserAvatar, ArtifactCard, Message, BriefingCard, Composer });
