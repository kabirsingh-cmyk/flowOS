// MVEDA Channel Strategy — LLM-derived channel mix recommendation
// Synthesizes a strategy from: brand, industry signals, connected channels,
// goals, and a stage (launch / growth / steady). Updates live as inputs change.

const { useState: useStateCS, useMemo: useMemoCS, useEffect: useEffectCS } = React;

// ─── Strategy library (what the "LLM" knows) ───
// Each channel has: discovery weight, retention weight, intent strength,
// content-cost, audience age skew, and best-fit tags.

const CHANNEL_LIB = {
  Instagram: { type: "social", discovery: 0.85, retention: 0.55, intent: 0.40, cost: 0.45, age: "18-44", fit: ["beauty","ritual","lifestyle","visual","founder-led"] },
  TikTok:    { type: "social", discovery: 0.95, retention: 0.30, intent: 0.30, cost: 0.55, age: "16-34", fit: ["beauty","story","ugc","authentic","trend"] },
  YouTube:   { type: "social", discovery: 0.65, retention: 0.50, intent: 0.55, cost: 0.85, age: "18-54", fit: ["education","ritual","longform","ingredient"] },
  Pinterest: { type: "social", discovery: 0.70, retention: 0.40, intent: 0.65, cost: 0.30, age: "25-54", fit: ["beauty","wellness","lifestyle","visual","aspirational"] },
  LinkedIn:  { type: "social", discovery: 0.30, retention: 0.45, intent: 0.50, cost: 0.45, age: "25-54", fit: ["b2b","founder","thought-leadership"] },
  Facebook:  { type: "social", discovery: 0.50, retention: 0.50, intent: 0.45, cost: 0.30, age: "35-65", fit: ["community","older","longform"] },

  Email:     { type: "owned",  discovery: 0.10, retention: 0.95, intent: 0.85, cost: 0.20, age: "any",   fit: ["retention","tribe","longform","narrative","direct"] },

  "Google Ads":    { type: "search", discovery: 0.55, retention: 0.30, intent: 0.95, cost: 0.85, age: "any", fit: ["intent","conversion","branded","launch"] },
  "Apple Search":  { type: "search", discovery: 0.40, retention: 0.20, intent: 0.80, cost: 0.55, age: "any", fit: ["app","ios","conversion"] },
  "Amazon Ads":    { type: "search", discovery: 0.45, retention: 0.30, intent: 0.90, cost: 0.70, age: "any", fit: ["conversion","commerce","intent","beauty"] },

  "Meta Ads":      { type: "paidsocial", discovery: 0.85, retention: 0.55, intent: 0.65, cost: 0.75, age: "18-54", fit: ["scale","retargeting","launch","creative-driven"] },
  "TikTok Ads":    { type: "paidsocial", discovery: 0.90, retention: 0.30, intent: 0.50, cost: 0.65, age: "16-34", fit: ["ugc","launch","reach","gen-z"] },
  "LinkedIn Ads":  { type: "paidsocial", discovery: 0.40, retention: 0.30, intent: 0.65, cost: 0.85, age: "28-55", fit: ["b2b","high-ticket"] },
  "Pinterest Ads": { type: "paidsocial", discovery: 0.65, retention: 0.35, intent: 0.70, cost: 0.45, age: "25-54", fit: ["beauty","wellness","aspirational","visual"] },
};

