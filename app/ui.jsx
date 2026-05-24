// FlowOS — shared UI primitives (merged from ui.jsx + ui2.jsx)
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ─── Utilities ────────────────────────────────────────────────────────────────

function cls(...xs) { return xs.filter(Boolean).join(" "); }

/** Format a Date (or now) as HH:MM */
function fmtTime(date) {
  const d = date || new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Primitive components ──────────────────────────────────────────────────────

function Chip({ tone = "neutral", children, mono = true }) {
  const map = {
    neutral:  { bg: "var(--paper-3)",    fg: "var(--ink-2)" },
    accent:   { bg: "var(--accent-wash)",fg: "var(--accent-ink)" },
    ok:       { bg: "var(--success-wash)", fg: "oklch(35% 0.1 155)" },
    warn:     { bg: "var(--warn-wash)",    fg: "oklch(38% 0.1 75)" },
    danger:   { bg: "var(--danger-wash)",  fg: "oklch(38% 0.14 25)" },
    ink:      { bg: "var(--ink)",          fg: "var(--paper)" },
  };
  const c = map[tone] || map.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 7px", borderRadius: 3,
      background: c.bg, color: c.fg,
      fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
      fontSize: 10.5, letterSpacing: "0.04em",
      textTransform: "uppercase", fontWeight: 500, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Dot({ status = "ok" }) {
  const c = { ok: "var(--success)", warn: "var(--warn)", err: "var(--danger)" }[status] || "var(--muted)";
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" }} />;
}

/** Consistent uppercase mono section label — replaces 20+ inline copies */
function SectionLabel({ children, style }) {
  return (
    <div className="mono" style={{
      fontSize: 10.5, color: "var(--muted)",
      letterSpacing: "0.08em", textTransform: "uppercase",
      ...style,
    }}>
      {children}
    </div>
  );
}

/** Centered spinner for loading states */
function Spinner({ size = 24, pad = 40 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: `${pad}px 0` }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        border: "2px solid var(--rule)", borderTopColor: "var(--accent)",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function Card({ title, meta, children, style }) {
  return (
    <div style={{
      border: "1px solid var(--rule)", background: "var(--paper)",
      borderRadius: 6, padding: "var(--pad-card)",
      display: "flex", flexDirection: "column", minHeight: 0, ...style
    }}>
      {(title || meta) && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 10, fontFamily: "var(--font-mono)",
          fontSize: 10.5, color: "var(--muted)",
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          <span>{title}</span><span>{meta}</span>
        </div>
      )}
      {children}
    </div>
  );
}

function Kpi({ label, value, unit, delta, sparkline }) {
  const positive = delta > 0;
  return (
    <Card title={label} meta={delta != null ? `${positive ? "+" : ""}${delta}${unit||""} 7d` : ""}>
      <div style={{
        fontSize: 28, letterSpacing: "-0.025em", fontWeight: 500,
        fontFamily: "var(--font-sans)", lineHeight: 1,
      }}>
        {value}{unit && <span style={{ fontSize: 16, color: "var(--muted)", marginLeft: 3 }}>{unit}</span>}
      </div>
      {sparkline && (
        <svg viewBox="0 0 200 32" preserveAspectRatio="none"
          style={{ width: "100%", height: 28, marginTop: 10 }}>
          <polyline fill="none" stroke="var(--accent)" strokeWidth="1.5"
            points={sparkline.map((v, i) => `${(i/(sparkline.length-1))*200},${32 - v*28}`).join(" ")} />
        </svg>
      )}
    </Card>
  );
}

function Btn({ children, onClick, variant = "default", size = "md", style, disabled, type, ...rest }) {
  const sizes = {
    sm: { padding: "5px 10px", fontSize: 12 },
    md: { padding: "7px 13px", fontSize: 13 },
    lg: { padding: "10px 18px", fontSize: 14 },
  };
  const variants = {
    default:  { background: "var(--paper)", color: "var(--ink)",   border: "1px solid var(--rule-strong)" },
    primary:  { background: "var(--accent)", color: "var(--accent-ink)", border: "1px solid var(--accent)" },
    accent:   { background: "var(--accent)",color: "var(--paper)", border: "1px solid var(--accent)" },
    ghost:    { background: "transparent",  color: "var(--ink-2)", border: "1px solid transparent" },
    danger:   { background: "var(--paper)", color: "var(--danger)",border: "1px solid var(--danger)" },
  };
  return (
    <button type={type || "button"} onClick={disabled ? undefined : onClick} disabled={disabled} {...rest}
      style={{
        ...variants[variant], ...sizes[size],
        borderRadius: 5, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-sans)", fontWeight: 500,
        display: "inline-flex", alignItems: "center", gap: 6,
        transition: "all .12s ease", opacity: disabled ? 0.5 : 1,
        ...style,
      }}>
      {children}
    </button>
  );
}

function Icon({ name, size = 14 }) {
  const paths = {
    plus:    <><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></>,
    check:   <polyline points="3 8 7 12 13 4" />,
    x:       <><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></>,
    arrow:   <><line x1="3" y1="8" x2="13" y2="8"/><polyline points="9 4 13 8 9 12" /></>,
    arrowl:  <><line x1="3" y1="8" x2="13" y2="8"/><polyline points="7 4 3 8 7 12" /></>,
    spark:   <polyline points="2 11 5 6 8 9 11 3 14 7" />,
    shield:  <path d="M8 2 L13 4 V8 Q13 12 8 14 Q3 12 3 8 V4 Z" />,
    eye:     <><path d="M1 8 Q4 3 8 3 Q12 3 15 8 Q12 13 8 13 Q4 13 1 8"/><circle cx="8" cy="8" r="2"/></>,
    bell:    <><path d="M4 11 V7 A4 4 0 0 1 12 7 V11 L13 12 H3 Z"/><path d="M6 13 A2 2 0 0 0 10 13"/></>,
    search:  <><circle cx="7" cy="7" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></>,
    calendar:<><rect x="2" y="3" width="12" height="11" rx="1"/><line x1="2" y1="6" x2="14" y2="6"/><line x1="5" y1="2" x2="5" y2="4"/><line x1="11" y1="2" x2="11" y2="4"/></>,
    send:    <><line x1="2" y1="14" x2="14" y2="2"/><polygon points="2 14 6 9 9 10 14 2"/></>,
    dot:     <circle cx="8" cy="8" r="2" />,
    pause:   <><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></>,
    play:    <polygon points="4 3 13 8 4 13" />,
    edit:    <><path d="M3 13 L3 10 L11 2 L14 5 L6 13 Z"/><line x1="9" y1="4" x2="12" y2="7"/></>,
    lock:    <><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7 V5 A3 3 0 0 1 11 5 V7"/></>,
    flash:   <polygon points="9 2 3 9 7 9 6 14 12 7 8 7" />,
    grid:    <><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></>,
    list:    <><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></>,
    inbox:   <><path d="M2 9 L5 3 H11 L14 9 V13 H2 Z"/><polyline points="2 9 6 9 7 11 9 11 10 9 14 9"/></>,
    chart:   <><line x1="2" y1="13" x2="14" y2="13"/><rect x="3" y="8" width="2" height="5"/><rect x="7" y="5" width="2" height="8"/><rect x="11" y="9" width="2" height="4"/></>,
    sliders: <><line x1="2" y1="5" x2="9" y2="5"/><line x1="11" y1="5" x2="14" y2="5"/><line x1="2" y1="11" x2="5" y2="11"/><line x1="7" y1="11" x2="14" y2="11"/><circle cx="10" cy="5" r="1.5"/><circle cx="6" cy="11" r="1.5"/></>,
    book:    <><path d="M3 2 H7 A2 2 0 0 1 8 4 V14 A2 2 0 0 0 7 12 H3 Z"/><path d="M13 2 H9 A2 2 0 0 0 8 4 V14 A2 2 0 0 1 9 12 H13 Z"/></>,
    globe:   <><circle cx="8" cy="8" r="6"/><line x1="2" y1="8" x2="14" y2="8"/><path d="M8 2 Q11 5 11 8 Q11 11 8 14 Q5 11 5 8 Q5 5 8 2"/></>,
    plug:    <><path d="M5 2 V6 H11 V2"/><path d="M8 6 V10"/><path d="M5 10 H11 V12 A3 3 0 0 1 5 12 Z"/></>,
    mail:    <><rect x="2" y="3" width="12" height="10" rx="1"/><polyline points="2 4 8 9 14 4"/></>,
    target:  <><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="0.5"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {paths[name] || null}
    </svg>
  );
}

// Simple Dialog — absolute-positioned within app frame
function Dialog({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (
    <div onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 50,
        background: "color-mix(in oklch, var(--ink) 36%, transparent)",
        backdropFilter: "blur(2px)",
        display: "grid", placeItems: "center",
        animation: "fadeIn .15s ease",
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          width, maxWidth: "90%", maxHeight: "86%", overflow: "auto",
          background: "var(--paper)", borderRadius: 8,
          border: "1px solid var(--rule-strong)",
          boxShadow: "0 24px 80px -20px oklch(20% 0.02 80 / 0.4)",
          animation: "scaleIn .18s ease",
        }}>
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid var(--rule)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{title}</div>
          <Btn variant="ghost" size="sm" onClick={onClose}><Icon name="x" size={13}/></Btn>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

// Status → chip tone mapping for calendar items
function statusChip(s) {
  const m = {
    approved:  { tone: "ok",     label: "approved" },
    scheduled: { tone: "accent", label: "scheduled" },
    draft:     { tone: "neutral",label: "draft" },
    review:    { tone: "warn",   label: "review" },
    policy:    { tone: "warn",   label: "policy" },
    sent:      { tone: "ok",     label: "sent" },
    blocked:   { tone: "danger", label: "blocked" },
  };
  return m[s] || m.draft;
}

// Animation utilities injected once into <head>
const ANIM_STYLE = `
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
.anim-fade { animation: fadeIn .25s ease; }
@keyframes scaleIn { from { opacity: 0; transform: translateY(6px) scale(.99) } to { opacity: 1; transform: none } }
@keyframes slideIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
@keyframes dotPulse { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.4); opacity: 0.5 } }
.dot-pulse { animation: dotPulse 1.1s ease-in-out infinite; }
.anim-fade { animation: fadeIn .25s ease; }
.anim-slide { animation: slideIn .22s ease both; }
.anim-pulse { animation: pulse 1.6s ease-in-out infinite; }
.row-hover:hover { background: var(--paper-2); }
.cell-btn { cursor: pointer; transition: all .12s ease; }
.cell-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px -6px oklch(20% 0.02 80 / 0.15); }
`;

// ─── Form + overlay components (previously ui2.jsx) ───────────────────────────

function Drawer({ open, onClose, title, width = 520, children, actions }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, zIndex: 40,
        background: open ? "color-mix(in oklch, var(--ink) 30%, transparent)" : "transparent",
        pointerEvents: open ? "auto" : "none",
        transition: "background .2s ease",
      }}/>
      <aside style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width, maxWidth: "92%",
        background: "var(--paper)",
        borderLeft: "1px solid var(--rule-strong)",
        boxShadow: "-30px 0 60px -30px oklch(20% 0.02 80 / 0.3)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .24s cubic-bezier(.2,.8,.2,1)",
        zIndex: 41, display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid var(--rule)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
          <Btn variant="ghost" size="sm" onClick={onClose}><Icon name="x" size={13}/></Btn>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>{children}</div>
        {actions && (
          <div style={{
            padding: 14, borderTop: "1px solid var(--rule)",
            display: "flex", gap: 8, justifyContent: "flex-end",
            background: "var(--paper-2)", flexShrink: 0,
          }}>{actions}</div>
        )}
      </aside>
    </>
  );
}

