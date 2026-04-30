// MVEDA — onboarding wizard (Klaviyo-style: clean step rail, website scan → live brand theme)
const { useState: useStateOB, useEffect: useEffectOB, useRef: useRefOB } = React;

// ─── Brand palette library ─────────────────────────────────────────────────
// Each preset maps to a full set of CSS custom property overrides.
// "scan" picks one deterministically from the entered URL so demos look smart.
const BRAND_PALETTES = [
  {
    id: "warm-earth",
    name: "Warm Earth",
    desc: "Cream · Copper · Umber",
    swatches: ["oklch(97% 0.012 75)", "oklch(58% 0.13 45)", "oklch(22% 0.022 55)", "oklch(52% 0.06 145)"],
    vars: {
      "--paper":          "oklch(97% 0.012 75)",
      "--paper-2":        "oklch(94.5% 0.016 75)",
      "--paper-3":        "oklch(91% 0.020 75)",
      "--ink":            "oklch(22% 0.022 55)",
      "--ink-2":          "oklch(34% 0.020 55)",
      "--muted":          "oklch(50% 0.018 55)",
      "--muted-2":        "oklch(64% 0.014 60)",
      "--rule":           "oklch(88% 0.014 70)",
      "--rule-strong":    "oklch(78% 0.018 65)",
      "--accent":         "oklch(58% 0.13 45)",
      "--accent-ink":     "oklch(38% 0.10 45)",
      "--accent-wash":    "oklch(94% 0.028 50)",
    },
  },
  {
    id: "dark-luxury",
    name: "Dark Luxury",
    desc: "Ink · Gold · Champagne",
    swatches: ["oklch(14% 0.010 50)", "oklch(72% 0.14 85)", "oklch(95% 0.008 80)", "oklch(48% 0.09 165)"],
    vars: {
      "--paper":          "oklch(16% 0.012 50)",
      "--paper-2":        "oklch(13% 0.010 50)",
      "--paper-3":        "oklch(11% 0.008 50)",
      "--ink":            "oklch(93% 0.010 75)",
      "--ink-2":          "oklch(80% 0.008 70)",
      "--muted":          "oklch(56% 0.010 65)",
      "--muted-2":        "oklch(42% 0.008 60)",
      "--rule":           "oklch(25% 0.012 55)",
      "--rule-strong":    "oklch(32% 0.014 55)",
      "--accent":         "oklch(72% 0.14 85)",
      "--accent-ink":     "oklch(58% 0.12 82)",
      "--accent-wash":    "oklch(22% 0.030 80)",
    },
  },
  {
    id: "clean-white",
    name: "Clean White",
    desc: "Pure · Navy · Cobalt",
    swatches: ["oklch(99% 0.003 260)", "oklch(36% 0.14 255)", "oklch(22% 0.020 250)", "oklch(54% 0.10 220)"],
    vars: {
      "--paper":          "oklch(99% 0.003 260)",
      "--paper-2":        "oklch(96% 0.008 240)",
      "--paper-3":        "oklch(93% 0.012 240)",
      "--ink":            "oklch(18% 0.015 250)",
      "--ink-2":          "oklch(30% 0.015 250)",
      "--muted":          "oklch(52% 0.012 240)",
      "--muted-2":        "oklch(66% 0.010 240)",
      "--rule":           "oklch(88% 0.008 250)",
      "--rule-strong":    "oklch(78% 0.010 245)",
      "--accent":         "oklch(48% 0.18 255)",
      "--accent-ink":     "oklch(34% 0.16 255)",
      "--accent-wash":    "oklch(94% 0.04 255)",
    },
  },
  {
    id: "forest",
    name: "Forest",
    desc: "Parchment · Deep Green · Sage",
    swatches: ["oklch(96% 0.014 110)", "oklch(36% 0.12 148)", "oklch(20% 0.015 140)", "oklch(62% 0.09 145)"],
    vars: {
      "--paper":          "oklch(96% 0.014 100)",
      "--paper-2":        "oklch(93% 0.018 105)",
      "--paper-3":        "oklch(90% 0.022 105)",
      "--ink":            "oklch(20% 0.016 138)",
      "--ink-2":          "oklch(32% 0.016 140)",
      "--muted":          "oklch(50% 0.014 135)",
      "--muted-2":        "oklch(64% 0.012 130)",
      "--rule":           "oklch(87% 0.016 115)",
      "--rule-strong":    "oklch(76% 0.020 118)",
      "--accent":         "oklch(42% 0.14 150)",
      "--accent-ink":     "oklch(30% 0.12 148)",
      "--accent-wash":    "oklch(93% 0.040 145)",
    },
  },
  {
    id: "coral-pop",
    name: "Coral Pop",
    desc: "Warm White · Coral · Terracotta",
    swatches: ["oklch(98% 0.008 50)", "oklch(60% 0.18 30)", "oklch(42% 0.10 35)", "oklch(54% 0.08 170)"],
    vars: {
      "--paper":          "oklch(98% 0.008 50)",
      "--paper-2":        "oklch(95% 0.012 50)",
      "--paper-3":        "oklch(92% 0.016 50)",
      "--ink":            "oklch(22% 0.014 40)",
      "--ink-2":          "oklch(34% 0.014 42)",
      "--muted":          "oklch(52% 0.012 45)",
      "--muted-2":        "oklch(66% 0.010 48)",
      "--rule":           "oklch(88% 0.012 55)",
      "--rule-strong":    "oklch(78% 0.015 52)",
      "--accent":         "oklch(58% 0.20 28)",
      "--accent-ink":     "oklch(40% 0.16 28)",
      "--accent-wash":    "oklch(94% 0.046 30)",
    },
  },
  {
    id: "slate-modern",
    name: "Slate Modern",
    desc: "Cool Grey · Indigo · Violet",
    swatches: ["oklch(97% 0.006 270)", "oklch(50% 0.18 280)", "oklch(24% 0.012 270)", "oklch(66% 0.10 200)"],
    vars: {
      "--paper":          "oklch(97% 0.006 270)",
      "--paper-2":        "oklch(94% 0.008 270)",
      "--paper-3":        "oklch(91% 0.010 270)",
      "--ink":            "oklch(22% 0.012 265)",
      "--ink-2":          "oklch(34% 0.012 265)",
      "--muted":          "oklch(52% 0.010 260)",
      "--muted-2":        "oklch(66% 0.008 260)",
      "--rule":           "oklch(88% 0.008 270)",
      "--rule-strong":    "oklch(78% 0.010 265)",
      "--accent":         "oklch(52% 0.20 280)",
      "--accent-ink":     "oklch(36% 0.18 278)",
      "--accent-wash":    "oklch(94% 0.040 278)",
    },
  },
];

