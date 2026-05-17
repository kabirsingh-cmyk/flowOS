// MVEDA — additional canvas surfaces
// SMS · SEO · Affiliate · Retention · CX · Seasonal · A/B · Team · Discount Ops · Mobile
const { useState: useStateF, useMemo: useMemoF, useEffect: useEffectF, useRef: useRefF } = React;

// ─────────────────────────── shared layout helpers ───────────────────────────
function FeaturePage({ kicker, title, children, right }) {
  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{kicker}</div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>{title}</h1>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 6, padding: 16, ...style }}>{children}</div>;
}

function StatTile({ label, value, delta, hint }) {
  const dirOk = (delta || "").toString().startsWith("+");
  return (
    <Card>
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <span className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>{value}</span>
        {delta != null && delta !== "" && (
          <span className="mono" style={{ fontSize: 11, color: dirOk ? "var(--success)" : "var(--danger)" }}>{delta}</span>
        )}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
    </Card>
  );
}

function SectionHead({ children, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{children}</div>
      {action}
    </div>
  );
}

// ─────────────────────────── 1 · SMS Center ───────────────────────────
function ChatDraftsToKlaviyoSms({ sms }) {
  if (!sms || sms.length === 0) return null;
  const statusMeta = {
    pushing:       { label: "Pushing…", tone: "warn" },
    klaviyo_draft: { label: "In Klaviyo", tone: "ok" },
    failed:        { label: "Failed",    tone: "bad" },
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>✱</span>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Chat drafts → Klaviyo SMS</span>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{sms.length}</span>
      </div>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 160px 80px 110px 90px", gap: 10, padding: "6px 0 10px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>Body</span><span>Audience</span><span>Chars</span><span>Status</span><span>Link</span>
        </div>
        {sms.map((s, i) => {
          const meta = statusMeta[s.status] || { label: s.status, tone: "neutral" };
          const dotColor = meta.tone === "ok" ? "var(--success)" : meta.tone === "warn" ? "oklch(72% 0.12 70)" : meta.tone === "bad" ? "oklch(58% 0.18 25)" : "var(--muted)";
          const len = (s.body || "").length;
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 160px 80px 110px 90px", gap: 10, padding: "12px 0", borderBottom: i < sms.length - 1 ? "1px solid var(--rule)" : "none", alignItems: "center", fontSize: 13 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-2)", fontStyle: "italic" }}>"{s.body}"</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {s.audience?.name || s.audienceHint || "—"}
                {s.audience?.fallback && <span style={{ fontSize: 10.5, opacity: 0.7 }}> (fallback)</span>}
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: len > 160 ? "oklch(48% 0.16 25)" : "var(--muted)" }}>{len}/160</span>
              <span style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 6 }} title={s.error || ""}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, display: "inline-block" }}/>
                {meta.label}
              </span>
              <span>
                {s.klaviyoUrl
                  ? <a href={s.klaviyoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--accent-ink)", textDecoration: "underline" }}>Open ↗</a>
                  : <span style={{ fontSize: 11.5, color: "var(--muted)" }}>—</span>}
              </span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function SmsCenter({ state, actions }) {
  const camp = state.smsCampaigns;
  const auto = state.smsAutomations;
  const comp = state.smsCompliance;
  const chatSms = state?.outbound?.sms || [];
  return (
    <FeaturePage kicker="Channel · SMS" title="SMS"
      right={<Btn size="sm" variant="primary"><Icon name="plus" size={11}/> New SMS campaign</Btn>}>

      <ChatDraftsToKlaviyoSms sms={chatSms}/>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatTile label="TCPA opt-ins"  value={comp.tcpaConsent.toLocaleString()} hint="active subscribers"/>
        <StatTile label="Opt-out · 30d" value={comp.optOutRate} delta={`${comp.optOut30d} this month`} hint="below 1% threshold"/>
        <StatTile label="Quiet hours"   value={comp.quietHours} hint="auto-respected per recipient TZ"/>
        <StatTile label="Active flows"  value={auto.filter(a=>a.status==="live").length + " of " + auto.length} hint="welcome, browse, win-back"/>
      </div>

      <SectionHead>Scheduled & live campaigns</SectionHead>
      <Card style={{ padding: 0 }}>
        {camp.map((c,i) => (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.2fr 0.9fr 1.2fr 0.9fr 1fr", gap: 10, padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{c.provider}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{c.segment}</div>
            <div className="mono" style={{ fontSize: 12 }}>{c.recipients.toLocaleString()}</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{c.sendAt}</div>
            <Chip tone={c.status === "live" ? "ok" : c.status === "scheduled" ? "accent" : "neutral"}>{c.status}</Chip>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {c.status !== "live" && <Btn size="sm" onClick={() => actions.updateSms(c.id, { status: "live" }, { logEvent: `sms · live · ${c.name}`, notify: { tone: "ok", text: `SMS '${c.name}' set live` } })}><Icon name="play" size={10}/> Send</Btn>}
              {c.status === "live"  && <Btn size="sm" onClick={() => actions.updateSms(c.id, { status: "paused" }, { notify: { tone: "warn", text: `Paused '${c.name}'` } })}><Icon name="pause" size={10}/> Pause</Btn>}
            </div>
            <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5, paddingTop: 4, fontStyle: "italic" }}>"{c.body}"</div>
          </div>
        ))}
      </Card>

      <SectionHead>Automations</SectionHead>
      <Card style={{ padding: 0 }}>
        {auto.map((a,i) => (
          <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 0.6fr 0.8fr 0.8fr 0.8fr", gap: 10, padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.trigger}</div>
            <div className="mono" style={{ fontSize: 12 }}>{a.steps} step{a.steps>1?"s":""}</div>
            <div className="mono" style={{ fontSize: 12 }}>{a.ctr}</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{a.revenue}</div>
            <Btn size="sm" onClick={() => actions.toggleSmsAutomation(a.id)}>
              <Icon name={a.status === "live" ? "pause" : "play"} size={10}/> {a.status === "live" ? "Pause" : "Resume"}
            </Btn>
          </div>
        ))}
      </Card>

      <Card style={{ background: "var(--accent-wash)" }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Compliance gate</div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.55 }}>
          Every send is checked against TCPA quiet hours, list source, opt-in proof, and STOP-keyword routing before broadcast. Sends outside opt-in scope are blocked at the gate, not at the carrier.
        </div>
      </Card>
    </FeaturePage>
  );
}