// ─── Industry profiles ───
const INDUSTRY_PROFILES = {
  "ayurvedic skincare": {
    label: "Ayurvedic skincare · DTC beauty",
    audience: "Women 25–44, high cultural-craft affinity, prefer narrative over hype",
    tags:    ["beauty","ritual","story","ingredient","ugc","aspirational","authentic","founder-led","retention","tribe","narrative","visual","longform","gen-z","wellness","lifestyle"],
    benchmarks: { social: 0.45, owned: 0.25, paid: 0.30 },
    notes: [
      "Beauty buyers convert 2.4× faster from email vs paid social (industry baseline).",
      "Ayurvedic positioning rewards educational longform; under-index on broadcast TV-style reach plays.",
      "UGC outperforms studio creative on TikTok by 3.1× for sub-$60 SKUs."
    ],
  },
  "performance apparel": {
    label: "Performance apparel · DTC",
    audience: "25–44, athletes & enthusiasts, performance + identity buyers",
    tags: ["lifestyle","ugc","launch","scale","conversion","creative-driven","visual","aspirational"],
    benchmarks: { social: 0.40, owned: 0.20, paid: 0.40 },
    notes: ["Apparel is paid-social-heavy — 40%+ of revenue lifts from Meta + TikTok ads in the first 18 months."],
  },
  "b2b saas": {
    label: "B2B SaaS · self-serve",
    audience: "Operators 28–50, intent-led, long consideration",
    tags: ["b2b","intent","thought-leadership","longform","high-ticket","desktop"],
    benchmarks: { social: 0.20, owned: 0.40, paid: 0.40 },
    notes: ["Search intent dominates SaaS acquisition; LinkedIn outperforms IG/TT 4×."],
  },
};

// ─── Goal weights ───
const GOAL_WEIGHTS = {
  awareness:  { discovery: 1.0, retention: 0.2, intent: 0.4 },
  acquisition:{ discovery: 0.6, retention: 0.4, intent: 1.0 },
  retention:  { discovery: 0.2, retention: 1.0, intent: 0.5 },
  community:  { discovery: 0.6, retention: 0.8, intent: 0.3 },
};

// ─── Stage modifiers ───
const STAGE_MULTIPLIERS = {
  launch:  { paidsocial: 1.4, search: 1.2, social: 1.1, owned: 0.7 },
  growth:  { paidsocial: 1.2, search: 1.2, social: 1.0, owned: 1.0 },
  steady:  { paidsocial: 0.9, search: 1.0, social: 1.0, owned: 1.3 },
  recover: { paidsocial: 0.7, search: 1.1, social: 1.1, owned: 1.4 },
};

// ─── Core scorer ───
function computeChannelStrategy({ industryKey, goal, stage, monthlyBudget, connectedChannels }) {
  const profile = INDUSTRY_PROFILES[industryKey] || INDUSTRY_PROFILES["ayurvedic skincare"];
  const goalW = GOAL_WEIGHTS[goal] || GOAL_WEIGHTS.acquisition;
  const stageM = STAGE_MULTIPLIERS[stage] || STAGE_MULTIPLIERS.growth;

  const scores = {};
  for (const [name, ch] of Object.entries(CHANNEL_LIB)) {
    // Goal alignment
    const goalScore = (ch.discovery * goalW.discovery + ch.retention * goalW.retention + ch.intent * goalW.intent) / 3;
    // Industry fit
    const fitMatches = ch.fit.filter(t => profile.tags.includes(t)).length;
    const fitScore = Math.min(1, fitMatches / 3);
    // Stage modifier
    const stageMod = stageM[ch.type] || 1;
    // Connected bonus (ready-to-execute)
    const connBonus = connectedChannels.has(name) ? 1.15 : 1.0;
    // Combine
    const raw = (goalScore * 0.55 + fitScore * 0.45) * stageMod * connBonus;
    scores[name] = { raw, goalScore, fitScore, stageMod, connBonus, type: ch.type, lib: ch };
  }

  // Take top channels (cut at 7)
  const ranked = Object.entries(scores).sort((a, b) => b[1].raw - a[1].raw);
  const top = ranked.slice(0, 7);

  // Normalize to ratios summing to 100
  const sum = top.reduce((s, [, v]) => s + v.raw, 0);
  const mix = top.map(([name, v]) => ({
    name,
    type: v.type,
    pct: Math.round((v.raw / sum) * 100),
    raw: v.raw,
    connected: connectedChannels.has(name),
    rationale: makeRationale(name, v, profile, goal, stage),
    budget: Math.round(monthlyBudget * (v.raw / sum)),
  }));

  // Adjust for rounding to exactly 100
  const drift = 100 - mix.reduce((s, m) => s + m.pct, 0);
  if (drift !== 0 && mix.length) mix[0].pct += drift;

  // Group by family for the bar
  const families = {
    "Organic social":  mix.filter(m => m.type === "social").reduce((s, m) => s + m.pct, 0),
    "Owned (email)":   mix.filter(m => m.type === "owned").reduce((s, m) => s + m.pct, 0),
    "Paid search":     mix.filter(m => m.type === "search").reduce((s, m) => s + m.pct, 0),
    "Paid social":     mix.filter(m => m.type === "paidsocial").reduce((s, m) => s + m.pct, 0),
  };

  // Disconnected channels = gaps
  const gaps = mix.filter(m => !m.connected && m.pct >= 6);

  return { profile, goal, stage, monthlyBudget, mix, families, gaps, notes: profile.notes };
}

