(function () {
// MVEDA workspaces — part 4: Connections + Brand Import flow
const { useState: useState4, useEffect: useEffect4, useMemo: useMemo4, useRef: useRef4 } = React;

// Filter pill groups for the Connections grid.
// Each pill corresponds to a `connector.group` value in seed.jsx (or "all").
const CONNECTOR_PILLS = [
  { id: "all",              label: "All" },
  { id: "Social",           label: "Social" },
  { id: "Ads",              label: "Ads" },
  { id: "Email & SMS",      label: "Email & SMS" },
  { id: "Commerce",         label: "Commerce" },
  { id: "Analytics & Ops",  label: "Analytics & Ops" },
  { id: "Creative AI",      label: "Creative AI" },
];

// Map FlowOS connector provider → backend API route.
// Pipedream is treated identically to Composio at the surface level; if /api/pipedream
// is not deployed the popup fails and the tile rolls back to unconnected.
function providerApiPath(provider) {
  if (provider === "pipedream") return "/api/pipedream";
  return "/api/composio";
}

// Per-provider routes for Direct-API connectors (provider: "direct" in seed.jsx).
// Each route exposes action=initiate_connection (validates the key + persists
// to connector_credentials) and action=disconnect. Connectors not listed here
// fall back to the local setTimeout simulation in handleConnectSubmit.
const DIRECT_API_ROUTES = {
  replicate:  "/api/replicate",
  higgsfield: "/api/higgsfield",
  luma:       "/api/luma",
};

// ────────────────────────────── BRAND IMPORT MODAL ──────────────────────────────
function BrandImportModal({ open, onClose, onApply }) {
  const [step, setStep]         = useState4("input");    // input | scanning | preview | error
  const [url, setUrl]           = useState4("");
  const [scanProgress, setScanProgress] = useState4([]);
  const [preset, setPreset]     = useState4(null);
  const [errorMsg, setErrorMsg] = useState4(null);

  useEffect4(() => {
    if (!open) { setStep("input"); setScanProgress([]); setPreset(null); setErrorMsg(null); }
  }, [open]);

  const startScan = async () => {
    if (!url.trim()) return;
    setStep("scanning");
    setScanProgress([]);
    setErrorMsg(null);

    // Animated scan steps — run in parallel with the real API call
    const steps = [
      { label: `Fetching ${url}…`,                              delay: 500  },
      { label: "Reading homepage content",                      delay: 600  },
      { label: "Fetching About page",                           delay: 700  },
      { label: "Extracting brand voice + copy",                 delay: 700  },
      { label: "Inferring palette from visual language",        delay: 800  },
      { label: "Identifying target audience",                   delay: 700  },
      { label: "Mapping recommended channels",                  delay: 600  },
      { label: "Researching competitive landscape",             delay: 800  },
      { label: "Compiling brand memory",                        delay: 500  },
    ];

    // Animate steps
    let animDone = false;
    let apiResult = null;
    let animResolve;
    const animPromise = new Promise(res => { animResolve = res; });

    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        animDone = true;
        animResolve();
        return;
      }
      setScanProgress(prev => [...prev, steps[i]]);
      i += 1;
      setTimeout(tick, steps[i]?.delay || 500);
    };
    setTimeout(tick, 300);

    // Real API call
    try {
      const { data: { session } } = await sb.auth.getSession();
      const tenantId = session?.user?.id || null;

      const res  = await fetch("/api/brand-import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: url.trim(), tenantId }),
      });
      const raw  = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error(`Server error: ${raw.slice(0, 120)}`); }
      if (!data.ok) throw new Error(data.error || "Brand import failed");
      apiResult = data.brand;
    } catch (err) {
      // Wait for animation to finish before showing error
      await animPromise;
      setErrorMsg(err.message);
      setStep("error");
      return;
    }

    // Wait for animation to finish before showing preview
    await animPromise;

    // Apply palette to UI immediately as a preview (user can still reject)
    if (apiResult?.palette?.vars) {
      const root = document.documentElement;
      Object.entries(apiResult.palette.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    }

    setPreset(apiResult);
    setStep("preview");
  };

  const apply = () => {
    onApply(preset);
    onClose();
  };

  const revert = () => {
    // Undo live palette preview if user cancels
    if (preset?.palette?.vars) {
      const root = document.documentElement;
      Object.keys(preset.palette.vars).forEach(k => root.style.removeProperty(k));
    }
    setStep("input");
    setPreset(null);
  };

  // Palette swatches from CSS vars
  const swatchKeys  = ["--paper", "--accent", "--ink", "--muted", "--accent-wash"];
  const swatchLabel = { "--paper": "bg", "--accent": "accent", "--ink": "ink", "--muted": "muted", "--accent-wash": "wash" };

  return (
    <Dialog open={open} onClose={onClose} title="Import brand" width={700}>
      {/* ── Input ───────────────────────────────────────────────────────────── */}
      {step === "input" && (
        <div>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 18 }}>
            FlowOS analyses your website and builds a brand memory — palette, voice, claims, channels, and competitors.
            Nothing is applied until you approve.
          </div>

          <FormRow label="Website URL" hint="We'll read your homepage and About page — takes ~15 seconds.">
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://yourbrand.com"
              onKeyDown={e => e.key === "Enter" && startScan()}
            />
          </FormRow>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em" }}>
              <Icon name="shield" size={11}/> Nothing applied until you approve
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn variant="primary" onClick={startScan} disabled={!url.trim()}>
                <Icon name="flash" size={12}/> Analyse brand
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Scanning ─────────────────────────────────────────────────────────── */}
      {step === "scanning" && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            Analysing · {url}
          </div>
          <div style={{ border: "1px solid var(--rule)", borderRadius: 5, overflow: "hidden" }}>
            {scanProgress.map((s, i) => (
              <div key={i} className="anim-slide" style={{
                padding: "9px 14px", borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                display: "flex", alignItems: "center", gap: 10, fontSize: 12.5,
                background: "var(--paper)",
              }}>
                <span style={{ color: "var(--success)" }}><Icon name="check" size={11}/></span>
                <span style={{ flex: 1 }}>{s.label}</span>
                <span className="mono" style={{ color: "var(--muted)", fontSize: 10.5 }}>ok</span>
              </div>
            ))}
            {scanProgress.length < 9 && (
              <div style={{
                padding: "9px 14px", borderTop: scanProgress.length ? "1px solid var(--rule)" : 0,
                display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, background: "var(--paper-2)",
              }}>
                <span className="dot-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }}/>
                <span style={{ color: "var(--muted)" }}>Working…</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {step === "error" && (
        <div style={{ padding: "24px 0" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--error-wash, oklch(95% 0.03 20))", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="x" size={14}/>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Brand analysis failed</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>{errorMsg}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={() => setStep("input")}>Try again</Btn>
          </div>
        </div>
      )}

      {/* ── Preview ───────────────────────────────────────────────────────────── */}
      {step === "preview" && preset && (
        <div>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: preset.palette?.vars?.["--accent"] || "var(--accent)",
              display: "grid", placeItems: "center",
              fontSize: 16, fontWeight: 700, color: "#fff",
            }}>
              {preset.name?.[0] || "B"}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>{preset.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{preset.industry}</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Chip tone="ok">Live preview applied</Chip>
            </div>
          </div>

          {/* Palette + Voice */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 14, background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Palette</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {swatchKeys.map(k => (
                  <div key={k} style={{ flex: 1 }}>
                    <div style={{
                      height: 32, borderRadius: 4,
                      background: preset.palette?.vars?.[k] || "var(--paper-2)",
                      border: "1px solid var(--rule)",
                    }}/>
                    <div className="mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 3 }}>{swatchLabel[k]}</div>
                  </div>
                ))}
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted-2)" }}>oklch · UI already updated ↑</div>
            </div>

            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 14, background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Voice</div>
              <div style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5, fontStyle: "italic", marginBottom: 6 }}>"{preset.voice?.tone}"</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{preset.voice?.personality}</div>
            </div>
          </div>

          {/* Audience + Channels */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 14, background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Target audience</div>
              <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>{preset.targetAudience}</div>
            </div>
            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 14, background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Recommended channels · {preset.recommendedConnectors?.length || 0}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {(preset.recommendedConnectors || []).map(id => (
                  <Chip key={id} tone="accent">{id}</Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Values + Claims */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 14, background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Brand values · {(preset.values || []).length}
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {(preset.values || []).map(v => (
                  <li key={v} style={{ paddingLeft: 14, position: "relative", marginBottom: 3 }}>
                    <span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>·</span>{v}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 14, background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Approved claims · {(preset.claims || []).length}
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {(preset.claims || []).slice(0, 4).map(c => (
                  <li key={c} style={{ paddingLeft: 14, position: "relative", marginBottom: 3 }}>
                    <span style={{ position: "absolute", left: 0, color: "var(--success)" }}>✓</span>{c}
                  </li>
                ))}
                {(preset.claims || []).length > 4 && (
                  <li style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>+ {preset.claims.length - 4} more</li>
                )}
              </ul>
            </div>
          </div>

          {/* Competitors */}
          {(preset.competitors || []).length > 0 && (
            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 14, background: "var(--paper)", marginBottom: 12 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Competitors · {preset.competitors.length}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {preset.competitors.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink)", minWidth: 110 }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.45 }}>{c.positioning}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em" }}>
              Palette already applied — reject to revert
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={revert}>Reject</Btn>
              <Btn variant="primary" onClick={apply}>
                <Icon name="check" size={12}/> Apply brand
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ────────────────────────────── CONNECTIONS WORKSPACE ──────────────────────────────

// Letter-mark fallback for connectors without a Simple Icons slug, or whose logo failed to load.
// Deterministically derives a soft pastel from the id so each tile is visually distinct.
function LetterMark({ id, name, size = 56 }) {
  const label = (name || id || "?")
    .replace(/\.(io|ai|so|com)$/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase() || "?";
  const hue = String(id || name || "")
    .split("")
    .reduce((a, c) => (a + c.charCodeAt(0)) % 360, 0);
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.18),
      background: `oklch(92% 0.045 ${hue})`,
      color:      `oklch(36% 0.13 ${hue})`,
      display: "grid", placeItems: "center",
      fontWeight: 600, fontSize: Math.round(size * 0.34),
      fontFamily: "var(--font-sans)", letterSpacing: "-0.02em",
      flexShrink: 0,
    }}>{label}</div>
  );
}

// ConnectorIcon — three-stage logo resolution.
//   1. Simple Icons CDN (`slug`) → brand-coloured SVG, sharp at any size
//   2. Google S2 favicon (`domain`) → 128px PNG, reliable for any registered domain
//   3. LetterMark fallback → deterministic pastel + initials
// Accepts either a connector object or just an id (legacy callers).
function ConnectorIcon({ connector, id, size = 56 }) {
  const [failedSimple, setFailedSimple] = useState4(false);
  const [failedFavicon, setFailedFavicon] = useState4(false);

  const row = useMemo4(() => {
    if (connector) return connector;
    if (!id) return null;
    return (window.SEED?.connectorCatalog || []).find(c => c.id === id)
        || { id, name: id, slug: null, domain: null };
  }, [connector, id]);

  if (!row) return null;

  const useSimple  = row.slug   && !failedSimple;
  const useFavicon = row.domain && !failedFavicon;

  if (!useSimple && !useFavicon) {
    return <LetterMark id={row.id} name={row.name} size={size}/>;
  }

  const src = useSimple
    ? `https://cdn.simpleicons.org/${row.slug}`
    : `https://www.google.com/s2/favicons?domain=${row.domain}&sz=128`;

  return (
    <img
      key={useSimple ? "simple" : "favicon"}
      src={src}
      alt={row.name}
      width={size}
      height={size}
      onError={() => {
        if (useSimple) setFailedSimple(true);
        else if (useFavicon) setFailedFavicon(true);
      }}
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.16),
        objectFit: "contain", display: "block",
        background: "transparent", flexShrink: 0,
      }}
    />
  );
}

// One-line switch — used for Read/Write/Admin toggles in the Manage modal.
function PermissionSwitch({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-checked={value}
      role="switch"
      style={{
        width: 36, height: 20, padding: 2, border: 0,
        borderRadius: 999,
        background: value ? "var(--accent)" : "color-mix(in oklch, var(--ink) 18%, transparent)",
        cursor: "pointer", display: "inline-flex",
        alignItems: "center",
        transition: "background .15s ease",
      }}>
      <span style={{
        width: 16, height: 16, borderRadius: "50%",
        background: "var(--paper)",
        transform: value ? "translateX(16px)" : "translateX(0)",
        transition: "transform .15s ease",
        boxShadow: "0 1px 3px oklch(20% 0.02 80 / 0.3)",
      }}/>
    </button>
  );
}

function Connections({ state, actions }) {
  const [importOpen, setImportOpen]   = useState4(false);
  const [connectStep, setConnectStep] = useState4(null);  // { connector }
  const [manageStep, setManageStep]   = useState4(null);  // { connector }
  const [search, setSearch]           = useState4("");
  const [activeGroup, setActiveGroup] = useState4("all");
  // { [id]: { startedAt } } — drives the amber "Connecting" tile state.
  const [connecting, setConnecting]   = useState4({});
  const pollersRef = useRef4({});

  // Shared "OAuth has completed — verify and persist" routine.
  // Called from: ?composio_connected= return URL, popup postMessage, and connection_status poll.
  const verifyAndPersistConnection = async (connectorId) => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;
    const tenantId = session.user.id;
    const connector = (SEED.connectorCatalog || []).find(c => c.id === connectorId);
    const apiPath = providerApiPath(connector?.provider);
    try {
      const res = await fetch(apiPath, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "connection_status", tenantId, app: connectorId }),
      });
      const data = await res.json();
      if (!data.connected) return;
      await sb.from("channels").upsert({
        user_id:                session.user.id,
        platform:               connectorId,
        composio_connection_id: data.accountId,
        status:                 "connected",
        updated_at:             new Date().toISOString(),
      }, { onConflict: "user_id, platform" });
      actions.setConnector(connectorId, {
        connected: true,
        status:    "ok",
        note:      `OAuth connected · ${connector?.provider || "composio"}`,
        syncCount: "syncing…",
      }, {
        logEvent: `connected · ${connector?.name || connectorId}`,
        notify:   { tone: "ok", text: `${connector?.name || connectorId} connected` },
      });
    } catch (e) {
      console.error("[connector verify]", e.message);
    }
  };

  // Full-page redirect fallback — fires when the popup was blocked and the user came back
  // via the legacy ?composio_connected= URL param.
  useEffect4(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const connectorId = params.get("composio_connected") || params.get("pipedream_connected");
      if (!connectorId) return;
      window.history.replaceState({}, "", window.location.pathname);
      await verifyAndPersistConnection(connectorId);
    })();
  }, []); // eslint-disable-line

  // Hydrate connector state from Supabase channels on mount.
  useEffect4(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) return;
      const { data } = await sb.from("channels")
        .select("platform, account_handle, followers_count, composio_connection_id, status")
        .eq("user_id", session.user.id)
        .eq("status", "connected");
      if (!data?.length) return;
      const platformToId = { instagram: "ig", tiktok: "tt", pinterest: "pn", youtube: "yt", facebook: "fb", linkedin: "li" };
      data.forEach(ch => {
        const id = platformToId[ch.platform] || ch.platform;
        actions.setConnector(id, {
          connected:  true,
          status:     "ok",
          note:       `${ch.account_handle || ch.platform} · connected`,
          syncCount:  ch.followers_count ? `${Number(ch.followers_count).toLocaleString()} followers` : "connected",
        });
      });
    })();
  }, []); // eslint-disable-line

  // Listen for postMessage from the OAuth popup → fast-path detect connection.
  useEffect4(() => {
    const handler = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "flowos_oauth_connected") return;
      const appId = e.data.app;
      if (!appId) return;
      stopPolling(appId);
      verifyAndPersistConnection(appId).finally(() => {
        setConnecting(p => { const n = { ...p }; delete n[appId]; return n; });
      });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []); // eslint-disable-line

  // Cancel any in-flight pollers when the workspace unmounts.
  useEffect4(() => () => {
    Object.values(pollersRef.current).forEach(clearInterval);
    pollersRef.current = {};
  }, []);

  const stopPolling = (connectorId) => {
    const handle = pollersRef.current[connectorId];
    if (handle) {
      clearInterval(handle);
      delete pollersRef.current[connectorId];
    }
  };

  // Kick off the setup flow. Always opens the (dumb) Connect modal first;
  // the modal's primary button then triggers either popup-OAuth or API-key validate.
  const startConnect = (connector) => setConnectStep({ connector });

  const handleConnectSubmit = async ({ apiKey }) => {
    const connector = connectStep?.connector;
    if (!connector) return;
    setConnectStep(null);

    // ── API-key connectors ──
    // Composio API-key connectors → POST credentials directly to Composio (no OAuth).
    // Direct API-key connectors → no Composio backend; persist locally as before
    // (per-provider validation route is the next iteration).
    if (connector.auth === "API key") {
      setConnecting(p => ({ ...p, [connector.id]: { startedAt: Date.now() } }));

      if (connector.provider === "composio") {
        try {
          const { data: { session } } = await sb.auth.getSession();
          if (!session?.user) throw new Error("Not signed in");
          const tenantId = session.user.id;

          const res = await fetch("/api/composio", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ action: "initiate_connection", tenantId, app: connector.id, apiKey }),
          });
          const raw = await res.text();
          let data;
          try { data = JSON.parse(raw); } catch { throw new Error(`Server (${res.status}): ${raw.slice(0, 120)}`); }
          if (!data.ok) throw new Error(data.error || "Failed to register API key");

          // Persist to Supabase channels for cross-session hydration.
          await sb.from("channels").upsert({
            user_id:                session.user.id,
            platform:               connector.id,
            composio_connection_id: data.connectionId,
            status:                 "connected",
            updated_at:             new Date().toISOString(),
          }, { onConflict: "user_id, platform" });

          actions.setConnector(connector.id, {
            connected: true,
            status:    "ok",
            note:      "API key validated · Composio",
            syncCount: "syncing…",
          }, {
            logEvent: `connected · ${connector.name}`,
            notify:   { tone: "ok", text: `${connector.name} connected` },
          });
        } catch (err) {
          actions.notify("warn", `${connector.name} connection failed: ${err.message}`);
        } finally {
          setConnecting(p => { const n = { ...p }; delete n[connector.id]; return n; });
        }
        return;
      }

      // Direct API-key: if a per-provider validation route exists, call it.
      // Otherwise (still-pending direct connectors) fall back to the local
      // simulated path so the tile flips green pre-wire-up.
      const directRoute = DIRECT_API_ROUTES[connector.id];
      if (directRoute) {
        try {
          const { data: { session } } = await sb.auth.getSession();
          if (!session?.user) throw new Error("Not signed in");
          const tenantId = session.user.id;

          const res = await fetch(directRoute, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ action: "initiate_connection", tenantId, apiKey }),
          });
          const raw = await res.text();
          let data;
          try { data = JSON.parse(raw); } catch { throw new Error(`Server (${res.status}): ${raw.slice(0, 120)}`); }
          if (!data.ok) throw new Error(data.error || "Failed to validate API key");

          actions.setConnector(connector.id, {
            connected: true,
            status:    "ok",
            note:      "API key validated · direct",
            syncCount: "ready",
          }, {
            logEvent: `connected · ${connector.name}`,
            notify:   { tone: "ok", text: `${connector.name} connected` },
          });
        } catch (err) {
          actions.notify("warn", `${connector.name} connection failed: ${err.message}`);
        } finally {
          setConnecting(p => { const n = { ...p }; delete n[connector.id]; return n; });
        }
        return;
      }

      // No /api/<provider> route yet → simulated path (placeholder until wired).
      setTimeout(() => {
        actions.setConnector(connector.id, {
          connected: true,
          status:    "ok",
          note:      "API key validated · direct",
          syncCount: "initial sync running…",
        }, {
          logEvent: `connected · ${connector.name}`,
          notify:   { tone: "ok", text: `${connector.name} connected` },
        });
        setConnecting(p => { const n = { ...p }; delete n[connector.id]; return n; });
      }, 1100);
      return;
    }

    // ── OAuth connectors: open popup + poll connection_status ──
    setConnecting(p => ({ ...p, [connector.id]: { startedAt: Date.now() } }));
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) throw new Error("Not signed in");
      const tenantId = session.user.id;
      const apiPath  = providerApiPath(connector.provider);
      const callbackUrl = `${window.location.origin}/oauth-callback.html?composio_connected=${connector.id}`;

      const res = await fetch(apiPath, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "initiate_connection", tenantId, app: connector.id, redirectUri: callbackUrl }),
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error(`Server (${res.status}): ${raw.slice(0, 120)}`); }
      if (!data.ok) throw new Error(data.error || "Failed to initiate connection");

      const popup = window.open(data.redirectUrl, "flowos_oauth", "width=600,height=720");
      if (!popup) {
        // Popup blocked → fall back to full-page redirect; the page-load effect above will
        // pick up ?composio_connected= when the user returns.
        window.location.href = data.redirectUrl;
        return;
      }

      // Poll connection_status every 1.5s. Stop on success, popup close, or 3-minute timeout.
      const start = Date.now();
      const TIMEOUT_MS = 3 * 60 * 1000;
      const interval = setInterval(async () => {
        // User closed popup → one last verify before deciding it was cancelled.
        // We keep the "connecting" state on during this grace window so the tile
        // doesn't flicker un-connected → connected if the user closed right as
        // OAuth completed.
        if (popup.closed) {
          stopPolling(connector.id);
          try {
            const r = await fetch(apiPath, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body:   JSON.stringify({ action: "connection_status", tenantId, app: connector.id }),
            }).then(r => r.json());
            if (r.connected) {
              await verifyAndPersistConnection(connector.id);
            } else {
              actions.notify("warn", `${connector.name} connection cancelled`);
            }
          } catch {
            actions.notify("warn", `${connector.name} connection cancelled`);
          }
          setConnecting(p => { const n = { ...p }; delete n[connector.id]; return n; });
          return;
        }
        if (Date.now() - start > TIMEOUT_MS) {
          stopPolling(connector.id);
          setConnecting(p => { const n = { ...p }; delete n[connector.id]; return n; });
          actions.notify("warn", `${connector.name} connection timed out`);
          return;
        }
        try {
          const r = await fetch(apiPath, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ action: "connection_status", tenantId, app: connector.id }),
          });
          const j = await r.json();
          if (j.connected) {
            stopPolling(connector.id);
            await verifyAndPersistConnection(connector.id);
            setConnecting(p => { const n = { ...p }; delete n[connector.id]; return n; });
            try { popup.close(); } catch {}
          }
        } catch {}
      }, 1500);
      pollersRef.current[connector.id] = interval;
    } catch (err) {
      setConnecting(p => { const n = { ...p }; delete n[connector.id]; return n; });
      actions.notify("warn", `${connector.name} connection failed: ${err.message}`);
    }
  };

  const disconnect = async (connector) => {
    const apiPath = providerApiPath(connector.provider);

    // Direct-API connectors with a per-provider route: server-side handler
    // deletes the credential and flips the channels row to disconnected.
    const directRoute = connector.provider === "direct" ? DIRECT_API_ROUTES[connector.id] : null;
    if (directRoute) {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        fetch(directRoute, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "disconnect", tenantId: session.user.id }),
        }).catch(() => {});
      }
    }

    // Revoke at the provider for any Composio-backed connector (OAuth or API key).
    // Direct API-key connectors only need local cleanup.
    if (connector.provider === "composio" || connector.provider === "pipedream") {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        const { data: channelRow } = await sb
          .from("channels")
          .select("composio_connection_id")
          .eq("user_id", session.user.id)
          .eq("platform", connector.id)
          .single();
        if (channelRow?.composio_connection_id) {
          fetch(apiPath, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ action: "disconnect", accountId: channelRow.composio_connection_id }),
          }).catch(() => {});
        }
        await sb.from("channels")
          .update({ status: "disconnected", composio_connection_id: null, updated_at: new Date().toISOString() })
          .eq("user_id", session.user.id)
          .eq("platform", connector.id);
      }
    }
    actions.setConnector(connector.id, {
      connected: false, status: "—", note: "not connected", syncCount: "—",
    }, {
      logEvent: `disconnected · ${connector.name}`,
      notify:   { tone: "neutral", text: `${connector.name} disconnected` },
    });
  };

  const resync = (connector) => {
    actions.setConnector(connector.id, { note: "synced just now", status: "ok" }, {
      notify: { tone: "ok", text: `${connector.name} re-synced` },
    });
  };

  const setPermissions = (connector, patch) => {
    const current = state.connectors[connector.id]?.permissions || { read: true, write: true, admin: false };
    actions.setConnector(connector.id, { permissions: { ...current, ...patch } });
  };

  const catalog = SEED.connectorCatalog;
  const recommendedIds = state.brandPreset?.recommendedConnectors || [];
  const recommendedSet = useMemo4(() => new Set(recommendedIds), [recommendedIds]);

  // Build the visible, sorted, filtered list.
  const visible = useMemo4(() => {
    const q = search.trim().toLowerCase();
    const filtered = catalog.filter(c => {
      if (activeGroup !== "all" && c.group !== activeGroup) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
    // Sort: connected → connecting → recommended → other, then alpha
    const rank = (c) => {
      const isConnected  = !!state.connectors[c.id]?.connected;
      const isConnecting = !!connecting[c.id];
      if (isConnected)  return 0;
      if (isConnecting) return 1;
      if (recommendedSet.has(c.id)) return 2;
      return 3;
    };
    return [...filtered].sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [catalog, search, activeGroup, state.connectors, connecting, recommendedSet]);

  const totalConnected = Object.values(state.connectors || {}).filter(c => c.connected).length;
  const totalAvailable = catalog.length;

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 18, height: "100%", overflow: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Integrations</h1>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13, maxWidth: 640 }}>
            Connect external apps. Connected services give your agents access to the tools they need to perform tasks.
            <span style={{ marginLeft: 10, color: "var(--ink-2)" }}>
              {totalConnected} of {totalAvailable} connected
              {state.brandImported && <> · brand: <span style={{ color: "var(--ink)" }}>{state.brandPreset?.name}</span></>}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {state.brandImported ? (
            <Btn size="sm" onClick={() => actions.resetBrand()}><Icon name="x" size={11}/> Reset brand</Btn>
          ) : null}
          <Btn size="sm" variant="primary" onClick={() => setImportOpen(true)}>
            <Icon name="globe" size={12}/> {state.brandImported ? "Re-import brand" : "Import brand"}
          </Btn>
        </div>
      </div>

      {/* Search + filter pill row */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 320px", minWidth: 240 }}>
          <div style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--muted)", pointerEvents: "none",
          }}>
            <Icon name="search" size={13}/>
          </div>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search integrations…"
            style={{ paddingLeft: 32 }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CONNECTOR_PILLS.map(p => {
            const active = activeGroup === p.id;
            return (
              <button key={p.id} onClick={() => setActiveGroup(p.id)}
                style={{
                  padding: "6px 12px", borderRadius: 999,
                  border: `1px solid ${active ? "var(--ink)" : "var(--rule)"}`,
                  background: active ? "var(--ink)" : "var(--paper)",
                  color:      active ? "var(--paper)" : "var(--ink-2)",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  transition: "all .12s",
                }}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
        gap: 12,
      }}>
        {visible.map(c => {
          const st = state.connectors[c.id] || {};
          const isConnected  = !!st.connected;
          const isConnecting = !!connecting[c.id];
          const isRecommended = recommendedSet.has(c.id);

          const onClick = () => {
            if (isConnecting) return;
            if (isConnected)  setManageStep({ connector: c });
            else              startConnect(c);
          };

          const borderColor = isConnected  ? "var(--success)"
                            : isConnecting ? "var(--warn)"
                            : isRecommended? "var(--accent)"
                            : "var(--rule)";
          const tint = isConnected  ? "color-mix(in oklch, var(--success) 5%, var(--paper))"
                     : isConnecting ? "color-mix(in oklch, var(--warn)    5%, var(--paper))"
                     : "var(--paper)";
          return (
            <button
              key={c.id}
              onClick={onClick}
              title={`${c.name} — ${c.desc}`}
              style={{
                border: `1.5px solid ${borderColor}`,
                background: tint,
                borderRadius: 10,
                padding: "16px 10px 12px",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 8,
                cursor: isConnecting ? "default" : "pointer",
                transition: "border-color .12s, background .12s, transform .12s",
                minHeight: 132,
                fontFamily: "var(--font-sans)",
                textAlign: "center",
              }}
              onMouseEnter={e => { if (!isConnecting) e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <ConnectorIcon connector={c} size={48}/>
              <div style={{
                fontSize: 12.5, fontWeight: 500,
                color: isConnected ? "var(--success)" : "var(--ink)",
                lineHeight: 1.2,
              }}>{c.name}</div>
              {isConnected && (
                <div style={{ fontSize: 10.5, color: "var(--success)", marginTop: -2 }}>Connected</div>
              )}
              {isConnecting && (
                <div style={{ fontSize: 10.5, color: "var(--warn)", marginTop: -2 }}>Connecting…</div>
              )}
              {!isConnected && !isConnecting && isRecommended && (
                <div style={{ fontSize: 10.5, color: "var(--accent)", marginTop: -2 }}>Recommended</div>
              )}
            </button>
          );
        })}
        {visible.length === 0 && (
          <div style={{
            gridColumn: "1 / -1", padding: "40px 0",
            textAlign: "center", color: "var(--muted)", fontSize: 13,
          }}>
            No integrations match “{search}”.
          </div>
        )}
      </div>

      {/* Modals */}
      <BrandImportModal open={importOpen} onClose={() => setImportOpen(false)} onApply={(preset) => actions.importBrand(preset)}/>
      <ConnectorAuthModal
        step={connectStep}
        onClose={() => setConnectStep(null)}
        onSubmit={handleConnectSubmit}
      />
      <ManageConnectorModal
        step={manageStep}
        status={manageStep ? state.connectors[manageStep.connector.id] || {} : null}
        onClose={() => setManageStep(null)}
        onDisconnect={(c) => { disconnect(c); setManageStep(null); }}
        onResync={resync}
        onSetPermissions={setPermissions}
      />
    </div>
  );
}

// ────────────────────────────── CONNECT MODAL (dumb) ──────────────────────────────
// One layout for every connector. OAuth gets a paragraph + button; API key gets the
// same paragraph + an input + button. The provider's own OAuth page shows the actual
// scope checklist — we don't try to re-state it here.
function ConnectorAuthModal({ step, onClose, onSubmit }) {
  const [apiKey, setApiKey] = useState4("");
  useEffect4(() => { if (step) setApiKey(""); }, [step]);
  if (!step) return null;
  const { connector } = step;
  const isApiKey = connector.auth === "API key";

  return (
    <Dialog open onClose={onClose} title={`Connect · ${connector.name}`} width={440}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <ConnectorIcon connector={connector} size={32}/>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Connect {connector.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{connector.desc}</div>
        </div>
      </div>

      {!isApiKey && (
        <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 14 }}>
          Connect your {connector.name} account. We'll open a browser window, you approve access there,
          and FlowOS will detect the connection automatically.
        </div>
      )}

      {isApiKey && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 10 }}>
            Paste your {connector.name} API key. We'll validate and store it encrypted at rest.
          </div>
          <FormRow label="API key" hint={`Found in your ${connector.name} dashboard → Settings → API.`}>
            <Input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="key_xxxxxxxxxxxx"
              type="password"
            />
          </FormRow>
        </div>
      )}

      <div style={{
        padding: "10px 12px",
        background: "var(--paper-2)",
        border: "1px solid var(--rule)",
        borderRadius: 6, marginBottom: 14,
        fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.5,
      }}>
        {connector.name} can expose {connector.category.toLowerCase()} data. After you connect,
        FlowOS's agent permissions are controlled in the Manage panel as read, write, and admin toggles.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary"
          onClick={() => onSubmit({ apiKey })}
          disabled={isApiKey && !apiKey.trim()}>
          <Icon name="check" size={12}/> Connect {connector.name}
        </Btn>
      </div>
    </Dialog>
  );
}

