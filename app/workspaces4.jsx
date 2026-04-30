// MVEDA workspaces — part 4: Connections + Brand Import flow
const { useState: useState4, useEffect: useEffect4, useMemo: useMemo4 } = React;

// ────────────────────────────── BRAND IMPORT MODAL ──────────────────────────────
function BrandImportModal({ open, onClose, onApply }) {
  const [step, setStep] = useState4("input"); // input | scanning | preview
  const [url, setUrl] = useState4("https://mveda.co");
  const [scanProgress, setScanProgress] = useState4([]);
  const [preset, setPreset] = useState4(null);

  useEffect4(() => {
    if (!open) { setStep("input"); setScanProgress([]); setPreset(null); }
  }, [open]);

  const startScan = (sourceLabel) => {
    setStep("scanning");
    setScanProgress([]);
    const steps = [
      { label: `Fetching ${sourceLabel}…`, delay: 400 },
      { label: "Reading meta + opengraph tags", delay: 380 },
      { label: "Extracting palette from CSS variables", delay: 460 },
      { label: "Detecting type system (display + body fonts)", delay: 420 },
      { label: "Sampling product copy from PDPs", delay: 540 },
      { label: "Inferring voice + cadence from headlines", delay: 460 },
      { label: "Pulling tagline + claims from About page", delay: 420 },
      { label: "Compiling brand memory candidate", delay: 360 },
    ];
    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        setPreset(SEED.brandPresets.mveda);
        setStep("preview");
        return;
      }
      setScanProgress(prev => [...prev, { ...steps[i], status: "ok" }]);
      i += 1;
      setTimeout(tick, steps[i]?.delay || 400);
    };
    setTimeout(tick, 280);
  };

  const apply = () => {
    onApply(preset);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Import brand" width={680}>
      {step === "input" && (
        <div>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 18 }}>
            FlowOS learns your brand from your website or a guidelines document.
            We extract palette, fonts, voice, claims, and prohibited topics — then you review before anything goes live.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <button onClick={() => startScan(url)}
              style={{
                textAlign: "left", padding: 16,
                border: "1px solid var(--ink)", borderRadius: 6, background: "var(--paper-2)",
                cursor: "pointer", display: "flex", flexDirection: "column", gap: 8,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="globe" size={14}/>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Website URL</span>
                <Chip tone="accent">recommended</Chip>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>
                Crawl your homepage, PDPs, and About page. Best for working brands with a live site.
              </div>
            </button>
            <button onClick={() => startScan("brand-guidelines.pdf")}
              style={{
                textAlign: "left", padding: 16,
                border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)",
                cursor: "pointer", display: "flex", flexDirection: "column", gap: 8,
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="book" size={14}/>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Guidelines PDF</span>
                <Chip>file upload</Chip>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>
                Upload a brand book or one-pager. Good for brands with formal guidelines.
              </div>
            </button>
          </div>

          <FormRow label="Website URL" hint="We'll fetch the homepage, 2 PDPs, and About — under 60 seconds.">
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://yourbrand.com"/>
          </FormRow>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em" }}>
              <Icon name="shield" size={11}/> Nothing applied until you approve
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn variant="primary" onClick={() => startScan(url)}>
                <Icon name="flash" size={12}/> Scan website
              </Btn>
            </div>
          </div>
        </div>
      )}

      {step === "scanning" && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            Scanning · {url}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--rule)", borderRadius: 5, overflow: "hidden" }}>
            {scanProgress.map((s, i) => (
              <div key={i} className="anim-slide" style={{
                padding: "10px 14px", borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                display: "flex", alignItems: "center", gap: 10, fontSize: 12.5,
                background: "var(--paper)",
              }}>
                <span style={{ color: "var(--success)" }}><Icon name="check" size={11}/></span>
                <span style={{ flex: 1 }}>{s.label}</span>
                <span className="mono" style={{ color: "var(--muted)", fontSize: 10.5, letterSpacing: "0.04em" }}>ok</span>
              </div>
            ))}
            <div style={{ padding: "10px 14px", borderTop: scanProgress.length ? "1px solid var(--rule)" : 0, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, background: "var(--paper-2)" }}>
              <span className="dot-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }}/>
              <span style={{ color: "var(--muted)" }}>Working…</span>
            </div>
          </div>
        </div>
      )}

      {step === "preview" && preset && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            Brand candidate · {preset.url}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 16, background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Palette</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {Object.entries(preset.palette).map(([name, c]) => (
                  <div key={name} style={{ flex: 1 }}>
                    <div style={{ height: 36, borderRadius: 4, background: `oklch(${c.l}% ${c.c} ${c.h})`, border: "1px solid var(--rule)" }}/>
                    <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 4, letterSpacing: "0.04em" }}>{name}</div>
                  </div>
                ))}
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted-2)", letterSpacing: "0.04em" }}>5 tones · oklch · WCAG AA verified</div>
            </div>

            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 16, background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Type</div>
              <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 26, lineHeight: 1.1, fontStyle: "italic", color: "var(--ink)" }}>{preset.fonts.display}</div>
              <div style={{ fontSize: 13, marginTop: 6, color: "var(--ink-2)" }}>{preset.fonts.body} <span style={{ color: "var(--muted)" }}>· body</span></div>
              <div className="mono" style={{ fontSize: 11.5, marginTop: 4, color: "var(--ink-2)" }}>{preset.fonts.mono} <span style={{ color: "var(--muted)" }}>· mono</span></div>
            </div>
          </div>

          <div style={{ marginTop: 14, border: "1px solid var(--rule)", borderRadius: 6, padding: 16, background: "var(--paper)" }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Voice</div>
            <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.55, fontStyle: "italic" }} className="serif">"{preset.voice}"</div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 14, background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Brand values · {preset.values.length}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {preset.values.map(v => <li key={v} style={{ paddingLeft: 14, position: "relative", marginBottom: 4 }}><span style={{ position: "absolute", left: 0, color: "var(--accent)" }}>·</span>{v}</li>)}
              </ul>
            </div>
            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: 14, background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Approved claims · {preset.claims.length}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {preset.claims.slice(0,4).map(c => <li key={c} style={{ paddingLeft: 14, position: "relative", marginBottom: 4 }}><span style={{ position: "absolute", left: 0, color: "var(--success)" }}>✓</span>{c}</li>)}
                {preset.claims.length > 4 && <li style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>+ {preset.claims.length - 4} more</li>}
              </ul>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 18 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em" }}>
              You can edit any of this in Brand Memory after applying
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={() => setStep("input")}>Back</Btn>
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
    ig: { fg: "linear-gradient(135deg, oklch(70% 0.18 30), oklch(58% 0.2 320))", letter: "I" },
    tt: { fg: "var(--ink)", letter: "T" },
    fb: { fg: "oklch(48% 0.18 260)", letter: "f" },
    li: { fg: "oklch(48% 0.14 235)", letter: "in" },
    yt: { fg: "oklch(58% 0.22 28)", letter: "▶" },
    pn: { fg: "oklch(56% 0.18 25)", letter: "P" },
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
  const [connectingId, setConnectingId] = useState4(null);
  const [authStep, setAuthStep] = useState4(null); // {connector, step}

  const catalog = SEED.connectorCatalog;
  const categories = ["Social", "Email", "SMS", "Search Ads", "Social Ads", "Creative AI", "Commerce", "Analytics", "SEO", "Affiliate", "Reviews · CX", "Experimentation", "MCP · Custom"];
  const byCat = useMemo4(() => {
    const out = {};
    catalog.forEach(c => { (out[c.category] ||= []).push(c); });
    return out;
  }, [catalog]);

  const startConnect = (connector) => {
    setAuthStep({ connector, step: "auth" });
  };
  const completeConnect = (connector) => {
    setAuthStep({ connector, step: "syncing" });
    setTimeout(() => {
      actions.setConnector(connector.id, {
        connected: true, status: "ok",
        note: `synced just now · ${connector.auth === "OAuth" ? "OAuth granted" : "API key validated"}`,
        syncCount: "initial sync running…",
      }, {
        logEvent: `connected · ${connector.name}`,
        notify: { tone: "ok", text: `${connector.name} connected` },
      });
      setAuthStep(null);
    }, 1100);
  };
  const disconnect = (connector) => {
    actions.setConnector(connector.id, {
      connected: false, status: "—", note: "not connected", syncCount: "—",
    }, { logEvent: `disconnected · ${connector.name}`, notify: { tone: "neutral", text: `${connector.name} disconnected` } });
  };

  const totalConnected = Object.values(state.connectors || {}).filter(c => c.connected).length;
  const totalAvailable = catalog.length;

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

      {/* Connector grid by category */}
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
                        {connected ? <Chip tone="ok">connected</Chip> : <Chip>disconnected</Chip>}
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
      <ConnectorAuthModal step={authStep} onClose={() => setAuthStep(null)} onComplete={completeConnect}/>
    </div>
  );
}