function makeRationale(name, v, profile, goal, stage) {
  const reasons = [];
  if (v.fitScore >= 0.6) reasons.push(`high fit with ${profile.label.split(" · ")[0]} audience`);
  else if (v.fitScore >= 0.3) reasons.push(`partial audience fit`);
  if (name === "Email") reasons.push(`MV Tribe is your highest-intent surface — ${goal === "retention" ? "core to LTV" : "compounds discovery from other channels"}`);
  if (name === "Instagram" && goal === "awareness") reasons.push("dominant visual surface for ritual + product storytelling");
  if (name === "TikTok" && stage === "launch") reasons.push("UGC-friendly · cheapest reach during launch");
  if (name === "Google Ads" && (goal === "acquisition" || stage === "launch")) reasons.push("captures branded + category intent at the bottom of the funnel");
  if (name === "Meta Ads" && stage !== "steady") reasons.push("retargeting + creative scale — pairs with organic IG");
  if (name === "Pinterest") reasons.push("aspirational discovery surface · long content half-life");
  if (name === "YouTube") reasons.push("longform ingredient education compounds over months");
  if (name === "LinkedIn") reasons.push("founder-led storytelling + B2B lift");
  if (v.connBonus > 1) reasons.push("already connected · ready to execute");
  else reasons.push("not yet connected");
  return reasons.slice(0, 3);
}

