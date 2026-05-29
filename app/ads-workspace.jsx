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

function TargetingBuilder({ platform, value, onChange, reach, reachLoading, showReach = true }) {
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

      {showReach && (
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
      )}
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

// ─── Boost-post drawer (PR 4c) ───────────────────────────────────────────────
// Promote an existing published post as a paid ad on any platform.
// TikTok exposes Spark Ad fields (sparkAuthCode / linkUrl / callToAction) —
// other platforms hide them. The API already accepts the fields (PR 4a);
// this drawer is the user-facing surface.

const TIKTOK_CTAS = [
  "LEARN_MORE", "SHOP_NOW", "DOWNLOAD_NOW", "SIGN_UP", "WATCH_NOW",
  "GET_QUOTE", "BOOK_NOW", "CONTACT_US", "APPLY_NOW", "ORDER_NOW",
];

const BOOST_GOALS = [
  { id: "engagement",      label: "Engagement" },
  { id: "traffic",         label: "Traffic" },
  { id: "awareness",       label: "Awareness" },
  { id: "video_views",     label: "Video views" },
  { id: "lead_generation", label: "Lead generation" },
  { id: "conversions",     label: "Conversions" },
  { id: "app_promotion",   label: "App promotion" },
];

function BoostDrawer({ open, onClose, platform, onCreated }) {
  const [postId,          setPostId]          = useStateAds("");
  const [usePlatformPost, setUsePlatformPost] = useStateAds(false);
  const [name,            setName]            = useStateAds("");
  const [goal,            setGoal]            = useStateAds("engagement");
  const [budget,          setBudget]          = useStateAds(20);
  const [targeting,       setTargeting]       = useStateAds({ countries: ["US"], ageMin: 18, ageMax: 65, interests: [] });
  // TikTok-only Spark Ad fields. Stay in state across platforms so a quick
  // switch back to TikTok keeps the user's input — minor convenience.
  const [sparkAuthCode,   setSparkAuthCode]   = useStateAds("");
  const [linkUrl,         setLinkUrl]         = useStateAds("");
  const [callToAction,    setCallToAction]    = useStateAds("LEARN_MORE");
  const [submitting,      setSubmitting]      = useStateAds(false);
  const [error,           setError]           = useStateAds("");

  const isTikTok = platform === "ttads";

  const submit = async () => {
    setError("");
    if (!postId) { setError("Post ID required."); return; }
    if (isTikTok && goal !== "engagement" && goal !== "awareness" && goal !== "video_views" && !linkUrl) {
      setError("TikTok Spark Ads with traffic/conversion goals require a destination URL.");
      return;
    }
    try {
      setSubmitting(true);
      const body = {
        platform,
        ...(usePlatformPost ? { platformPostId: postId } : { postId }),
        name, goal, budgetDaily: Number(budget) || 10,
        targeting,
        ...(isTikTok && sparkAuthCode ? { sparkAuthCode } : {}),
        ...(isTikTok && linkUrl       ? { linkUrl }       : {}),
        ...(isTikTok && callToAction  ? { callToAction }  : {}),
      };
      const created = await callPaidSocial("boost_post", body);
      onCreated?.(created);
      onClose();
    } catch (e) { setError(e.message); }
    finally   { setSubmitting(false); }
  };

  return (
    <Drawer open={open} onClose={onClose}
      title={`Boost ${PLATFORMS.find(p => p.id === platform)?.label || ""} post`} width={580}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Boosting…" : "Create (paused)"}
          </Btn>
        </div>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormRow label={usePlatformPost ? "Platform post ID" : "Zernio post ID"}
          hint={usePlatformPost ? "The post ID as it exists on the platform (Meta/TikTok/etc.)" : "Zernio's internal post _id."}>
          <Input value={postId} onChange={e => setPostId(e.target.value)} placeholder={usePlatformPost ? "1234567890" : "p_abc123…"}/>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-2)", marginTop: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={usePlatformPost} onChange={e => setUsePlatformPost(e.target.checked)}/>
            Use platform-native post ID instead
          </label>
        </FormRow>

        <FormRow label="Name (optional)">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Boost · creator collab · Q3"/>
        </FormRow>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormRow label="Goal">
            <select value={goal} onChange={e => setGoal(e.target.value)} style={{ ...inputCSS, width: "100%" }}>
              {BOOST_GOALS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          </FormRow>
          <FormRow label="Daily budget (USD)">
            <Input type="number" min={1} value={budget} onChange={e => setBudget(e.target.value)}/>
          </FormRow>
        </div>

        {isTikTok && (
          <>
            <div style={{ height: 1, background: "var(--rule)", margin: "6px 0" }}/>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              TikTok Spark Ads
            </div>
            <FormRow label="Spark auth code (optional)"
              hint="Creator's auth_code from TikTok app → Promote settings. Required only when boosting another creator's video.">
              <Input value={sparkAuthCode} onChange={e => setSparkAuthCode(e.target.value)} placeholder="Creator's Spark code"/>
            </FormRow>
            <FormRow label="Destination URL"
              hint="Spark Ads have no clickable destination by default. Required for traffic / conversion goals.">
              <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…"/>
            </FormRow>
            <FormRow label="Call to action">
              <select value={callToAction} onChange={e => setCallToAction(e.target.value)} style={{ ...inputCSS, width: "100%" }}>
                {TIKTOK_CTAS.map(c => <option key={c} value={c}>{c.replace(/_/g, " ").toLowerCase()}</option>)}
              </select>
            </FormRow>
          </>
        )}

        <div style={{ height: 1, background: "var(--rule)", margin: "6px 0" }}/>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Targeting</div>
        <TargetingBuilder platform={platform} value={targeting} onChange={setTargeting} showReach={false}/>

        {error ? <div style={{ fontSize: 12, color: "var(--accent-ink)" }}>{error}</div> : null}
      </div>
    </Drawer>
  );
}

// ─── Detail pane — selected campaign ─────────────────────────────────────────

function CampaignDetail({ platform, campaign, tree, onRefresh }) {
  const [busy, setBusy] = useStateAds("");
  const [editBudget, setEditBudget] = useStateAds(campaign.budgetMonth ? Math.round(campaign.budgetMonth / 30.4) : "");
  const [adChart, setAdChart] = useStateAds(null); // { adId, adName, data, loading, error }
  const [chartCache, setChartCache] = useStateAds({}); // { [adId]: { data, fetchedAt } }

  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip: ReTooltip, ResponsiveContainer } = window.Recharts || {};

  useEffectAds(() => {
    setEditBudget(campaign.budgetMonth ? Math.round(campaign.budgetMonth / 30.4) : "");
  }, [campaign.id]);

  const run = async (label, fn) => {
    try { setBusy(label); await fn(); await onRefresh(); }
    catch (e) { alert(e.message); }
    finally   { setBusy(""); }
  };

  const openAdChart = async (ad) => {
    const adId = ad.id || ad.platformAdId || ad.adId;
    const adName = ad.name || "Untitled ad";
    if (!adId) return;

    // Serve from session cache if available.
    const cached = chartCache[adId];
    if (cached?.data) {
      setAdChart({ adId, adName, loading: false, data: cached.data });
      return;
    }

    const toDate   = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
      setAdChart({ adId, adName, loading: true, data: [] });
      const analytics = await callAds("ad_analytics", { adId, fromDate, toDate });
      // Zernio returns { rows: [{ date, impressions, clicks, spend, ctr, cpc, conversions, roas }, ...] }
      const rows = (analytics?.rows || analytics?.data || analytics || []).filter(Boolean);
      setChartCache(prev => ({ ...prev, [adId]: { data: rows, fetchedAt: Date.now() } }));
      setAdChart({ adId, adName, loading: false, data: rows });
    } catch (e) {
      setAdChart({ adId, adName, loading: false, data: [], error: e.message });
    }
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
                            <button key={ad.id || ad.platformAdId || j} type="button" onClick={() => openAdChart(ad)} style={{
                              fontSize: 12, color: "var(--ink-2)", paddingLeft: 10, borderLeft: "2px solid var(--rule)",
                              background: "transparent", border: 0, cursor: "pointer", textAlign: "left",
                            }}>
                              {ad.name || "Untitled ad"} <span style={{ color: "var(--muted)" }}>· {ad.status}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
      </div>

      {/* Per-ad analytics chart (PR A4) */}
      {adChart && (
        <div style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: 12, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{adChart.adName}</div>
            <button type="button" onClick={() => setAdChart(null)} style={{
              fontSize: 11, color: "var(--muted)", background: "transparent", border: 0, cursor: "pointer",
            }}>Close</button>
          </div>
          {adChart.loading ? (
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Loading analytics…</div>
          ) : adChart.error ? (
            <div style={{ fontSize: 11, color: "var(--accent-ink)" }}>{adChart.error}</div>
          ) : adChart.data.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--muted)" }}>No analytics data for this period.</div>
          ) : !LineChart ? (
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Chart library not loaded.</div>
          ) : (
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={adChart.data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted)" />
                  <YAxis yAxisId="left"  tick={{ fontSize: 10 }} stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#82ca9d" />
                  <ReTooltip contentStyle={{ fontSize: 11, background: "var(--paper)", border: "1px solid var(--rule)" }} />
                  <Line yAxisId="left"  type="monotone" dataKey="spend"        stroke="#8884d8" strokeWidth={2} dot={false} name="Spend ($)" />
                  <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#82ca9d" strokeWidth={2} dot={false} name="Impressions" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Audiences sub-tab (PR 4b) ───────────────────────────────────────────────

const AUDIENCE_TYPES = [
  { id: "customer_list",   label: "Customer list",  metaOnly: false, note: "Upload emails / phones." },
  { id: "website",         label: "Website",        metaOnly: true,  note: "Pixel-based retargeting. Meta only." },
  { id: "lookalike",       label: "Lookalike",      metaOnly: true,  note: "Derived from a source audience. Meta only." },
  { id: "saved_targeting", label: "Saved targeting",metaOnly: false, note: "Reusable TargetingSpec — no upload step." },
];

// Tiny RFC4180-ish CSV parser scoped to email/phone extraction. Doesn't depend
// on workspaces3.jsx's parseCsv (that's IIFE-private).
function parseCsvForUsers(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else { field += c; }
    } else {
      if      (c === '"')  inQuotes = true;
      else if (c === ",")  { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* swallow */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];

  // Detect a header row by looking for the word "email" or "phone" (case
  // insensitive). If absent, treat the file as plain email-per-line.
  const first = rows[0].map(s => String(s || "").trim().toLowerCase());
  const hasHeader = first.some(c => c === "email" || c === "phone" || c.includes("e-mail"));
  let emailIdx = -1, phoneIdx = -1;
  if (hasHeader) {
    emailIdx = first.findIndex(c => c === "email" || c === "e-mail" || c.includes("email"));
    phoneIdx = first.findIndex(c => c === "phone" || c.includes("phone") || c.includes("tel"));
    rows.shift();
  } else {
    // Single-column or no header: assume column 0 is email.
    emailIdx = 0;
  }

  const out = [];
  for (const r of rows) {
    const u = {};
    if (emailIdx >= 0 && r[emailIdx]) u.email = String(r[emailIdx]).trim();
    if (phoneIdx >= 0 && r[phoneIdx]) u.phone = String(r[phoneIdx]).trim();
    if (u.email || u.phone) out.push(u);
  }
  return out;
}

function NewAudienceDrawer({ open, onClose, platform, adAccountId, onCreated }) {
  const [type,        setType]        = useStateAds("customer_list");
  const [name,        setName]        = useStateAds("");
  const [description, setDescription] = useStateAds("");
  const [pixelId,     setPixelId]     = useStateAds("");
  const [retention,   setRetention]   = useStateAds(30);
  const [sourceAud,   setSourceAud]   = useStateAds("");
  const [country,     setCountry]     = useStateAds("US");
  const [ratio,       setRatio]       = useStateAds(0.01);
  const [csvUsers,    setCsvUsers]    = useStateAds([]);
  const [csvName,     setCsvName]     = useStateAds("");
  const [csvError,    setCsvError]    = useStateAds("");
  const [submitting,  setSubmitting]  = useStateAds(false);
  const [progress,    setProgress]    = useStateAds("");
  const [error,       setError]       = useStateAds("");

  const cfg = AUDIENCE_TYPES.find(t => t.id === type) || AUDIENCE_TYPES[0];
  const metaOnly = cfg.metaOnly && platform !== "metaads";

  const onCsvFile = async (file) => {
    if (!file) return;
    setCsvError("");
    setCsvName(file.name);
    try {
      const text = await file.text();
      const users = parseCsvForUsers(text);
      if (users.length === 0) {
        setCsvError("No email or phone rows found in this file.");
        setCsvUsers([]);
        return;
      }
      setCsvUsers(users);
    } catch (e) {
      setCsvError(e.message);
      setCsvUsers([]);
    }
  };

  const submit = async () => {
    setError(""); setProgress("");
    if (metaOnly) { setError(`${type} audiences require a Meta ad account.`); return; }
    if (!name)    { setError("Name required.");                                 return; }
    if (type !== "saved_targeting" && !adAccountId) {
      setError("Set the platform ad account ID at the top of the audiences view first.");
      return;
    }
    try {
      setSubmitting(true);
      const created = await callAds("audiences_create", {
        platform, adAccountId, name, description, type,
        ...(type === "website"   ? { pixelId, retentionDays: Number(retention) } : {}),
        ...(type === "lookalike" ? { sourceAudienceId: sourceAud, country, ratio: Number(ratio) } : {}),
      });
      const audienceId = created.audience?.id || created.audience?._id || created.audience?.platformAudienceId;

      // Chunk-upload the CSV after create (customer_list only).
      if (type === "customer_list" && csvUsers.length > 0) {
        if (!audienceId) throw new Error("Audience created but no ID returned — cannot upload members.");
        const CHUNK = 1000;
        for (let i = 0; i < csvUsers.length; i += CHUNK) {
          setProgress(`Uploading ${i + 1}–${Math.min(i + CHUNK, csvUsers.length)} of ${csvUsers.length}…`);
          await callAds("audiences_add_users", { audienceId, users: csvUsers.slice(i, i + CHUNK) });
        }
        setProgress(`Uploaded ${csvUsers.length} rows.`);
      }
      onCreated?.(created);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New audience" width={560}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={submitting || metaOnly}
            title={metaOnly ? "Lookalikes are Meta-only per platform spec." : undefined}>
            {submitting ? "Creating…" : "Create"}
          </Btn>
        </div>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormRow label="Type">
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputCSS, width: "100%" }}>
            {AUDIENCE_TYPES.map(t => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{cfg.note}</div>
        </FormRow>

        <FormRow label="Name"><Input value={name} onChange={e => setName(e.target.value)}/></FormRow>
        <FormRow label="Description (optional)">
          <Input value={description} onChange={e => setDescription(e.target.value)}/>
        </FormRow>

        {type === "website" && (
          <>
            <FormRow label="Pixel ID"><Input value={pixelId} onChange={e => setPixelId(e.target.value)}/></FormRow>
            <FormRow label="Retention (days)" hint="1 – 180">
              <Input type="number" min={1} max={180} value={retention}
                onChange={e => setRetention(Math.max(1, Math.min(180, Number(e.target.value) || 30)))}
                style={{ width: 100 }}/>
            </FormRow>
          </>
        )}

        {type === "lookalike" && (
          <>
            <FormRow label="Source audience ID"><Input value={sourceAud} onChange={e => setSourceAud(e.target.value)}/></FormRow>
            <FormRow label="Country" hint="2-letter ISO code.">
              <Input value={country} onChange={e => setCountry(e.target.value.toUpperCase().slice(0, 2))} style={{ width: 80 }}/>
            </FormRow>
            <FormRow label="Ratio" hint="0.01 – 0.20 (1% – 20% similarity)">
              <Input type="number" min={0.01} max={0.2} step="0.01" value={ratio}
                onChange={e => setRatio(Math.max(0.01, Math.min(0.2, Number(e.target.value) || 0.01)))}
                style={{ width: 100 }}/>
            </FormRow>
          </>
        )}

        {type === "customer_list" && (
          <FormRow label="CSV upload (optional)" hint="Headers email / phone, or one email per line.">
            <input type="file" accept=".csv,text/csv,text/plain"
              onChange={e => onCsvFile(e.target.files?.[0])}/>
            {csvName ? <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>{csvName} · {csvUsers.length} valid rows</div> : null}
            {csvError ? <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 4 }}>{csvError}</div> : null}
          </FormRow>
        )}

        {progress ? <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{progress}</div> : null}
        {error    ? <div style={{ fontSize: 12, color: "var(--accent-ink)" }}>{error}</div> : null}
      </div>
    </Drawer>
  );
}

function AudienceDetail({ audience, onDelete, onAppend, platform }) {
  const [busy,     setBusy]     = useStateAds("");
  const [csvUsers, setCsvUsers] = useStateAds([]);
  const [csvName,  setCsvName]  = useStateAds("");
  const [csvError, setCsvError] = useStateAds("");
  const [progress, setProgress] = useStateAds("");

  const audienceId = audience.id || audience._id || audience.platformAudienceId;
  const canAddUsers = audience.type === "customer_list";

  const onCsvFile = async (file) => {
    if (!file) return;
    setCsvError(""); setCsvName(file.name);
    try {
      const users = parseCsvForUsers(await file.text());
      if (users.length === 0) { setCsvError("No email/phone rows."); setCsvUsers([]); return; }
      setCsvUsers(users);
    } catch (e) { setCsvError(e.message); setCsvUsers([]); }
  };

  const doUpload = async () => {
    if (!audienceId)      { alert("Audience has no ID — cannot upload."); return; }
    if (csvUsers.length === 0) return;
    try {
      setBusy("upload");
      const CHUNK = 1000;
      for (let i = 0; i < csvUsers.length; i += CHUNK) {
        setProgress(`Uploading ${i + 1}–${Math.min(i + CHUNK, csvUsers.length)} of ${csvUsers.length}…`);
        await callAds("audiences_add_users", { audienceId, users: csvUsers.slice(i, i + CHUNK) });
      }
      setProgress(`Uploaded ${csvUsers.length} rows.`);
      onAppend?.();
    } catch (e) { alert(e.message); }
    finally    { setBusy(""); }
  };

  const doDelete = async () => {
    if (!audienceId) return;
    if (!confirm(`Delete audience "${audience.name}"? This cannot be undone.`)) return;
    try {
      setBusy("delete");
      await callAds("audiences_delete", { audienceId });
      onDelete?.();
    } catch (e) { alert(e.message); }
    finally    { setBusy(""); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16 }}>
      <div>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {audience.type || "audience"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{audience.name || "Untitled audience"}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {audience.status ? <Chip>{audience.status}</Chip> : null}
          {audience.size != null ? <Chip>{fmtInt(audience.size)} members</Chip> : null}
        </div>
        {audience.description ? <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-2)" }}>{audience.description}</div> : null}
      </div>

      {canAddUsers && (
        <FormRow label="Add members from CSV" hint="email / phone columns; chunked at 10 000 rows per request.">
          <input type="file" accept=".csv,text/csv,text/plain"
            onChange={e => onCsvFile(e.target.files?.[0])}/>
          {csvName ? <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>{csvName} · {csvUsers.length} rows</div> : null}
          {csvError ? <div style={{ fontSize: 11, color: "var(--accent-ink)", marginTop: 4 }}>{csvError}</div> : null}
          {csvUsers.length > 0 && (
            <Btn size="sm" variant="primary" onClick={doUpload} disabled={!!busy} style={{ marginTop: 8 }}>
              {busy === "upload" ? "Uploading…" : `Upload ${csvUsers.length} rows`}
            </Btn>
          )}
          {progress ? <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>{progress}</div> : null}
        </FormRow>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
        <Btn size="sm" onClick={doDelete} disabled={!!busy}>
          {busy === "delete" ? "Deleting…" : "Delete audience"}
        </Btn>
      </div>
    </div>
  );
}

function AudiencesPane({ platform, adAccountId, setAdAccountId }) {
  const [audiences,  setAudiences]  = useStateAds([]);
  const [selectedId, setSelectedId] = useStateAds(null);
  const [filter,     setFilter]     = useStateAds("");          // "" = all
  const [loading,    setLoading]    = useStateAds(false);
  const [error,      setError]      = useStateAds("");
  const [drawerOpen, setDrawerOpen] = useStateAds(false);

  const idOf = (a) => a.id || a._id || a.platformAudienceId;
  const selected = useMemoAds(
    () => audiences.find(a => idOf(a) === selectedId) || audiences[0] || null,
    [audiences, selectedId]
  );

  const load = async () => {
    if (!adAccountId) { setAudiences([]); return; }
    try {
      setLoading(true); setError("");
      const data = await callAds("audiences_list", { platform, adAccountId, ...(filter ? { type: filter } : {}) });
      setAudiences(data.audiences || []);
      if (!data.audiences?.some(a => idOf(a) === selectedId)) setSelectedId(idOf(data.audiences?.[0]) || null);
    } catch (e) {
      setError(e.message); setAudiences([]);
    } finally { setLoading(false); }
  };

  // After CSV uploads, poll a few times so the async "processing → ready" flip
  // and updated row count are visible without manual refresh.
  const pollTimers = useRefAds([]);
  const loadWithPoll = async () => {
    await load();
    pollTimers.current.forEach(clearTimeout);
    pollTimers.current = [1, 2, 3].map(n => setTimeout(load, n * 2000));
  };

  useEffectAds(() => { load(); /* eslint-disable-next-line */ }, [platform, adAccountId, filter]);
  useEffectAds(() => () => pollTimers.current.forEach(clearTimeout), []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr 360px", height: "100%", minHeight: 0 }}>
      {/* LEFT: list + filter + ad account */}
      <div style={{ borderRight: "1px solid var(--rule)", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper)" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--rule)" }}>
          <FormRow label="Platform ad account ID" hint="e.g. act_123456 for Meta. Stored locally per platform.">
            <Input value={adAccountId} onChange={e => setAdAccountId(e.target.value)} placeholder="act_…"/>
          </FormRow>
        </div>

        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { id: "",               label: "All" },
            { id: "customer_list",  label: "Customer" },
            { id: "website",        label: "Website" },
            { id: "lookalike",      label: "Lookalike" },
            { id: "saved_targeting",label: "Saved" },
          ].map(f => (
            <button key={f.id || "all"} type="button" onClick={() => setFilter(f.id)} style={{
              fontSize: 11, padding: "3px 8px", borderRadius: 999, cursor: "pointer",
              border: "1px solid var(--rule)",
              background: filter === f.id ? "var(--accent-wash)" : "var(--paper-2)",
              color:      filter === f.id ? "var(--accent-ink)" : "var(--ink-2)",
            }}>{f.label}</button>
          ))}
        </div>

        <div style={{ padding: 12, borderBottom: "1px solid var(--rule)" }}>
          <Btn size="sm" variant="primary" disabled={!adAccountId} onClick={() => setDrawerOpen(true)} style={{ width: "100%" }}>
            + New audience
          </Btn>
        </div>

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {!adAccountId ? (
            <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>
              Enter your platform ad account ID above to see audiences.
            </div>
          ) : loading ? (
            <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: 16, color: "var(--accent-ink)", fontSize: 12 }}>{error}</div>
          ) : audiences.length === 0 ? (
            <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>
              No audiences yet. Create one above.
            </div>
          ) : audiences.map(a => (
            <button key={idOf(a)} type="button" onClick={() => setSelectedId(idOf(a))} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 14px", border: 0, cursor: "pointer",
              background: idOf(a) === idOf(selected || {}) ? "var(--accent-wash)" : "transparent",
              borderBottom: "1px solid var(--rule)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{a.name || "Untitled audience"}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, display: "flex", gap: 8 }}>
                <span>{a.type || "—"}</span>
                {a.size != null ? <span>{fmtInt(a.size)} members</span> : null}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CENTER: nothing fancy yet — audience-level analytics is post-4b */}
      <div style={{ padding: 24, overflowY: "auto", minHeight: 0 }}>
        {!selected ? (
          <div style={{ color: "var(--muted)" }}>Pick an audience to see details and manage members.</div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
              {platform.toUpperCase()} · {selected.type}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{selected.name}</div>
            {selected.spec ? (
              <pre style={{
                marginTop: 18, fontSize: 11, fontFamily: "var(--font-mono)",
                background: "var(--paper-2)", border: "1px solid var(--rule)",
                borderRadius: 8, padding: 12, overflowX: "auto", maxHeight: 400,
              }}>{JSON.stringify(selected.spec, null, 2)}</pre>
            ) : null}
          </div>
        )}
      </div>

      {/* RIGHT: detail/actions */}
      <div style={{ borderLeft: "1px solid var(--rule)", overflowY: "auto", minHeight: 0, background: "var(--paper)" }}>
        {selected
          ? <AudienceDetail audience={selected} platform={platform} onDelete={load} onAppend={loadWithPoll}/>
          : <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>No selection.</div>}
      </div>

      <NewAudienceDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        platform={platform} adAccountId={adAccountId} onCreated={loadWithPoll}/>
    </div>
  );
}

// ─── Lead forms sub-tab (PR 4c) ──────────────────────────────────────────────
// Meta Lead Gen forms are Page-owned and Meta-only. On other platforms we
// render a polite "not available" panel and skip the API calls.

function PushToKlaviyoButton({ lead, onPushed }) {
  const [busy, setBusy] = useStateAds(false);
  const [msg,  setMsg]  = useStateAds("");

  // Pull email/phone from the normalized `fields` map first, fall back to
  // raw `fieldData`. Both shapes are returned by Zernio.
  const fieldOf = (key) => {
    if (lead.fields?.[key]) return lead.fields[key];
    const raw = (lead.fieldData || []).find(f => String(f?.name || "").toLowerCase().includes(key));
    return raw?.values?.[0] || null;
  };
  const email      = fieldOf("email");
  const phone      = fieldOf("phone");
  const firstName  = fieldOf("first_name") || fieldOf("first name") || fieldOf("full_name")?.split(" ")[0];
  const lastName   = fieldOf("last_name")  || fieldOf("last name")  || fieldOf("full_name")?.split(" ").slice(1).join(" ");

  const push = async () => {
    if (!email && !phone) { alert("This lead has no email or phone — nothing to push."); return; }
    setBusy(true); setMsg("");
    try {
      const res  = await window.apiFetch("/api/klaviyo", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          action: "subscribe_lead",
          email, phone, firstName, lastName,
          leadId: lead.id,
          properties: {
            source:           "Meta Lead Ad",
            zernio_lead_id:   lead.id,
            zernio_form_id:   lead.formId,
            campaign_id:      lead.campaignId || null,
            ad_id:            lead.adId       || null,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `Klaviyo push failed (${res.status})`);
      setMsg(`Pushed${json.subscribed ? " + subscribed" : ""}.`);
      onPushed?.(json);
    } catch (e) {
      setMsg(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Btn size="sm" variant="primary" onClick={push} disabled={busy || (!email && !phone)}>
        {busy ? "Pushing…" : "Push to Klaviyo"}
      </Btn>
      {msg ? <span style={{ fontSize: 11, color: msg.startsWith("Pushed") ? "var(--ink-2)" : "var(--accent-ink)" }}>{msg}</span> : null}
    </div>
  );
}

function NewLeadFormDrawer({ open, onClose, platform, onCreated }) {
  const [name,           setName]           = useStateAds("");
  const [privacyUrl,     setPrivacyUrl]     = useStateAds("");
  const [thankYouTitle,  setThankYouTitle]  = useStateAds("Thanks!");
  const [thankYouBody,   setThankYouBody]   = useStateAds("We'll be in touch soon.");
  const [questions,      setQuestions]      = useStateAds([
    { type: "EMAIL" }, { type: "FULL_NAME" },
  ]);
  const [submitting,     setSubmitting]     = useStateAds(false);
  const [error,          setError]          = useStateAds("");

  const PREFILLED_TYPES = ["EMAIL", "PHONE", "FULL_NAME", "FIRST_NAME", "LAST_NAME", "CITY", "STATE", "COUNTRY"];

  const addQ = () => setQuestions(qs => [...qs, { type: "EMAIL" }]);
  const setQ = (i, patch) => setQuestions(qs => qs.map((q, j) => j === i ? { ...q, ...patch } : q));
  const rmQ  = (i) => setQuestions(qs => qs.filter((_, j) => j !== i));

  const submit = async () => {
    setError("");
    if (!name)       { setError("Form name required.");           return; }
    if (!privacyUrl) { setError("Privacy policy URL required."); return; }
    if (questions.length === 0) { setError("At least one question required."); return; }
    try {
      setSubmitting(true);
      await callAds("lead_forms_create", {
        platform, name, privacyPolicyUrl: privacyUrl,
        thankYouTitle, thankYouBody,
        questions: questions.map(q => {
          const isCustom = !PREFILLED_TYPES.includes(q.type);
          return isCustom
            ? { type: "CUSTOM", key: q.key || q.label?.toLowerCase().replace(/\s+/g, "_"), label: q.label || "" }
            : { type: q.type };
        }),
      });
      onCreated?.();
      onClose();
    } catch (e) { setError(e.message); }
    finally   { setSubmitting(false); }
  };

  return (
    <Drawer open={open} onClose={onClose} title="New Lead Gen form" width={580}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create form"}
          </Btn>
        </div>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FormRow label="Form name"><Input value={name} onChange={e => setName(e.target.value)}/></FormRow>
        <FormRow label="Privacy policy URL" hint="Required by Meta for every Lead Gen form.">
          <Input value={privacyUrl} onChange={e => setPrivacyUrl(e.target.value)} placeholder="https://…/privacy"/>
        </FormRow>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormRow label="Thank-you title"><Input value={thankYouTitle} onChange={e => setThankYouTitle(e.target.value)}/></FormRow>
          <FormRow label="Thank-you body"><Input value={thankYouBody} onChange={e => setThankYouBody(e.target.value)}/></FormRow>
        </div>

        <FormRow label="Questions">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {questions.map((q, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select value={q.type} onChange={e => setQ(i, { type: e.target.value })} style={{ ...inputCSS, width: 160 }}>
                  {PREFILLED_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  <option value="CUSTOM">Custom…</option>
                </select>
                {q.type === "CUSTOM" && (
                  <Input value={q.label || ""} onChange={e => setQ(i, { label: e.target.value })} placeholder="Question label" style={{ flex: 1 }}/>
                )}
                <Btn size="sm" variant="ghost" onClick={() => rmQ(i)}>×</Btn>
              </div>
            ))}
            <Btn size="sm" onClick={addQ}>+ Add question</Btn>
          </div>
        </FormRow>

        {error ? <div style={{ fontSize: 12, color: "var(--accent-ink)" }}>{error}</div> : null}
      </div>
    </Drawer>
  );
}

function LeadFormsPane({ platform }) {
  const [forms,        setForms]        = useStateAds([]);
  const [selectedFormId, setSelectedFormId] = useStateAds(null);
  const [leads,        setLeads]        = useStateAds([]);
  const [selectedLeadId, setSelectedLeadId] = useStateAds(null);
  const [loadingForms, setLoadingForms] = useStateAds(false);
  const [loadingLeads, setLoadingLeads] = useStateAds(false);
  const [error,        setError]        = useStateAds("");
  const [drawerOpen,   setDrawerOpen]   = useStateAds(false);

  const isMeta = platform === "metaads";

  const loadForms = async () => {
    if (!isMeta) { setForms([]); return; }
    try {
      setLoadingForms(true); setError("");
      const data = await callAds("lead_forms_list", { platform: "metaads", limit: 100 });
      setForms(data.forms || []);
      if (!data.forms?.some(f => f.id === selectedFormId)) {
        setSelectedFormId(data.forms?.[0]?.id || null);
      }
    } catch (e) { setError(e.message); setForms([]); }
    finally    { setLoadingForms(false); }
  };

  const loadLeads = async () => {
    if (!isMeta || !selectedFormId) { setLeads([]); return; }
    try {
      setLoadingLeads(true);
      const data = await callAds("leads_list", { platform: "metaads", formId: selectedFormId, limit: 100 });
      setLeads(data.leads || []);
      if (!data.leads?.some(l => l.id === selectedLeadId)) {
        setSelectedLeadId(data.leads?.[0]?.id || null);
      }
    } catch (e) { setError(e.message); setLeads([]); }
    finally    { setLoadingLeads(false); }
  };

  useEffectAds(() => { loadForms(); /* eslint-disable-next-line */ }, [platform]);
  useEffectAds(() => { loadLeads(); /* eslint-disable-next-line */ }, [selectedFormId]);

  if (!isMeta) {
    return (
      <div style={{ padding: 40, color: "var(--muted)", maxWidth: 540 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>
          Lead forms are Meta-only.
        </div>
        Switch the platform tab to <strong>Meta</strong> at the top to manage Lead Gen forms and their leads.
        Other platforms don't expose a public Lead Gen API — use their native ad-platform UI to create leads,
        and the Audiences tab + customer-list CSV upload to retarget.
      </div>
    );
  }

  const selectedForm = forms.find(f => f.id === selectedFormId) || forms[0] || null;
  const selectedLead = leads.find(l => l.id === selectedLeadId) || leads[0] || null;

  const sendTestLead = async () => {
    if (!selectedForm) return;
    try {
      await callAds("test_leads", { platform: "metaads", formId: selectedForm.id });
      alert("Test lead sent. It will appear in the leads list shortly.");
      loadLeads();
      setTimeout(loadLeads, 3000);
      setTimeout(loadLeads, 6000);
    } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 420px", height: "100%", minHeight: 0 }}>
      {/* LEFT — forms list */}
      <div style={{ borderRight: "1px solid var(--rule)", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper)" }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--rule)" }}>
          <Btn size="sm" variant="primary" onClick={() => setDrawerOpen(true)} style={{ width: "100%" }}>
            + New form
          </Btn>
        </div>
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {loadingForms ? (
            <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: 16, color: "var(--accent-ink)", fontSize: 12 }}>{error}</div>
          ) : forms.length === 0 ? (
            <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>
              No lead forms yet on the connected Facebook Page.
            </div>
          ) : forms.map(f => (
            <button key={f.id} type="button" onClick={() => setSelectedFormId(f.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 14px", border: 0, cursor: "pointer",
              background: f.id === selectedForm?.id ? "var(--accent-wash)" : "transparent",
              borderBottom: "1px solid var(--rule)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{f.name || "Untitled form"}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {f.status || "—"}{f.leads_count != null ? ` · ${fmtInt(f.leads_count)} leads` : ""}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CENTER — leads list for selected form */}
      <div style={{ overflowY: "auto", padding: 16, minHeight: 0 }}>
        {!selectedForm ? (
          <div style={{ color: "var(--muted)" }}>Pick a form on the left to see leads.</div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Lead form</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{selectedForm.name}</div>
            <div style={{ marginBottom: 14 }}>
              <Btn size="sm" variant="ghost" onClick={sendTestLead}>Send test lead</Btn>
            </div>

            {loadingLeads ? (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Loading leads…</div>
            ) : leads.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                No leads yet. Leads land here in real time via Zernio's leadgen webhook.
              </div>
            ) : (
              <div style={{ border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden" }}>
                {leads.map(l => {
                  const email = l.fields?.email || (l.fieldData || []).find(f => /email/i.test(f.name || ""))?.values?.[0];
                  const phone = l.fields?.phone || (l.fieldData || []).find(f => /phone/i.test(f.name || ""))?.values?.[0];
                  const name  = l.fields?.full_name || l.fields?.first_name ||
                                (l.fieldData || []).find(f => /name/i.test(f.name || ""))?.values?.[0];
                  return (
                    <button key={l.id} type="button" onClick={() => setSelectedLeadId(l.id)} style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "10px 14px", border: 0, cursor: "pointer",
                      background: l.id === selectedLead?.id ? "var(--accent-wash)" : "var(--paper)",
                      borderBottom: "1px solid var(--rule)",
                    }}>
                      <div style={{ fontSize: 13, color: "var(--ink)" }}>
                        {name || email || "Unnamed lead"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {email || "—"}{phone ? ` · ${phone}` : ""}{l.createdTime ? ` · ${new Date(l.createdTime).toLocaleString()}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT — selected lead detail + push to Klaviyo */}
      <div style={{ borderLeft: "1px solid var(--rule)", overflowY: "auto", minHeight: 0, background: "var(--paper)" }}>
        {!selectedLead ? (
          <div style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>No lead selected.</div>
        ) : (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Lead</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                {selectedLead.fields?.full_name || selectedLead.fields?.first_name || "—"}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {selectedLead.createdTime ? new Date(selectedLead.createdTime).toLocaleString() : "no timestamp"}
                {selectedLead.adId ? ` · ad ${selectedLead.adId.slice(-8)}` : ""}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
              {Object.entries(selectedLead.fields || {}).map(([k, v]) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
                  <div style={{ color: "var(--muted)" }}>{k.replace(/_/g, " ")}</div>
                  <div style={{ color: "var(--ink)" }}>{String(v)}</div>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: "var(--rule)" }}/>
            <PushToKlaviyoButton lead={selectedLead}/>
          </div>
        )}
      </div>

      <NewLeadFormDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
        platform={platform} onCreated={loadForms}/>
    </div>
  );
}

// ─── Main shell ──────────────────────────────────────────────────────────────

function CampaignsPane({ platform }) {
  const [campaigns,   setCampaigns]   = useStateAds([]);
  const [selectedId,  setSelectedId]  = useStateAds(null);
  const [listLoading, setListLoading] = useStateAds(false);
  const [listError,   setListError]   = useStateAds("");
  const [tree,        setTree]        = useStateAds({});
  const [drawerOpen,  setDrawerOpen]  = useStateAds(false);
  const [boostOpen,   setBoostOpen]   = useStateAds(false);

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
        <div style={{ padding: 12, borderBottom: "1px solid var(--rule)", display: "flex", flexDirection: "column", gap: 6 }}>
          <Btn size="sm" variant="primary" onClick={() => setDrawerOpen(true)} style={{ width: "100%" }}>
            + New campaign
          </Btn>
          <Btn size="sm" onClick={() => setBoostOpen(true)} style={{ width: "100%" }}>
            Boost existing post
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
      <BoostDrawer open={boostOpen} onClose={() => setBoostOpen(false)}
        platform={platform} onCreated={refresh}/>
    </div>
  );
}

function AdsWorkspace() {
  const [platform, setPlatform] = useStateAds("metaads");
  const [view,     setView]     = useStateAds("campaigns"); // "campaigns" | "audiences" | "leadforms"

  // Per-platform adAccountId is sticky in localStorage so it survives reload.
  // Audiences need the platform-side ad account ID (e.g. act_xxx for Meta);
  // the campaigns view currently uses Zernio's first connected account so it
  // doesn't need this — but PR 4c will start needing it for boosts too.
  const lsKey = `flowos.ads.adAccountId.${platform}`;
  const [adAccountId, setAdAccountIdRaw] = useStateAds(() => {
    try { return window.localStorage.getItem(lsKey) || ""; } catch { return ""; }
  });
  useEffectAds(() => {
    try { setAdAccountIdRaw(window.localStorage.getItem(lsKey) || ""); } catch { setAdAccountIdRaw(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);
  const setAdAccountId = (v) => {
    setAdAccountIdRaw(v);
    try { window.localStorage.setItem(lsKey, v); } catch { /* ignore quota */ }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Topbar: platform picker + view tabs ───────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderBottom: "1px solid var(--rule)",
        background: "var(--paper)", gap: 12,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {PLATFORMS.map(p => (
            <button key={p.id} type="button" onClick={() => setPlatform(p.id)} style={{
              fontSize: 11, fontFamily: "var(--font-mono)", padding: "4px 10px", borderRadius: 6,
              cursor: "pointer", border: "1px solid var(--rule)",
              background: p.id === platform ? "var(--accent-wash)" : "var(--paper-2)",
              color:      p.id === platform ? "var(--accent-ink)" : "var(--ink-2)",
            }} title={p.hint}>{p.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "campaigns", label: "Campaigns" },
            { id: "audiences", label: "Audiences" },
            { id: "leadforms", label: "Lead forms" },
          ].map(v => (
            <button key={v.id} type="button" onClick={() => setView(v.id)} style={{
              fontSize: 12, padding: "5px 14px", borderRadius: 6, cursor: "pointer",
              border: "1px solid var(--rule)",
              background: view === v.id ? "var(--accent)"      : "var(--paper-2)",
              color:      view === v.id ? "var(--accent-ink)"  : "var(--ink-2)",
              fontWeight: view === v.id ? 600 : 400,
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {view === "campaigns" ? <CampaignsPane platform={platform}/>
         : view === "audiences" ? <AudiencesPane platform={platform} adAccountId={adAccountId} setAdAccountId={setAdAccountId}/>
         : <LeadFormsPane platform={platform}/>}
      </div>
    </div>
  );
}

Object.assign(window, { AdsWorkspace });
})();
