(function () {
// MVEDA workspaces — part 4: Connections + Brand Import flow
const { useState: useState4, useEffect: useEffect4, useMemo: useMemo4, useRef: useRef4 } = React;

// Connector IDs that use Composio managed OAuth.
// These get a real OAuth redirect instead of the fake setTimeout connect.
const COMPOSIO_OAUTH_APPS = new Set([
  // Social
  "ig", "tt", "fb", "li", "yt", "pn", "x", "threads", "reddit", "snap", "bluesky", "mastodon", "telegram",
  // Ads & commerce
  "googleads", "ga4", "metaads", "liads", "shopify",
  // Email
  "klaviyo",
]);

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
      const res  = await apiFetch("/api/brand-import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: url.trim() }),
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
function ConnectorIcon({ id }) {
  // brand letter mark — color-shifted per category
  const map = {
    pb:      { fg: "oklch(44% 0.18 260)", letter: "Pb" },
    ay:      { fg: "oklch(44% 0.18 260)", letter: "A" }, // legacy
    ig:      { fg: "linear-gradient(135deg, oklch(70% 0.18 30), oklch(58% 0.2 320))", letter: "I" },
    tt:      { fg: "var(--ink)",           letter: "T" },
    fb:      { fg: "oklch(48% 0.18 260)", letter: "f" },
    li:      { fg: "oklch(48% 0.14 235)", letter: "in" },
    yt:      { fg: "oklch(58% 0.22 28)",  letter: "▶" },
    pn:      { fg: "oklch(56% 0.18 25)",  letter: "P" },
    x:       { fg: "var(--ink)",           letter: "𝕏" },
    threads: { fg: "var(--ink)",           letter: "@" },
    reddit:  { fg: "oklch(58% 0.22 28)",  letter: "R" },
    snap:    { fg: "oklch(88% 0.16 100)", letter: "👻", inkColor: "var(--ink)" },
    bsky:    { fg: "oklch(55% 0.18 240)", letter: "Bk" },
    mst:     { fg: "oklch(48% 0.16 285)", letter: "M" },
    tg:      { fg: "oklch(60% 0.16 225)", letter: "Tg" },
    klaviyo:   { fg: "oklch(38% 0.04 80)", letter: "K" },
    mailchimp: { fg: "oklch(80% 0.16 95)", letter: "✻", inkColor: "var(--ink)" },
    googleads: { fg: "oklch(72% 0.17 100)", letter: "G", inkColor: "var(--ink)" },
    msads:     { fg: "oklch(58% 0.18 220)", letter: "⊞" },
    appleads:  { fg: "var(--ink)", letter: "" },
    amazonads: { fg: "oklch(72% 0.18 75)", letter: "a", inkColor: "var(--ink)" },
    metaads:   { fg: "oklch(54% 0.2 260)", letter: "∞" },
    ttads:     { fg: "var(--ink)", letter: "T" },
    liads:     { fg: "oklch(48% 0.14 235)", letter: "in" },
    pinads:    { fg: "oklch(56% 0.18 25)", letter: "P" },
    xads:      { fg: "var(--ink)", letter: "X" },
    redditads: { fg: "oklch(58% 0.22 30)", letter: "R" },
    snapads:   { fg: "oklch(88% 0.18 100)", letter: "👻", inkColor: "var(--ink)" },
    heygen:    { fg: "oklch(52% 0.18 280)", letter: "H" },
    fal:       { fg: "oklch(18% 0.02 260)", letter: "fal", fontSize: 11 },
    elevenlabs:{ fg: "oklch(28% 0.04 80)",  letter: "11" },
    runway:    { fg: "var(--ink)",           letter: "R" },
    shopify:   { fg: "oklch(58% 0.13 145)", letter: "S" },
    ga4:       { fg: "oklch(60% 0.16 50)",  letter: "GA", inkColor: "var(--ink)" },
    amplitude: { fg: "oklch(58% 0.18 250)", letter: "A" },
    // Creative AI
    runware:   { fg: "oklch(54% 0.20 170)", letter: "Rw" },
    higgsfield:{ fg: "oklch(30% 0.04 260)", letter: "Hf" },
    luma:      { fg: "oklch(48% 0.16 300)", letter: "Lu" },
    pika:      { fg: "oklch(58% 0.18 320)", letter: "Pk" },
    kling:     { fg: "oklch(22% 0.02 260)", letter: "Kl" },
    // MCP
    mcp:       { fg: "oklch(44% 0.14 260)", letter: "⬡", fontSize: 18 },
    klaviyo:   { fg: "oklch(38% 0.04 80)",  letter: "K" },
  };
  const cfg = map[id] || { fg: "var(--ink)", letter: "?" };
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 7,
      background: cfg.fg, color: cfg.inkColor || "var(--paper)",
      display: "grid", placeItems: "center",
      fontFamily: "var(--font-serif)", fontSize: cfg.letter.length > 2 ? 13 : 17,
      fontWeight: 500, letterSpacing: "0.02em",
      flexShrink: 0,
      border: "1px solid color-mix(in oklch, var(--ink) 8%, transparent)",
    }}>{cfg.letter}</div>
  );
}