const inputCSS = {
  width: "100%", padding: "9px 11px",
  border: "1px solid var(--rule-strong)", borderRadius: 5,
  fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)",
  background: "var(--paper)", outline: "none", resize: "vertical",
};

function Input(props) { return <input {...props} style={{ ...inputCSS, ...(props.style||{}) }} />; }
function Textarea(props) { return <textarea {...props} style={{ ...inputCSS, minHeight: 80, ...(props.style||{}) }} />; }

function FormRow({ label, hint, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <SectionLabel>{label}</SectionLabel>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}

function Slider({ value, onChange, min = 0, max = 100, step = 1 }) {
  return (
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: "100%", accentColor: "var(--ink)" }}/>
  );
}

function Toggle({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", border: "1px solid var(--rule-strong)", borderRadius: 4, padding: 2, background: "var(--paper)", width: "fit-content" }}>
      {options.map(o => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <button key={v} onClick={() => onChange(v)}
            style={{
              padding: "5px 11px", border: 0, borderRadius: 3,
              background: value === v ? "var(--paper-3)" : "transparent",
              color: value === v ? "var(--ink)" : "var(--ink-2)",
              fontSize: 11.5, fontFamily: "var(--font-sans)", cursor: "pointer",
              fontWeight: 500, letterSpacing: "0.01em", textTransform: "capitalize",
            }}>{l}</button>
        );
      })}
    </div>
  );
}

