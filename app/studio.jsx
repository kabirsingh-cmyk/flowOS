// FlowOS — Studio: Social Studio hub, Email Studio, Search Studio
const { useState: useStateS } = React;

// ─────────────────────────── LOCAL HELPERS ─────────────────────────────────

function SHead({ children, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{children}</span>
      {action}
    </div>
  );
}

function FlowRec({ studio, title, body, cta, onClick, urgent }) {
  return (
    <div style={{ padding: 16, borderRadius: 7, background: "var(--paper)", border: "1px solid var(--rule)", borderLeft: `3px solid ${urgent ? "var(--danger)" : "var(--accent)"}` }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        {studio && <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{studio}</span>}
        {urgent && <span className="mono" style={{ fontSize: 9.5, color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.08em" }}>⚡ Urgent</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.35 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5, marginBottom: 12 }}>{body}</div>
      <Btn size="sm" variant="primary" onClick={onClick}>{cta} →</Btn>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = {
    draft:     { bg: "var(--paper-2)",       color: "var(--muted)",              border: "1px solid var(--rule)" },
    live:      { bg: "var(--success-wash)",   color: "oklch(35% 0.1 155)",        border: "1px solid var(--success)" },
    active:    { bg: "var(--success-wash)",   color: "oklch(35% 0.1 155)",        border: "1px solid var(--success)" },
    sent:      { bg: "var(--paper-2)",        color: "var(--muted)",              border: "1px solid var(--rule)" },
    paused:    { bg: "var(--warn-wash,#fefce8)", color: "oklch(58% 0.15 75)",    border: "1px solid oklch(75% 0.12 75)" },
    scheduled: { bg: "var(--accent-wash)",    color: "var(--accent)",             border: "1px solid var(--accent)" },
  }[status] || { bg: "var(--paper-2)", color: "var(--muted)", border: "1px solid var(--rule)" };
  return <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 3, fontFamily: "var(--font-mono)", ...s }}>{status}</span>;
}

// ──────────────────────────── STUDIO HUB ───────────────────────────────────
function StudioHub({ state, actions, go }) {
  const [createOpen, setCreateOpen] = useStateS(false);

  const brandId    = state?.activeBrandId || "mveda";
  const isErickson = brandId === "erickson";

  const STUDIOS_MVEDA = [
    {
      id: "organic", label: "Social Studio", color: "var(--accent)",
      desc: "Organic content — Instagram, TikTok, Pinterest, X & more",
      stat1Label: "Active drafts", stat1: "4",
      stat2Label: "Scheduled this week", stat2: "12",
      highlight: "TikTok +44% reach this month",
    },
    {
      id: "emailstudio", label: "Email Studio", color: "oklch(48% 0.18 260)",
      desc: "Klaviyo flows, campaigns & automated sequences",
      stat1Label: "Draft campaigns", stat1: "3",
      stat2Label: "Sends this week", stat2: "24.1k",
      highlight: "Welcome flow · 58% open rate",
    },
    {
      id: "searchstudio", label: "Search Studio", color: "oklch(62% 0.18 160)",
      desc: "Google & Bing — search, shopping & Performance Max",
      stat1Label: "Active campaigns", stat1: "2",
      stat2Label: "Monthly budget", stat2: "$1.8k",
      highlight: "Neem Cleanser CTR 4.2% → expand",
    },
  ];

  const STUDIOS_ERICKSON = [
    {
      id: "searchstudio", label: "Search Studio", color: "oklch(62% 0.18 160)",
      desc: "Google LSA, search campaigns & local service ads — your #1 lead channel",
      stat1Label: "Active campaigns", stat1: "5",
      stat2Label: "Monthly budget", stat2: "$6.2k",
      highlight: "LSA avg cost/lead $38 → optimise",
    },
    {
      id: "emailstudio", label: "Email Studio", color: "oklch(48% 0.18 260)",
      desc: "Service reminders, maintenance plan renewals & seasonal campaigns",
      stat1Label: "Draft campaigns", stat1: "3",
      stat2Label: "List size", stat2: "2,840",
      highlight: "Maintenance reminder · 44% open rate",
    },
    {
      id: "organic", label: "Social Studio", color: "var(--accent)",
      desc: "Facebook before/after, YouTube how-to & LinkedIn commercial trust content",
      stat1Label: "Active drafts", stat1: "3",
      stat2Label: "Scheduled this week", stat2: "5",
      highlight: "Facebook post reach +28% this month",
    },
  ];

  const STUDIOS = isErickson ? STUDIOS_ERICKSON : STUDIOS_MVEDA;

  const RECS_MVEDA = [
    { studio: "Social Studio",  title: "Hair Ritual Reel format — scale now",     body: "2.4× avg saves, 98k reach in 30d. Flow recommends doubling post frequency and extending to 60s format.",       cta: "Open Social Studio",  t: "organic"      },
    { studio: "Email Studio",   title: "Win-back flow — 847 lapsed customers",    body: "90d+ lapse segment with avg LTV $240. Draft personalised win-back copy loaded with 20% comeback offer.",         cta: "Review draft",        t: "emailstudio", urgent: true },
    { studio: "Search Studio",  title: "Brand keyword gap — 'MVEDA hair oil'",    body: "$0.40 CPC, 720 mo/searches, low competition. No active search campaign capturing this brand intent.",            cta: "Create campaign",     t: "searchstudio" },
  ];

  const RECS_ERICKSON = [
    { studio: "Search Studio",  title: "LSA daily budget too low for summer peak", body: "Phoenix AC emergency searches up 34% — your $200/day cap is limiting reach. Flow estimates 18 leads/wk uncaptured.", cta: "Adjust budget",     t: "searchstudio", urgent: true },
    { studio: "Email Studio",   title: "Pre-season AC tune-up — send by May 15",   body: "2,840 contacts, 380 past AC customers due for tune-up. Draft ready with $30 off spring service offer.",              cta: "Review draft",      t: "emailstudio",  urgent: true },
    { studio: "Social Studio",  title: "YouTube how-to — AC pre-summer checklist", body: "7-point DIY inspection video scores high on 'HVAC maintenance' searches. Draft script + shot list ready.",          cta: "Open Social Studio", t: "organic" },
  ];

  const RECS = isErickson ? RECS_ERICKSON : RECS_MVEDA;

  const ALL_DRAFTS_MVEDA = [
    { title: "Hair Ritual · Reel series",      studio: "Social", platform: "Instagram + TikTok",  date: "Content ready",      t: "organic"      },
    { title: "Win-back · 90d lapsed",           studio: "Email",  platform: "Klaviyo flow",        date: "Ready to activate",  t: "emailstudio"  },
    { title: "Mother's Day · gifters",          studio: "Email",  platform: "Klaviyo campaign",    date: "Schedule by May 9",  t: "emailstudio"  },
    { title: "MVEDA brand keywords",            studio: "Search", platform: "Google Ads",          date: "Awaiting review",    t: "searchstudio" },
    { title: "Saffron Serum · Reels",          studio: "Social", platform: "Instagram",           date: "Draft ready",        t: "organic"      },
    { title: "VIP early access · Hair Ritual", studio: "Email",  platform: "Klaviyo campaign",    date: "Ready to schedule",  t: "emailstudio"  },
  ];

  const ALL_DRAFTS_ERICKSON = [
    { title: "Summer AC prep — emergency search",    studio: "Search", platform: "Google Ads · LSA",      date: "Awaiting review",    t: "searchstudio" },
    { title: "Erickson brand keywords",              studio: "Search", platform: "Google Ads",             date: "Ready to activate",  t: "searchstudio" },
    { title: "Pre-season AC tune-up · spring offer", studio: "Email",  platform: "Klaviyo campaign",       date: "Ready to send",      t: "emailstudio"  },
    { title: "Maintenance plan renewal · past cust", studio: "Email",  platform: "Klaviyo flow",           date: "Schedule by May 15", t: "emailstudio"  },
    { title: "Commercial accounts · LinkedIn trust", studio: "Social", platform: "LinkedIn",               date: "Draft ready",        t: "organic"      },
    { title: "AC maintenance checklist · YouTube",   studio: "Social", platform: "YouTube",                date: "Script ready",       t: "organic"      },
  ];

  const ALL_DRAFTS = isErickson ? ALL_DRAFTS_ERICKSON : ALL_DRAFTS_MVEDA;

  const SC = { Social: "var(--accent)", Email: "oklch(48% 0.18 260)", Search: "oklch(62% 0.18 160)" };

  return (
    <div className="anim-fade" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 20px", borderBottom: "1px solid var(--rule)", background: "var(--paper)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Creative ops</div>
            <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "4px 0 0" }}>Studio</h1>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
              {isErickson ? "Search · Email · Social — campaign builders for Erickson Refrigeration" : "Social · Email · Search — all your campaign builders in one place"}
            </div>
          </div>
          <Btn variant="primary" onClick={() => setCreateOpen(true)}><Icon name="spark" size={13}/> Create campaign</Btn>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Flow recommendations */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>✦</span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Flow recommends</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {RECS.map((r, i) => (
              <FlowRec key={i} studio={r.studio} title={r.title} body={r.body} cta={r.cta} urgent={r.urgent} onClick={() => go(r.t)}/>
            ))}
          </div>
        </div>

        {/* Studio cards */}
        <div>
          <SHead>Studios</SHead>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {STUDIOS.map(s => (
              <div key={s.id} style={{ padding: 22, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--rule)", borderTop: `3px solid ${s.color}`, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{s.desc}</div>
                </div>
                <div style={{ display: "flex", gap: 28 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{s.stat1Label}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em" }}>{s.stat1}</div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{s.stat2Label}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em" }}>{s.stat2}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: s.color, background: `color-mix(in oklch, ${s.color} 12%, transparent)`, padding: "5px 10px", borderRadius: 4, fontWeight: 500 }}>↑ {s.highlight}</div>
                <Btn size="sm" variant="primary" onClick={() => go(s.id)}>Open {s.label} →</Btn>
              </div>
            ))}
          </div>
        </div>

        {/* All drafts */}
        <div>
          <SHead>All drafts across studios</SHead>
          <div style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 180px 160px 90px", gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", background: "var(--paper-2)" }}>
              <span>Campaign</span><span>Studio</span><span>Platform</span><span>Status</span><span/>
            </div>
            {ALL_DRAFTS.map((d, i) => (
              <div key={i} className="row-hover" style={{ display: "grid", gridTemplateColumns: "1fr 72px 180px 160px 90px", gap: 12, padding: "12px 16px", borderBottom: i < ALL_DRAFTS.length - 1 ? "1px solid var(--rule)" : "none", alignItems: "center", fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{d.title}</span>
                <span>
                  <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 3, fontFamily: "var(--font-mono)", background: `color-mix(in oklch, ${SC[d.studio]} 14%, transparent)`, color: SC[d.studio], border: `1px solid color-mix(in oklch, ${SC[d.studio]} 30%, transparent)` }}>{d.studio}</span>
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{d.platform}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{d.date}</span>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Btn size="sm" variant="primary" onClick={() => go(d.t)}>Open →</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create picker modal */}
      {createOpen && (
        <Dialog open onClose={() => setCreateOpen(false)} title="Create campaign — choose studio">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 4 }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>Select which studio to create in:</div>
            {STUDIOS.map(s => (
              <button key={s.id} onClick={() => { setCreateOpen(false); go(s.id); }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 7, border: "1px solid var(--rule)", background: "var(--paper-2)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "border-color .12s, background .12s" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }}/>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ───────────────────────────── EMAIL STUDIO ─────────────────────────────────
function EmailStudio({ state, actions }) {
  const [tab, setTab] = useStateS("overview");
  const [activeDraft, setActiveDraft] = useStateS(null);
  const [createOpen, setCreateOpen] = useStateS(false);
  const [form, setForm] = useStateS({ name: "", type: "campaign", subject: "", previewText: "", segment: "All subscribers", sendDate: "", body: "" });

  const RECS = [
    { title: "Win-back · 847 lapsed customers",      body: "90d+ lapse, avg LTV $240. Draft ready with personalised 20% off comeback offer.",                 cta: "Review draft",    draftId: "d-wb", urgent: true },
    { title: "Welcome flow — A/B test subject line",  body: "58.2% open rate is strong. A/B test a curiosity subject to push past 62% industry benchmark.",    cta: "Create variant",  draftId: null    },
    { title: "Mother's Day — schedule by May 9",      body: "4,200 gifter segment, copy ready. 8 days to deadline — optimal delivery 5 days before holiday.",  cta: "Schedule now",    draftId: "d-md", urgent: true },
  ];

  const CAMPAIGNS = [
    { id: "d-wb",  name: "Win-back · 90d lapsed",          type: "flow",     segment: "Lapsed 90d+",     sends: 847,   openRate: null, revenue: null,  status: "draft",     date: "Ready to activate",  subject: "We miss you, {{first_name}} — something special inside",          previewText: "Your ritual is waiting.",        body: "Hi {{first_name}},\n\nIt's been a while. We miss you.\n\nAs a thank-you for being part of the MVEDA community, here's 20% off your next order.\n\nCode: COMEBACK20 · valid 7 days.\n\nWith love,\nMVEDA" },
    { id: "d-md",  name: "Mother's Day · gifters",          type: "campaign", segment: "Gifters",         sends: 4200,  openRate: null, revenue: null,  status: "draft",     date: "Schedule by May 9",  subject: "A ritual for the woman who gave you everything",                  previewText: "Gift her the MVEDA collection.", body: "This Mother's Day, give the gift of ritual.\n\nOur Saffron + Hair Oil gift set — beautifully wrapped, delivered by May 10th when you order today.\n\nShop the gift collection →\n\nWith love,\nMVEDA" },
    { id: "d-vip", name: "VIP early access · Hair Ritual",  type: "campaign", segment: "VIP (2× buyers)", sends: 1840,  openRate: null, revenue: null,  status: "draft",     date: "Ready to schedule",  subject: "Before anyone else — your exclusive first look",                  previewText: "VIP access starts tomorrow.",    body: "Hi {{first_name}},\n\nAs one of our most loyal customers, you get first access to the new Hair Ritual collection — 24 hours before it goes public.\n\nShop your early access →\n\nMVEDA" },
    { id: "l-ws",  name: "Welcome series",                  type: "flow",     segment: "New subscribers", sends: 1840,  openRate: 58.2, revenue: 18200, status: "live",      date: "Ongoing",            subject: "Welcome to MVEDA — your ritual starts here",                     previewText: "Three drops. Palms warmed.",     body: "" },
    { id: "l-ba",  name: "Browse abandonment · 24h",        type: "flow",     segment: "Browsers",        sends: 3240,  openRate: 42.1, revenue: 12400, status: "live",      date: "Ongoing",            subject: "You left something behind, {{first_name}}",                      previewText: "Still thinking about it?",       body: "" },
    { id: "s-ss",  name: "Saffron Serum launch",            type: "campaign", segment: "Full list",       sends: 24100, openRate: 34.8, revenue: 14200, status: "sent",      date: "Sent Apr 18",        subject: "Introducing Saffron Serum — our most concentrated formula yet",  previewText: "",                               body: "" },
    { id: "s-ri",  name: "Ritual subscription nudge",       type: "campaign", segment: "1× buyers",       sends: 18400, openRate: 36.4, revenue: 8240,  status: "sent",      date: "Sent Apr 6",         subject: "Make your ritual a habit, {{first_name}}",                       previewText: "Subscribe & save 15%.",          body: "" },
  ];

  const SEGMENTS = ["All subscribers", "VIP (2× buyers)", "Lapsed 90d+", "New (30d)", "High engagement", "Gifters", "Browse abandoners", "1× buyers"];

  const filtered = tab === "campaigns" ? CAMPAIGNS.filter(c => c.type === "campaign")
                 : tab === "flows"     ? CAMPAIGNS.filter(c => c.type === "flow")
                 : CAMPAIGNS.slice(0, 5);

  return (
    <div className="anim-fade" style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      {/* Main column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Sticky header + tabs */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--paper)", borderBottom: "1px solid var(--rule)", padding: "18px 32px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Studio · Email</div>
              <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em", margin: "4px 0 0" }}>Email Studio</h1>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn size="sm" variant="ghost"><Icon name="download" size={12}/> Export</Btn>
              <Btn variant="primary" onClick={() => setCreateOpen(true)}><Icon name="spark" size={13}/> Create campaign</Btn>
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {["overview", "campaigns", "flows"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", background: "transparent", border: "none", borderBottom: tab === t ? "2px solid var(--ink)" : "2px solid transparent", color: tab === t ? "var(--ink)" : "var(--muted)", fontWeight: tab === t ? 600 : 400, transition: "color .12s", marginBottom: -1, textTransform: "capitalize" }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 28 }}>
          {tab === "overview" && (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--gap)" }}>
                <Kpi label="Avg open rate" value="40.2%" delta={3.2} unit="pp" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
                <Kpi label="Avg CTR" value="7.3%" delta={1.1} unit="pp" sparkline={[0.4,0.45,0.5,0.55,0.58,0.6,0.62,0.65,0.68,0.7,0.75]}/>
                <Kpi label="Email revenue" value="$59.2k" delta={14} unit="%" sparkline={[0.3,0.4,0.5,0.55,0.6,0.65,0.7,0.72,0.76,0.8,0.85]}/>
                <Kpi label="Subscribers" value="24,118" delta={412} unit="" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
              </div>

              {/* Flow recommendations */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>✦</span>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Flow recommends</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  {RECS.map((r, i) => (
                    <FlowRec key={i} title={r.title} body={r.body} cta={r.cta} urgent={r.urgent}
                      onClick={() => { const d = CAMPAIGNS.find(c => c.id === r.draftId); if (d) setActiveDraft(d); else setCreateOpen(true); }}/>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Campaign table — all tabs */}
          <div>
            {tab === "overview" && (
              <SHead action={<Btn size="sm" variant="ghost" onClick={() => setTab("campaigns")}>View all</Btn>}>
                Campaigns &amp; flows
              </SHead>
            )}
            <Card>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 74px 140px 68px 80px 90px 82px", gap: 10, padding: "6px 0 10px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <span>Name</span><span>Type</span><span>Segment</span><span>Sends</span><span>Open %</span><span>Revenue</span><span>Status</span>
              </div>
              {filtered.map((c, i) => (
                <div key={c.id} className="row-hover" onClick={() => setActiveDraft(c)}
                  style={{ display: "grid", gridTemplateColumns: "1fr 74px 140px 68px 80px 90px 82px", gap: 10, padding: "12px 0", borderBottom: i < filtered.length - 1 ? "1px solid var(--rule)" : "none", alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  <span>
                    <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)", background: c.type === "flow" ? "var(--accent-wash)" : "var(--paper-2)", color: c.type === "flow" ? "var(--accent)" : "var(--muted)", border: c.type === "flow" ? "1px solid var(--accent)" : "1px solid var(--rule)" }}>{c.type}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{c.segment}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.sends.toLocaleString()}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{c.openRate ? `${c.openRate}%` : "—"}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{c.revenue ? `$${(c.revenue/1000).toFixed(1)}k` : "—"}</span>
                  <StatusBadge status={c.status}/>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>

      {/* Right drawer — draft editor */}
      <Drawer open={!!activeDraft} onClose={() => setActiveDraft(null)} title={activeDraft?.name || "Campaign"} width={480}
        actions={activeDraft && (
          <>
            <Btn variant="ghost" onClick={() => setActiveDraft(null)}>Close</Btn>
            <Btn variant="primary" onClick={() => { actions.notify("ok", `'${activeDraft.name}' scheduled`); setActiveDraft(null); }}>
              <Icon name="send" size={12}/> {activeDraft.status === "draft" ? "Schedule & send" : "View in Klaviyo"}
            </Btn>
          </>
        )}>
        {activeDraft && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)", background: activeDraft.type === "flow" ? "var(--accent-wash)" : "var(--paper-2)", color: activeDraft.type === "flow" ? "var(--accent)" : "var(--muted)", border: activeDraft.type === "flow" ? "1px solid var(--accent)" : "1px solid var(--rule)" }}>{activeDraft.type}</span>
              <StatusBadge status={activeDraft.status}/>
              <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{activeDraft.sends.toLocaleString()} sends · {activeDraft.segment}</span>
            </div>
            <FormRow label="Subject line">
              <Input defaultValue={activeDraft.subject} key={activeDraft.id + "-sub"}/>
            </FormRow>
            {activeDraft.previewText !== "" && (
              <FormRow label="Preview text">
                <Input defaultValue={activeDraft.previewText} key={activeDraft.id + "-pre"}/>
              </FormRow>
            )}
            {activeDraft.body && (
              <FormRow label="Email body">
                <Textarea defaultValue={activeDraft.body} rows={8} key={activeDraft.id + "-body"}/>
              </FormRow>
            )}
            {activeDraft.status === "draft" && (
              <FormRow label="Send date / time">
                <Input type="datetime-local"/>
              </FormRow>
            )}
            {activeDraft.openRate && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 5, background: "var(--paper-2)", border: "1px solid var(--rule)" }}>
                  <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Open rate</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{activeDraft.openRate}%</div>
                </div>
                <div style={{ padding: 12, borderRadius: 5, background: "var(--paper-2)", border: "1px solid var(--rule)" }}>
                  <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Revenue</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>${(activeDraft.revenue/1000).toFixed(1)}k</div>
                </div>
              </div>
            )}
            <div style={{ padding: 12, borderRadius: 5, background: "var(--accent-wash)", border: "1px solid var(--accent)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
              <strong>✦ Flow suggests:</strong> Send Tuesday 9am for highest open rate based on your subscriber engagement history.
            </div>
          </div>
        )}
      </Drawer>

      {/* Create campaign dialog */}
      {createOpen && (
        <Dialog open onClose={() => setCreateOpen(false)} title="Create email campaign" width={640}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormRow label="Campaign name">
                <Input placeholder="e.g. Summer sale · July 4" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}/>
              </FormRow>
              <FormRow label="Type">
                <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))} style={{ ...inputCSS, appearance: "none" }}>
                  <option value="campaign">Campaign (one-time send)</option>
                  <option value="flow">Flow (triggered)</option>
                  <option value="automated">Automated sequence</option>
                </select>
              </FormRow>
            </div>
            <FormRow label="Subject line">
              <Input placeholder="e.g. Your ritual starts today, {{first_name}}" value={form.subject} onChange={e => setForm(p => ({...p, subject: e.target.value}))}/>
            </FormRow>
            <FormRow label="Preview text">
              <Input placeholder="Short preview shown in inbox before email is opened" value={form.previewText} onChange={e => setForm(p => ({...p, previewText: e.target.value}))}/>
            </FormRow>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormRow label="Audience segment">
                <select value={form.segment} onChange={e => setForm(p => ({...p, segment: e.target.value}))} style={{ ...inputCSS, appearance: "none" }}>
                  {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormRow>
              <FormRow label="Send date">
                <Input type="datetime-local" value={form.sendDate} onChange={e => setForm(p => ({...p, sendDate: e.target.value}))}/>
              </FormRow>
            </div>
            <FormRow label="Email body">
              <Textarea rows={6} placeholder="Write your email body here, or paste from your design tool…" value={form.body} onChange={e => setForm(p => ({...p, body: e.target.value}))}/>
            </FormRow>
            <div style={{ padding: 12, borderRadius: 5, background: "var(--accent-wash)", border: "1px solid var(--accent)", fontSize: 12, color: "var(--ink-2)" }}>
              ✦ <strong>Flow AI:</strong> Once saved, Flow will suggest the optimal send time, subject line A/B variants, and audience refinements.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
              <Btn variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Btn>
              <Btn onClick={() => { setCreateOpen(false); actions.notify("ok", `'${form.name || "Campaign"}' saved as draft`); }}>Save as draft</Btn>
              <Btn variant="primary" onClick={() => { setCreateOpen(false); actions.notify("ok", `'${form.name || "Campaign"}' scheduled`); }}>
                <Icon name="send" size={12}/> Schedule
              </Btn>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ───────────────────────────── SEARCH STUDIO ────────────────────────────────
function SearchStudio({ state, actions }) {
  const [activeCampaign, setActiveCampaign] = useStateS(null);
  const [createOpen, setCreateOpen] = useStateS(false);
  const [form, setForm] = useStateS({ name: "", type: "search", keywords: "", headline1: "", headline2: "", headline3: "", desc1: "", budget: "", bidding: "target-roas" });

  const RECS = [
    { title: "Brand keyword gap — 'MVEDA hair oil'",   body: "720 mo/searches, $0.40 CPC, low competition. No active search campaign capturing this brand intent.",      cta: "Create campaign" },
    { title: "Neem Cleanser — expand budget",           body: "4.2% CTR, 8.0x ROAS on $540 spend. Increase from $600 → $900/mo budget cap for ~40% more attributed revenue.", cta: "Adjust budget"   },
    { title: "Competitor conquesting — Aesop scalp",   body: "'Aesop scalp oil' gets 720 mo/searches at $1.20 CPC. MVEDA has a comparable product with stronger reviews.", cta: "Create campaign" },
  ];

  const CAMPAIGNS = [
    { id: "s1", name: "MVEDA brand keywords",        type: "Search",          budget: 300,  spend: 0,    revenue: 0,     roas: null, ctr: null, status: "draft",   keywords: "MVEDA, MVEDA hair oil, MVEDA skincare, MVEDA hair mist" },
    { id: "s2", name: "Hair Ritual — intent",        type: "Search",          budget: 500,  spend: 0,    revenue: 0,     roas: null, ctr: null, status: "draft",   keywords: "hair oil ritual, ayurvedic hair oil, botanical hair serum" },
    { id: "s3", name: "Neem Cleanser · Search",      type: "Search",          budget: 600,  spend: 540,  revenue: 4320,  roas: 8.0,  ctr: 4.2,  status: "active",  keywords: "neem face cleanser, natural neem cleanser, neem oil cleanser" },
    { id: "s4", name: "Saffron Serum · Retargeting", type: "RLSA",            budget: 400,  spend: 380,  revenue: 3220,  roas: 8.5,  ctr: 3.8,  status: "active",  keywords: "saffron serum, saffron face serum, saffron skincare" },
    { id: "s5", name: "Brand awareness · PMax",      type: "Performance Max", budget: 800,  spend: 720,  revenue: 3240,  roas: 4.5,  ctr: 1.4,  status: "paused",  keywords: "Auto-managed" },
  ];

  const totalSpend = CAMPAIGNS.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = CAMPAIGNS.reduce((s, c) => s + c.revenue, 0);
  const blendedROAS = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(1) : "—";
  const avgCTR = (CAMPAIGNS.filter(c => c.ctr).reduce((s, c) => s + c.ctr, 0) / CAMPAIGNS.filter(c => c.ctr).length).toFixed(1);

  return (
    <div className="anim-fade" style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Sticky header */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--paper)", borderBottom: "1px solid var(--rule)", padding: "18px 32px 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Studio · Search</div>
              <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em", margin: "4px 0 0" }}>Search Studio</h1>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn size="sm" variant="ghost"><Icon name="download" size={12}/> Export</Btn>
              <Btn variant="primary" onClick={() => setCreateOpen(true)}><Icon name="spark" size={13}/> Create campaign</Btn>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 28 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--gap)" }}>
            <Kpi label="Total spend" value={`$${(totalSpend/1000).toFixed(1)}k`} delta={0} unit="" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
            <Kpi label="Revenue attributed" value={`$${(totalRevenue/1000).toFixed(1)}k`} delta={12} unit="%" sparkline={[0.4,0.5,0.55,0.6,0.65,0.7,0.68,0.72,0.75,0.8,0.85]}/>
            <Kpi label="Blended ROAS" value={`${blendedROAS}x`} delta={0.4} unit="x" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
            <Kpi label="Avg CTR" value={`${avgCTR}%`} delta={0.8} unit="pp" sparkline={[0.4,0.45,0.5,0.55,0.58,0.6,0.62,0.65,0.68,0.7,0.75]}/>
          </div>

          {/* Flow recommendations */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>✦</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Flow recommends</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              {RECS.map((r, i) => (
                <FlowRec key={i} title={r.title} body={r.body} cta={r.cta} onClick={() => setCreateOpen(true)}/>
              ))}
            </div>
          </div>

          {/* Campaign table */}
          <div>
            <SHead>Campaigns</SHead>
            <Card>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 74px 74px 84px 60px 60px 80px", gap: 10, padding: "6px 0 10px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <span>Campaign</span><span>Type</span><span>Budget</span><span>Spend</span><span>Revenue</span><span>ROAS</span><span>CTR</span><span>Status</span>
              </div>
              {CAMPAIGNS.map((c, i) => (
                <div key={c.id} className="row-hover" onClick={() => setActiveCampaign(c)}
                  style={{ display: "grid", gridTemplateColumns: "1fr 110px 74px 74px 84px 60px 60px 80px", gap: 10, padding: "12px 0", borderBottom: i < CAMPAIGNS.length - 1 ? "1px solid var(--rule)" : "none", alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  <span><span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)", background: "var(--paper-2)", border: "1px solid var(--rule)", color: "var(--muted)" }}>{c.type}</span></span>
                  <span className="mono" style={{ fontSize: 11.5 }}>${c.budget}/mo</span>
                  <span className="mono" style={{ fontSize: 11.5, color: c.spend === 0 ? "var(--muted)" : "var(--ink)" }}>{c.spend > 0 ? `$${c.spend}` : "—"}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: c.revenue === 0 ? "var(--muted)" : "var(--ink)" }}>{c.revenue > 0 ? `$${(c.revenue/1000).toFixed(1)}k` : "—"}</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: c.roas ? (c.roas >= 7 ? "oklch(35% 0.1 155)" : c.roas >= 5 ? "var(--accent)" : "var(--danger)") : "var(--muted)" }}>{c.roas ? `${c.roas}x` : "—"}</span>
                  <span className="mono" style={{ fontSize: 11.5 }}>{c.ctr ? `${c.ctr}%` : "—"}</span>
                  <StatusBadge status={c.status}/>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>

      {/* Right drawer — campaign editor */}
      <Drawer open={!!activeCampaign} onClose={() => setActiveCampaign(null)} title={activeCampaign?.name || "Campaign"} width={460}
        actions={activeCampaign && (
          <>
            <Btn variant="ghost" onClick={() => setActiveCampaign(null)}>Close</Btn>
            <Btn variant="primary" onClick={() => { actions.notify("ok", `'${activeCampaign.name}' ${activeCampaign.status === "draft" ? "launched" : "updated"}`); setActiveCampaign(null); }}>
              {activeCampaign.status === "draft" ? <><Icon name="send" size={12}/> Launch</> : "Save changes"}
            </Btn>
          </>
        )}>
        {activeCampaign && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)", background: "var(--paper-2)", border: "1px solid var(--rule)", color: "var(--muted)" }}>{activeCampaign.type}</span>
              <StatusBadge status={activeCampaign.status}/>
            </div>
            {activeCampaign.roas && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[["ROAS", `${activeCampaign.roas}x`], ["CTR", `${activeCampaign.ctr}%`], ["Revenue", `$${(activeCampaign.revenue/1000).toFixed(1)}k`]].map(([l, v]) => (
                  <div key={l} style={{ padding: 10, borderRadius: 5, background: "var(--paper-2)", border: "1px solid var(--rule)", textAlign: "center" }}>
                    <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            <FormRow label="Monthly budget ($)">
              <Input type="number" defaultValue={activeCampaign.budget} key={activeCampaign.id + "-budget"}/>
            </FormRow>
            <FormRow label="Target keywords">
              <Textarea defaultValue={activeCampaign.keywords} rows={3} key={activeCampaign.id + "-kw"}/>
            </FormRow>
            <FormRow label="Headline 1"><Input defaultValue="Ayurvedic Hair Oil · MVEDA" key={activeCampaign.id + "-h1"}/></FormRow>
            <FormRow label="Headline 2"><Input defaultValue="Natural Ritual. Real Results." key={activeCampaign.id + "-h2"}/></FormRow>
            <FormRow label="Headline 3"><Input defaultValue="Free Shipping Over $60" key={activeCampaign.id + "-h3"}/></FormRow>
            <FormRow label="Description">
              <Textarea defaultValue="MVEDA's award-winning hair oil blends pure saffron, neem & botanical actives for stronger, healthier hair in 4 weeks." rows={3} key={activeCampaign.id + "-desc"}/>
            </FormRow>
            {activeCampaign.status === "draft" && (
              <div style={{ padding: 12, borderRadius: 5, background: "var(--accent-wash)", border: "1px solid var(--accent)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                ✦ <strong>Flow AI estimate:</strong> ~8,400 impressions/mo · ~270 clicks/mo · Projected ROAS: 7.2x based on similar campaigns in your account.
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create campaign dialog */}
      {createOpen && (
        <Dialog open onClose={() => setCreateOpen(false)} title="Create search campaign" width={640}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormRow label="Campaign name">
                <Input placeholder="e.g. Brand keywords · MVEDA" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}/>
              </FormRow>
              <FormRow label="Type">
                <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))} style={{ ...inputCSS, appearance: "none" }}>
                  <option value="search">Search</option>
                  <option value="pmax">Performance Max</option>
                  <option value="rlsa">RLSA (retargeting)</option>
                  <option value="shopping">Shopping</option>
                </select>
              </FormRow>
            </div>
            <FormRow label="Target keywords">
              <Textarea placeholder="One keyword or phrase per line, or comma-separated" value={form.keywords} onChange={e => setForm(p => ({...p, keywords: e.target.value}))} rows={3}/>
            </FormRow>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <FormRow label="Headline 1"><Input placeholder="MVEDA Hair Oil" value={form.headline1} onChange={e => setForm(p => ({...p, headline1: e.target.value}))}/></FormRow>
              <FormRow label="Headline 2"><Input placeholder="Natural Ritual" value={form.headline2} onChange={e => setForm(p => ({...p, headline2: e.target.value}))}/></FormRow>
              <FormRow label="Headline 3"><Input placeholder="Free shipping $60+" value={form.headline3} onChange={e => setForm(p => ({...p, headline3: e.target.value}))}/></FormRow>
            </div>
            <FormRow label="Ad description">
              <Textarea placeholder="Up to 90 characters. Clear, benefit-led copy." value={form.desc1} onChange={e => setForm(p => ({...p, desc1: e.target.value}))} rows={2}/>
            </FormRow>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormRow label="Monthly budget ($)">
                <Input type="number" placeholder="500" value={form.budget} onChange={e => setForm(p => ({...p, budget: e.target.value}))}/>
              </FormRow>
              <FormRow label="Bidding strategy">
                <select value={form.bidding} onChange={e => setForm(p => ({...p, bidding: e.target.value}))} style={{ ...inputCSS, appearance: "none" }}>
                  <option value="target-roas">Target ROAS</option>
                  <option value="target-cpa">Target CPA</option>
                  <option value="max-clicks">Maximise clicks</option>
                  <option value="manual-cpc">Manual CPC</option>
                </select>
              </FormRow>
            </div>
            <div style={{ padding: 12, borderRadius: 5, background: "var(--accent-wash)", border: "1px solid var(--accent)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
              ✦ <strong>Flow AI:</strong> Will estimate reach and projected ROAS after saving. Campaigns sync to Google Ads once a Google Ads connection is active in Connections.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
              <Btn variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Btn>
              <Btn onClick={() => { setCreateOpen(false); actions.notify("ok", `'${form.name || "Campaign"}' saved as draft`); }}>Save as draft</Btn>
              <Btn variant="primary" onClick={() => { setCreateOpen(false); actions.notify("ok", `'${form.name || "Campaign"}' launched`); }}>
                <Icon name="send" size={12}/> Launch
              </Btn>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ────────────────────────────── SETTINGS HUB ───────────────────────────────
function SettingsHub({ state, actions, go }) {
  const SECTIONS = [
    {
      id: "memory",
      label: "Brand Memory",
      icon: "shield",
      color: "var(--accent)",
      desc: "Brand voice, values, approved claims, prohibited topics, and tone modes. The source of truth for everything Flow generates.",
      stats: [
        { label: "Values", value: state?.brandValues?.length || 4 },
        { label: "Approved claims", value: state?.approvedClaims?.length || 6 },
        { label: "Prohibited topics", value: state?.prohibited?.length || 5 },
      ],
    },
    {
      id: "connections",
      label: "Connections",
      icon: "sliders",
      color: "oklch(48% 0.18 260)",
      desc: "Connect your channels — social platforms via Publer, email via Klaviyo, ad platforms, analytics, commerce, and creative AI tools.",
      stats: [
        { label: "Connected", value: Object.values(state?.connectors || {}).filter(c => c.connected).length },
        { label: "Available", value: 30 },
        { label: "Recommended", value: state?.brandPreset?.recommendedConnectors?.length || 0 },
      ],
    },
    {
      id: "autonomy",
      label: "Autonomy Settings",
      icon: "spark",
      color: "oklch(62% 0.18 160)",
      desc: "Set AI autonomy levels per channel. Control confidence thresholds, daily caps, approval queues, and SLA targets.",
      stats: [
        { label: "Mode", value: state?.autonomyMode || "assisted" },
        { label: "Channels configured", value: state?.channelRules?.length || 14 },
        { label: "Confidence threshold", value: `${state?.thresholds?.confidence || 85}%` },
      ],
    },
  ];

  const brand = state?.brandPreset;
  const brandId = state?.activeBrandId || "mveda";

  return (
    <div className="anim-fade" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 20px", borderBottom: "1px solid var(--rule)", background: "var(--paper)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Account</div>
            <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "4px 0 0" }}>Settings</h1>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Brand · Connections · Autonomy</div>
          </div>
          {brand && (
            <div style={{ padding: "10px 16px", borderRadius: 7, border: "1px solid var(--rule)", background: "var(--paper-2)", textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{brand.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{brand.url || brand.industry || ""}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Settings cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {SECTIONS.map(s => (
            <div key={s.id} style={{ padding: 22, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--rule)", borderTop: `3px solid ${s.color}`, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name={s.icon} size={16}/>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{s.label}</div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>{s.desc}</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {s.stats.map(st => (
                  <div key={st.label}>
                    <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{st.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>{st.value}</div>
                  </div>
                ))}
              </div>
              <Btn size="sm" variant="primary" onClick={() => go(s.id)}>Open {s.label} →</Btn>
            </div>
          ))}
        </div>

        {/* Quick brand overview */}
        {brand && (
          <div style={{ padding: 20, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Brand overview — {brand.name}</span>
              <Btn size="sm" variant="ghost" onClick={() => go("memory")}>Edit brand →</Btn>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Voice &amp; tone</div>
                <div style={{ fontSize: 13, fontStyle: "italic", lineHeight: 1.5, color: "var(--ink-2)" }}>"{brand.voice}"</div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Core values</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {(brand.values || []).slice(0, 3).map((v, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: "var(--ink-2)", display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 10 }}>✦</span> {v}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { StudioHub, EmailStudio, SearchStudio, SettingsHub });