// Pick palette deterministically from URL so the same brand always gets same theme
function paletteFromUrl(url) {
  const domain = url.replace(/https?:\/\//,"").split("/")[0].replace(/^www\./,"");
  let hash = 0;
  for (let i = 0; i < domain.length; i++) hash = (hash * 31 + domain.charCodeAt(i)) & 0xffff;
  return BRAND_PALETTES[hash % BRAND_PALETTES.length];
}

// Apply palette to :root CSS variables
function applyPalette(palette) {
  const root = document.documentElement;
  Object.entries(palette.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

// Revert to token defaults
function revertPalette() {
  const root = document.documentElement;
  Object.keys(BRAND_PALETTES[0].vars).forEach(k => root.style.removeProperty(k));
}

// ─── Scan steps (mimics the BrandImportModal) ──────────────────────────────
const SCAN_STEPS = [
  { label: "Fetching homepage…",                  delay: 350 },
  { label: "Reading meta + Open Graph tags",       delay: 320 },
  { label: "Extracting colour palette from CSS",   delay: 480 },
  { label: "Detecting display + body fonts",       delay: 420 },
  { label: "Sampling hero & product copy",         delay: 520 },
  { label: "Inferring brand voice from headlines", delay: 440 },
  { label: "Checking logo + icon library",         delay: 380 },
  { label: "Compiling brand memory candidate",     delay: 340 },
];

// ─── Industries ────────────────────────────────────────────────────────────
const INDUSTRIES = [
  "Beauty & wellness", "Fashion & apparel", "Home & living",
  "Food & beverage", "Sports & outdoor", "Health & supplements",
  "Jewellery & accessories", "Pet care", "Consumer tech", "Other",
];

const GOALS = [
  { id: "acquire",   icon: "target",   label: "Acquire new customers",   sub: "Grow reach, paid acquisition, awareness campaigns" },
  { id: "retain",    icon: "spark",    label: "Retain & grow",            sub: "Lifecycle, replenishment, VIP programmes" },
  { id: "launch",    icon: "flash",    label: "Launch a product",         sub: "Pre-launch buzz, email capture, creator seeding" },
  { id: "creative",  icon: "edit",     label: "Improve creative quality", sub: "Drafts, approvals, brand voice enforcement" },
  { id: "scale",     icon: "chart",    label: "Scale paid spend",         sub: "Pmax, Advantage+, Meta Ads, keyword expansion" },
];

const QUICK_CHANNELS = [
  // Organic social
  { id: "instagram",  label: "Instagram",   sub: "Organic social — feed, reels, stories", color: "#e1306c" },
  { id: "tiktok",     label: "TikTok",      sub: "Organic social — short video",          color: "#010101" },
  { id: "facebook",   label: "Facebook",    sub: "Organic social — pages & groups",       color: "#1877f2" },
  { id: "pinterest",  label: "Pinterest",   sub: "Organic social — pins & boards",        color: "#e60023" },
  { id: "youtube",    label: "YouTube",     sub: "Organic video — shorts & long-form",    color: "#ff0000" },
  // Paid social
  { id: "meta_ads",   label: "Meta Ads",    sub: "Paid social — Advantage+",              color: "#0866ff" },
  { id: "tiktok_ads", label: "TikTok Ads",  sub: "Paid social — spark ads",               color: "#69c9d0" },
  // Search
  { id: "google",     label: "Google Ads",  sub: "Search, Shopping & Pmax",               color: "#4285f4" },
  // Email & commerce
  { id: "klaviyo",    label: "Klaviyo",     sub: "Email & SMS",                           color: "#36c" },
  { id: "shopify",    label: "Shopify",     sub: "Commerce & data",                       color: "#96bf48" },
];

// ─── Progress dots ─────────────────────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 6,
          height: 6,
          borderRadius: 3,
          background: i === current ? "var(--accent)" : i < current ? "var(--accent-wash)" : "var(--rule-strong)",
          transition: "all .3s ease",
        }}/>
      ))}
    </div>
  );
}