function EditableList({ items, onAdd, onRemove, placeholder = "add…", tone = "ok" }) {
  const [val, setVal] = useState("");
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        {items.map(it => (
          <span key={it} onClick={() => onRemove(it)} title="click to remove"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 3,
              background: tone === "ok" ? "var(--success-wash)" : "var(--danger-wash)",
              color: tone === "ok" ? "oklch(35% 0.1 155)" : "oklch(38% 0.14 25)",
              fontSize: 11, cursor: "pointer", transition: "opacity .12s",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 0.6}
            onMouseLeave={e => e.currentTarget.style.opacity = 1}>
            {it} <Icon name="x" size={9}/>
          </span>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
        style={{ display: "flex", gap: 6 }}>
        <Input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} style={{ padding: "6px 9px", fontSize: 12 }}/>
        <Btn size="sm" type="submit"><Icon name="plus" size={11}/></Btn>
      </form>
    </div>
  );
}

function NotifBell({ notifications, onDismiss, onClearAll }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          background: "transparent", border: "1px solid var(--rule)",
          borderRadius: 999, padding: "4px 10px",
          fontSize: 11.5, color: "var(--muted)", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-sans)",
        }}>
        <Icon name="bell" size={11}/>
        {notifications.length > 0 && (
          <span style={{
            background: "var(--accent)", color: "var(--paper)",
            borderRadius: 999, padding: "0 6px", fontSize: 10,
            fontFamily: "var(--font-mono)", fontWeight: 500,
          }}>{notifications.length}</span>
        )}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }}/>
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)",
            width: 340, background: "var(--paper)",
            border: "1px solid var(--rule-strong)", borderRadius: 6,
            boxShadow: "0 20px 60px -20px oklch(20% 0.02 80 / 0.35)",
            zIndex: 51, animation: "scaleIn .15s ease",
            maxHeight: 420, display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <SectionLabel>Activity</SectionLabel>
              {notifications.length > 0 && <button onClick={onClearAll} style={{ background: "transparent", border: 0, fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>Clear all</button>}
            </div>
            <div style={{ overflow: "auto", flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>No new activity</div>
              ) : notifications.map(n => (
                <div key={n.id} style={{
                  padding: "10px 14px", borderBottom: "1px solid var(--rule)",
                  display: "flex", gap: 10, alignItems: "flex-start",
                  animation: "slideIn .2s ease",
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", marginTop: 6, flexShrink: 0,
                    background: n.tone === "ok" ? "var(--success)" : n.tone === "warn" ? "var(--warn)" : n.tone === "accent" ? "var(--accent)" : "var(--muted)",
                  }}/>
                  <div style={{ flex: 1, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4 }}>{n.text}</div>
                  <button onClick={() => onDismiss(n.id)} style={{ background: "transparent", border: 0, color: "var(--muted)", cursor: "pointer", padding: 0 }}>
                    <Icon name="x" size={10}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

Object.assign(window, {
  cls, fmtTime,
  Chip, Dot, SectionLabel, Spinner,
  Card, Kpi, Btn, Icon, Dialog, statusChip, ANIM_STYLE,
  Drawer, Input, Textarea, FormRow, Slider, Toggle, EditableList, NotifBell, inputCSS,
});