// ─────────────────────────── 2 · SEO Studio ───────────────────────────
function SeoStudio({ state, actions }) {
  const [tab, setTab] = useStateF("articles");
  const arts = state.seoArticles;
  const kws  = state.seoKeywords;
  const sugs = state.seoInternalSuggestions;
  const blinks = state.seoBacklinks;

  const totalTraffic = arts.reduce((s,a) => s + (a.traffic||0), 0);
  const ranking      = kws.filter(k => k.rank && k.rank <= 10).length;

  return (
    <FeaturePage kicker="Channel · Organic search" title="SEO Studio"
      right={<Btn size="sm" variant="primary"><Icon name="plus" size={11}/> New brief</Btn>}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatTile label="Tracked keywords" value={kws.length} hint="Ahrefs + Search Console"/>
        <StatTile label="In top 10"         value={`${ranking} / ${kws.length}`} delta="+2 vs last week"/>
        <StatTile label="Organic traffic · 30d" value={totalTraffic.toLocaleString()} delta="+18%" hint="across published articles"/>
        <StatTile label="Internal links waiting" value={sugs.length} hint="auto-suggested · review to apply"/>
      </div>

      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--rule)" }}>
        {[["articles","Articles"],["keywords","Keywords"],["links","Internal links"],["backlinks","Backlinks"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: "8px 14px", fontSize: 12.5, background: "transparent", border: "none",
              borderBottom: tab === k ? "2px solid var(--ink)" : "2px solid transparent",
              color: tab === k ? "var(--ink)" : "var(--muted)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>{l}</button>
        ))}
      </div>

      {tab === "articles" && (
        <Card style={{ padding: 0 }}>
          {arts.map((a,i) => (
            <div key={a.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.7fr 0.6fr 0.9fr", gap: 12, padding: "14px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{a.url} · cluster: {a.cluster}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{a.intent}</div>
              <div className="mono" style={{ fontSize: 12 }}>{a.words ? `${a.words.toLocaleString()} words` : "—"}</div>
              <div className="mono" style={{ fontSize: 12 }}>rank {a.rank ?? "—"}</div>
              <div className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{(a.traffic||0).toLocaleString()}</div>
              <Chip tone={a.status === "published" ? "ok" : a.status === "draft" ? "accent" : "neutral"}>{a.status}</Chip>
            </div>
          ))}
        </Card>
      )}

      {tab === "keywords" && (
        <Card style={{ padding: 0 }}>
          {kws.map((k,i) => {
            const move = k.prevRank - k.rank;
            return (
              <div key={k.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.6fr 0.6fr 0.6fr 0.6fr 1.4fr", gap: 10, padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
                <div style={{ fontSize: 13 }}>{k.term}</div>
                <div className="mono" style={{ fontSize: 12 }}>{k.vol.toLocaleString()}/mo</div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>#{k.rank}</div>
                <div className="mono" style={{ fontSize: 12, color: move > 0 ? "var(--success)" : move < 0 ? "var(--danger)" : "var(--muted)" }}>{move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : "—"}</div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>kd {k.difficulty}</div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{k.url}</div>
              </div>
            );
          })}
        </Card>
      )}

      {tab === "links" && (
        <Card style={{ padding: 0 }}>
          {sugs.length === 0 && <div style={{ padding: 24, color: "var(--muted)", fontSize: 13, textAlign: "center" }}>No internal-link suggestions waiting.</div>}
          {sugs.map((s,i) => (
            <div key={i} style={{ padding: "14px 16px", borderTop: i ? "1px solid var(--rule)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div className="mono" style={{ fontSize: 11.5 }}>{s.from} <span style={{ color: "var(--muted)" }}>→</span> {s.to}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4 }}>Anchor: <strong>"{s.anchor}"</strong></div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{s.reason}</div>
              </div>
              <Btn size="sm" variant="primary" onClick={() => actions.acceptInternalLink(i, s)}><Icon name="check" size={11}/> Apply</Btn>
            </div>
          ))}
        </Card>
      )}

      {tab === "backlinks" && (
        <Card style={{ padding: 0 }}>
          {blinks.map((b,i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr 0.6fr 0.8fr 0.7fr", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
              <div className="mono" style={{ fontSize: 12 }}>{b.source}</div>
              <div style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--ink-2)" }}>"{b.anchor}"</div>
              <div className="mono" style={{ fontSize: 12 }}>DA {b.da}</div>
              <Chip tone="ok">{b.type}</Chip>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{b.date}</div>
            </div>
          ))}
        </Card>
      )}
    </FeaturePage>
  );
}

// ─────────────────────────── 3 · Affiliate Program ───────────────────────────
function AffiliateProgram({ state, actions }) {
  const p = state.affiliateProgram, partners = state.affiliatePartners, ref = state.referralProgram;
  return (
    <FeaturePage kicker="Channel · Partners" title="Affiliate & referral"
      right={<Btn size="sm" variant="primary"><Icon name="plus" size={11}/> Invite partner</Btn>}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatTile label="Affiliate revenue · MTD" value={`$${p.mtdRevenue.toLocaleString()}`} hint={p.commissionTier}/>
        <StatTile label="Payouts · MTD"           value={`$${p.mtdPayouts.toLocaleString()}`} hint={`${partners.filter(x => x.status === "active").length} active partners`}/>
        <StatTile label="Conv. rate"              value={`${p.conversionRate}%`} delta="+0.4 vs last month"/>
        <StatTile label="Referral · 30d"          value={`${ref.referrers30d} → ${ref.redemptions30d}`} hint={`LTV uplift ${ref.ltvUplift}`}/>
      </div>

      <SectionHead>Partners</SectionHead>
      <Card style={{ padding: 0 }}>
        {partners.map((x,i) => (
          <div key={x.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 0.9fr 0.8fr 0.8fr 0.9fr 1fr", gap: 10, padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{x.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{x.tier} · {x.followers.toLocaleString()} followers</div>
            </div>
            <Chip tone={x.status === "active" ? "ok" : x.status === "pending" ? "accent" : "neutral"}>{x.status}</Chip>
            <div className="mono" style={{ fontSize: 12 }}>code: {x.code}</div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{x.link}</div>
            <div className="mono" style={{ fontSize: 12 }}>${x.sales.toLocaleString()}</div>
            <div className="mono" style={{ fontSize: 12 }}>${x.payout}</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {x.status === "active"  && <Btn size="sm" onClick={() => actions.updateAffiliate(x.id, { status: "paused" })}><Icon name="pause" size={10}/> Pause</Btn>}
              {x.status === "paused"  && <Btn size="sm" onClick={() => actions.updateAffiliate(x.id, { status: "active" })}><Icon name="play" size={10}/> Resume</Btn>}
              {x.status === "pending" && <Btn size="sm" variant="primary" onClick={() => actions.updateAffiliate(x.id, { status: "active" })}><Icon name="check" size={10}/> Approve</Btn>}
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Referral program · MV Tribe</div>
        <div style={{ display: "flex", gap: 24, marginTop: 10, flexWrap: "wrap" }}>
          <div><div className="serif" style={{ fontSize: 22 }}>{ref.reward}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>reward</div></div>
          <div><div className="serif" style={{ fontSize: 22 }}>{ref.referrers30d}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>referrers · 30d</div></div>
          <div><div className="serif" style={{ fontSize: 22 }}>{ref.redemptions30d}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>redemptions · 30d</div></div>
          <div><div className="serif" style={{ fontSize: 22 }}>{ref.ltvUplift}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>LTV uplift</div></div>
        </div>
      </Card>
    </FeaturePage>
  );
}

// ─────────────────────────── 4 · Retention Dashboard ───────────────────────────
function RetentionDashboard({ state }) {
  const r = state.retention;
  return (
    <FeaturePage kicker="Customers · Retention" title="Retention">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatTile label="Repeat purchase · 90d" value={`${r.rpr.v}%`} delta={`${r.rpr.d > 0 ? "+" : ""}${r.rpr.d}pp`} hint={r.rpr.note}/>
        <StatTile label="AOV · 30d"              value={`$${r.aov.v}`} delta={`+$${r.aov.d}`} hint={r.aov.note}/>
        <StatTile label="Replenishment median"   value={`${r.replenishmentMedianDays.v}d`} delta={`${r.replenishmentMedianDays.d}d`} hint={r.replenishmentMedianDays.note}/>
        <StatTile label="Subscription churn"     value={`${r.subscriptionChurn.v}%`} delta={`${r.subscriptionChurn.d}pp`} hint={r.subscriptionChurn.note}/>
      </div>

      <SectionHead>Lifecycle segments</SectionHead>
      <Card style={{ padding: 0 }}>
        {r.segments.map((s, i) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 0.7fr 0.9fr 1.6fr 1fr", gap: 10, padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{s.id}</div>
            </div>
            <div className="mono" style={{ fontSize: 12 }}>{s.size.toLocaleString()}</div>
            <div className="mono" style={{ fontSize: 12, color: s.trend > 0 ? "var(--success)" : s.trend < 0 ? "var(--danger)" : "var(--muted)" }}>{s.trend > 0 ? `+${s.trend}%` : s.trend < 0 ? `${s.trend}%` : "—"}</div>
            <div className="mono" style={{ fontSize: 12 }}>{s.cadence}</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{s.note}</div>
            <Btn size="sm">Open flow</Btn>
          </div>
        ))}
      </Card>

      <SectionHead>Replenishment by SKU</SectionHead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {r.replenishmentBySku.map((sku, i) => (
          <Card key={i}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{sku.sku}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>median · {sku.median}d · range {sku.range}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12 }}>
              <span>Buyers: <strong className="mono">{sku.buyers.toLocaleString()}</strong></span>
              <span>Due now: <strong className="mono" style={{ color: "var(--accent)" }}>{sku.dueNow}</strong></span>
            </div>
            <Btn size="sm" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}><Icon name="send" size={11}/> Send replenishment SMS</Btn>
          </Card>
        ))}
      </div>
    </FeaturePage>
  );
}

// ─────────────────────────── 5 · CX Signals ───────────────────────────
function CxSignals({ state }) {
  const cx = state.cxSignals;
  return (
    <FeaturePage kicker="Customer · CX" title="CX signals">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatTile label="Return rate · 30d" value={`${cx.returnRate.v}%`} delta={`${cx.returnRate.d > 0 ? "+" : ""}${cx.returnRate.d}pp`} hint={cx.returnRate.note}/>
        <StatTile label="RMA queue"          value={cx.rmaQueue} hint="open returns"/>
        <StatTile label="Open tickets"       value={cx.openTickets} hint="Gorgias"/>
        <StatTile label="Reviews · 30d"      value={cx.reviews30d} delta={`avg ${cx.avgRating}`} hint={`lowest: ${cx.lowestSku}`}/>
      </div>

      <SectionHead>Spikes — marketing should know</SectionHead>
      {cx.spikes.map(sp => (
        <Card key={sp.id} style={{ borderLeft: `3px solid ${sp.severity === "high" ? "var(--danger)" : "var(--accent)"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{sp.sku}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4 }}>{sp.reason}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, letterSpacing: "0.04em" }}>{sp.count} reports · {sp.period}</div>
            </div>
            <Chip tone={sp.severity === "high" ? "danger" : "warn"}>{sp.severity}</Chip>
          </div>
          <div style={{ marginTop: 12, padding: 12, background: "var(--paper-2)", borderRadius: 5, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
            <strong>Auto-action:</strong> {sp.action}
          </div>
        </Card>
      ))}

      <SectionHead>Top complaint themes</SectionHead>
      <Card style={{ padding: 0 }}>
        {cx.topComplaints.map((c, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 0.5fr 2fr 1fr", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
            <div style={{ fontSize: 13 }}>{c.theme}</div>
            <div className="mono" style={{ fontSize: 12 }}>{c.count}</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{c.suggestedReply}</div>
            <Chip tone="neutral">{c.channel}</Chip>
          </div>
        ))}
      </Card>
    </FeaturePage>
  );
}

// ─────────────────────────── 6 · Seasonal mode ───────────────────────────
function SeasonalMode({ state, actions }) {
  const playbooks = state.seasonalPlaybooks;
  const cap = state.capacityPlan;
  return (
    <FeaturePage kicker="Operations · Calendar" title="Seasonal & holiday mode">
      <Card style={{ background: "var(--accent-wash)" }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Capacity plan</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 10 }}>
          <div><div className="serif" style={{ fontSize: 22 }}>{cap.ordersPerDay}/d</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>current orders</div></div>
          <div><div className="serif" style={{ fontSize: 22 }}>{cap.peakCapacity}/d</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>peak capacity</div></div>
          <div><div className="serif" style={{ fontSize: 22 }}>{cap.fulfilmentSLA}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>fulfilment SLA</div></div>
          <div><div className="serif" style={{ fontSize: 22 }}>{cap.warehouseLeadTime}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>warehouse lead</div></div>
          <div><div className="serif" style={{ fontSize: 22 }}>{cap.paidSpendCeiling}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>spend ceiling</div></div>
        </div>
      </Card>

      <SectionHead>Playbooks</SectionHead>
      {playbooks.map(pb => (
        <Card key={pb.id} style={{ borderLeft: pb.status === "active" ? "3px solid var(--accent)" : "1px solid var(--rule)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="serif" style={{ fontSize: 18, fontWeight: 500 }}>{pb.name}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em", marginTop: 4 }}>{pb.window} · {pb.expectedLift}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Chip tone={pb.status === "active" ? "ok" : pb.status === "preloaded" ? "accent" : "neutral"}>{pb.status}</Chip>
              <Btn size="sm" onClick={() => actions.toggleSeasonal(pb.id)}>
                {pb.status === "active" ? "Suspend" : "Activate"}
              </Btn>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pb.phases.map((ph, i) => (
              <div key={i} style={{ padding: "6px 10px", border: "1px solid var(--rule)", borderRadius: 4, fontSize: 11.5, background: "var(--paper-2)" }}>
                <span className="mono" style={{ color: "var(--muted)", marginRight: 6 }}>{i+1}.</span>{ph}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </FeaturePage>
  );
}

// ─────────────────────────── 7 · A/B Test Lab ───────────────────────────
function AbTestLab({ state, actions }) {
  const tests = state.abTests;
  const rules = state.abFedBrandRules;
  return (
    <FeaturePage kicker="Experimentation · primitive" title="A/B tests"
      right={<Btn size="sm" variant="primary"><Icon name="plus" size={11}/> New test</Btn>}>

      <Card style={{ background: "var(--paper-2)" }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>How this works</div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.55 }}>
          Every draft can be split. Email subject lines and PDP CTAs run inside Klaviyo / VWO; ad headlines via Optimizely or your ad platform's built-in test. Winners with ≥90% confidence and ≥10% lift can be promoted into Brand Memory — they become the default voice and Brand Guard enforces them on future drafts.
        </div>
      </Card>

      <SectionHead>Tests</SectionHead>
      {tests.map(t => (
        <Card key={t.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.subject}{t.provider ? ` · ${t.provider}` : ""}</div>
              <div style={{ fontSize: 13, marginTop: 4, color: "var(--ink-2)" }}>{t.lift}</div>
            </div>
            <Chip tone={t.status.includes("winner") ? "ok" : t.status === "running" ? "accent" : "neutral"}>{t.status === "running" ? "running" : t.status === "winner-a" ? "A wins" : t.status === "winner-b" ? "B wins" : t.status}</Chip>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            {[["A", t.variantA], ["B", t.variantB]].map(([k, v]) => {
              const isWinner = (k === "A" && t.status === "winner-a") || (k === "B" && t.status === "winner-b");
              return (
                <div key={k} style={{ padding: 12, borderRadius: 5, background: isWinner ? "var(--success-wash)" : "var(--paper-2)", border: isWinner ? "1px solid var(--success)" : "1px solid var(--rule)" }}>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Variant {k}{isWinner ? " · winner" : ""}</div>
                  <div className="serif" style={{ fontSize: 16, marginTop: 6, lineHeight: 1.4 }}>"{v}"</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8 }}>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>confidence · {t.confidence}%</div>
            <div style={{ display: "flex", gap: 6 }}>
              {t.status === "running" && <Btn size="sm" onClick={() => actions.updateAbTest(t.id, { status: "winner-a", confidence: 92 })}>Declare A</Btn>}
              {t.status === "running" && <Btn size="sm" onClick={() => actions.updateAbTest(t.id, { status: "winner-b", confidence: 92 })}>Declare B</Btn>}
              {t.status.includes("winner") && t.confidence >= 88 &&
                <Btn size="sm" variant="primary" onClick={() => actions.promoteAbToBrand(`${t.subject} · ${t.lift}`, `${t.id} → ${t.status}`)}>
                  <Icon name="shield" size={11}/> Promote to Brand
                </Btn>}
            </div>
          </div>
        </Card>
      ))}

      <SectionHead>Promoted to Brand Memory</SectionHead>
      <Card style={{ padding: 0 }}>
        {rules.map((r, i) => (
          <div key={i} style={{ padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none" }}>
            <div style={{ fontSize: 13 }}>{r.rule}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>source · {r.source}</div>
          </div>
        ))}
      </Card>
    </FeaturePage>
  );
}

// ─────────────────────────── 8 · Team & Guest seats ───────────────────────────
function TeamSeats({ state, actions }) {
  const [inviteOpen, setInviteOpen] = useStateF(false);
  const [draft, setDraft] = useStateF({ name: "", email: "", scope: ["paid-channels"], permissions: "comment-only", via: "agency seat" });

  const submit = () => {
    if (!draft.email) return;
    actions.inviteGuest({ ...draft, role: "guest" });
    setInviteOpen(false);
    setDraft({ name: "", email: "", scope: ["paid-channels"], permissions: "comment-only", via: "agency seat" });
  };

  return (
    <FeaturePage kicker="Workspace · Permissions" title="Team & guests"
      right={<Btn size="sm" variant="primary" onClick={() => setInviteOpen(true)}><Icon name="plus" size={11}/> Invite guest</Btn>}>

      <SectionHead>Owners & operators</SectionHead>
      <Card style={{ padding: 0 }}>
        {state.team.map((u, i) => (
          <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr 0.8fr 0.8fr 0.8fr", gap: 10, padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{u.email}</div>
            <Chip tone="ok">{u.role}</Chip>
            <div className="mono" style={{ fontSize: 11.5 }}>{u.scope}</div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>last · {u.last}</div>
          </div>
        ))}
      </Card>

      <SectionHead>Vendors & agencies · scoped</SectionHead>
      <Card style={{ padding: 0 }}>
        {state.guests.map((g, i) => (
          <div key={g.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr 1.2fr 1fr 0.8fr", gap: 10, padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{g.via}</div>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{g.email}</div>
            <Chip tone={g.permissions === "edit" ? "accent" : g.permissions === "comment-only" ? "ok" : "neutral"}>{g.permissions}</Chip>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {g.scope.map(s => <span key={s} className="mono" style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, background: "var(--paper-2)", border: "1px solid var(--rule)" }}>{s}</span>)}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>last · {g.last}</div>
            <Btn size="sm" variant="ghost" onClick={() => actions.removeGuest(g.id)}><Icon name="x" size={11}/> Revoke</Btn>
          </div>
        ))}
      </Card>

      <Card style={{ background: "var(--paper-2)" }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Permission ladder</div>
        <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-2)" }}>
          <li><strong>View-only</strong> · sees the workspaces in scope, can't act. For legal review and investor decks.</li>
          <li><strong>Comment-only</strong> · can leave comments on any artifact in scope. Can't approve, can't publish. Default for agencies.</li>
          <li><strong>Edit</strong> · can edit drafts in scope but can't push to publish. Final gate stays with operators.</li>
        </ul>
      </Card>

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a guest" width={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
            style={{ padding: "9px 11px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13, fontFamily: "var(--font-sans)" }}/>
          <input placeholder="email@vendor.com" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}
            style={{ padding: "9px 11px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13, fontFamily: "var(--font-sans)" }}/>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 6 }}>Scope</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["paid-channels","creative-studio","compliance","insights","inbox","planner"].map(s => {
              const on = draft.scope.includes(s);
              return (
                <button key={s} type="button" onClick={() => setDraft({ ...draft, scope: on ? draft.scope.filter(x => x !== s) : [...draft.scope, s] })}
                  style={{ padding: "5px 10px", borderRadius: 4, fontSize: 11.5, border: "1px solid var(--rule)",
                    background: on ? "var(--ink)" : "var(--paper)", color: on ? "var(--paper)" : "var(--ink)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>{s}</button>
              );
            })}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 6 }}>Permission</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["view-only","comment-only","edit"].map(p => (
              <button key={p} type="button" onClick={() => setDraft({ ...draft, permissions: p })}
                style={{ flex: 1, padding: "8px", borderRadius: 4, fontSize: 12, border: "1px solid " + (draft.permissions === p ? "var(--ink)" : "var(--rule)"),
                  background: draft.permissions === p ? "var(--ink)" : "var(--paper)", color: draft.permissions === p ? "var(--paper)" : "var(--ink)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>{p}</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <Btn size="sm" onClick={() => setInviteOpen(false)}>Cancel</Btn>
            <Btn size="sm" variant="primary" onClick={submit}><Icon name="send" size={11}/> Send invite</Btn>
          </div>
        </div>
      </Dialog>
    </FeaturePage>
  );
}

// ─────────────────────────── 9 · Discount Ops ───────────────────────────
function DiscountOps({ state, actions }) {
  const sim = SEED.pricingSimDefault;
  const [pct, setPct] = useStateF(15);
  const [extraUnits, setExtra] = useStateF(28);

  const baseRev    = sim.baseUnits * sim.basePrice;
  const baseMargin = sim.baseUnits * (sim.basePrice - sim.baseCogs - sim.baseShip);
  const newPrice   = sim.basePrice * (1 - pct/100);
  const newUnits   = sim.baseUnits + extraUnits;
  const newRev     = newUnits * newPrice;
  const newMargin  = newUnits * (newPrice - sim.baseCogs - sim.baseShip);
  const marginPct  = (newPrice - sim.baseCogs - sim.baseShip) / newPrice * 100;
  const floor      = state.marginFloors.default;
  const breachesFloor = marginPct < floor;

  return (
    <FeaturePage kicker="Pricing · Discount" title="Discount ops">
      <Card>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Should I run X% off? · simulator</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Discount %</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="serif" style={{ fontSize: 28, fontWeight: 500 }}>{pct}%</span>
              <input type="range" min={0} max={40} value={pct} onChange={e => setPct(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--ink)" }}/>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, marginBottom: 4 }}>Estimated extra units</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="serif" style={{ fontSize: 22 }}>+{extraUnits}</span>
              <input type="range" min={0} max={300} value={extraUnits} onChange={e => setExtra(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--ink)" }}/>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12 }}>SKU · {sim.sku} · base ${sim.basePrice} · COGS ${sim.baseCogs} · ship ${sim.baseShip}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ padding: 10, background: "var(--paper-2)", borderRadius: 5 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Baseline rev</div>
              <div className="serif" style={{ fontSize: 20 }}>${baseRev.toLocaleString()}</div>
            </div>
            <div style={{ padding: 10, background: pct > 0 ? "var(--success-wash)" : "var(--paper-2)", borderRadius: 5 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>With {pct}% off</div>
              <div className="serif" style={{ fontSize: 20 }}>${newRev.toLocaleString()}</div>
            </div>
            <div style={{ padding: 10, background: "var(--paper-2)", borderRadius: 5 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Baseline margin</div>
              <div className="serif" style={{ fontSize: 20 }}>${Math.round(baseMargin).toLocaleString()}</div>
            </div>
            <div style={{ padding: 10, background: breachesFloor ? "var(--accent-wash)" : "var(--paper-2)", borderRadius: 5, border: breachesFloor ? "1px solid var(--danger)" : "1px solid transparent" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Margin {pct}% off</div>
              <div className="serif" style={{ fontSize: 20, color: breachesFloor ? "var(--danger)" : "var(--ink)" }}>${Math.round(newMargin).toLocaleString()}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{marginPct.toFixed(1)}% margin{breachesFloor ? ` · below ${floor}% floor` : ""}</div>
            </div>
          </div>
        </div>
        {breachesFloor && (
          <div style={{ marginTop: 12, padding: 10, background: "var(--paper-2)", borderRadius: 5, fontSize: 12, color: "var(--danger)", lineHeight: 1.55 }}>
            <strong>Margin floor breach.</strong> A {pct}% discount on this SKU drops margin below the {floor}% default floor. Recommend capping at {Math.max(0, Math.floor((1 - (sim.baseCogs + sim.baseShip) / sim.basePrice * (1 - floor/100)) * 100))}% — Brand Guard will block above that without an explicit override.
          </div>
        )}
      </Card>

      <SectionHead>Discount fatigue</SectionHead>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="serif" style={{ fontSize: 22 }}>{state.discountFatigue.last90d} sends with discount · 90d</div>
          <Chip tone={state.discountFatigue.last90d > state.discountFatigue.threshold ? "danger" : "ok"}>threshold {state.discountFatigue.threshold}</Chip>
        </div>
        {state.discountFatigue.alerts.map((a, i) => (
          <div key={i} style={{ marginTop: 8, fontSize: 12.5, color: "var(--ink-2)" }}>• {a}</div>
        ))}
      </Card>

      <SectionHead>Active codes</SectionHead>
      <Card style={{ padding: 0 }}>
        {state.discountHistory.map((d, i) => (
          <div key={d.id} style={{ display: "grid", gridTemplateColumns: "0.8fr 0.5fr 0.8fr 1fr 0.8fr 0.8fr 0.9fr", gap: 10, padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
            <div className="mono" style={{ fontSize: 13 }}>{d.code}</div>
            <div className="mono" style={{ fontSize: 12 }}>{d.pct}% off</div>
            <div className="mono" style={{ fontSize: 12 }}>{d.used30d.toLocaleString()} used</div>
            <div className="mono" style={{ fontSize: 12 }}>${d.revenue30d.toLocaleString()}</div>
            <div className="mono" style={{ fontSize: 12, color: d.marginAfter < state.marginFloors.default ? "var(--danger)" : "var(--ink-2)" }}>{d.marginAfter}% margin</div>
            <Chip tone={d.fatigue === "high" ? "danger" : d.fatigue === "medium" ? "warn" : "ok"}>{d.fatigue}</Chip>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {d.status === "active" && <Btn size="sm" onClick={() => actions.updateDiscount(d.id, { status: "paused" })}><Icon name="pause" size={10}/> Pause</Btn>}
              {d.status === "paused" && <Btn size="sm" onClick={() => actions.updateDiscount(d.id, { status: "active" })}><Icon name="play" size={10}/> Resume</Btn>}
              {d.status === "scheduled" && <Btn size="sm" variant="primary" onClick={() => actions.updateDiscount(d.id, { status: "active" })}>Activate</Btn>}
            </div>
          </div>
        ))}
      </Card>
    </FeaturePage>
  );
}

// ─────────────────────────── 10 · Mobile shell ───────────────────────────
function MobileShell({ state, actions }) {
  const open = state.approvals.length;
  const inboxOpen = state.inbox.filter(i => i.status === "open").length;

  const PhoneFrame = ({ children }) => (
    <div style={{
      width: 320, margin: "0 auto",
      background: "var(--ink)", borderRadius: 32, padding: 8,
      boxShadow: "0 30px 60px -20px oklch(20% 0.02 80 / 0.4)",
    }}>
      <div style={{
        background: "var(--paper)", borderRadius: 26, overflow: "hidden",
        height: 600, position: "relative", display: "flex", flexDirection: "column",
      }}>
        <div style={{ height: 26, background: "var(--ink)", color: "var(--paper)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 18px", fontSize: 10.5, fontFamily: "var(--font-mono)" }}>
          <span>9:41</span><span>5G</span>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <FeaturePage kicker="Surface · Mobile" title="Mobile · inbox & approvals">
      <Card style={{ background: "var(--paper-2)" }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Why mobile-first</div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.55 }}>
          SMB founders run their business from their phone. The two highest-value mobile flows are <strong>approval gates</strong> (don't make me open a laptop to say yes) and <strong>inbox triage</strong> (reply between things). Everything else stays desktop.
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "flex-start" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Approval gate</div>
          <PhoneFrame>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="serif" style={{ fontSize: 18, fontWeight: 500 }}>Approvals</div>
              <Chip tone="accent">{open}</Chip>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {state.approvals.slice(0,4).map(a => (
                <div key={a.id} style={{ padding: "14px 18px", borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>{a.title}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>{a.source}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>{a.reason}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <Btn size="sm" variant="primary" onClick={() => actions.resolveApproval(a.id, "approve")} style={{ flex: 1, justifyContent: "center" }}><Icon name="check" size={11}/> Approve</Btn>
                    <Btn size="sm" onClick={() => actions.resolveApproval(a.id, "revise")} style={{ flex: 1, justifyContent: "center" }}>Send back</Btn>
                  </div>
                </div>
              ))}
              {open === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Inbox zero. Nothing waiting.</div>}
            </div>
          </PhoneFrame>
        </div>

        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Inbox triage</div>
          <PhoneFrame>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="serif" style={{ fontSize: 18, fontWeight: 500 }}>Inbox</div>
              <Chip tone="accent">{inboxOpen}</Chip>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {state.inbox.filter(i => i.status === "open").map(i => (
                <div key={i.id} style={{ padding: "14px 18px", borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{i.author}</div>
                    <Chip tone={i.risk === "high" ? "danger" : i.risk === "medium" ? "warn" : "ok"}>{i.risk}</Chip>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>"{i.text}"</div>
                  <div style={{ marginTop: 10, padding: 8, background: "var(--paper-2)", borderRadius: 5, fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.5, fontStyle: "italic" }}>
                    Drafted: {i.draft}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <Btn size="sm" variant="primary" onClick={() => actions.updateInbox(i.id, { status: "replied" }, { notify: { tone: "ok", text: `Replied · ${i.author}` } })} style={{ flex: 1, justifyContent: "center" }}>
                      <Icon name="send" size={11}/> Send
                    </Btn>
                    <Btn size="sm" style={{ flex: 1, justifyContent: "center" }}><Icon name="edit" size={11}/> Edit</Btn>
                  </div>
                </div>
              ))}
              {inboxOpen === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Triaged. Back to building.</div>}
            </div>
          </PhoneFrame>
        </div>
      </div>
    </FeaturePage>
  );
}

// ─────────────────────────── 11 · Organic Social Studio ──────────────────
const PLATFORM_META = {
  instagram: { label: "Instagram", color: "oklch(62% 0.18 340)", dot: "IG" },
  tiktok:    { label: "TikTok",    color: "oklch(18% 0.02 260)", dot: "TK" },
  pinterest: { label: "Pinterest", color: "oklch(52% 0.20 28)",  dot: "PN" },
  youtube:   { label: "YouTube",   color: "oklch(54% 0.22 27)",  dot: "YT" },
  facebook:  { label: "Facebook",  color: "oklch(48% 0.18 260)", dot: "FB" },
  linkedin:  { label: "LinkedIn",  color: "oklch(48% 0.14 235)", dot: "LI" },
  x:         { label: "X",         color: "oklch(22% 0.02 260)", dot: "𝕏"  },
  threads:   { label: "Threads",   color: "oklch(22% 0.02 260)", dot: "Th" },
  reddit:    { label: "Reddit",    color: "oklch(58% 0.22 28)",  dot: "Rd" },
  snapchat:  { label: "Snapchat",  color: "oklch(88% 0.16 100)", dot: "Sn" },
  bluesky:   { label: "Bluesky",   color: "oklch(55% 0.18 240)", dot: "Bk" },
  mastodon:  { label: "Mastodon",  color: "oklch(50% 0.15 285)", dot: "Mt" },
  telegram:  { label: "Telegram",  color: "oklch(60% 0.16 225)", dot: "Tg" },
};

const STATUS_META = {
  scheduled:   { label: "Scheduled",   color: "var(--success)",  bg: "var(--success-wash)" },
  draft:        { label: "Draft",       color: "var(--muted)",    bg: "var(--paper-3)" },
  needs_image:  { label: "Needs image", color: "var(--warn)",     bg: "var(--warn-wash)" },
  published:    { label: "Published",   color: "var(--accent)",   bg: "var(--accent-wash)" },
};

function OrganicSocialStudio({ state, actions }) {
  const isErickson = state?.activeBrandId === "erickson";
  const defaultPlatform = isErickson ? "facebook" : "instagram";
  const defaultType     = isErickson ? "Post"     : "Reel";

  const [tab, setTab]           = useStateF("all");
  const [composing, setComposing] = useStateF(false);
  const [draft, setDraft]       = useStateF({ platform: defaultPlatform, type: defaultType, caption: "", scheduledAt: "" });
  const [genLoading, setGenLoading] = useStateF(false);
  const [genDone, setGenDone]   = useStateF(null);

  // ── Real data from Supabase ────────────────────────────────────────────────
  const [posts, setPosts]       = useStateF([]);
  const [channels, setChannels] = useStateF({}); // { platform: channelRow }
  const [dbLoading, setDbLoading] = useStateF(true);
  const [saving, setSaving]     = useStateF(false);
  const [publishing, setPublishing] = useStateF(null); // postId being published

  useEffectF(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) { setDbLoading(false); return; }
      const uid = session.user.id;

      // Load connected social channels
      const { data: chData } = await sb.from("channels")
        .select("*").eq("user_id", uid).eq("status", "connected");
      if (chData) {
        const map = {};
        chData.forEach(ch => { map[ch.platform] = ch; });
        setChannels(map);
      }

      // Load posts (newest first)
      const { data: postData } = await sb.from("posts")
        .select("*").eq("user_id", uid)
        .order("created_at", { ascending: false }).limit(50);
      setPosts(postData || []);
      setDbLoading(false);
    })();
  }, []);

  const connectedImageGen = ["runware", "fal", "replicate"].find(id => state.connectors?.[id]?.connected);
  const connectedVideoGen = ["luma", "kling", "pika", "higgsfield"].find(id => state.connectors?.[id]?.connected);

  const simulateImageGen = () => {
    setGenLoading(true);
    setTimeout(() => { setGenLoading(false); setGenDone("product-shot-gen.jpg"); }, 2200);
  };

  // ── Save post to Supabase ──────────────────────────────────────────────────
  const savePost = async (status = "draft") => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;
    setSaving(true);

    const ch = channels[draft.platform];
    const { data, error } = await sb.from("posts").insert({
      user_id:      session.user.id,
      channel_id:   ch?.id || null,
      platform:     draft.platform,
      post_type:    draft.type,
      caption:      draft.caption || "",
      media_urls:   genDone ? [genDone] : [],
      status,
      scheduled_at: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : null,
      updated_at:   new Date().toISOString(),
    }).select().single();

    if (!error && data) {
      setPosts(prev => [data, ...prev]);
      actions.notify("ok", status === "scheduled" ? "Post scheduled" : "Draft saved");
    } else {
      actions.notify("warn", error?.message || "Could not save post");
    }
    setSaving(false);
    setComposing(false);
    setGenDone(null);
    setDraft({ platform: "instagram", type: "Reel", caption: "", scheduledAt: "" });
  };

  // ── Publish post now (via connected platform) ────────────────────────────
  const publishNow = async (post) => {
    const ch = channels[post.platform];
    if (!ch?.composio_connection_id) {
      actions.notify("warn", `${post.platform} not connected — open Connections → Social first`);
      return;
    }
    setPublishing(post.id);
    try {
      // Mark as published in Supabase (direct posting via Composio tools handled by AI agent)
      await sb.from("posts").update({
        status:       "published",
        published_at: new Date().toISOString(),
      }).eq("id", post.id);

      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: "published" } : p));
      actions.notify("ok", "Published!");
    } catch (err) {
      actions.notify("warn", `Publish failed: ${err.message}`);
    }
    setPublishing(null);
  };

  // Only show platform tabs for connected channels (+ "all")
  const ALL_PLATFORMS = ["instagram", "tiktok", "pinterest", "youtube", "facebook", "linkedin", "x", "reddit"];
  const TABS = ["all", ...ALL_PLATFORMS.filter(p => channels[p])];
  const filtered = tab === "all" ? posts : posts.filter(p => p.platform === tab);
  const scheduled = posts.filter(p => p.status === "scheduled").length;
  const connectedCount = Object.keys(channels).length;

  return (
    <FeaturePage kicker={isErickson ? "Facebook · YouTube · LinkedIn" : "Organic · Social"} title="Social Studio"
      right={
        <div style={{ display: "flex", gap: 8 }}>
          <Btn size="sm" variant="ghost"><Icon name="calendar" size={11}/> Calendar view</Btn>
          <Btn size="sm" variant="primary" onClick={() => setComposing(true)}><Icon name="edit" size={11}/> Compose</Btn>
        </div>
      }>

      {/* Connected accounts strip */}
      {connectedCount > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(connectedCount, 4)}, 1fr)`, gap: 10 }}>
          {Object.entries(channels).map(([platform, ch]) => {
            const pm = PLATFORM_META[platform] || {};
            return (
              <Card key={platform} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: pm.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{pm.dot}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ch.account_handle || platform}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{ch.followers_count ? ch.followers_count.toLocaleString() + " followers" : "connected"}</div>
                </div>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }}/>
              </Card>
            );
          })}
        </div>
      ) : (
        <div style={{ background: "var(--accent-wash)", border: "1px solid var(--accent)", borderRadius: 8, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <Icon name="sliders" size={16}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>No social accounts connected yet</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Open Connections → Social and connect your platforms via OAuth.
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <StatTile label="Queued"       value={scheduled} hint="posts scheduled"/>
        <StatTile label="Total posts"  value={posts.length} hint="across all platforms"/>
        <StatTile label="Connected"    value={connectedCount} hint="social accounts"/>
        <StatTile label="Best time"    value="08:00" hint="BST · Tue & Thu"/>
      </div>

      {/* Creative AI banner */}
      {!connectedImageGen && (
        <div style={{ background: "var(--paper-2)", border: "1px solid var(--rule)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <Icon name="spark" size={15}/>
          <div style={{ flex: 1, fontSize: 12.5, color: "var(--muted)" }}>Connect Runware, fal.ai, or Runway in Connections to generate images from captions.</div>
        </div>
      )}
      {connectedImageGen && (
        <div style={{ background: "var(--success-wash)", border: "1px solid var(--success)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <Icon name="check" size={14}/>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>{connectedImageGen === "fal" ? "fal.ai" : connectedImageGen.charAt(0).toUpperCase() + connectedImageGen.slice(1)}</strong> connected — Drafter can generate images.
            {connectedVideoGen && <> · <strong>{connectedVideoGen}</strong> ready for video.</>}
          </div>
        </div>
      )}

      {/* Platform tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "5px 14px", borderRadius: 5, border: "1px solid",
            borderColor: tab === t ? "var(--ink)" : "var(--rule)",
            background: tab === t ? "var(--ink)" : "var(--paper)",
            color: tab === t ? "var(--paper)" : "var(--ink-2)",
            fontSize: 12, fontFamily: "var(--font-sans)", cursor: "pointer",
            textTransform: t === "all" ? "none" : "capitalize",
          }}>{t === "all" ? "All channels" : t}</button>
        ))}
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center" }}>
          {dbLoading ? "Loading…" : `${filtered.length} posts`}
        </div>
      </div>

      {/* Post queue */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--rule)", borderRadius: 6, overflow: "hidden" }}>
        {dbLoading && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading posts…</div>
        )}
        {!dbLoading && filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            No posts yet. Hit <strong>Compose</strong> to create your first one.
          </div>
        )}
        {filtered.map((post, i) => {
          const pm = PLATFORM_META[post.platform] || {};
          const sm = STATUS_META[post.status] || STATUS_META.draft;
          const isPublishing = publishing === post.id;
          const ch = channels[post.platform];
          return (
            <div key={post.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
              borderTop: i === 0 ? "none" : "1px solid var(--rule)",
              background: "var(--paper)",
            }}>
              <div style={{ width: 28, height: 28, borderRadius: 5, background: pm.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{pm.dot}</div>

              <div style={{ width: 28, height: 28, borderRadius: 4, background: (post.media_urls?.length > 0) ? "var(--paper-3)" : "var(--warn-wash)", border: "1px solid var(--rule)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={(post.media_urls?.length > 0) ? "image" : "plus"} size={11}/>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink)" }}>
                  {post.caption ? `"${post.caption}"` : <span style={{ color: "var(--muted)" }}>No caption</span>}
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>
                  {post.post_type} · {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not scheduled"}
                </div>
              </div>

              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 3, background: sm.bg, color: sm.color, whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>{sm.label}</span>

              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                {post.status !== "published" && ch?.composio_connection_id && ch?.account_id && (
                  <Btn size="sm" variant="primary" onClick={() => publishNow(post)} disabled={isPublishing}>
                    <Icon name="send" size={10}/> {isPublishing ? "Posting…" : "Post now"}
                  </Btn>
                )}
                {post.status !== "published" && (!ch?.composio_connection_id || !ch?.account_id) && (
                  <Btn size="sm" variant="ghost" title="Connect this platform via Connections → Social">
                    <Icon name="sliders" size={10}/> Connect
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose overlay */}
      {composing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 100 }}>
          <div style={{ background: "var(--paper)", borderRadius: 10, width: 560, maxHeight: "90vh", overflow: "auto", padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="serif" style={{ margin: 0, fontSize: 22 }}>Compose post</h3>
              <Btn size="sm" variant="ghost" onClick={() => { setComposing(false); setGenDone(null); }}><Icon name="x" size={11}/> Close</Btn>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Platform</span>
                <select value={draft.platform} onChange={e => setDraft(d => ({ ...d, platform: e.target.value, type: "Post" }))}
                  style={{ padding: "8px 10px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13, fontFamily: "var(--font-sans)", background: "var(--paper)" }}>
                  {ALL_PLATFORMS.map(p => {
                    const pm = PLATFORM_META[p];
                    if (!pm) return null;
                    return (
                      <option key={p} value={p}>
                        {pm.label}{channels[p] ? " ✓" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Format</span>
                <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))}
                  style={{ padding: "8px 10px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13, fontFamily: "var(--font-sans)", background: "var(--paper)" }}>
                  {draft.platform === "instagram"  && <><option>Reel</option><option>Carousel</option><option>Post</option><option>Story</option></>}
                  {draft.platform === "tiktok"     && <><option>Video</option><option>Photo mode</option></>}
                  {draft.platform === "pinterest"  && <><option>Pin</option><option>Idea pin</option><option>Video pin</option></>}
                  {draft.platform === "youtube"    && <><option>Short</option><option>Long-form</option></>}
                  {draft.platform === "facebook"   && <><option>Post</option><option>Story</option><option>Reel</option></>}
                  {draft.platform === "linkedin"   && <><option>Post</option><option>Article</option><option>Poll</option></>}
                  {draft.platform === "x"          && <><option>Post</option><option>Thread</option></>}
                  {draft.platform === "reddit"     && <><option>Text post</option><option>Image post</option><option>Link post</option></>}
                  {/* Fallback for any unmapped platform */}
                  {!["instagram","tiktok","pinterest","youtube","facebook","linkedin","x","reddit"].includes(draft.platform) && <option>Post</option>}
                </select>
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Caption <span style={{ textTransform: "none", fontWeight: 400, letterSpacing: 0 }}>— ask Drafter to write this</span>
              </span>
              <textarea value={draft.caption} onChange={e => setDraft(d => ({ ...d, caption: e.target.value }))}
                rows={4} placeholder="Write a caption, or leave blank and ask Drafter in chat…"
                style={{ padding: "10px 12px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13.5, fontFamily: "var(--font-serif)", fontStyle: "italic", lineHeight: 1.6, background: "var(--paper)", resize: "vertical" }}/>
            </label>

            <div>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Visual</div>
              {genDone ? (
                <div style={{ background: "var(--success-wash)", border: "1px solid var(--success)", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "var(--success)" }}>
                  ✓ Image generated: {genDone}
                </div>
              ) : connectedImageGen ? (
                <Btn onClick={simulateImageGen} disabled={genLoading}>
                  <Icon name="spark" size={12}/> {genLoading ? "Generating…" : `Generate with ${connectedImageGen === "fal" ? "fal.ai" : connectedImageGen}`}
                </Btn>
              ) : (
                <div style={{ padding: "10px 14px", background: "var(--paper-2)", borderRadius: 6, fontSize: 12.5, color: "var(--muted)" }}>
                  Connect Runware, fal.ai, or Runway in Connections to auto-generate images.
                </div>
              )}
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Schedule</span>
              <input type="datetime-local" value={draft.scheduledAt} onChange={e => setDraft(d => ({ ...d, scheduledAt: e.target.value }))}
                style={{ padding: "8px 10px", border: "1px solid var(--rule-strong)", borderRadius: 5, fontSize: 13, fontFamily: "var(--font-sans)", background: "var(--paper)" }}/>
            </label>

            {!channels[draft.platform] && (
              <div style={{ padding: "10px 14px", background: "var(--warn-wash)", border: "1px solid var(--warn)", borderRadius: 6, fontSize: 12.5, color: "var(--ink-2)" }}>
                <Icon name="sliders" size={11}/> {draft.platform.charAt(0).toUpperCase() + draft.platform.slice(1)} not connected — you can save a draft but posting requires connecting this platform (Connections → Social).
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <Btn variant="ghost" onClick={() => { setComposing(false); setGenDone(null); }}>Cancel</Btn>
              <Btn onClick={() => savePost("draft")} disabled={saving}>Save draft</Btn>
              <Btn variant="primary" onClick={() => savePost(draft.scheduledAt ? "scheduled" : "draft")} disabled={saving}>
                <Icon name="send" size={11}/> {saving ? "Saving…" : draft.scheduledAt ? "Schedule" : "Save"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </FeaturePage>
  );
}

Object.assign(window, {
  SmsCenter, SeoStudio, AffiliateProgram, RetentionDashboard, CxSignals,
  SeasonalMode, AbTestLab, TeamSeats, DiscountOps, MobileShell,
  OrganicSocialStudio,
});
