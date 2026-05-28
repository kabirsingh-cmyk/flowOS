(function () {
// FlowOS Reach — Ads Workspace (Track A · PR 4a)
//
// Three-pane workspace over /api/paid-social and /api/zernio-ads.
//   left   campaigns list (per-platform)
//   center selected-campaign hierarchy (campaign → ad set → ad) with metrics
//   right  detail panel — edit budget / bid, pause / enable / duplicate,
//          launch "New campaign" drawer with targeting builder + live reach
//
// Future PRs (4b/4c) hang sub-tabs (Audiences, Lead forms, Spark Ads) off the
// same shell — keep additions append-only inside the IIFE.

const { useState: useStateAds, useMemo: useMemoAds, useEffect: useEffectAds, useRef: useRefAds } = React;

const PLATFORMS = [
  { id: "metaads", label: "Meta",     hint: "Facebook + Instagram" },
  { id: "liads",   label: "LinkedIn", hint: "Sponsored Content" },
  { id: "ttads",   label: "TikTok",   hint: "In-feed + Spark Ads" },
  { id: "xads",    label: "X",        hint: "Promoted tweets" },
  { id: "pinads",  label: "Pinterest",hint: "Promoted Pins" },
];

// Bid strategies that need a bidAmount / roasAverageFloor. Used to drive
// conditional rendering in the detail panel + new-campaign drawer.
const BID_STRATEGIES = [
  { id: "",                              label: "Default" },
  { id: "LOWEST_COST_WITHOUT_CAP",       label: "Lowest cost (no cap)" },
  { id: "LOWEST_COST_WITH_BID_CAP",      label: "Lowest cost (bid cap)",  needs: "bidAmount" },
  { id: "COST_CAP",                      label: "Cost cap",               needs: "bidAmount" },
  { id: "LOWEST_COST_WITH_MIN_ROAS",     label: "Min ROAS",               needs: "roas" },
];

const DEFAULT_TARGETING = {
  countries: ["US"],
  ageMin:    18,
  ageMax:    65,
  interests: [],  // [{ id, name }]
};

const fmtMoney = (n, currency) => n == null
  ? "—"
  : new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(n);

const fmtInt = (n) => n == null ? "—" : new Intl.NumberFormat("en-US").format(Math.round(n));

async function callPaidSocial(action, payload) {
  const res  = await window.apiFetch("/api/paid-social", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || `paid-social ${action} failed (${res.status})`);
  return json.data;
}

async function callAds(action, payload) {
  const res  = await window.apiFetch("/api/zernio-ads", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || `zernio-ads ${action} failed (${res.status})`);
  return json.data;
}

// ─── Targeting builder ───────────────────────────────────────────────────────
// Two autocompletes (countries + interests) plus an age range. Wires a
// debounced reach-estimate call whenever the spec changes meaningfully.

function TargetingBuilder({ platform, value, onChange, reach, reachLoading }) {
  const [interestQuery, setInterestQuery] = useStateAds("");
  const [interestHits,  setInterestHits]  = useStateAds([]);
  const [searching,     setSearching]     = useStateAds(false);
  const debounceRef = useRefAds(null);

  useEffectAds(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!interestQuery.trim()) { setInterestHits([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const data = await callAds("targeting_search", {
          platform, q: interestQuery, dimension: "interest", limit: 12,
        });
        setInterestHits(data.results || []);
      } catch (e) {
        console.warn("targeting_search", e);
        setInterestHits([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [interestQuery, platform]);

  const addInterest = (hit) => {
    if (value.interests.some(i => i.id === hit.id)) return;
    onChange({ ...value, interests: [...value.interests, { id: hit.id, name: hit.name }] });
    setInterestQuery("");
    setInterestHits([]);
  };
  const removeInterest = (id) =>
    onChange({ ...value, interests: value.interests.filter(i => i.id !== id) });

  const toggleCountry = (code) => {
    const has = value.countries.includes(code);
    onChange({ ...value, countries: has ? value.countries.filter(c => c !== code) : [...value.countries, code] });
  };

  const COMMON_COUNTRIES = ["US", "CA", "GB", "AU", "DE", "FR", "IN"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <FormRow label="Countries" hint="ISO 3166-1 alpha-2. Click to toggle.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {COMMON_COUNTRIES.map(c => (
            <button key={c} type="button" onClick={() => toggleCountry(c)} style={{
              fontFamily: "var(--font-mono)", fontSize: 11, padding: "4px 10px",
              borderRadius: 999, cursor: "pointer",
              border: "1px solid var(--rule)",
              background: value.countries.includes(c) ? "var(--accent-wash)" : "var(--paper-2)",
              color: value.countries.includes(c) ? "var(--accent-ink)" : "var(--ink-2)",
            }}>{c}</button>
          ))}
        </div>
      </FormRow>

      <FormRow label="Age" hint={`${value.ageMin} – ${value.ageMax}`}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Input type="number" min={13} max={65} value={value.ageMin}
            onChange={e => onChange({ ...value, ageMin: Math.max(13, Math.min(65, Number(e.target.value) || 13)) })}
            style={{ width: 80 }}/>
          <span style={{ color: "var(--muted)" }}>to</span>
          <Input type="number" min={13} max={65} value={value.ageMax}
            onChange={e => onChange({ ...value, ageMax: Math.max(13, Math.min(65, Number(e.target.value) || 65)) })}
            style={{ width: 80 }}/>
        </div>
      </FormRow>

      <FormRow label="Interests" hint="Type to search platform-native interest entities.">
        <div style={{ position: "relative" }}>
          <Input value={interestQuery} onChange={e => setInterestQuery(e.target.value)}
            placeholder="e.g. yoga, refrigeration, baking…"/>
          {interestHits.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
              background: "var(--paper)", border: "1px solid var(--rule)",
              borderRadius: 8, maxHeight: 220, overflowY: "auto", zIndex: 5,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}>
              {interestHits.map(h => (
                <button key={h.id} type="button" onClick={() => addInterest(h)} style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "8px 12px", border: 0, background: "transparent",
                  borderBottom: "1px solid var(--rule)", cursor: "pointer",
                  color: "var(--ink)", fontSize: 13,
                }}>
                  <div style={{ fontWeight: 500 }}>{h.name}</div>
                  {h.path?.length ? (
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{h.path.join(" › ")}</div>
                  ) : null}
                  {h.audienceSize != null ? (
                    <div style={{ color: "var(--muted-2)", fontSize: 11 }}>~{fmtInt(h.audienceSize)} reachable</div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
        {value.interests.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {value.interests.map(i => (
              <span key={i.id} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 8px", borderRadius: 999, fontSize: 11,
                background: "var(--accent-wash)", color: "var(--accent-ink)",
              }}>
                {i.name}
                <button type="button" onClick={() => removeInterest(i.id)} style={{
                  border: 0, background: "transparent", cursor: "pointer",
                  color: "var(--accent-ink)", padding: 0, fontSize: 14, lineHeight: 1,
                }}>×</button>
              </span>
            ))}
          </div>
        )}
        {searching ? <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 6 }}>Searching…</div> : null}
      </FormRow>

      <div style={{
        padding: "10px 12px", borderRadius: 8, background: "var(--paper-2)",
        border: "1px solid var(--rule)", fontSize: 12,
      }}>
        <div style={{ color: "var(--muted)", marginBottom: 4 }}>Estimated reach</div>
        {reachLoading
          ? <div style={{ color: "var(--ink-2)" }}>Calculating…</div>
          : reach?.available === false
            ? <div style={{ color: "var(--ink-2)" }}>Pre-flight estimate not available on this platform.</div>
            : reach?.lower != null
              ? <div style={{ fontWeight: 600 }}>{fmtInt(reach.lower)} – {fmtInt(reach.upper)} people</div>
              : <div style={{ color: "var(--muted-2)" }}>Add targeting to see an estimate.</div>}
      </div>
    </div>
  );
}

// ─── New-campaign drawer ─────────────────────────────────────────────────────

function NewCampaignDrawer({ open, onClose, platform, onCreated }) {
  const [name,       setName]       = useStateAds("");
  const [headline,   setHeadline]   = useStateAds("");
  const [body,       setBody]       = useStateAds("");
  const [linkUrl,    setLinkUrl]    = useStateAds("");
  const [budget,     setBudget]     = useStateAds(20);
  const [bidStrategy,setBidStrategy]= useStateAds("");
  const [bidAmount,  setBidAmount]  = useStateAds("");
  const [roasFloor,  setRoasFloor]  = useStateAds("");
  const [targeting,  setTargeting]  = useStateAds(DEFAULT_TARGETING);
  const [reach,      setReach]      = useStateAds(null);
  const [reachLoading, setReachLoading] = useStateAds(false);
  const [submitting, setSubmitting] = useStateAds(false);
  const [error,      setError]      = useStateAds("");

  // Debounced reach estimate whenever the spec changes.
  const reachTimer = useRefAds(null);
  useEffectAds(() => {
    if (!open) return;
    if (reachTimer.current) clearTimeout(reachTimer.current);
    reachTimer.current = setTimeout(async () => {
      try {
        setReachLoading(true);
        const spec = {
          countries: targeting.countries,
          ageMin:    targeting.ageMin,
          ageMax:    targeting.ageMax,
          interests: targeting.interests,
        };
        const data = await callAds("targeting_reach_estimate", { platform, spec });
        setReach(data);
      } catch (e) {
        console.warn("reach estimate", e);
        setReach({ available: false });
      } finally {
        setReachLoading(false);
      }
    }, 380);
    return () => clearTimeout(reachTimer.current);
  }, [open, platform, targeting]);

  const bidNeeds = BID_STRATEGIES.find(s => s.id === bidStrategy)?.needs;

  const submit = async () => {
    setError("");
    if (!linkUrl) { setError("linkUrl is required (destination URL)."); return; }
    if (bidNeeds === "bidAmount" && !bidAmount) { setError("bidAmount is required for this bid strategy."); return; }
    if (bidNeeds === "roas"      && !roasFloor) { setError("roasAverageFloor is required for this bid strategy."); return; }
    try {
      setSubmitting(true);
      const created = await callPaidSocial("create_campaign", {
        platform, name, headline, body, linkUrl, budgetDaily: Number(budget) || 10,
        targeting,
        ...(bidStrategy ? { bidStrategy } : {}),
        ...(bidAmount   ? { bidAmount:        Number(bidAmount) } : {}),
        ...(roasFloor   ? { roasAverageFloor: Number(roasFloor) } : {}),
      });
      onCreated?.(created);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={`New ${PLATFORMS.find(p => p.id === platform)?.label || ""} campaign`} width={620}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create (paused)"}
          </Btn>
        </div>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormRow label="Name"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Q3 awareness · creators"/></FormRow>
        <FormRow label="Headline"><Input value={headline} onChange={e => setHeadline(e.target.value)}/></FormRow>
        <FormRow label="Body"><Textarea value={body} onChange={e => setBody(e.target.value)} rows={3}/></FormRow>
        <FormRow label="Destination URL" hint="Required.">
          <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…"/>
        </FormRow>
        <FormRow label="Daily budget (USD)">
          <Input type="number" min={1} value={budget} onChange={e => setBudget(e.target.value)} style={{ width: 120 }}/>
        </FormRow>

        <div style={{ height: 1, background: "var(--rule)", margin: "6px 0" }}/>

        <TargetingBuilder platform={platform} value={targeting} onChange={setTargeting} reach={reach} reachLoading={reachLoading}/>

        <div style={{ height: 1, background: "var(--rule)", margin: "6px 0" }}/>

        <FormRow label="Bid strategy">
          <select value={bidStrategy} onChange={e => setBidStrategy(e.target.value)} style={{ ...inputCSS, width: "100%" }}>
            {BID_STRATEGIES.map(s => <option key={s.id || "default"} value={s.id}>{s.label}</option>)}
          </select>
        </FormRow>
        {bidNeeds === "bidAmount" && (
          <FormRow label="Bid cap (whole currency units)" hint="e.g. 5 = $5.00">
            <Input type="number" min={0} step="0.01" value={bidAmount} onChange={e => setBidAmount(e.target.value)} style={{ width: 140 }}/>
          </FormRow>
        )}
        {bidNeeds === "roas" && (
          <FormRow label="Min ROAS multiplier" hint="e.g. 2.0 = 2.0x">
            <Input type="number" min={0} step="0.1" value={roasFloor} onChange={e => setRoasFloor(e.target.value)} style={{ width: 140 }}/>
          </FormRow>
        )}

        {error ? <div style={{ color: "var(--accent-ink)", fontSize: 12 }}>{error}</div> : null}
      </div>
    </Drawer>
  );
}

// ─── Detail pane — selected campaign ─────────────────────────────────────────

function CampaignDetail({ platform, campaign, tree, onRefresh }) {
  const [busy, setBusy] = useStateAds("");
  const [editBudget, setEditBudget] = useStateAds(campaign.budgetMonth ? Math.round(campaign.budgetMonth / 30.4) : "");

  useEffectAds(() => {
    setEditBudget(campaign.budgetMonth ? Math.round(campaign.budgetMonth / 30.4) : "");
  }, [campaign.id]);

  const run = async (label, fn) => {
    try { setBusy(label); await fn(); await onRefresh(); }
    catch (e) { alert(e.message); }
    finally   { setBusy(""); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16 }}>
      <div>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{platform}</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{campaign.name}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {statusChip(campaign.status)}
          <Chip>{fmtInt(campaign.impressions)} impr</Chip>
          <Chip>{fmtInt(campaign.clicks)} clicks</Chip>
          <Chip>CTR {campaign.ctr ?? 0}%</Chip>
          {campaign.roas != null ? <Chip tone="ok">ROAS {campaign.roas}x</Chip> : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {campaign.status === "active" ? (
          <Btn size="sm" disabled={!!busy} onClick={() => run("pause",
            () => callPaidSocial("pause_campaign",  { platform, campaignId: campaign.id }))}>
            {busy === "pause" ? "Pausing…" : "Pause"}
          </Btn>
        ) : (
          <Btn size="sm" variant="primary" disabled={!!busy} onClick={() => run("enable",
            () => callPaidSocial("enable_campaign", { platform, campaignId: campaign.id }))}>
            {busy === "enable" ? "Enabling…" : "Enable"}
          </Btn>
        )}
        <Btn size="sm" disabled={!!busy} onClick={() => run("dup",
          () => callPaidSocial("campaign_duplicate", { platform, campaignId: campaign.id, deepCopy: true, statusOption: "PAUSED" }))}>
          {busy === "dup" ? "Duplicating…" : "Duplicate"}
        </Btn>
      </div>

      <FormRow label="Daily budget" hint="Updates the CBO budget. ABO campaigns fall back to the first ad set automatically.">
        <div style={{ display: "flex", gap: 6 }}>
          <Input type="number" min={1} value={editBudget} onChange={e => setEditBudget(e.target.value)} style={{ width: 120 }}/>
          <Btn size="sm" disabled={!!busy || !editBudget} onClick={() => run("budget",
            () => callPaidSocial("update_budget", { platform, campaignId: campaign.id, dailyBudget: Number(editBudget) }))}>
            {busy === "budget" ? "Saving…" : "Save"}
          </Btn>
        </div>
      </FormRow>

      <div>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          Hierarchy
        </div>
        {tree?.loading
          ? <div style={{ color: "var(--muted)", fontSize: 12 }}>Loading tree…</div>
          : tree?.error
            ? <div style={{ color: "var(--accent-ink)", fontSize: 12 }}>{tree.error}</div>
            : !tree?.adSets?.length
              ? <div style={{ color: "var(--muted)", fontSize: 12 }}>No ad sets discovered yet.</div>
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tree.adSets.map((s, i) => (
                    <div key={s.id || s.platformAdSetId || i} style={{
                      border: "1px solid var(--rule)", borderRadius: 8, padding: 10,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name || "Untitled ad set"}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {s.status} · {fmtInt(s.metrics?.impressions)} impr · {fmtMoney(s.metrics?.spend)} spend
                      </div>
                      {(s.ads || []).length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                          {s.ads.map((ad, j) => (
                            <div key={ad.id || ad.platformAdId || j} style={{
                              fontSize: 12, color: "var(--ink-2)", paddingLeft: 10, borderLeft: "2px solid var(--rule)",
                            }}>
                              {ad.name || "Untitled ad"} <span style={{ color: "var(--muted)" }}>· {ad.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
      </div>
    </div>
  );
}

// ─── Main shell ──────────────────────────────────────────────────────────────

function AdsWorkspace() {
  const [platform,    setPlatform]    = useStateAds("metaads");
  const [campaigns,   setCampaigns]   = useStateAds([]);
  const [selectedId,  setSelectedId]  = useStateAds(null);
  const [listLoading, setListLoading] = useStateAds(false);
  const [listError,   setListError]   = useStateAds("");
  const [tree,        setTree]        = useStateAds({});
  const [drawerOpen,  setDrawerOpen]  = useStateAds(false);

  const selected = useMemoAds(
    () => campaigns.find(c => c.id === selectedId) || campaigns[0] || null,
    [campaigns, selectedId]
  );

  const loadCampaigns = async () => {
    try {
      setListLoading(true);
      setListError("");
      const rows = await callPaidSocial("list_campaigns", { platform });
      setCampaigns(rows);
      if (!rows.some(r => r.id === selectedId)) setSelectedId(rows[0]?.id || null);
    } catch (e) {
      setListError(e.message);
      setCampaigns([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffectAds(() => { loadCampaigns(); /* eslint-disable-next-line */ }, [platform]);

  const loadTree = async () => {
    if (!selected) { setTree({}); return; }
    try {
      setTree({ loading: true });
      const data = await callPaidSocial("get_ad_tree", { platform });
      // Flatten the matching campaign's ad-set subtree for the detail pane.
      const match = (data.campaigns || []).find(c =>
        (c.platformCampaignId || c._id) === selected.id || c.campaignId === selected.id
      );
      setTree({ loading: false, adSets: match?.adSets || [] });
    } catch (e) {
      setTree({ loading: false, error: e.message });
    }
  };

  useEffectAds(() => { loadTree(); /* eslint-disable-next-line */ }, [selected?.id, platform]);

  const refresh = async () => { await loadCampaigns(); await loadTree(); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 380px", height: "100%", minHeight: 0 }}>
      {/* ── LEFT: campaigns list ──────────────────────────────────────────── */}
      <div style={{
        borderRight: "1px solid var(--rule)", display: "flex", flexDirection: "column",
        minHeight: 0, background: "var(--paper)",
      }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--rule)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Platform</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            {PLATFORMS.map(p => (
              <button key={p.id} type="button" onClick={() => setPlatform(p.id)} style={{
                fontSize: 11, fontFamily: "var(--font-mono)", padding: "4px 8px", borderRadius: 6,
                cursor: "pointer", border: "1px solid var(--rule)",
                background: p.id === platform ? "var(--accent-wash)" : "var(--paper-2)",
                color:      p.id === platform ? "var(--accent-ink)" : "var(--ink-2)",
              }} title={p.hint}>{p.label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: 12, borderBottom: "1px solid var(--rule)" }}>
          <Btn size="sm" variant="primary" onClick={() => setDrawerOpen(true)} style={{ width: "100%" }}>
            + New campaign
          </Btn>
        </div>

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {listLoading ? (
            <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>Loading…</div>
          ) : listError ? (
            <div style={{ padding: 16, color: "var(--accent-ink)", fontSize: 12 }}>{listError}</div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>
              No campaigns yet. Create one above to get started.
            </div>
          ) : campaigns.map(c => (
            <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 14px", border: 0, cursor: "pointer",
              background: c.id === selected?.id ? "var(--accent-wash)" : "transparent",
              borderBottom: "1px solid var(--rule)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{c.name || "Untitled"}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, display: "flex", gap: 8 }}>
                <span>{c.status}</span>
                <span>{fmtMoney(c.spend)}</span>
                <span>{fmtInt(c.impressions)} impr</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── CENTER: tree / overview ───────────────────────────────────────── */}
      <div style={{ overflowY: "auto", padding: 24, minHeight: 0 }}>
        {!selected ? (
          <div style={{ color: "var(--muted)" }}>Pick a campaign to see its hierarchy and metrics.</div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>{platform.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{selected.name}</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 18 }}>
              <Kpi label="Spend"       value={fmtMoney(selected.spend)}/>
              <Kpi label="Impressions" value={fmtInt(selected.impressions)}/>
              <Kpi label="Clicks"      value={fmtInt(selected.clicks)}/>
              <Kpi label="CTR"         value={`${selected.ctr ?? 0}%`}/>
              <Kpi label="CPC"         value={fmtMoney(selected.cpc)}/>
              <Kpi label="CPM"         value={fmtMoney(selected.cpm)}/>
              <Kpi label="Conversions" value={fmtInt(selected.conversions)}/>
              <Kpi label="ROAS"        value={selected.roas != null ? `${selected.roas}x` : "—"}/>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: detail panel ───────────────────────────────────────────── */}
      <div style={{ borderLeft: "1px solid var(--rule)", overflowY: "auto", minHeight: 0, background: "var(--paper)" }}>
        {selected
          ? <CampaignDetail platform={platform} campaign={selected} tree={tree} onRefresh={refresh}/>
          : <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>No selection.</div>}
      </div>

      <NewCampaignDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        platform={platform} onCreated={refresh}/>
    </div>
  );
}

Object.assign(window, { AdsWorkspace });
})();