// ─── Colour swatch ─────────────────────────────────────────────────────────
function PaletteCard({ palette, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", padding: "12px 14px", borderRadius: 8,
      border: `1.5px solid ${selected ? "var(--accent)" : "var(--rule)"}`,
      background: selected ? "var(--accent-wash)" : "var(--paper)",
      cursor: "pointer", display: "flex", flexDirection: "column", gap: 8,
      transition: "border-color .15s",
    }}>
      <div style={{ display: "flex", gap: 6 }}>
        {palette.swatches.map((c, i) => (
          <div key={i} style={{ width: 18, height: 18, borderRadius: 4, background: c, flexShrink: 0 }}/>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{palette.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{palette.desc}</div>
      </div>
    </button>
  );
}

// ─── Step 1 — Brand basics ─────────────────────────────────────────────────
function Step1({ data, onChange, onNext }) {
  const ready = data.storeName.trim().length > 0 && data.industry;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Step 1 of 4</div>
        <h2 className="serif" style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Tell us about<br/><em>your brand.</em>
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>
          A few quick details — no writing required.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Brand / store name</span>
          <input
            autoFocus
            value={data.storeName}
            onChange={e => onChange({ storeName: e.target.value })}
            placeholder="e.g. MVEDA Wellness"
            style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 6, fontSize: 14, fontFamily: "var(--font-sans)", background: "var(--paper)", color: "var(--ink)", outline: "none" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Industry</span>
          <select
            value={data.industry}
            onChange={e => onChange({ industry: e.target.value })}
            style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 6, fontSize: 14, fontFamily: "var(--font-sans)", background: "var(--paper)", color: data.industry ? "var(--ink)" : "var(--muted)", appearance: "none", cursor: "pointer" }}
          >
            <option value="">Select industry…</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Monthly revenue <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>(optional)</span></span>
          <select
            value={data.revenue}
            onChange={e => onChange({ revenue: e.target.value })}
            style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 6, fontSize: 14, fontFamily: "var(--font-sans)", background: "var(--paper)", color: data.revenue ? "var(--ink)" : "var(--muted)", appearance: "none", cursor: "pointer" }}
          >
            <option value="">Prefer not to say</option>
            <option value="pre">Pre-revenue</option>
            <option value="0-10k">Under £10k</option>
            <option value="10-50k">£10k – £50k</option>
            <option value="50-200k">£50k – £200k</option>
            <option value="200k+">£200k+</option>
          </select>
        </label>
      </div>

      <button disabled={!ready} onClick={onNext} style={{
        padding: "12px 24px", borderRadius: 6,
        background: ready ? "var(--accent)" : "var(--rule)", color: ready ? "var(--paper)" : "var(--muted)",
        border: "none", fontWeight: 500, fontSize: 14, fontFamily: "var(--font-sans)",
        cursor: ready ? "pointer" : "not-allowed", transition: "background .15s",
        alignSelf: "flex-start",
      }}>Continue →</button>
    </div>
  );
}

