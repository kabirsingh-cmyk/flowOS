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

// ─── Font pairings by industry type ──────────────────────────────────────────
const FONT_PAIRINGS = [
  {
    match: ["beauty", "skincare", "luxury", "jewel", "wellness", "fashion", "apparel", "fragrance", "cosmetic"],
    serif: "Cormorant Garamond",
    sans:  "DM Sans",
    url:   "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=DM+Sans:wght@400;500&display=swap",
  },
  {
    match: ["hvac", "refriger", "plumb", "electric", "construct", "landscap", "roofing", "pest", "moving", "cleaning", "auto repair", "trades", "blue collar", "security", "locksmith"],
    serif: "IBM Plex Sans",
    sans:  "IBM Plex Sans",
    url:   "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap",
  },
  {
    match: ["saas", "software", "tech", "b2b", "consulting", "staffing", "legal", "accounting", "finance", "insurance"],
    serif: "Inter",
    sans:  "Inter",
    url:   "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
  },
  {
    match: ["restaurant", "café", "cafe", "food", "beverage", "hotel", "hospitality", "bakery"],
    serif: "Lora",
    sans:  "Inter",
    url:   "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500&display=swap",
  },
];

function applyFont(industry) {
  const s = (industry || "").toLowerCase();
  const pairing = FONT_PAIRINGS.find(p => p.match.some(kw => s.includes(kw)));
  if (!pairing) return;

  const linkId = "flowos-brand-font";
  let link = document.getElementById(linkId);
  if (!link) {
    link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = pairing.url;

  const root = document.documentElement;
  root.style.setProperty("--font-serif", `'${pairing.serif}', Georgia, serif`);
  root.style.setProperty("--font-sans",  `'${pairing.sans}', system-ui, sans-serif`);
}

// Apply palette to :root CSS variables
function applyPalette(palette) {
  const root = document.documentElement;
  Object.entries(palette.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  if (palette.brandData?.industry) applyFont(palette.brandData.industry);
}

// ─── Industries ────────────────────────────────────────────────────────────
const INDUSTRY_GROUPS = [
  {
    group: "E-commerce & DTC",
    options: [
      "Beauty & skincare",
      "Health & supplements",
      "Fashion & apparel",
      "Jewellery & accessories",
      "Home & living",
      "Food & beverage",
      "Sports & outdoor",
      "Pet care",
      "Baby & kids",
      "Consumer electronics",
      "Automotive accessories",
    ],
  },
  {
    group: "Trades & Blue Collar",
    options: [
      "HVAC & refrigeration",
      "Plumbing",
      "Electrical",
      "Construction & contracting",
      "Landscaping & lawn care",
      "Cleaning & janitorial",
      "Auto repair & bodywork",
      "Painting & decorating",
      "Roofing",
      "Pest control",
      "Security & locksmith",
      "Moving & storage",
    ],
  },
  {
    group: "B2B & Professional Services",
    options: [
      "SaaS & software",
      "Marketing & creative agency",
      "Legal & compliance",
      "Accounting & finance",
      "Consulting",
      "Staffing & recruitment",
      "Real estate",
      "Insurance",
    ],
  },
  {
    group: "Hospitality & Local",
    options: [
      "Restaurant & café",
      "Hotel & accommodation",
      "Fitness & gym",
      "Salon & beauty services",
      "Retail (brick & mortar)",
      "Events & entertainment",
    ],
  },
  {
    group: "Healthcare & Wellness",
    options: [
      "Medical practice",
      "Dental",
      "Mental health",
      "Pharmacy & compounding",
      "Veterinary",
      "Chiropractic & physio",
    ],
  },
  {
    group: "Other",
    options: ["Non-profit", "Education & training", "Government & public sector", "Other"],
  },
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

// ─── Step 1 — Brand basics ─────────────────────────────────────────────────
function Step1({ data, onChange, onNext }) {
  const ready = data.storeName.trim().length > 0 && data.industry && data.website.includes(".");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Step 1 of 2</div>
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
            {INDUSTRY_GROUPS.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.options.map(o => <option key={o} value={o}>{o}</option>)}
              </optgroup>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Website URL</span>
          <input
            type="url"
            value={data.website}
            onChange={e => onChange({ website: e.target.value })}
            placeholder="https://yourbrand.com"
            style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 6, fontSize: 14, fontFamily: "var(--font-sans)", background: "var(--paper)", color: "var(--ink)", outline: "none" }}
          />
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

// ─── Step 2 — Add your first connector (Google) ───────────────────────────
// Each tile maps to a Composio toolkit slug; OAuth is the Google sign-in popup,
// scoped by the toolkit Composio requests.
const GOOGLE_CONNECTOR_OPTIONS = [
  { id: "google-workspace", composioApp: "ga4", label: "Google · Workspace", sub: "Workspace · Google Analytics 4" },
];

function Step2({ data, onChange, onFinish, onBack }) {
  const [connecting, setConnecting] = useStateOB(null); // option id mid-flight
  const [connected, setConnected]   = useStateOB(null); // option id that finished
  const [error, setError]           = useStateOB("");
  const [finishing, setFinishing]   = useStateOB(false); // awaiting brand-import
  const pollerRef = useRefOB(null);

  useEffectOB(() => () => { if (pollerRef.current) clearInterval(pollerRef.current); }, []);

  const stopPoller = () => {
    if (pollerRef.current) { clearInterval(pollerRef.current); pollerRef.current = null; }
  };

  const persistConnection = async (opt, accountId) => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;
    await sb.from("channels").upsert({
      user_id:                session.user.id,
      platform:               opt.composioApp,
      composio_connection_id: accountId,
      status:                 "connected",
      updated_at:             new Date().toISOString(),
    }, { onConflict: "user_id, platform" });
  };

  const connect = async (opt) => {
    setError("");
    setConnecting(opt.id);
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) throw new Error("Not signed in");
      const callbackUrl = `${window.location.origin}/oauth-callback.html?composio_connected=${opt.composioApp}`;

      const res = await apiFetch("/api/composio", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "initiate_connection", app: opt.composioApp, redirectUri: callbackUrl }),
      });
      const raw = await res.text();
      let init;
      try { init = JSON.parse(raw); } catch { throw new Error(`Server (${res.status}): ${raw.slice(0,120)}`); }
      if (!init.ok) throw new Error(init.error || "Failed to initiate connection");

      const popup = window.open(init.redirectUrl, "flowos_oauth", "width=600,height=720");
      if (!popup) {
        // Popup blocked → full-page redirect; ?composio_connected= handled by workspaces4 on return
        window.location.href = init.redirectUrl;
        return;
      }

      const start = Date.now();
      const TIMEOUT_MS = 3 * 60 * 1000;
      pollerRef.current = setInterval(async () => {
        if (popup.closed) {
          stopPoller();
          // One last verify before declaring cancelled (OAuth may have completed as user closed)
          try {
            const r = await apiFetch("/api/composio", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body:   JSON.stringify({ action: "connection_status", app: opt.composioApp }),
            }).then(r => r.json());
            if (r.connected) {
              await persistConnection(opt, r.accountId);
              setConnected(opt.id);
            } else {
              setError(`${opt.label} connection cancelled`);
            }
          } catch (e) {
            setError(`${opt.label} connection cancelled`);
          }
          setConnecting(null);
          return;
        }
        if (Date.now() - start > TIMEOUT_MS) {
          stopPoller();
          setConnecting(null);
          setError(`${opt.label} connection timed out`);
          return;
        }
        try {
          const r = await apiFetch("/api/composio", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ action: "connection_status", app: opt.composioApp }),
          }).then(r => r.json());
          if (r.connected) {
            stopPoller();
            await persistConnection(opt, r.accountId);
            setConnected(opt.id);
            setConnecting(null);
            try { popup.close(); } catch {}
          }
        } catch {}
      }, 1500);
    } catch (err) {
      setConnecting(null);
      setError(err.message || `${opt.label} connection failed`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Step 2 of 2</div>
        <h2 className="serif" style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Add your<br/><em>first connector.</em>
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>
          Connect a Google account so FlowOS can pull analytics and act on your behalf. You can add more connectors later in Connections.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {GOOGLE_CONNECTOR_OPTIONS.map(opt => {
          const isConnected  = connected === opt.id;
          const isConnecting = connecting === opt.id;
          return (
            <div key={opt.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "13px 16px",
              border: `1.5px solid ${isConnected ? "var(--accent)" : "var(--rule)"}`,
              borderRadius: 7,
              background: isConnected ? "var(--accent-wash)" : "var(--paper)",
              transition: "all .2s",
            }}>
              <svg width="22" height="22" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{opt.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{opt.sub}</div>
              </div>
              {isConnected ? (
                <span className="mono" style={{ fontSize: 10.5, color: "var(--accent-ink)", letterSpacing: "0.06em" }}>Connected</span>
              ) : (
                <button onClick={() => connect(opt)} disabled={!!connecting} style={{
                  padding: "7px 16px", borderRadius: 5,
                  background: isConnecting ? "var(--rule)" : "var(--accent)",
                  color: isConnecting ? "var(--muted)" : "var(--accent-ink)",
                  border: "none", fontSize: 12, fontFamily: "var(--font-sans)",
                  cursor: connecting ? "not-allowed" : "pointer",
                }}>{isConnecting ? "Connecting…" : "Connect"}</button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>
      )}

      <p className="mono" style={{ margin: 0, fontSize: 10.5, color: "var(--muted)", lineHeight: 1.6 }}>
        More connectors (Meta, TikTok, Klaviyo, Shopify…) live in Settings → Connections.
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} disabled={finishing} style={{ padding: "11px 18px", borderRadius: 6, background: "transparent", border: "1px solid var(--rule-strong)", color: "var(--ink-2)", fontFamily: "var(--font-sans)", fontSize: 13.5, cursor: finishing ? "not-allowed" : "pointer", opacity: finishing ? 0.5 : 1 }}>← Back</button>
        <button onClick={async () => {
          if (finishing) return;
          setFinishing(true);
          const opt = GOOGLE_CONNECTOR_OPTIONS.find(o => o.id === connected);
          try {
            await onFinish({ connectedChannels: opt ? [opt.composioApp] : [] });
          } finally {
            setFinishing(false);
          }
        }} disabled={finishing} style={{
          padding: "11px 24px", borderRadius: 6,
          background: finishing ? "var(--rule)" : "var(--accent)",
          color: finishing ? "var(--muted)" : "var(--paper)",
          border: "none", fontWeight: 500, fontSize: 14, fontFamily: "var(--font-sans)",
          cursor: finishing ? "not-allowed" : "pointer",
        }}>{finishing ? "Analyzing your brand…" : (connected ? "Enter workspace →" : "Skip — enter workspace →")}</button>
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
  });

  const merge = (updates) => setForm(prev => ({ ...prev, ...updates }));

  const finish = async (extra) => {
    const result = { ...form, ...extra, completedAt: Date.now() };
    try { localStorage.setItem("flowos_onboarding", JSON.stringify(result)); } catch {}

    // 1) Persist the user-entered fields first so the row exists with the
    //    name/industry/revenue the user typed (Claude analysis may overwrite
    //    name/industry with its own extraction; user values shouldn't lose).
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      const { error } = await sb.from("brands").upsert({
        user_id:    session.user.id,
        name:       result.storeName || "My Brand",
        industry:   result.industry  || null,
        website:    result.website   || null,
        revenue:    result.revenue   || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) console.error("[FlowOS] brand save:", error);
    }

    // 2) Run Claude brand analysis if we have a website. /api/brand-import
    //    scrapes the site, extracts voice/values/claims/messaging/terminology
    //    /palette via Claude, and (fire-and-forget) upserts to Supabase.
    //    We pass the returned brand straight to onComplete so the store
    //    hydrates immediately without waiting on Supabase round-trip.
    let importedBrand = null;
    if (result.website) {
      try {
        const r = await apiFetch("/api/brand-import", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ url: result.website }),
        });
        const j = await r.json();
        if (j?.ok && j.brand) importedBrand = j.brand;
        else console.warn("[FlowOS] brand-import:", j?.error || r.status);
      } catch (e) {
        console.warn("[FlowOS] brand-import failed:", e.message);
      }
    }

    // 3) Re-apply user-entered name/industry/revenue so they win over Claude
    //    extraction (only if user actually typed them).
    if (session?.user && importedBrand && (result.storeName || result.industry || result.revenue)) {
      const overrides = { user_id: session.user.id, updated_at: new Date().toISOString() };
      if (result.storeName) overrides.name     = result.storeName;
      if (result.industry)  overrides.industry = result.industry;
      if (result.revenue)   overrides.revenue  = result.revenue;
      await sb.from("brands").upsert(overrides, { onConflict: "user_id" });
    }

    onComplete(result, importedBrand);
  };

  const STEPS = [
    { label: "Your brand",     sub: "Name, industry, website" },
    { label: "First connector", sub: "Connect Google" },
  ];

  return (
    <div style={{
      minHeight: "100vh", height: "100vh", background: "var(--paper-2)",
      display: "grid", gridTemplateColumns: "1.1fr 1fr", overflow: "hidden",
    }}>
      <div style={{
        background: "var(--paper-3)", color: "var(--ink)",
        padding: "60px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--accent)", color: "var(--accent-ink)", display: "grid", placeItems: "center", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>F</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em" }}>FlowOS</div>
            <div className="mono" style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.14em", textTransform: "uppercase" }}>AI Marketing OS</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="mono" style={{ fontSize: 10.5, opacity: 0.55, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 20 }}>Getting started</div>
          {STEPS.map((s, i) => (
            <div key={i} style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "12px 16px", borderRadius: 8,
              background: i === step ? "rgba(255,255,255,.10)" : "transparent",
              transition: "background .2s",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                background: i < step ? "var(--accent)" : i === step ? "var(--ink)" : "rgba(255,255,255,.15)",
                color: i < step ? "var(--accent-ink)" : i === step ? "var(--paper)" : "rgba(255,255,255,.5)",
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

        <div aria-hidden="true" style={{ position: "absolute", right: -60, bottom: -100, fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 480, lineHeight: 1, color: "var(--ink)", opacity: 0.04, pointerEvents: "none", userSelect: "none" }}>F</div>
      </div>

      <div style={{ padding: "60px 56px", display: "flex", flexDirection: "column", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ maxWidth: 420, width: "100%", margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <StepDots current={step} total={STEPS.length}/>
          </div>

          {step === 0 && <Step1 data={form} onChange={merge} onNext={() => setStep(1)}/>}
          {step === 1 && <Step2 data={form} onChange={merge} onFinish={finish} onBack={() => setStep(0)}/>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingWizard, applyPalette, BRAND_PALETTES });