// ─── React component ───
function ChannelStrategyCanvas({ state, actions }) {
  const brand = state.brand || { name: "MVEDA", category: "Ayurvedic skincare" };
  const connectedSet = useMemoCS(() => {
    const map = {
      ig: "Instagram", tt: "TikTok", fb: "Facebook", li: "LinkedIn", yt: "YouTube", pn: "Pinterest",
      klaviyo: "Email", mailchimp: "Email",
      googleads: "Google Ads", appleads: "Apple Search", amazonads: "Amazon Ads",
      metaads: "Meta Ads", ttads: "TikTok Ads", liads: "LinkedIn Ads", pinads: "Pinterest Ads",
      xads: "X Ads", redditads: "Reddit Ads", snapads: "Snap Ads",
    };
    const set = new Set();
    Object.entries(state.connectors || {}).forEach(([id, c]) => {
      if (c.connected && map[id]) set.add(map[id]);
    });
    return set;
  }, [state.connectors]);

  const [goal, setGoal] = useStateCS(state.strategy?.goal || "acquisition");
  const [stage, setStage] = useStateCS(state.strategy?.stage || "growth");
  const [budget, setBudget] = useStateCS(state.strategy?.budget || 25000);
  const [recomputing, setRecomputing] = useStateCS(false);

  const industryKey = (brand.category || "").toLowerCase().includes("apparel") ? "performance apparel"
                    : (brand.category || "").toLowerCase().includes("saas")    ? "b2b saas"
                    : "ayurvedic skincare";

  const strategy = useMemoCS(
    () => computeChannelStrategy({ industryKey, goal, stage, monthlyBudget: budget, connectedChannels: connectedSet }),
    [industryKey, goal, stage, budget, connectedSet]
  );

  const handleApply = () => {
    actions.applyStrategy?.({ goal, stage, budget, mix: strategy.mix, families: strategy.families });
  };

  const handleRecompute = () => {
    setRecomputing(true);
    setTimeout(() => setRecomputing(false), 1200);
  };

  return (
    <div style={{ padding: "28px 36px", maxWidth: 920, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          Strategy · {brand.name} · {strategy.profile.label}
        </div>
        <h2 className="serif" style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
          Recommended channel mix
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", margin: 0, maxWidth: 600 }}>
          Synthesized from your brand memory, industry benchmarks, audience match, current connector state, and the goal + stage you set below.
          Re-runs anytime your inputs change.
        </p>
      </div>

      {/* Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
        <StrategyControl label="Primary goal" value={goal} onChange={setGoal} options={[
          { v: "awareness",   label: "Awareness" },
          { v: "acquisition", label: "Acquisition" },
          { v: "retention",   label: "Retention" },
          { v: "community",   label: "Community" },
        ]}/>
        <StrategyControl label="Stage" value={stage} onChange={setStage} options={[
          { v: "launch",  label: "Launch" },
          { v: "growth",  label: "Growth" },
          { v: "steady",  label: "Steady-state" },
          { v: "recover", label: "Recovery" },
        ]}/>
        <div style={{
          padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 6,
          background: "var(--paper)",
        }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
            Monthly budget
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span className="serif" style={{ fontSize: 22, fontWeight: 500 }}>${(budget/1000).toFixed(0)}k</span>
            <input type="range" min={5000} max={150000} step={2500} value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              style={{ flex: 1, marginLeft: 8, accentColor: "var(--ink)" }}/>
          </div>
        </div>
      </div>

      {/* Family bar */}
      <div style={{ marginBottom: 20 }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Channel family mix
        </div>
        <FamilyBar families={strategy.families}/>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
          <span>Industry baseline · social {Math.round(strategy.profile.benchmarks.social*100)}% / owned {Math.round(strategy.profile.benchmarks.owned*100)}% / paid {Math.round(strategy.profile.benchmarks.paid*100)}%</span>
          <span>{Object.entries(strategy.families).filter(([,v])=>v>0).length} families</span>
        </div>
      </div>

      {/* Mix table */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Per-channel allocation
          </div>
          <button onClick={handleRecompute} disabled={recomputing} style={{
            border: "1px solid var(--rule-strong)", background: "var(--paper)", padding: "5px 10px",
            borderRadius: 5, fontSize: 11, color: "var(--ink-2)", fontFamily: "inherit", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span className={recomputing ? "anim-pulse" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }}/>
            {recomputing ? "Recomputing…" : "Re-run with latest data"}
          </button>
        </div>
        <div style={{ border: "1px solid var(--rule)", borderRadius: 6, overflow: "hidden" }}>
          {strategy.mix.map((m, i) => (
            <AllocationRow key={m.name} m={m} budget={budget} i={i}/>
          ))}
        </div>
      </div>

      {/* Gaps */}
      {strategy.gaps.length > 0 && (
        <div style={{
          padding: 16, background: "color-mix(in oklch, var(--accent) 6%, var(--paper))",
          border: "1px solid color-mix(in oklch, var(--accent) 20%, var(--rule-strong))",
          borderRadius: 6, marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="zap" size={13}/>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--accent-ink)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {strategy.gaps.length} channel{strategy.gaps.length > 1 ? "s" : ""} recommended but not connected
            </div>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)" }}>
            Connecting these unlocks {strategy.gaps.reduce((s, g) => s + g.pct, 0)}% of the recommended mix:
            {" "}
            {strategy.gaps.map((g, i) => (
              <span key={g.name}>
                <strong style={{ color: "var(--ink)" }}>{g.name}</strong> ({g.pct}%){i < strategy.gaps.length - 1 ? ", " : ""}
              </span>
            ))}
            .
          </div>
        </div>
      )}

      {/* Reasoning */}
      <div style={{ marginBottom: 22 }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
          How I'm thinking about this
        </div>
        <div style={{ background: "var(--paper-2)", border: "1px solid var(--rule)", borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink-2)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            "{strategy.profile.audience}. With a {goal} goal at the {stage} stage, I'm weighting {topFamily(strategy.families)} highest — that's where {brand.name}'s audience converts and {goalCopy(goal)}."
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--rule)" }}>
            {strategy.notes.map((n, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.6, color: "var(--muted-2)", marginTop: i ? 6 : 0 }}>
                <span style={{ color: "var(--accent-ink)", marginRight: 8 }}>·</span>{n}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Apply */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 14, borderTop: "1px solid var(--rule)" }}>
        <Btn variant="primary" onClick={handleApply}><Icon name="check" size={12}/> Approve & route to planning</Btn>
        <Btn variant="ghost"><Icon name="edit" size={12}/> Edit ratios manually</Btn>
        <div style={{ flex: 1 }}/>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Strategy · v{(state.strategy?.version || 0) + 1}
        </span>
      </div>
    </div>
  );
}

function StrategyControl({ label, value, onChange, options }) {
  return (
    <div style={{
      padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 6,
      background: "var(--paper)",
    }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {options.map(o => (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            padding: "5px 9px", borderRadius: 4, fontSize: 11.5, fontFamily: "inherit",
            border: "1px solid " + (value === o.v ? "var(--ink)" : "var(--rule)"),
            background: value === o.v ? "var(--ink)" : "var(--paper)",
            color: value === o.v ? "var(--paper)" : "var(--ink-2)",
            cursor: "pointer", transition: "all .12s",
          }}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function FamilyBar({ families }) {
  const colors = {
    "Organic social":  "oklch(72% 0.08 80)",
    "Owned (email)":   "oklch(48% 0.04 80)",
    "Paid search":     "oklch(60% 0.13 240)",
    "Paid social":     "oklch(56% 0.16 25)",
  };
  const entries = Object.entries(families).filter(([,v]) => v > 0);
  return (
    <>
      <div style={{ display: "flex", height: 36, borderRadius: 4, overflow: "hidden", border: "1px solid var(--rule-strong)" }}>
        {entries.map(([name, pct]) => (
          <div key={name} style={{
            width: `${pct}%`, background: colors[name], display: "flex", alignItems: "center",
            justifyContent: "center", color: "var(--paper)", fontSize: 11, fontWeight: 500,
            transition: "width .4s ease",
          }}>{pct >= 8 ? `${pct}%` : ""}</div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
        {entries.map(([name, pct]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
            <span style={{ width: 10, height: 10, background: colors[name], borderRadius: 2 }}/>
            <span style={{ color: "var(--ink-2)" }}>{name}</span>
            <span style={{ color: "var(--muted)" }}>{pct}%</span>
          </div>
        ))}
      </div>
    </>
  );
}

function AllocationRow({ m, budget, i }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "180px 1fr 90px 120px",
      alignItems: "center", gap: 14, padding: "12px 14px",
      borderTop: i ? "1px solid var(--rule)" : 0,
      background: i % 2 ? "var(--paper)" : "var(--paper-2)",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
        <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
          {m.type === "paidsocial" ? "Paid social" : m.type === "search" ? "Paid search" : m.type === "owned" ? "Owned" : "Organic"}
          {m.connected
            ? <span style={{ color: "var(--success)", marginLeft: 6 }}>● connected</span>
            : <span style={{ color: "oklch(48% 0.16 25)", marginLeft: 6 }}>○ not connected</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {m.rationale.map((r, ri) => (
          <div key={ri} style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.45 }}>
            <span style={{ color: "var(--accent-ink)", marginRight: 6 }}>·</span>{r}
          </div>
        ))}
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>{m.pct}%</div>
        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>of mix</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>${(m.budget/1000).toFixed(1)}k</div>
        <div style={{ fontSize: 10.5, color: "var(--muted)" }}>monthly</div>
      </div>
    </div>
  );
}

function topFamily(families) {
  const entries = Object.entries(families).sort((a,b)=>b[1]-a[1]);
  return entries[0]?.[0]?.toLowerCase() || "owned channels";
}
function goalCopy(goal) {
  return {
    awareness: "discovery compounds fastest",
    acquisition: "intent-led channels close revenue quickest",
    retention: "owned surfaces compound LTV",
    community: "consistent presence builds your tribe",
  }[goal] || "your audience converts";
}

Object.assign(window, { ChannelStrategyCanvas, computeChannelStrategy, AllocationRow });
