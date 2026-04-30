// MVEDA ui2 — Drawer, Input, Textarea, Confirm, Slider, Toggle, NotifBell
const { useState: useStateUI2, useEffect: useEffectUI2, useRef: useRefUI2 } = React;

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
      <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
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
              background: value === v ? "var(--ink)" : "transparent",
              color: value === v ? "var(--paper)" : "var(--ink-2)",
              fontSize: 11.5, fontFamily: "var(--font-sans)", cursor: "pointer",
              fontWeight: 500, letterSpacing: "0.01em", textTransform: "capitalize",
            }}>{l}</button>
        );
      })}
    </div>
  );
}

function EditableList({ items, onAdd, onRemove, placeholder = "add…", tone = "ok" }) {
  const [val, setVal] = useStateUI2("");
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
  const [open, setOpen] = useStateUI2(false);
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
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Activity</div>
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

Object.assign(window, { Drawer, Input, Textarea, FormRow, Slider, Toggle, EditableList, NotifBell, inputCSS });