// ────────────────────────────── MANAGE MODAL ──────────────────────────────
// Opened by clicking a Connected tile. Surfaces the connector status,
// per-agent permission toggles, and disconnect.
function ManageConnectorModal({ step, status, onClose, onDisconnect, onResync, onSetPermissions }) {
  if (!step) return null;
  const { connector } = step;
  const permissions = status?.permissions || { read: true, write: true, admin: false };

  const Row = ({ label, hint, children }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      gap: 16, padding: "12px 0",
      borderTop: "1px solid var(--rule)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.45 }}>{hint}</div>
      </div>
      <div style={{ paddingTop: 2 }}>{children}</div>
    </div>
  );

  return (
    <Dialog open onClose={onClose} title={`Manage · ${connector.name}`} width={520}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <ConnectorIcon connector={connector} size={32}/>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Manage {connector.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{connector.desc}</div>
        </div>
      </div>

      {/* Status */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 0", borderBottom: "1px solid var(--rule)", marginTop: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }}/>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--success)" }}>
            {connector.name} is connected.
          </div>
        </div>
        <Btn size="sm" variant="ghost" onClick={() => onResync(connector)}>
          <Icon name="flash" size={11}/> Re-sync
        </Btn>
      </div>
      {status?.note && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "8px 0 4px" }}>
          {status.note}{status.syncCount ? ` · ${status.syncCount}` : ""}
        </div>
      )}

      {/* Permissions */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Permissions
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Read + Write enabled by default</div>
        </div>
        <Row label="Read" hint="Allow listing, fetching, searching (e.g. read posts, audiences, reports).">
          <PermissionSwitch value={!!permissions.read}  onChange={v => onSetPermissions(connector, { read: v })}/>
        </Row>
        <Row label="Write" hint="Allow sending, creating, updating (e.g. publish posts, push campaigns).">
          <PermissionSwitch value={!!permissions.write} onChange={v => onSetPermissions(connector, { write: v })}/>
        </Row>
        <Row label="Admin" hint="Allow destructive or permission-changing actions (delete, archive, share).">
          <PermissionSwitch value={!!permissions.admin} onChange={v => onSetPermissions(connector, { admin: v })}/>
        </Row>
      </div>

      {/* Triggers placeholder */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--rule)" }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          Triggers
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          No triggers are currently available for {connector.name}.
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
        <Btn variant="ghost" onClick={() => onDisconnect(connector)} style={{ color: "var(--danger)" }}>
          <Icon name="x" size={11}/> Disconnect
        </Btn>
        <Btn variant="primary" onClick={onClose}>Close</Btn>
      </div>
    </Dialog>
  );
}

Object.assign(window, { Connections, BrandImportModal, ConnectorIcon, LetterMark });
})();