function ConnectorAuthModal({ step, onClose, onComplete }) {
  const [apiKey, setApiKey] = useState4("");
  const [mcpUrl, setMcpUrl] = useState4("");
  useEffect4(() => { if (step?.step === "auth") { setApiKey(""); setMcpUrl(""); } }, [step]);
  if (!step) return null;
  const { connector, step: phase } = step;
  const isMcp = connector.auth === "MCP";

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
            <FormRow label="API key" hint={`Found in your ${connector.name} dashboard → Settings → API. We never store this in plaintext.`}>
              <Input value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={connector.id === "fal" || connector.id === "mcp_fal" ? "fal-key-xxxxxxxxxxxx" : connector.id.startsWith("heygen") ? "hg_live_xxxxxxxxxxxx" : connector.id.startsWith("runware") ? "rw-key-xxxxxxxxxxxx" : "key_xxxxxxxxxxxx"}
                type="password"/>
            </FormRow>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 6 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary"
              onClick={() => onComplete(connector)}
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
          <div style={{ fontSize: 14, fontWeight: 500 }}>Connecting to {connector.name}…</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Validating credentials and pulling initial state</div>
        </div>
      )}
    </Dialog>
  );
}

Object.assign(window, { Connections, BrandImportModal, ConnectorIcon });