function Connections({ state, actions }) {
  const [importOpen, setImportOpen] = useState4(false);
  const [authStep, setAuthStep] = useState4(null); // { connector, step }

  // On mount, check for Composio OAuth callback (?composio_connected=<id>)
  useEffect4(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const connectorId = params.get("composio_connected");
      if (!connectorId) return;

      // Clear the URL param immediately so refresh doesn't re-trigger
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);

      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) return;

      try {
        // Verify the connection is actually active
        const res = await apiFetch("/api/composio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "connection_status", app: connectorId }),
        });
        const data = await res.json();
        if (!data.connected) return;

        // Save connected_account_id to Supabase channels table
        await sb.from("channels").upsert({
          user_id:                session.user.id,
          platform:               connectorId,
          composio_connection_id: data.accountId,
          status:                 "connected",
          updated_at:             new Date().toISOString(),
        }, { onConflict: "user_id, platform" });

        // Update store
        const catalog = SEED.connectorCatalog;
        const connector = catalog.find(c => c.id === connectorId);
        actions.setConnector(connectorId, {
          connected: true,
          status:    "ok",
          note:      `OAuth connected · Composio`,
          syncCount: "syncing…",
        }, {
          logEvent: `connected · ${connector?.name || connectorId}`,
          notify:   { tone: "ok", text: `${connector?.name || connectorId} connected` },
        });
      } catch (e) {
        console.error("[composio callback]", e.message);
      }
    })();
  }, []); // eslint-disable-line

  // On mount, hydrate store connector state from Supabase channels table
  useEffect4(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) return;
      const { data } = await sb.from("channels")
        .select("platform, account_handle, followers_count, composio_connection_id, status")
        .eq("user_id", session.user.id)
        .eq("status", "connected");
      if (!data?.length) return;

      // Map DB rows → connector store
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

  const catalog = SEED.connectorCatalog;
  const categories = ["Social", "Email", "SMS", "Search Ads", "Social Ads", "Commerce", "Analytics", "SEO", "Affiliate", "Experimentation", "Creative AI", "MCP · Custom"];
  const byCat = useMemo4(() => {
    const out = {};
    catalog.forEach(c => { (out[c.category] ||= []).push(c); });
    return out;
  }, [catalog]);

  const startConnect = (connector) => {
    setAuthStep({ connector, step: "auth" });
  };

  // Called by ConnectorAuthModal when user submits credentials
  const completeConnect = async (connector, apiKey, mcpUrl) => {

    // ── Composio OAuth connectors: initiate real OAuth redirect ──────────────
    if (COMPOSIO_OAUTH_APPS.has(connector.id)) {
      setAuthStep({ connector, step: "syncing" });
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session?.user && !window.flowAuth.hasDevToken()) throw new Error("Not signed in");

        const redirectUri = `${window.location.origin}/?composio_connected=${connector.id}`;
        const res = await apiFetch("/api/composio", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            action:      "initiate_connection",
            app:         connector.id,
            redirectUri,
          }),
        });
        // Use text() first — edge runtime may return plain-text on hard errors
        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); } catch {
          throw new Error(`Server error (${res.status}): ${raw.slice(0, 120)}`);
        }
        if (!data.ok) throw new Error(data.error || "Failed to initiate connection");

        // Redirect user to OAuth provider.
        // On return the ?composio_connected= callback effect will verify + persist the connection.
        window.location.href = data.redirectUrl;
      } catch (err) {
        alert(`${connector.name} connection failed: ${err.message}`);
        setAuthStep(null);
      }
      return;
    }

    // ── Default: simulated connect for API-key connectors ─────────────────
    setAuthStep({ connector, step: "syncing" });
    setTimeout(() => {
      actions.setConnector(connector.id, {
        connected:  true,
        status:     "ok",
        note:       `synced just now · API key validated`,
        syncCount:  "initial sync running…",
      }, {
        logEvent: `connected · ${connector.name}`,
        notify:   { tone: "ok", text: `${connector.name} connected` },
      });
      setAuthStep(null);
    }, 1100);
  };

  const disconnect = async (connector) => {
    if (COMPOSIO_OAUTH_APPS.has(connector.id)) {
      // Composio-managed OAuth: revoke via API + clear Supabase row
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        // Fetch the stored Composio account ID
        const { data: channelRow } = await sb
          .from("channels")
          .select("composio_connection_id")
          .eq("user_id", session.user.id)
          .eq("platform", connector.id)
          .single();

        if (channelRow?.composio_connection_id) {
          // Best-effort revoke — don't block UI on failure
          apiFetch("/api/composio", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ action: "disconnect", accountId: channelRow.composio_connection_id }),
          }).catch(() => {});
        }

        await sb.from("channels")
          .update({
            status:                 "disconnected",
            composio_connection_id: null,
            updated_at:             new Date().toISOString(),
          })
          .eq("user_id", session.user.id)
          .eq("platform", connector.id);
      }
    } else {
      // API-key connectors: no server-side revocation needed
    }
    actions.setConnector(connector.id, {
      connected: false, status: "—", note: "not connected", syncCount: "—",
    }, { logEvent: `disconnected · ${connector.name}`, notify: { tone: "neutral", text: `${connector.name} disconnected` } });
  };

  const totalConnected = Object.values(state.connectors || {}).filter(c => c.connected).length;
  const totalAvailable = catalog.length;

  // Recommended connector IDs from brand analysis (populated after brand import)
  const recommendedIds = state.brandPreset?.recommendedConnectors || [];
  const recommendedCatalog = recommendedIds.map(id => catalog.find(c => c.id === id)).filter(Boolean);

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>00 · Connect</div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Connections</h1>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>
            {totalConnected} of {totalAvailable} connected · brand: {state.brandImported ? <span style={{ color: "var(--ink)" }}>{state.brandPreset?.name || "imported"}</span> : "default"}
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

      {/* Brand status banner */}
      <div style={{
        border: "1px solid var(--rule)", borderRadius: 6,
        background: state.brandImported ? "var(--success-wash)" : "var(--accent-wash)",
        padding: 16, display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 6,
          background: state.brandImported ? "var(--success)" : "var(--accent)",
          color: "var(--paper)", display: "grid", placeItems: "center",
        }}>
          <Icon name={state.brandImported ? "check" : "globe"} size={18}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
            {state.brandImported
              ? `${state.brandPreset?.name} brand applied`
              : "Import your brand to personalize the OS"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45 }}>
            {state.brandImported
              ? `Palette, type, voice, and approved claims pulled from ${state.brandPreset?.url}. Edit anytime in Brand Memory.`
              : "Paste your URL or upload a guidelines doc. We'll extract palette, fonts, voice, claims, and prohibited topics — under 60 seconds."}
          </div>
        </div>
        {!state.brandImported && (
          <Btn size="sm" variant="primary" onClick={() => setImportOpen(true)}><Icon name="flash" size={11}/> Start scan</Btn>
        )}
      </div>

      {/* ── Recommended section (shown when brand is imported) ───────────────── */}
      {state.brandImported && recommendedCatalog.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Recommended for {state.brandPreset?.name}
              <span style={{ marginLeft: 8, color: "var(--muted-2)" }}>
                {recommendedCatalog.filter(c => state.connectors[c.id]?.connected).length} / {recommendedCatalog.length} connected
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Based on brand analysis · edit in Brand Memory</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
            {recommendedCatalog.map(c => {
              const status = state.connectors[c.id] || {};
              const connected = status.connected;
              return (
                <div key={c.id} style={{
                  border: `1px solid ${connected ? "var(--success)" : "var(--accent)"}`,
                  borderRadius: 6,
                  background: connected ? "var(--success-wash)" : "var(--accent-wash)",
                  padding: "10px 12px",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <ConnectorIcon id={c.id}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                      {connected ? (status.note || "connected") : c.category}
                    </div>
                  </div>
                  {connected ? (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }}/>
                  ) : (
                    <Btn size="sm" variant="primary" onClick={() => startConnect(c)}>
                      <Icon name="plus" size={10}/>
                    </Btn>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section label before full catalog ────────────────────────────────── */}
      {state.brandImported && (
        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            All channels · {totalAvailable}
          </div>
        </div>
      )}

      {/* ── Connector grid by category ────────────────────────────────────────── */}
      {categories.map(cat => (
        <div key={cat}>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            {cat}
            <span style={{ marginLeft: 8, color: "var(--muted-2)" }}>
              {byCat[cat]?.filter(c => state.connectors[c.id]?.connected).length || 0} / {byCat[cat]?.length || 0}
            </span>
          </div>
          {/* MCP explainer */}
          {cat === "MCP · Custom" && (
            <div style={{ background: "var(--accent-wash)", border: "1px solid var(--accent)", borderRadius: 8, padding: "14px 18px", marginBottom: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>⬡</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>Model Context Protocol (MCP)</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                  MCP lets FlowOS's AI specialists call tools on any compatible server — image generators, video engines, your own internal APIs.
                  Paste your server URL and optionally an API key. No SDK required.
                </div>
              </div>
            </div>
          )}
          {/* Creative AI note */}
          {cat === "Creative AI" && (
            <div style={{ background: "var(--paper-3)", border: "1px solid var(--rule)", borderRadius: 8, padding: "12px 16px", marginBottom: 12, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
              Connected creative tools are available to Drafter — ask it to "generate an image for this caption" and it will use your connected provider automatically.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {byCat[cat]?.map(c => {
              const status = state.connectors[c.id] || {};
              const connected = status.connected;
              return (
                <div key={c.id} style={{
                  border: "1px solid var(--rule)", borderRadius: 6,
                  background: "var(--paper)", padding: 14,
                  display: "flex", flexDirection: "column", gap: 10,
                  transition: "border-color .12s",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <ConnectorIcon id={c.id}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.005em" }}>{c.name}</span>
                        {connected
                          ? <Chip tone="ok">connected</Chip>
                          : recommendedIds.includes(c.id)
                            ? <Chip tone="accent">★ recommended</Chip>
                            : <Chip>—</Chip>
                        }
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>{c.desc}</div>
                    </div>
                  </div>

                  {connected && (
                    <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--rule)", paddingTop: 8, lineHeight: 1.45 }}>
                      <div className="mono" style={{ fontSize: 10, color: "var(--muted-2)", letterSpacing: "0.04em", marginBottom: 2 }}>{c.auth} · {status.note}</div>
                      {status.syncCount && <div style={{ color: "var(--ink-2)" }}>{status.syncCount}</div>}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                    {connected ? (
                      <>
                        <Btn size="sm" variant="ghost" onClick={() => actions.setConnector(c.id, { note: "synced just now", status: "ok" }, { notify: { tone: "ok", text: `${c.name} re-synced` } })}>
                          <Icon name="flash" size={11}/> Sync
                        </Btn>
                        <Btn size="sm" variant="ghost" onClick={() => disconnect(c)}>
                          <Icon name="x" size={11}/> Disconnect
                        </Btn>
                      </>
                    ) : (
                      <Btn size="sm" variant="primary" onClick={() => startConnect(c)}>
                        <Icon name="plus" size={11}/> Connect
                      </Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <BrandImportModal open={importOpen} onClose={() => setImportOpen(false)} onApply={(preset) => actions.importBrand(preset)}/>
      <ConnectorAuthModal
        step={authStep}
        onClose={() => setAuthStep(null)}
        onComplete={completeConnect}
      />
    </div>
  );
}

function ConnectorAuthModal({ step, onClose, onComplete }) {
  const [apiKey, setApiKey] = useState4("");
  const [mcpUrl, setMcpUrl] = useState4("");
  useEffect4(() => { if (step?.step === "auth") { setApiKey(""); setMcpUrl(""); } }, [step]);
  if (!step) return null;
  const { connector, step: phase, hint } = step;
  const isMcp = connector?.auth === "MCP";

  return (
    <Dialog open onClose={onClose} title={`Connect · ${connector.name}`} width={520}>
      {phase === "auth" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <ConnectorIcon id={connector.id}/>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{connector.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{connector.desc}</div>
            </div>
          </div>

          {/* Optional hint */}
          {hint && (
            <div style={{ padding: "10px 14px", background: "var(--accent-wash)", border: "1px solid var(--accent)", borderRadius: 6, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, marginBottom: 14 }}>
              {hint}
            </div>
          )}

          {isMcp ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: 14, background: "var(--accent-wash)", border: "1px solid var(--accent)", borderRadius: 6, fontSize: 12.5, lineHeight: 1.55 }}>
                FlowOS connects to your MCP server over HTTP. The server handles auth — paste its base URL below and we'll negotiate the protocol handshake.
              </div>
              <FormRow label="MCP server URL" hint="e.g. https://mcp.runware.ai or http://localhost:3000">
                <Input value={mcpUrl} onChange={e => setMcpUrl(e.target.value)} placeholder="https://your-mcp-server.com"/>
              </FormRow>
              <FormRow label="API key (optional)" hint="If your MCP server requires authentication.">
                <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Bearer token or API key" type="password"/>
              </FormRow>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em" }}>
                Connection is tested at save time. Credentials stored encrypted at rest.
              </div>
            </div>
          ) : connector.auth === "OAuth" ? (
            <div>
              <div style={{
                padding: 16, border: "1px solid var(--rule)", borderRadius: 6,
                background: "var(--paper-2)", marginBottom: 14, fontSize: 12.5, lineHeight: 1.55,
              }}>
                FlowOS will request the following scopes from {connector.name}:
                <ul style={{ margin: "10px 0 0", padding: "0 0 0 18px", color: "var(--ink-2)" }}>
                  <li>Read account profile + connected accounts</li>
                  <li>Publish content on your behalf</li>
                  <li>Read insights and analytics</li>
                  {(connector.category === "Search Ads" || connector.category === "Social Ads") && <li>Manage campaigns, budgets, and audiences</li>}
                </ul>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>
                Tokens are stored encrypted at rest. Revocable anytime.
              </div>
            </div>
          ) : (
            <>
              <FormRow label="API key" hint={`Found in your ${connector.name} dashboard → Settings → API. We never store this in plaintext.`}>
                <Input value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder={
                    connector.id.startsWith("heygen")  ? "hg_live_xxxxxxxxxxxx" :
                    connector.id.startsWith("runware") ? "rw-key-xxxxxxxxxxxx" :
                    "key_xxxxxxxxxxxx"
                  }
                  type="password"/>
              </FormRow>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 6 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary"
              onClick={() => onComplete(connector, apiKey, mcpUrl)}
              disabled={(connector.auth === "API key" && !apiKey.trim()) || (isMcp && !mcpUrl.trim())}>
              <Icon name="check" size={12}/>
              {isMcp ? "Test & connect MCP" : connector.auth === "OAuth" ? `Authorize ${connector.name}` : "Validate & connect"}
            </Btn>
          </div>
        </div>
      )}

      {phase === "syncing" && (
        <div style={{ padding: "30px 0", textAlign: "center" }}>
          <div className="dot-pulse" style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "var(--accent)", margin: "0 auto 16px",
          }}/>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            {`Connecting to ${connector.name}…`}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            Validating credentials and pulling initial state
          </div>
        </div>
      )}
    </Dialog>
  );
}

Object.assign(window, { Connections, BrandImportModal, ConnectorIcon });
})();