// ─── Step 2 — Brand identity scan ─────────────────────────────────────────
function Step2({ data, onChange, onNext, onBack }) {
  const [scanState, setScanState] = useStateOB("idle"); // idle | scanning | done
  const [scanLog, setScanLog] = useStateOB([]);
  const [palette, setPalette] = useStateOB(null);
  const [chosen, setChosen] = useStateOB(null);
  const timerRef = useRefOB(null);

  const startScan = () => {
    if (!data.website.trim()) return;
    setScanState("scanning");
    setScanLog([]);
    const detected = paletteFromUrl(data.website);
    setPalette(detected);
    let i = 0;
    const tick = () => {
      if (i >= SCAN_STEPS.length) {
        setScanState("done");
        setChosen(detected);
        // Apply preview immediately so user sees their colours live
        applyPalette(detected);
        return;
      }
      setScanLog(prev => [...prev, { ...SCAN_STEPS[i], status: "ok" }]);
      i++;
      timerRef.current = setTimeout(tick, SCAN_STEPS[i - 1].delay);
    };
    timerRef.current = setTimeout(tick, 200);
  };

  useEffectOB(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleChoose = (p) => {
    setChosen(p);
    applyPalette(p);
  };

  const ready = scanState === "done" && chosen;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Step 2 of 4</div>
        <h2 className="serif" style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Make FlowOS<br/><em>feel like you.</em>
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>
          We'll scan your website and extract your colour palette, fonts, and brand voice — then apply them to your workspace.
        </p>
      </div>

      {scanState === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Your website URL</span>
            <input
              autoFocus
              type="url"
              value={data.website}
              onChange={e => onChange({ website: e.target.value })}
              placeholder="https://yourbrand.com"
              onKeyDown={e => e.key === "Enter" && data.website.includes(".") && startScan()}
              style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 6, fontSize: 14, fontFamily: "var(--font-sans)", background: "var(--paper)", color: "var(--ink)" }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={!data.website.includes(".")} onClick={startScan} style={{
              padding: "11px 20px", borderRadius: 6, background: data.website.includes(".") ? "var(--ink)" : "var(--rule)",
              color: data.website.includes(".") ? "var(--paper)" : "var(--muted)",
              border: "none", fontWeight: 500, fontSize: 13.5, fontFamily: "var(--font-sans)", cursor: data.website.includes(".") ? "pointer" : "not-allowed",
            }}>Scan website</button>
            <button onClick={() => { onChange({ website: "" }); setScanState("done"); setChosen(BRAND_PALETTES[0]); applyPalette(BRAND_PALETTES[0]); }}
              style={{ padding: "11px 20px", borderRadius: 6, background: "transparent", border: "1px solid var(--rule-strong)", color: "var(--muted)", fontFamily: "var(--font-sans)", fontSize: 13.5, cursor: "pointer" }}>
              Skip — pick a theme
            </button>
          </div>
        </div>
      )}

      {scanState === "scanning" && (
        <div style={{ background: "var(--paper-3)", borderRadius: 8, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
            Scanning {data.website}
          </div>
          {scanLog.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
              <span style={{ color: "var(--success)", fontSize: 11 }}>✓</span>
              <span style={{ color: "var(--ink-2)" }}>{s.label}</span>
            </div>
          ))}
          {scanLog.length < SCAN_STEPS.length && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "var(--muted)" }}>
              <span className="dot-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }}/>
              <span>{SCAN_STEPS[scanLog.length]?.label}</span>
            </div>
          )}
        </div>
      )}

      {scanState === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {palette && (
            <div style={{ background: "var(--accent-wash)", border: "1px solid var(--accent)", borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--accent-ink)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Detected from {data.website || "your selection"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", gap: 5 }}>
                  {palette.swatches.map((c, i) => (
                    <div key={i} style={{ width: 22, height: 22, borderRadius: 5, background: c, border: "1px solid rgba(0,0,0,.08)" }}/>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{palette.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{palette.desc}</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Choose a different theme</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {BRAND_PALETTES.map(p => (
                <PaletteCard key={p.id} palette={p} selected={chosen?.id === p.id} onClick={() => handleChoose(p)}/>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ padding: "11px 18px", borderRadius: 6, background: "transparent", border: "1px solid var(--rule-strong)", color: "var(--ink-2)", fontFamily: "var(--font-sans)", fontSize: 13.5, cursor: "pointer" }}>← Back</button>
        {ready && (
          <button onClick={() => onNext({ chosenPalette: chosen })} style={{
            padding: "11px 24px", borderRadius: 6, background: "var(--accent)", color: "var(--paper)",
            border: "none", fontWeight: 500, fontSize: 14, fontFamily: "var(--font-sans)", cursor: "pointer",
          }}>Apply theme & continue →</button>
        )}
      </div>
    </div>
  );
}

// ─── Step 3 — Goals ────────────────────────────────────────────────────────
function Step3({ data, onChange, onNext, onBack }) {
  const ready = !!data.goal;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Step 3 of 4</div>
        <h2 className="serif" style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          What's your<br/><em>focus right now?</em>
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>
          FlowOS routes work to the right specialists based on your priority.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {GOALS.map(g => (
          <button key={g.id} onClick={() => onChange({ goal: g.id })} style={{
            textAlign: "left", padding: "13px 16px", borderRadius: 7,
            border: `1.5px solid ${data.goal === g.id ? "var(--accent)" : "var(--rule)"}`,
            background: data.goal === g.id ? "var(--accent-wash)" : "var(--paper)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "border-color .15s",
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: data.goal === g.id ? "var(--accent)" : "var(--paper-2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name={g.icon} size={14} style={{ color: data.goal === g.id ? "var(--paper)" : "var(--muted)" }}/>
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{g.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{g.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Monthly marketing budget</span>
        <select value={data.budget} onChange={e => onChange({ budget: e.target.value })}
          style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 6, fontSize: 14, fontFamily: "var(--font-sans)", background: "var(--paper)", color: data.budget ? "var(--ink)" : "var(--muted)", appearance: "none", cursor: "pointer" }}>
          <option value="">Optional</option>
          <option value="under-1k">Under £1k</option>
          <option value="1-5k">£1k – £5k</option>
          <option value="5-20k">£5k – £20k</option>
          <option value="20-50k">£20k – £50k</option>
          <option value="50k+">£50k+</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ padding: "11px 18px", borderRadius: 6, background: "transparent", border: "1px solid var(--rule-strong)", color: "var(--ink-2)", fontFamily: "var(--font-sans)", fontSize: 13.5, cursor: "pointer" }}>← Back</button>
        <button disabled={!ready} onClick={onNext} style={{
          padding: "11px 24px", borderRadius: 6,
          background: ready ? "var(--accent)" : "var(--rule)", color: ready ? "var(--paper)" : "var(--muted)",
          border: "none", fontWeight: 500, fontSize: 14, fontFamily: "var(--font-sans)", cursor: ready ? "pointer" : "not-allowed",
        }}>Continue →</button>
      </div>
    </div>
  );
}

// ─── Step 4 — Connect first channel ───────────────────────────────────────
function Step4({ data, onChange, onFinish, onBack }) {
  const [connecting, setConnecting] = useStateOB(null);
  const [connected, setConnected] = useStateOB([]);

  const connect = (id) => {
    setConnecting(id);
    setTimeout(() => {
      setConnected(prev => [...prev, id]);
      setConnecting(null);
    }, 900);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Step 4 of 4</div>
        <h2 className="serif" style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Connect your<br/><em>first channel.</em>
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>
          One click — you can always add more from Connections. Skip if you'd like to explore first.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {QUICK_CHANNELS.map(ch => {
          const isConnected = connected.includes(ch.id);
          const isConnecting = connecting === ch.id;
          return (
            <div key={ch.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
              border: `1.5px solid ${isConnected ? "var(--success)" : "var(--rule)"}`,
              borderRadius: 7, background: isConnected ? "var(--success-wash)" : "var(--paper)",
              transition: "all .2s",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ch.color, flexShrink: 0 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{ch.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{ch.sub}</div>
              </div>
              {isConnected ? (
                <span className="mono" style={{ fontSize: 10.5, color: "var(--success)", letterSpacing: "0.06em" }}>Connected</span>
              ) : (
                <button onClick={() => connect(ch.id)} disabled={!!connecting} style={{
                  padding: "6px 14px", borderRadius: 5, background: isConnecting ? "var(--rule)" : "var(--ink)",
                  color: "var(--paper)", border: "none", fontSize: 12, fontFamily: "var(--font-sans)", cursor: connecting ? "not-allowed" : "pointer",
                }}>
                  {isConnecting ? "…" : "Connect"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ padding: "11px 18px", borderRadius: 6, background: "transparent", border: "1px solid var(--rule-strong)", color: "var(--ink-2)", fontFamily: "var(--font-sans)", fontSize: 13.5, cursor: "pointer" }}>← Back</button>
        <button onClick={() => onFinish({ connectedChannels: connected })} style={{
          padding: "11px 24px", borderRadius: 6, background: "var(--accent)", color: "var(--paper)",
          border: "none", fontWeight: 500, fontSize: 14, fontFamily: "var(--font-sans)", cursor: "pointer",
        }}>{connected.length > 0 ? "Enter your workspace →" : "Skip — enter workspace →"}</button>
      </div>
    </div>
  );
}

// ─── Main wizard ───────────────────────────────────────────────────────────
function OnboardingWizard({ auth, onComplete }) {
  const [step, setStep] = useStateOB(0);
  const [form, setForm] = useStateOB({
    storeName: "",
    industry: "",
    revenue: "",
    website: "",
    goal: "",
    budget: "",
  });

  const merge = (updates) => setForm(prev => ({ ...prev, ...updates }));

  const finish = (extra) => {
    const result = { ...form, ...extra, completedAt: Date.now() };
    try { localStorage.setItem("flowos_onboarding", JSON.stringify(result)); } catch {}
    onComplete(result);
  };

  return (
    <div style={{
      minHeight: "100vh", height: "100vh", background: "var(--paper-2)",
      display: "grid", gridTemplateColumns: "1.1fr 1fr", overflow: "hidden",
    }}>
      {/* Left — brand panel */}
      <div style={{
        background: "var(--ink)", color: "var(--paper)",
        padding: "60px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between",
        position: "relative", overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--paper)", color: "var(--ink)", display: "grid", placeItems: "center", fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22 }}>F</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em" }}>FlowOS</div>
            <div className="mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.14em", textTransform: "uppercase" }}>AI Marketing OS</div>
          </div>
        </div>

        {/* Steps sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="mono" style={{ fontSize: 10.5, opacity: 0.55, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 20 }}>Getting started</div>
          {[
            { label: "Your brand",      sub: "Name, industry, scale" },
            { label: "Brand identity",  sub: "Website scan + theme" },
            { label: "Focus",           sub: "Goals + budget" },
            { label: "First channel",   sub: "One-click connect" },
          ].map((s, i) => (
            <div key={i} style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "12px 16px", borderRadius: 8,
              background: i === step ? "rgba(255,255,255,.10)" : "transparent",
              transition: "background .2s",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                background: i < step ? "var(--accent)" : i === step ? "var(--paper)" : "rgba(255,255,255,.15)",
                color: i < step ? "var(--paper)" : i === step ? "var(--ink)" : "rgba(255,255,255,.5)",
                display: "grid", placeItems: "center",
                fontSize: i < step ? 12 : 11, fontWeight: 600,
              }}>
                {i < step ? "✓" : i + 1}
              </div>
              <div style={{ opacity: i > step ? 0.45 : 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: i === step ? 500 : 400 }}>{s.label}</div>
                <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, opacity: 0.45, letterSpacing: "0.04em" }}>
          Signed in as {auth?.name || "you"} · {auth?.email || ""}
        </div>

        {/* Decorative glyph */}
        <div aria-hidden="true" style={{ position: "absolute", right: -60, bottom: -100, fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 480, lineHeight: 1, color: "var(--paper)", opacity: 0.04, pointerEvents: "none", userSelect: "none" }}>F</div>
      </div>

      {/* Right — form pane */}
      <div style={{ padding: "60px 56px", display: "flex", flexDirection: "column", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ maxWidth: 420, width: "100%", margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <StepDots current={step} total={4}/>
          </div>

          {step === 0 && <Step1 data={form} onChange={merge} onNext={() => setStep(1)}/>}
          {step === 1 && <Step2 data={form} onChange={merge} onNext={(extra) => { merge(extra); setStep(2); }} onBack={() => setStep(0)}/>}
          {step === 2 && <Step3 data={form} onChange={merge} onNext={() => setStep(3)} onBack={() => setStep(1)}/>}
          {step === 3 && <Step4 data={form} onChange={merge} onFinish={finish} onBack={() => setStep(2)}/>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingWizard, applyPalette, BRAND_PALETTES });
