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
      desc: "Google Search campaigns — commercial refrigeration, walk-in cooler & HVAC queries",
      stat1Label: "Active campaigns", stat1: "4",
      stat2Label: "Monthly budget", stat2: "$4.8k",
      highlight: "Commercial refrig. repair · 9.4% CTR",
    },
    {
      id: "emailstudio", label: "Email Studio", color: "oklch(48% 0.18 260)",
      desc: "Service contract renewals, seasonal PM reminders & post-service follow-up flows",
      stat1Label: "Draft campaigns", stat1: "2",
      stat2Label: "Active contacts", stat2: "1,840",
      highlight: "Post-service flow · 54% open rate",
    },
    {
      id: "organic", label: "Social Studio", color: "var(--accent)",
      desc: "LinkedIn trust content, Facebook awareness & YouTube how-to for commercial clients",
      stat1Label: "Active drafts", stat1: "3",
      stat2Label: "Scheduled this week", stat2: "4",
      highlight: "LinkedIn reach +28% this month",
    },
  ];

  const STUDIOS = isErickson ? STUDIOS_ERICKSON : STUDIOS_MVEDA;

  const RECS_MVEDA = [
    { studio: "Social Studio",  title: "Hair Ritual Reel format — scale now",     body: "2.4× avg saves, 98k reach in 30d. Flow recommends doubling post frequency and extending to 60s format.",       cta: "Open Social Studio",  t: "organic"      },
    { studio: "Email Studio",   title: "Win-back flow — 847 lapsed customers",    body: "90d+ lapse segment with avg LTV $240. Draft personalised win-back copy loaded with 20% comeback offer.",         cta: "Review draft",        t: "emailstudio", urgent: true },
    { studio: "Search Studio",  title: "Brand keyword gap — 'MVEDA hair oil'",    body: "$0.40 CPC, 720 mo/searches, low competition. No active search campaign capturing this brand intent.",            cta: "Create campaign",     t: "searchstudio" },
  ];

  const RECS_ERICKSON = [
    { studio: "Search Studio",  title: "Expand to Oregon & Idaho search terms",       body: "You serve WA, OR & ID but paid search only covers Seattle. 'Commercial refrigeration repair Portland' and 'walk-in cooler service Boise' have 0 coverage — low competition, high intent.", cta: "Create campaigns",   t: "searchstudio", urgent: true },
    { studio: "Email Studio",   title: "Summer cooling prep — send by May 12",        body: "1,840 contacts, 340 accounts haven't had a PM visit in 6+ months. Draft ready with free pre-summer inspection offer for service contract holders.",                                          cta: "Review draft",       t: "emailstudio",  urgent: true },
    { studio: "Social Studio",  title: "LinkedIn case study — recognisable client",   body: "Museum of Pop Culture or O'Brien Auto Group as a case study would perform well with facility managers. Commercial social proof is your biggest trust signal for new B2B accounts.",          cta: "Open Social Studio", t: "organic" },
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
    { title: "Portland & Boise — commercial refrig. search",  studio: "Search", platform: "Google Ads · OR + ID",   date: "Awaiting review",    t: "searchstudio" },
    { title: "Erickson brand keywords · Seattle",             studio: "Search", platform: "Google Ads",             date: "Active",             t: "searchstudio" },
    { title: "Summer cooling prep · free inspection offer",   studio: "Email",  platform: "Klaviyo campaign",       date: "Send by May 12",     t: "emailstudio"  },
    { title: "Lapsed accounts · PM contract re-engagement",   studio: "Email",  platform: "Klaviyo campaign",       date: "Ready to review",    t: "emailstudio"  },
    { title: "Client case study · facility managers",         studio: "Social", platform: "LinkedIn",               date: "Draft ready",        t: "organic"      },
    { title: "Walk-in cooler compressor warning signs",       studio: "Social", platform: "YouTube",                date: "Script ready",       t: "organic"      },
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
              {isErickson ? "Search · Email · Social — campaign builders for Erickson Commercial Refrigeration" : "Social · Email · Search — all your campaign builders in one place"}
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

// Flavor #1 — Proactive email drafts. Produced by the proactive-emails cron when
// analytics_insights surface an email-actionable signal (lapsed cohort, replenish,
// rescue, cart aging, VIP quiet). Drafts land here pre-reviewed by Claude but
// NOT pushed — user clicks "Approve & push" to send to Klaviyo via /api/klaviyo.
function ProactiveEmailDrafts({ drafts, tenantId, actions }) {
  const [expanded, setExpanded] = useStateS({}); // { [id]: bool }
  const pending = (drafts || []).filter(d => d.status === "proactive_draft" || d.status === "pushing" || d.status === "failed" || d.status === "klaviyo_draft");
  if (pending.length === 0) return null;

  const ruleTone = {
    R1_winback:    { color: "oklch(60% 0.18 30)",  label: "Win-back" },
    R2_replenish:  { color: "oklch(62% 0.15 180)", label: "Replenish" },
    R3_rescue:     { color: "oklch(65% 0.16 80)",  label: "Rescue" },
    R4_cart_aging: { color: "oklch(58% 0.16 320)", label: "Cart aging" },
    R5_vip_quiet:  { color: "oklch(55% 0.14 280)", label: "VIP" },
  };

  const persistPatch = (id, patch) => {
    apiFetch("/api/proactive-emails", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, patch }),
    }).catch(() => null);
  };

  const handleApprove = (d) => {
    if (d.status === "pushing" || d.status === "klaviyo_draft") return;
    actions.updateProactiveEmail(d.id, { status: "pushing", error: null });

    apiFetch("/api/klaviyo", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        action:       "create_draft_campaign",
        subject:      d.subject,
        preheader:    d.preheader,
        bodyText:     d.body,
        audienceHint: d.audienceHint,
      }),
    })
      .then(r => r.json())
      .then(res => {
        if (res?.ok) {
          const patch = {
            status:            "klaviyo_draft",
            klaviyoTemplateId: res.templateId,
            klaviyoCampaignId: res.campaignId,
            klaviyoMessageId:  res.messageId,
            klaviyoUrl:        res.klaviyoUrl,
            audience:          res.audience,
          };
          actions.updateProactiveEmail(d.id, patch,
            { notify: { tone: "ok", text: `Email pushed to Klaviyo · ${res.audience?.name || "draft"}` } });
          persistPatch(d.id, {
            status:              "pushed",
            klaviyo_template_id: res.templateId,
            klaviyo_campaign_id: res.campaignId,
            klaviyo_message_id:  res.messageId,
            klaviyo_url:         res.klaviyoUrl,
            audience:            res.audience,
          });
        } else {
          const err = res?.error || "unknown error";
          actions.updateProactiveEmail(d.id, { status: "failed", error: err },
            { notify: { tone: "warn", text: `Klaviyo push failed: ${err}` } });
        }
      })
      .catch(e => {
        actions.updateProactiveEmail(d.id, { status: "failed", error: e.message },
          { notify: { tone: "warn", text: `Klaviyo push failed: ${e.message}` } });
      });
  };

  const handleDismiss = (d) => {
    actions.removeProactiveEmail(d.id, { notify: { tone: "neutral", text: "Proactive draft dismissed" } });
    persistPatch(d.id, { status: "dismissed" });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>✦</span>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>
          Proactive drafts · awaiting review
        </span>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{pending.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {pending.map(d => {
          const tone = ruleTone[d.rule] || { color: "var(--accent)", label: d.ruleLabel || d.rule };
          const isOpen = !!expanded[d.id];
          const pushed = d.status === "klaviyo_draft";
          const failed = d.status === "failed";
          const pushing = d.status === "pushing";
          return (
            <div key={d.id} style={{
              border:       "1px solid var(--rule-strong)",
              borderRadius: 7,
              background:   "var(--paper)",
              overflow:     "hidden",
            }}>
              {/* Header strip */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                background: "var(--paper-2)",
                borderBottom: "1px solid var(--rule)",
              }}>
                <span className="mono" style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                  color: tone.color,
                  padding: "3px 8px",
                  borderRadius: 3,
                  background: "var(--paper-3)",
                  border: `1px solid ${tone.color}`,
                }}>{tone.label}</span>
                {d.audienceHint && (
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>· {d.audienceHint}</span>
                )}
                {d.source === "fallback" && (
                  <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>demo</span>
                )}
                <span style={{ flex: 1 }}/>
                <Chip tone="accent">klaviyo</Chip>
              </div>

              {/* Subject + preheader */}
              <div style={{ padding: "14px 14px 6px", borderLeft: `3px solid ${tone.color}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{d.subject}</div>
                {d.preheader && (
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>{d.preheader}</div>
                )}
              </div>

              {/* Body — collapsed by default */}
              <div style={{
                padding: "6px 14px 12px",
                borderLeft: `3px solid ${tone.color}`,
                fontSize: 12.5, lineHeight: 1.65,
                color: "var(--ink-2)",
                whiteSpace: "pre-wrap",
                maxHeight: isOpen ? "none" : 96,
                overflow: "hidden",
                position: "relative",
              }}>
                {d.body}
                {!isOpen && d.body && d.body.length > 200 && (
                  <div style={{
                    position: "absolute", inset: "auto 0 0 0", height: 36,
                    background: "linear-gradient(to bottom, transparent, var(--paper))",
                  }}/>
                )}
              </div>

              {/* Reason line */}
              {d.reason && (
                <div style={{
                  margin: "0 14px 12px",
                  padding: "8px 10px",
                  background: "var(--paper-3)",
                  borderRadius: 4,
                  fontSize: 11, color: "var(--muted)", lineHeight: 1.5,
                }}>
                  <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Why · </span>
                  {d.reason}
                </div>
              )}

              {/* Actions */}
              <div style={{
                padding: "10px 14px",
                borderTop: "1px solid var(--rule)",
                display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
              }}>
                {!pushed && !pushing && (
                  <>
                    <Btn size="sm" variant="primary" onClick={() => handleApprove(d)}>
                      <Icon name="send" size={11}/> Approve &amp; push
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setExpanded(prev => ({ ...prev, [d.id]: !prev[d.id] }))}>
                      {isOpen ? "Collapse" : "Read more"}
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => handleDismiss(d)}>Dismiss</Btn>
                  </>
                )}
                {pushing && (
                  <span style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Dot status="warn"/> Creating template + campaign in Klaviyo…
                  </span>
                )}
                {pushed && (
                  <>
                    <span style={{ fontSize: 11.5, color: "var(--success)", fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                      <Icon name="check" size={11}/> Pushed to Klaviyo
                      {d.audience?.name && (
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                          · {d.audience.name}{d.audience.fallback ? " (fallback)" : ""}
                        </span>
                      )}
                    </span>
                    {d.klaviyoUrl && (
                      <a href={d.klaviyoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--accent-ink)", textDecoration: "underline" }}>
                        Open in Klaviyo →
                      </a>
                    )}
                  </>
                )}
                {failed && (
                  <>
                    <span style={{ fontSize: 11.5, color: "oklch(58% 0.18 25)", display: "flex", alignItems: "center", gap: 5 }}>
                      <Dot status="bad"/> Push failed{d.error ? ` · ${d.error}` : ""}
                    </span>
                    <Btn size="sm" variant="primary" onClick={() => handleApprove(d)}>Retry</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => handleDismiss(d)}>Dismiss</Btn>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChatDraftsToKlaviyo({ emails }) {
  if (!emails || emails.length === 0) return null;
  const statusMeta = {
    pushing:       { label: "Pushing…", tone: "warn" },
    klaviyo_draft: { label: "In Klaviyo", tone: "ok" },
    failed:        { label: "Failed",    tone: "bad" },
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>✉︎</span>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Chat drafts → Klaviyo</span>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{emails.length}</span>
      </div>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 110px 90px", gap: 10, padding: "6px 0 10px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>Subject</span><span>Audience</span><span>Status</span><span>Link</span>
        </div>
        {emails.map((e, i) => {
          const meta = statusMeta[e.status] || { label: e.status, tone: "neutral" };
          const dotColor = meta.tone === "ok" ? "var(--success)" : meta.tone === "warn" ? "oklch(72% 0.12 70)" : meta.tone === "bad" ? "oklch(58% 0.18 25)" : "var(--muted)";
          return (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1fr 160px 110px 90px", gap: 10, padding: "12px 0", borderBottom: i < emails.length - 1 ? "1px solid var(--rule)" : "none", alignItems: "center", fontSize: 13 }}>
              <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.subject}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {e.audience?.name || e.audienceHint || "—"}
                {e.audience?.fallback && <span style={{ fontSize: 10.5, opacity: 0.7 }}> (fallback)</span>}
              </span>
              <span style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 6 }} title={e.error || ""}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, display: "inline-block" }}/>
                {meta.label}
              </span>
              <span>
                {e.klaviyoUrl
                  ? <a href={e.klaviyoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "var(--accent-ink)", textDecoration: "underline" }}>Open ↗</a>
                  : <span style={{ fontSize: 11.5, color: "var(--muted)" }}>—</span>}
              </span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function EmailStudio({ state, actions }) {
  const isErickson = state?.activeBrandId === "erickson";

  const [tab, setTab] = useStateS("overview");
  const [activeDraft, setActiveDraft] = useStateS(null);
  const [createOpen, setCreateOpen] = useStateS(false);
  const defaultSegment = isErickson ? "All contacts" : "All subscribers";
  const [form, setForm] = useStateS({ name: "", type: "campaign", subject: "", previewText: "", segment: defaultSegment, sendDate: "", body: "" });

  const RECS = isErickson ? [
    { title: "Summer cooling prep — send by May 12",    body: "1,840 contacts, 340 accounts 6+ months without a PM visit. Draft ready with free pre-summer inspection offer.",              cta: "Review draft",  draftId: "e-sc", urgent: true },
    { title: "Lapsed accounts — PM contract re-engage", body: "340 accounts with $0 revenue in 18 months. Avg contract value $8,400. Free inspection offer projected 14–18% conversion.", cta: "Review draft",  draftId: "e-la", urgent: true },
    { title: "Post-service flow — A/B test subject",    body: "54.2% open rate is well above B2B benchmark. Test a more direct subject line to push past 58% and increase contract upsells.", cta: "Create variant", draftId: null   },
  ] : [
    { title: "Win-back · 847 lapsed customers",      body: "90d+ lapse, avg LTV $240. Draft ready with personalised 20% off comeback offer.",                 cta: "Review draft",    draftId: "d-wb", urgent: true },
    { title: "Welcome flow — A/B test subject line",  body: "58.2% open rate is strong. A/B test a curiosity subject to push past 62% industry benchmark.",    cta: "Create variant",  draftId: null    },
    { title: "Mother's Day — schedule by May 9",      body: "4,200 gifter segment, copy ready. 8 days to deadline — optimal delivery 5 days before holiday.",  cta: "Schedule now",    draftId: "d-md", urgent: true },
  ];

  const CAMPAIGNS_ERICKSON = [
    { id: "e-sc",  name: "Summer cooling prep · free inspection",  type: "campaign", segment: "All contacts",            sends: 1840, openRate: null, revenue: null,  status: "draft",  date: "Send by May 12",    subject: "Before summer hits — is your refrigeration ready?",            previewText: "Free pre-season inspection for service contract holders.", body: "Hi {{first_name}},\n\nSummer is 6 weeks out — the busiest season for commercial refrigeration failures.\n\nAs an Erickson service contract holder, you qualify for a free pre-season inspection before June 1st.\n\nBook your slot before they fill up →\n\nErickson Commercial Refrigeration\n(206) 789-4722 · Available 24/7" },
    { id: "e-la",  name: "Lapsed accounts · PM contract offer",   type: "campaign", segment: "Lapsed accounts (18mo+)",  sends: 340,  openRate: null, revenue: null,  status: "draft",  date: "Ready to review",   subject: "It's been a while — let's make sure you're covered",           previewText: "Free inspection · no obligation.",                         body: "Hi {{first_name}},\n\nWe haven't seen you in a while, and with summer peak season approaching, we wanted to reach out.\n\nWe're offering a complimentary inspection for past Erickson clients — no commitment, no obligation.\n\nIf anything needs attention, we'll walk you through it with transparent pricing.\n\nSchedule your free inspection →\n\nErickson Commercial Refrigeration" },
    { id: "e-ps",  name: "Post-service follow-up",                 type: "flow",     segment: "Recent service visits",   sends: 980,  openRate: 54.2, revenue: 24500, status: "live",   date: "Ongoing",           subject: "How did we do, {{first_name}}?",                               previewText: "Your service summary is inside.",                          body: "" },
    { id: "e-cr",  name: "Service contract renewal",               type: "flow",     segment: "Contracts expiring 60d",  sends: 340,  openRate: 44.8, revenue: 38400, status: "live",   date: "Ongoing",           subject: "Your service contract renews in 60 days — let's talk",        previewText: "Early renewal locks in current pricing.",                  body: "" },
    { id: "e-sp",  name: "Spring PM reminder",                     type: "campaign", segment: "All contacts",            sends: 1840, openRate: 38.6, revenue: 32000, status: "sent",   date: "Sent Mar 28",       subject: "Spring is here — is your walk-in cooler ready?",              previewText: "",                                                         body: "" },
  ];

  const CAMPAIGNS_MVEDA = [
    { id: "d-wb",  name: "Win-back · 90d lapsed",          type: "flow",     segment: "Lapsed 90d+",     sends: 847,   openRate: null, revenue: null,  status: "draft",     date: "Ready to activate",  subject: "We miss you, {{first_name}} — something special inside",          previewText: "Your ritual is waiting.",        body: "Hi {{first_name}},\n\nIt's been a while. We miss you.\n\nAs a thank-you for being part of the MVEDA community, here's 20% off your next order.\n\nCode: COMEBACK20 · valid 7 days.\n\nWith love,\nMVEDA" },
    { id: "d-md",  name: "Mother's Day · gifters",          type: "campaign", segment: "Gifters",         sends: 4200,  openRate: null, revenue: null,  status: "draft",     date: "Schedule by May 9",  subject: "A ritual for the woman who gave you everything",                  previewText: "Gift her the MVEDA collection.", body: "This Mother's Day, give the gift of ritual.\n\nOur Saffron + Hair Oil gift set — beautifully wrapped, delivered by May 10th when you order today.\n\nShop the gift collection →\n\nWith love,\nMVEDA" },
    { id: "d-vip", name: "VIP early access · Hair Ritual",  type: "campaign", segment: "VIP (2× buyers)", sends: 1840,  openRate: null, revenue: null,  status: "draft",     date: "Ready to schedule",  subject: "Before anyone else — your exclusive first look",                  previewText: "VIP access starts tomorrow.",    body: "Hi {{first_name}},\n\nAs one of our most loyal customers, you get first access to the new Hair Ritual collection — 24 hours before it goes public.\n\nShop your early access →\n\nMVEDA" },
    { id: "l-ws",  name: "Welcome series",                  type: "flow",     segment: "New subscribers", sends: 1840,  openRate: 58.2, revenue: 18200, status: "live",      date: "Ongoing",            subject: "Welcome to MVEDA — your ritual starts here",                     previewText: "Three drops. Palms warmed.",     body: "" },
    { id: "l-ba",  name: "Browse abandonment · 24h",        type: "flow",     segment: "Browsers",        sends: 3240,  openRate: 42.1, revenue: 12400, status: "live",      date: "Ongoing",            subject: "You left something behind, {{first_name}}",                      previewText: "Still thinking about it?",       body: "" },
    { id: "s-ss",  name: "Saffron Serum launch",            type: "campaign", segment: "Full list",       sends: 24100, openRate: 34.8, revenue: 14200, status: "sent",      date: "Sent Apr 18",        subject: "Introducing Saffron Serum — our most concentrated formula yet",  previewText: "",                               body: "" },
    { id: "s-ri",  name: "Ritual subscription nudge",       type: "campaign", segment: "1× buyers",       sends: 18400, openRate: 36.4, revenue: 8240,  status: "sent",      date: "Sent Apr 6",         subject: "Make your ritual a habit, {{first_name}}",                       previewText: "Subscribe & save 15%.",          body: "" },
  ];

  const CAMPAIGNS = isErickson ? CAMPAIGNS_ERICKSON : CAMPAIGNS_MVEDA;

  const SEGMENTS = isErickson
    ? ["All contacts", "Service contract holders", "Lapsed accounts (18mo+)", "Contracts expiring 60d", "Restaurant clients", "Grocery & retail", "Commercial kitchens", "New accounts (90d)"]
    : ["All subscribers", "VIP (2× buyers)", "Lapsed 90d+", "New (30d)", "High engagement", "Gifters", "Browse abandoners", "1× buyers"];

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
                {isErickson ? <>
                  <Kpi label="Avg open rate"    value="44.8%" delta={4.2}  unit="pp" sparkline={[0.4,0.45,0.5,0.55,0.58,0.62,0.68,0.72,0.75,0.8,0.85]}/>
                  <Kpi label="Avg CTR"          value="16.3%" delta={2.4}  unit="pp" sparkline={[0.4,0.45,0.5,0.55,0.58,0.6,0.62,0.65,0.68,0.7,0.75]}/>
                  <Kpi label="Email revenue"    value="$94.9k" delta={18}  unit="%" sparkline={[0.3,0.4,0.5,0.55,0.6,0.65,0.7,0.72,0.76,0.8,0.85]}/>
                  <Kpi label="Active contacts"  value="1,840"  delta={84}  unit="" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
                </> : <>
                  <Kpi label="Avg open rate" value="40.2%" delta={3.2} unit="pp" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
                  <Kpi label="Avg CTR" value="7.3%" delta={1.1} unit="pp" sparkline={[0.4,0.45,0.5,0.55,0.58,0.6,0.62,0.65,0.68,0.7,0.75]}/>
                  <Kpi label="Email revenue" value="$59.2k" delta={14} unit="%" sparkline={[0.3,0.4,0.5,0.55,0.6,0.65,0.7,0.72,0.76,0.8,0.85]}/>
                  <Kpi label="Subscribers" value="24,118" delta={412} unit="" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
                </>}
              </div>

              {/* Proactive email drafts — analytics-triggered, awaiting human review */}
              <ProactiveEmailDrafts
                drafts={state?.outbound?.proactiveEmails || []}
                tenantId={state?.auth?.id}
                actions={actions}
              />

              {/* Chat drafts pushed to Klaviyo */}
              <ChatDraftsToKlaviyo emails={state?.outbound?.emails || []}/>

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
              <Input placeholder={isErickson ? "e.g. Before summer hits — is your refrigeration ready?" : "e.g. Your ritual starts today, {{first_name}}"} value={form.subject} onChange={e => setForm(p => ({...p, subject: e.target.value}))}/>
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
// ── Google Ads API helpers (browser-side calls to our edge functions) ────────

const BLANK_FORM = {
  name: "", type: "search", keywordsRaw: "",
  headlines: ["", "", ""],   // start with 3; user can add up to 15
  descriptions: ["", ""],    // start with 2; up to 4
  budget: "", bidding: "target-roas", finalUrl: "",
};

async function gadsCall(action, params) {
  const res = await apiFetch("/api/google-ads", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ action, ...params }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Google Ads API error");
  return data.data;
}

function useGoogleAds(tenantId) {
  const [campaigns, setCampaigns] = useStateS([]);
  const [loading,   setLoading]   = useStateS(false);
  const [error,     setError]     = useStateS(null);
  const [connected, setConnected] = useStateS(false);

  function load() {
    setLoading(true); setError(null);
    gadsCall("list_campaigns", {}, tenantId)
      .then(data => { setCampaigns(data); setConnected(true); })
      .catch(err => {
        const msg = err.message || "";
        if (msg.includes("No Google Ads token")) setConnected(false);
        else setError(msg);
        // Fall back to seed data so UI always shows something
        setConnected(c => c); // no-op to avoid double-set
      })
      .finally(() => setLoading(false));
  }

  return { campaigns, setCampaigns, loading, error, connected, load };
}

// ── SearchStudio component ───────────────────────────────────────────────────

function SearchStudio({ state, actions }) {
  const isErickson = state?.activeBrandId === "erickson";
  const tenantId   = state?.activeBrandId || "mveda";
  const brand      = state?.brandPreset;

  // Panels
  const [tab,            setTab]            = useStateS("campaigns"); // campaigns | keywords | copy
  const [activeCampaign, setActiveCampaign] = useStateS(null);
  const [createOpen,     setCreateOpen]     = useStateS(false);
  const [detailLoading,  setDetailLoading]  = useStateS(false);
  const [detail,         setDetail]         = useStateS(null);

  // Campaign form
  const [form,     setForm]     = useStateS({ ...BLANK_FORM });
  const [creating, setCreating] = useStateS(false);
  const [budgetEdit, setBudgetEdit] = useStateS("");

  // Keyword research
  const [kwSeeds,   setKwSeeds]   = useStateS("");
  const [kwResults, setKwResults] = useStateS([]);
  const [kwLoading, setKwLoading] = useStateS(false);

  // AI copy gen
  const [copyProduct,  setCopyProduct]  = useStateS(brand?.name || "");
  const [copyKeywords, setCopyKeywords] = useStateS("");
  const [copyTone,     setCopyTone]     = useStateS(brand?.voice || "");
  const [copyUrl,      setCopyUrl]      = useStateS(brand?.url || "");
  const [copyLoading,  setCopyLoading]  = useStateS(false);
  const [generatedCopy, setGeneratedCopy] = useStateS(null);

  // Live data
  const { campaigns: liveCampaigns, setCampaigns: setLiveCampaigns, loading, error, connected, load } = useGoogleAds(tenantId);

  // Seed / fallback campaigns
  const SEED_ERICKSON = [
    { id: "s1", name: "Commercial refrig. repair · Seattle",  type: "SEARCH", budgetMonth: 2800, spend: 2540, revenue: 22400, roas: 8.8, ctr: 9.4, status: "enabled",  keywords: "commercial refrigeration repair, commercial fridge repair Seattle, walk-in cooler repair WA" },
    { id: "s2", name: "Walk-in cooler service · WA",          type: "SEARCH", budgetMonth: 1400, spend: 1240, revenue: 10800, roas: 8.7, ctr: 7.8, status: "enabled",  keywords: "walk-in cooler service, walk-in freezer repair, commercial freezer repair" },
    { id: "s3", name: "Erickson brand keywords",              type: "SEARCH", budgetMonth: 600,  spend: 520,  revenue: 4160,  roas: 8.0, ctr: 5.2, status: "enabled",  keywords: "Erickson refrigeration, Erickson HVAC, Erickson commercial refrigeration Seattle" },
    { id: "s4", name: "Commercial refrig. · Portland & OR",   type: "SEARCH", budgetMonth: 1200, spend: 0,    revenue: 0,     roas: null, ctr: null, status: "paused",   keywords: "commercial refrigeration Portland, walk-in cooler service Oregon" },
    { id: "s5", name: "Commercial HVAC · Boise & Idaho",      type: "SEARCH", budgetMonth: 800,  spend: 0,    revenue: 0,     roas: null, ctr: null, status: "paused",   keywords: "commercial HVAC Boise, commercial refrigeration Idaho" },
  ];
  const SEED_MVEDA = [
    { id: "s1", name: "MVEDA brand keywords",        type: "SEARCH",           budgetMonth: 300,  spend: 0,    revenue: 0,     roas: null, ctr: null, status: "paused",  keywords: "MVEDA, MVEDA hair oil, MVEDA skincare" },
    { id: "s2", name: "Hair Ritual — intent",        type: "SEARCH",           budgetMonth: 500,  spend: 0,    revenue: 0,     roas: null, ctr: null, status: "paused",  keywords: "hair oil ritual, ayurvedic hair oil, botanical hair serum" },
    { id: "s3", name: "Neem Cleanser · Search",      type: "SEARCH",           budgetMonth: 600,  spend: 540,  revenue: 4320,  roas: 8.0,  ctr: 4.2,  status: "enabled", keywords: "neem face cleanser, natural neem cleanser" },
    { id: "s4", name: "Saffron Serum · Retargeting", type: "SEARCH",           budgetMonth: 400,  spend: 380,  revenue: 3220,  roas: 8.5,  ctr: 3.8,  status: "enabled", keywords: "saffron serum, saffron face serum" },
    { id: "s5", name: "Brand awareness · PMax",      type: "PERFORMANCE_MAX",  budgetMonth: 800,  spend: 720,  revenue: 3240,  roas: 4.5,  ctr: 1.4,  status: "enabled", keywords: "Auto-managed" },
  ];

  const seedCampaigns = isErickson ? SEED_ERICKSON : SEED_MVEDA;
  const CAMPAIGNS     = liveCampaigns.length ? liveCampaigns : seedCampaigns;

  // Load on mount
  React.useEffect(() => { load(); }, [tenantId]);

  // Open campaign → load detail
  function openCampaign(c) {
    setActiveCampaign(c);
    setDetail(null);
    setBudgetEdit(String(c.budgetMonth || c.budget || ""));
    if (c.id && !c.id.startsWith("s")) {
      setDetailLoading(true);
      gadsCall("campaign_detail", { campaignId: c.id }, tenantId)
        .then(d => setDetail(d))
        .catch(() => {})
        .finally(() => setDetailLoading(false));
    }
  }

  // Launch / pause
  function toggleStatus(c) {
    const next = c.status === "enabled" ? "pause_campaign" : "enable_campaign";
    const label = c.status === "enabled" ? "paused" : "launched";
    gadsCall(next, { campaignId: c.id }, tenantId)
      .then(() => {
        setLiveCampaigns(cs => cs.map(x => x.id === c.id ? { ...x, status: c.status === "enabled" ? "paused" : "enabled" } : x));
        if (activeCampaign?.id === c.id) setActiveCampaign(a => ({ ...a, status: label === "paused" ? "paused" : "enabled" }));
        actions.notify("ok", `'${c.name}' ${label}`);
        setActiveCampaign(null);
      })
      .catch(err => actions.notify("error", err.message));
  }

  // Budget save
  function saveBudget(c) {
    const monthly = parseInt(budgetEdit, 10);
    if (!monthly || isNaN(monthly)) return;
    gadsCall("update_budget", { campaignId: c.id, budgetMonthly: monthly }, tenantId)
      .then(() => {
        setLiveCampaigns(cs => cs.map(x => x.id === c.id ? { ...x, budgetMonth: monthly } : x));
        actions.notify("ok", `Budget updated to $${monthly}/mo`);
      })
      .catch(err => actions.notify("error", err.message));
  }

  // Create campaign
  async function submitCreate(launch) {
    if (!form.name) { actions.notify("error", "Campaign name is required"); return; }
    setCreating(true);
    try {
      const keywords = form.keywordsRaw.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
      const headlines    = form.headlines.filter(Boolean);
      const descriptions = form.descriptions.filter(Boolean);
      const result = await gadsCall("create_campaign", {
        name:            form.name,
        type:            form.type,
        keywords,
        headlines:       headlines.length ? headlines : [`${brand?.name || "We"} — ${form.name}`, "Call Us Today", "Free Quote"],
        descriptions:    descriptions.length ? descriptions : ["Get a free quote. Serving WA, OR & ID.", "Commercial refrigeration experts. Call now."],
        budgetMonthly:   parseInt(form.budget, 10) || 500,
        biddingStrategy: form.bidding,
        finalUrl:        form.finalUrl || brand?.url || "",
      }, tenantId);

      // Optimistically add to list
      setLiveCampaigns(cs => [{ ...result, budgetMonth: parseInt(form.budget, 10) || 500, spend: 0, revenue: 0, roas: null, ctr: null, clicks: 0, impressions: 0, type: form.type.toUpperCase() }, ...cs]);
      actions.notify("ok", `'${form.name}' created${launch ? " and launched" : " as draft"}`);
      setCreateOpen(false);
      setForm({ ...BLANK_FORM });
    } catch (err) {
      actions.notify("error", err.message);
    }
    setCreating(false);
  }

  // Keyword research
  function runKeywordResearch() {
    const seeds = kwSeeds.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    if (!seeds.length) return;
    setKwLoading(true);
    gadsCall("keyword_ideas", { seedKeywords: seeds, url: brand?.url }, tenantId)
      .then(r => setKwResults(r))
      .catch(err => {
        // Fallback demo data
        setKwResults([
          { keyword: seeds[0], avgMonthlySearches: 880, competition: "MEDIUM", lowCpc: 0.80, highCpc: 2.40 },
          { keyword: seeds[0] + " near me", avgMonthlySearches: 480, competition: "LOW", lowCpc: 0.60, highCpc: 1.80 },
          { keyword: "best " + seeds[0], avgMonthlySearches: 320, competition: "LOW", lowCpc: 0.50, highCpc: 1.60 },
          { keyword: seeds[0] + " service", avgMonthlySearches: 260, competition: "MEDIUM", lowCpc: 1.20, highCpc: 3.00 },
          { keyword: "affordable " + seeds[0], avgMonthlySearches: 140, competition: "LOW", lowCpc: 0.40, highCpc: 1.20 },
        ]);
      })
      .finally(() => setKwLoading(false));
  }

  // AI copy gen
  function runCopyGen() {
    if (!copyProduct) return;
    setCopyLoading(true);
    const keywords = copyKeywords.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    apiFetch("/api/google-ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate_copy",
        brandName: brand?.name || copyProduct,
        productName: copyProduct,
        keywords: keywords.length ? keywords : [copyProduct],
        tone: copyTone || brand?.voice,
        url: copyUrl || brand?.url,
      }),
    })
      .then(r => r.json())
      .then(d => setGeneratedCopy(d))
      .catch(() => setGeneratedCopy({
        headlines: [
          copyProduct + " — Call Today", "Free Quote. Fast Service.", "Trusted Since 2005",
          "Licensed & Insured", "Same-Day Response", "Commercial Specialists",
          "{KeyWord:" + copyProduct + "}", "Serving WA · OR · ID", "24/7 Emergency Line",
          "Competitive Rates", "Expert Technicians", "No Hidden Fees",
          "5★ Google Reviews", "Get Started Today →", "Warranty on All Work",
        ],
        descriptions: [
          "Expert " + copyProduct + " services. Free estimates. Licensed & insured. Call now.",
          "Serving businesses across the Pacific Northwest. Fast response, fair prices.",
          "Commercial refrigeration & HVAC specialists. 20+ years. Call for a free quote.",
          "Same-day service available. Trusted by 500+ businesses. Get your free estimate.",
        ],
      }))
      .finally(() => setCopyLoading(false));
  }

  // KPIs
  const totalSpend   = CAMPAIGNS.reduce((s, c) => s + (c.spend || 0), 0);
  const totalRevenue = CAMPAIGNS.reduce((s, c) => s + (c.revenue || 0), 0);
  const blendedROAS  = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(1) : "—";
  const ctrs         = CAMPAIGNS.filter(c => c.ctr);
  const avgCTR       = ctrs.length ? (ctrs.reduce((s, c) => s + c.ctr, 0) / ctrs.length).toFixed(1) : "—";
  const activeCount  = CAMPAIGNS.filter(c => c.status === "enabled" || c.status === "active").length;

  // Flow recommendations
  const RECS = isErickson ? [
    { title: "Expand to Oregon — zero coverage gap", body: "'Commercial refrigeration repair Portland' — high intent, low competition, you serve the area but have $0 spend.", cta: "Create campaign", urgent: true },
    { title: "Idaho search terms — Boise opportunity", body: "'Commercial HVAC repair Boise' — you're licensed to serve ID. No competitor owns this yet.", cta: "Create campaign" },
    { title: "Increase Seattle budget — summer demand", body: "Commercial cooling searches up 28% MoM. Current budget may be capping impressions.", cta: "Adjust budget", urgent: true },
  ] : [
    { title: "Brand keyword gap — 'MVEDA hair oil'", body: "720 mo/searches, $0.40 CPC, low competition. No active campaign capturing brand intent.", cta: "Create campaign" },
    { title: "Neem Cleanser — expand budget", body: "4.2% CTR, 8.0x ROAS. Increase from $600 → $900/mo for ~40% more revenue.", cta: "Adjust budget" },
    { title: "Competitor conquesting — Aesop scalp", body: "'Aesop scalp oil' 720 mo/searches, $1.20 CPC. MVEDA has a comparable product.", cta: "Create campaign" },
  ];

  const TAB_STYLE = (t) => ({
    padding: "6px 14px", borderRadius: 5, fontSize: 12.5, fontWeight: tab === t ? 600 : 400,
    background: tab === t ? "var(--accent)" : "transparent",
    color: tab === t ? "white" : "var(--muted)",
    border: "none", cursor: "pointer",
  });

  return (
    <div className="anim-fade" style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--paper)", borderBottom: "1px solid var(--rule)", padding: "18px 32px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Studio · Search</div>
                <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em", margin: "4px 0 0" }}>Search Studio</h1>
              </div>
              {/* Connection status */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, border: "1px solid var(--rule)", background: "var(--paper-2)", fontSize: 11.5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "oklch(62% 0.18 155)" : "var(--muted)", display: "inline-block" }}/>
                <span className="mono" style={{ color: connected ? "oklch(35% 0.1 155)" : "var(--muted)" }}>
                  {loading ? "syncing…" : connected ? "Google Ads live" : "seed data"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 2, padding: "3px", borderRadius: 7, background: "var(--paper-2)", border: "1px solid var(--rule)", marginRight: 6 }}>
                <button style={TAB_STYLE("campaigns")} onClick={() => setTab("campaigns")}>Campaigns</button>
                <button style={TAB_STYLE("keywords")}  onClick={() => setTab("keywords")}>Keyword Research</button>
                <button style={TAB_STYLE("copy")}      onClick={() => setTab("copy")}>AI Copy Gen</button>
              </div>
              <Btn size="sm" variant="ghost" onClick={load}><Icon name="refresh" size={12}/></Btn>
              <Btn variant="primary" onClick={() => setCreateOpen(true)}><Icon name="spark" size={13}/> Create campaign</Btn>
            </div>
          </div>
          {error && (
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 5, background: "var(--danger-wash,#fef2f2)", border: "1px solid var(--danger,oklch(55% 0.18 25))", fontSize: 12, color: "var(--danger,oklch(40% 0.18 25))" }}>
              ⚠ Google Ads: {error}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── CAMPAIGNS TAB ── */}
          {tab === "campaigns" && (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--gap)" }}>
                <Kpi label="Active campaigns" value={String(activeCount)}      delta={0}   unit=""  sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
                <Kpi label="Total spend/mo"   value={`$${(totalSpend/1000).toFixed(1)}k`}  delta={isErickson ? 8 : 0}  unit="%" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
                <Kpi label={isErickson ? "Revenue (contracts)" : "Revenue attributed"} value={`$${(totalRevenue/1000).toFixed(1)}k`} delta={12} unit="%" sparkline={[0.4,0.5,0.55,0.6,0.65,0.7,0.68,0.72,0.75,0.8,0.85]}/>
                <Kpi label="Blended ROAS"     value={`${blendedROAS}x`}        delta={0.4} unit="x" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
                <Kpi label="Avg CTR"          value={`${avgCTR}%`}             delta={0.8} unit="pp" sparkline={[0.4,0.45,0.5,0.55,0.58,0.6,0.62,0.65,0.68,0.7,0.75]}/>
              </div>

              {/* Flow recs */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>✦</span>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Flow recommends</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  {RECS.map((r, i) => (
                    <FlowRec key={i} title={r.title} body={r.body} cta={r.cta} urgent={r.urgent} onClick={() => setCreateOpen(true)}/>
                  ))}
                </div>
              </div>

              {/* Campaign table */}
              <div>
                <SHead>Campaigns</SHead>
                <Card>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px 80px 90px 60px 60px 90px", gap: 10, padding: "6px 0 10px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <span>Campaign</span><span>Type</span><span>Budget</span><span>Spend</span><span>Revenue</span><span>ROAS</span><span>CTR</span><span>Status</span>
                  </div>
                  {CAMPAIGNS.map((c, i) => (
                    <div key={c.id} className="row-hover" onClick={() => openCampaign(c)}
                      style={{ display: "grid", gridTemplateColumns: "1fr 140px 80px 80px 90px 60px 60px 90px", gap: 10, padding: "12px 0", borderBottom: i < CAMPAIGNS.length - 1 ? "1px solid var(--rule)" : "none", alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                      <span><span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)", background: "var(--paper-2)", border: "1px solid var(--rule)", color: "var(--muted)" }}>{c.type}</span></span>
                      <span className="mono" style={{ fontSize: 11.5 }}>${c.budgetMonth || c.budget || "—"}/mo</span>
                      <span className="mono" style={{ fontSize: 11.5, color: !c.spend ? "var(--muted)" : "var(--ink)" }}>{c.spend ? `$${c.spend}` : "—"}</span>
                      <span className="mono" style={{ fontSize: 11.5, color: !c.revenue ? "var(--muted)" : "var(--ink)" }}>{c.revenue ? `$${(c.revenue/1000).toFixed(1)}k` : "—"}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: c.roas ? (c.roas >= 7 ? "oklch(35% 0.1 155)" : c.roas >= 5 ? "var(--accent)" : "var(--danger)") : "var(--muted)" }}>{c.roas ? `${c.roas}x` : "—"}</span>
                      <span className="mono" style={{ fontSize: 11.5 }}>{c.ctr ? `${c.ctr}%` : "—"}</span>
                      <StatusBadge status={c.status}/>
                    </div>
                  ))}
                </Card>
              </div>
            </>
          )}

          {/* ── KEYWORD RESEARCH TAB ── */}
          {tab === "keywords" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ padding: 20, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--rule)" }}>
                <SHead>Keyword Research</SHead>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "flex-end" }}>
                  <FormRow label="Seed keywords (one per line or comma-separated)">
                    <Textarea value={kwSeeds} onChange={e => setKwSeeds(e.target.value)} rows={3}
                      placeholder={isErickson
                        ? "commercial refrigeration repair\nwalk-in cooler service\nHVAC contractor Seattle"
                        : "ayurvedic hair oil\nneem face cleanser\nsaffron serum"}/>
                  </FormRow>
                  <Btn variant="primary" onClick={runKeywordResearch} style={{ alignSelf: "flex-end", marginBottom: 2 }}>
                    {kwLoading ? "Researching…" : <><Icon name="spark" size={12}/> Get ideas</>}
                  </Btn>
                </div>
              </div>

              {kwResults.length > 0 && (
                <Card>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 100px 80px 80px 100px", gap: 10, padding: "6px 0 10px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <span>Keyword</span><span>Mo. Searches</span><span>Competition</span><span>Low CPC</span><span>High CPC</span><span></span>
                  </div>
                  {kwResults.map((r, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px 100px 80px 80px 100px", gap: 10, padding: "11px 0", borderBottom: i < kwResults.length - 1 ? "1px solid var(--rule)" : "none", alignItems: "center", fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{r.keyword}</span>
                      <span className="mono" style={{ fontSize: 12 }}>{r.avgMonthlySearches?.toLocaleString() || "—"}</span>
                      <span>
                        <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)",
                          background: r.competition === "LOW" ? "var(--success-wash)" : r.competition === "HIGH" ? "oklch(96% 0.02 25)" : "var(--paper-2)",
                          color: r.competition === "LOW" ? "oklch(35% 0.1 155)" : r.competition === "HIGH" ? "oklch(50% 0.18 25)" : "var(--muted)",
                          border: "1px solid var(--rule)" }}>
                          {r.competition || "—"}
                        </span>
                      </span>
                      <span className="mono" style={{ fontSize: 12 }}>{r.lowCpc ? `$${r.lowCpc}` : "—"}</span>
                      <span className="mono" style={{ fontSize: 12 }}>{r.highCpc ? `$${r.highCpc}` : "—"}</span>
                      <Btn size="sm" variant="ghost" onClick={() => {
                        setKwSeeds(s => s ? s + "\n" + r.keyword : r.keyword);
                        setTab("campaigns"); setCreateOpen(true);
                        setForm(f => ({ ...f, keywordsRaw: f.keywordsRaw ? f.keywordsRaw + "\n" + r.keyword : r.keyword }));
                      }}>Add to campaign</Btn>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          )}

          {/* ── AI COPY GEN TAB ── */}
          {tab === "copy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ padding: 20, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--rule)" }}>
                <SHead>AI Ad Copy Generator</SHead>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <FormRow label="Product / service">
                      <Input value={copyProduct} onChange={e => setCopyProduct(e.target.value)}
                        placeholder={isErickson ? "Commercial refrigeration repair" : "Ayurvedic hair oil"}/>
                    </FormRow>
                    <FormRow label="Landing page URL">
                      <Input value={copyUrl} onChange={e => setCopyUrl(e.target.value)} placeholder="https://…"/>
                    </FormRow>
                  </div>
                  <FormRow label="Target keywords">
                    <Textarea value={copyKeywords} onChange={e => setCopyKeywords(e.target.value)} rows={2}
                      placeholder={isErickson ? "commercial refrigeration repair, walk-in cooler service Seattle" : "ayurvedic hair oil, botanical hair serum"}/>
                  </FormRow>
                  <FormRow label="Brand tone / voice">
                    <Input value={copyTone} onChange={e => setCopyTone(e.target.value)} placeholder="Professional, trustworthy, direct — or paste your brand voice…"/>
                  </FormRow>
                  <Btn variant="primary" onClick={runCopyGen} style={{ alignSelf: "flex-start" }}>
                    {copyLoading ? "Generating…" : <><Icon name="spark" size={12}/> Generate ad copy</>}
                  </Btn>
                </div>
              </div>

              {generatedCopy && (
                <>
                  <div style={{ padding: 20, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--rule)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Headlines <span className="mono" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>({generatedCopy.headlines?.length || 0}/15) · max 30 chars each</span></span>
                      <Btn size="sm" variant="ghost" onClick={runCopyGen}>Regenerate</Btn>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      {(generatedCopy.headlines || []).map((h, i) => (
                        <div key={i} style={{ padding: "8px 12px", borderRadius: 5, background: "var(--paper-2)", border: "1px solid var(--rule)", fontSize: 12.5 }}>
                          <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)", marginRight: 6 }}>{i+1}</span>
                          {h}
                          <span className="mono" style={{ fontSize: 9.5, color: h.length > 30 ? "var(--danger)" : "var(--muted)", marginLeft: 6 }}>{h.length}/30</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: 20, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--rule)" }}>
                    <div style={{ marginBottom: 14 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Descriptions <span className="mono" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>({generatedCopy.descriptions?.length || 0}/4) · max 90 chars each</span></span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(generatedCopy.descriptions || []).map((d, i) => (
                        <div key={i} style={{ padding: "10px 14px", borderRadius: 5, background: "var(--paper-2)", border: "1px solid var(--rule)", fontSize: 12.5, lineHeight: 1.5 }}>
                          <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)", marginRight: 6 }}>{i+1}</span>
                          {d}
                          <span className="mono" style={{ fontSize: 9.5, color: d.length > 90 ? "var(--danger)" : "var(--muted)", marginLeft: 8 }}>{d.length}/90</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <Btn variant="primary" onClick={() => {
                        setTab("campaigns"); setCreateOpen(true);
                        setForm(f => ({
                          ...f,
                          headlines:    (generatedCopy.headlines || []).slice(0, 15),
                          descriptions: (generatedCopy.descriptions || []).slice(0, 4),
                          name:         f.name || copyProduct,
                          keywordsRaw:  f.keywordsRaw || copyKeywords,
                        }));
                      }}><Icon name="send" size={12}/> Use in new campaign</Btn>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right drawer — campaign detail + editor */}
      <Drawer open={!!activeCampaign} onClose={() => setActiveCampaign(null)} title={activeCampaign?.name || "Campaign"} width={480}
        actions={activeCampaign && (
          <>
            <Btn variant="ghost" onClick={() => setActiveCampaign(null)}>Close</Btn>
            {activeCampaign.status === "enabled" || activeCampaign.status === "active"
              ? <Btn variant="ghost" onClick={() => toggleStatus(activeCampaign)}><Icon name="pause" size={11}/> Pause</Btn>
              : <Btn variant="primary" onClick={() => toggleStatus(activeCampaign)}><Icon name="send" size={11}/> Launch</Btn>
            }
            <Btn variant="primary" onClick={() => saveBudget(activeCampaign)}>Save changes</Btn>
          </>
        )}>
        {activeCampaign && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)", background: "var(--paper-2)", border: "1px solid var(--rule)", color: "var(--muted)" }}>{activeCampaign.type}</span>
              <StatusBadge status={activeCampaign.status}/>
            </div>

            {activeCampaign.roas && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                {[["ROAS", `${activeCampaign.roas}x`], ["CTR", `${activeCampaign.ctr}%`], ["Spend", `$${activeCampaign.spend}`], ["Revenue", `$${(activeCampaign.revenue/1000).toFixed(1)}k`]].map(([l, v]) => (
                  <div key={l} style={{ padding: 10, borderRadius: 5, background: "var(--paper-2)", border: "1px solid var(--rule)", textAlign: "center" }}>
                    <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            <FormRow label="Monthly budget ($)">
              <Input type="number" value={budgetEdit} onChange={e => setBudgetEdit(e.target.value)}/>
            </FormRow>

            {/* Live ad detail */}
            {detailLoading && <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>Loading ad detail…</div>}
            {detail && (
              <>
                <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Ad headlines</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(detail.ads?.[0]?.headlines || []).map((h, i) => (
                      <span key={i} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: "var(--paper-2)", border: "1px solid var(--rule)" }}>{h}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Top keywords</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {(detail.keywords || []).slice(0, 8).map((k, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "5px 0", borderBottom: "1px solid var(--rule)" }}>
                        <span>{k.text} <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>[{k.matchType}]</span></span>
                        <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{k.clicks} clicks · {k.ctr}% CTR</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Seed fallback keyword display */}
            {!detail && !detailLoading && activeCampaign.keywords && (
              <FormRow label="Target keywords">
                <Textarea defaultValue={activeCampaign.keywords} rows={3} key={activeCampaign.id + "-kw"}/>
              </FormRow>
            )}

            {(activeCampaign.status === "paused" || activeCampaign.status === "draft") && (
              <div style={{ padding: 12, borderRadius: 5, background: "var(--accent-wash)", border: "1px solid var(--accent)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                ✦ <strong>Flow AI estimate:</strong> Based on similar campaigns — projected ROAS: {isErickson ? "7.8x" : "7.2x"} · ~{isErickson ? "340" : "270"} clicks/mo at current budget.
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create campaign dialog */}
      {createOpen && (
        <Dialog open onClose={() => setCreateOpen(false)} title="Create search campaign" width={680}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormRow label="Campaign name">
                <Input placeholder="e.g. Brand keywords · MVEDA" value={form.name}
                  onChange={e => setForm(p => ({...p, name: e.target.value}))}/>
              </FormRow>
              <FormRow label="Type">
                <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))} style={{ ...inputCSS, appearance: "none" }}>
                  <option value="search">Search</option>
                  <option value="pmax">Performance Max</option>
                  <option value="rlsa">RLSA (retargeting)</option>
                  <option value="shopping">Shopping</option>
                  <option value="display">Display</option>
                </select>
              </FormRow>
            </div>

            <FormRow label="Target keywords (one per line or comma-separated)">
              <Textarea placeholder={isErickson
                ? "commercial refrigeration repair\nwalk-in cooler service Seattle\nHVAC contractor WA"
                : "ayurvedic hair oil\nneem face cleanser\nsaffron face serum"}
                value={form.keywordsRaw} rows={3}
                onChange={e => setForm(p => ({...p, keywordsRaw: e.target.value}))}/>
            </FormRow>

            {/* Headlines */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Headlines <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 400 }}>({form.headlines.length}/15) · 30 char max</span></span>
                {form.headlines.length < 15 && (
                  <Btn size="sm" variant="ghost" onClick={() => setForm(f => ({...f, headlines: [...f.headlines, ""]}))}>+ Add</Btn>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {form.headlines.map((h, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <Input maxLength={30} value={h} placeholder={`Headline ${i+1}`}
                      onChange={e => setForm(f => ({ ...f, headlines: f.headlines.map((x, j) => j === i ? e.target.value : x) }))}/>
                    <span className="mono" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 9.5, color: h.length > 27 ? "var(--danger)" : "var(--muted)", pointerEvents: "none" }}>{h.length}/30</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Descriptions */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Descriptions <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 400 }}>({form.descriptions.length}/4) · 90 char max</span></span>
                {form.descriptions.length < 4 && (
                  <Btn size="sm" variant="ghost" onClick={() => setForm(f => ({...f, descriptions: [...f.descriptions, ""]}))}>+ Add</Btn>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {form.descriptions.map((d, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <Input maxLength={90} value={d} placeholder={`Description ${i+1}`}
                      onChange={e => setForm(f => ({ ...f, descriptions: f.descriptions.map((x, j) => j === i ? e.target.value : x) }))}/>
                    <span className="mono" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 9.5, color: d.length > 85 ? "var(--danger)" : "var(--muted)", pointerEvents: "none" }}>{d.length}/90</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <FormRow label="Final URL">
                <Input placeholder="https://…" value={form.finalUrl} onChange={e => setForm(p => ({...p, finalUrl: e.target.value}))}/>
              </FormRow>
              <FormRow label="Monthly budget ($)">
                <Input type="number" placeholder="500" value={form.budget} onChange={e => setForm(p => ({...p, budget: e.target.value}))}/>
              </FormRow>
              <FormRow label="Bidding strategy">
                <select value={form.bidding} onChange={e => setForm(p => ({...p, bidding: e.target.value}))} style={{ ...inputCSS, appearance: "none" }}>
                  <option value="target-roas">Target ROAS</option>
                  <option value="target-cpa">Target CPA</option>
                  <option value="max-clicks">Maximise clicks</option>
                  <option value="max-conversions">Maximise conversions</option>
                  <option value="manual-cpc">Manual CPC</option>
                </select>
              </FormRow>
            </div>

            {/* Quick AI copy fill */}
            {!form.headlines.some(Boolean) && (
              <div style={{ padding: 12, borderRadius: 5, background: "var(--accent-wash)", border: "1px solid var(--accent)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>✦ <strong>Flow AI:</strong> Headlines empty — generate ad copy from your brand + keywords.</span>
                <Btn size="sm" variant="primary" onClick={() => {
                  setCreateOpen(false); setTab("copy");
                  setCopyProduct(brand?.name || form.name);
                  setCopyKeywords(form.keywordsRaw);
                }}>Generate copy →</Btn>
              </div>
            )}

            <div style={{ padding: 12, borderRadius: 5, background: "var(--paper-2)", border: "1px solid var(--rule)", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              Campaign will be created as <strong>Paused</strong> — click <em>Launch</em> to enable immediately, or save and launch from the campaign list.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
              <Btn variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Btn>
              <Btn disabled={creating} onClick={() => submitCreate(false)}>
                {creating ? "Saving…" : "Save as draft"}
              </Btn>
              <Btn variant="primary" disabled={creating} onClick={() => submitCreate(true)}>
                <Icon name="send" size={12}/> {creating ? "Creating…" : "Create & launch"}
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
      desc: "Connect your channels — social platforms via OAuth, email via Klaviyo, ad platforms, analytics, commerce, and creative AI tools.",
      stats: [
        { label: "Connected", value: Object.values(state?.connectors || {}).filter(c => c.connected).length },
        { label: "Available", value: (window.SEED?.connectorCatalog || []).length },
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

        {/* Operator section */}
        <div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>Operator</div>
          <div style={{ padding: 20, borderRadius: 8, background: "var(--paper)", border: "1px solid var(--rule)", borderTop: "3px solid oklch(55% 0.14 300)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Generation Spend</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>All-tenant AI generation cost tracking — runware, replicate, heygen, higgsfield, elevenlabs.</div>
            </div>
            <Btn size="sm" variant="primary" onClick={() => go("spend")} style={{ flexShrink: 0 }}>Open Spend →</Btn>
          </div>
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

// ───────────────────────────── SPEND DASHBOARD ──────────────────────────────
// FlowOS operator view — all-tenant AI generation cost tracking.
// Data comes from /api/spend which uses the service key to bypass RLS.

function SpendDashboard({ actions }) {
  const [data,    setData]    = useStateS(null);
  const [loading, setLoading] = useStateS(true);
  const [error,   setError]   = useStateS(null);

  function load() {
    setLoading(true); setError(null);
    apiFetch("/api/spend")
      .then(r => r.json())
      .then(d => {
        if (d.ok) setData(d);
        else setError(d.error || "Failed to load spend data");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  React.useEffect(() => { load(); }, []);

  const fmt$ = (n) => n == null ? "—" : n < 0.01 ? "<$0.01" : `$${n.toFixed(n >= 10 ? 2 : 4)}`;
  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
           d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const PROVIDER_COLORS = {
    runware:    "var(--accent)",
    replicate:  "oklch(55% 0.18 280)",
    heygen:     "oklch(62% 0.16 30)",
    higgsfield: "oklch(58% 0.18 200)",
    elevenlabs: "oklch(55% 0.14 50)",
  };

  const STATUS_COLOR = { completed: "var(--success)", failed: "oklch(58% 0.18 25)", pending: "oklch(72% 0.12 70)" };

  const maxProviderSpend = data ? Math.max(...(data.byProvider.map(p => p.spend)), 0.0001) : 1;

  return (
    <div className="anim-fade" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 20px", borderBottom: "1px solid var(--rule)", background: "var(--paper)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Operator · FlowOS internal</div>
            <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "4px 0 0" }}>Generation Spend</h1>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>All-tenant AI generation costs — runware · replicate · heygen · higgsfield · elevenlabs</div>
          </div>
          <Btn size="sm" variant="ghost" onClick={load} disabled={loading}>
            <Icon name="refresh" size={12}/> {loading ? "Loading…" : "Refresh"}
          </Btn>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 28 }}>

        {error && (
          <div style={{ padding: 16, borderRadius: 6, background: "oklch(97% 0.02 25)", border: "1px solid oklch(85% 0.08 25)", color: "oklch(45% 0.15 25)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { label: "All-time spend",  value: data ? fmt$(data.summary.totalSpend)     : "—" },
            { label: "This month",      value: data ? fmt$(data.summary.thisMonthSpend)  : "—" },
            { label: "Last 30 days",    value: data ? fmt$(data.summary.last30dSpend)    : "—" },
            { label: "Total jobs",      value: data ? data.summary.totalJobs.toLocaleString() : "—" },
          ].map(k => (
            <div key={k.label} style={{ padding: "18px 20px", borderRadius: 8, background: "var(--paper)", border: "1px solid var(--rule)" }}>
              <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", color: loading ? "var(--muted)" : "var(--ink)" }}>{k.value}</div>
            </div>
          ))}
        </div>

        {data && (
          <>
            {/* Provider breakdown */}
            <div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>By provider</div>
              <div style={{ background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden" }}>
                {data.byProvider.length === 0 ? (
                  <div style={{ padding: "24px 20px", color: "var(--muted)", fontSize: 13 }}>No jobs recorded yet.</div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 80px", gap: 12, padding: "8px 18px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", background: "var(--paper-2)" }}>
                      <span>Provider</span><span>Share</span><span style={{ textAlign: "right" }}>Jobs</span><span style={{ textAlign: "right" }}>Spend</span>
                    </div>
                    {data.byProvider.map((p, i) => {
                      const color = PROVIDER_COLORS[p.provider] || "var(--accent)";
                      const pct   = maxProviderSpend > 0 ? (p.spend / maxProviderSpend) * 100 : 0;
                      return (
                        <div key={p.provider} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 80px", gap: 12, padding: "12px 18px", borderBottom: i < data.byProvider.length - 1 ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }}/>
                            <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{p.provider}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: "var(--paper-2)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width .4s ease" }}/>
                          </div>
                          <span className="mono" style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>{p.jobs.toLocaleString()}</span>
                          <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>{fmt$(p.spend)}</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* By tenant */}
            {data.byTenant.length > 0 && (
              <div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>By tenant</div>
                <div style={{ background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 12, padding: "8px 18px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", background: "var(--paper-2)" }}>
                    <span>Tenant ID</span><span style={{ textAlign: "right" }}>Jobs</span><span style={{ textAlign: "right" }}>Spend</span>
                  </div>
                  {data.byTenant.map((t, i) => (
                    <div key={t.tenant_id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 12, padding: "11px 18px", borderBottom: i < data.byTenant.length - 1 ? "1px solid var(--rule)" : "none", alignItems: "center" }}>
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.tenant_id}</span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>{t.jobs.toLocaleString()}</span>
                      <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>{fmt$(t.spend)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent jobs */}
            {data.recent.length > 0 && (
              <div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>Recent jobs</div>
                <div style={{ background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "130px 90px 90px 80px 1fr 60px 70px", gap: 10, padding: "8px 18px", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", background: "var(--paper-2)" }}>
                    <span>When</span><span>Provider</span><span>Type</span><span>Status</span><span>Job ID</span><span>Model</span><span style={{ textAlign: "right" }}>Cost</span>
                  </div>
                  {data.recent.slice(0, 20).map((r, i) => {
                    const color = PROVIDER_COLORS[r.provider] || "var(--accent)";
                    const sc    = STATUS_COLOR[r.status] || "var(--muted)";
                    return (
                      <div key={r.id} style={{ display: "grid", gridTemplateColumns: "130px 90px 90px 80px 1fr 60px 70px", gap: 10, padding: "10px 18px", borderBottom: i < Math.min(data.recent.length, 20) - 1 ? "1px solid var(--rule)" : "none", alignItems: "center", fontSize: 12 }}>
                        <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(r.created_at)}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }}/>
                          <span className="mono" style={{ fontSize: 11 }}>{r.provider}</span>
                        </span>
                        <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{r.job_type || "—"}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc, flexShrink: 0, display: "inline-block" }}/>
                          <span className="mono" style={{ fontSize: 10, color: sc }}>{r.status}</span>
                        </span>
                        <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.job_id || r.id}</span>
                        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.model ? r.model.split("/").pop() : "—"}</span>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>{fmt$(r.cost_estimate)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {loading && !data && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13 }}>
            <Dot status="warn"/> Loading spend data…
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { StudioHub, EmailStudio, SearchStudio, SettingsHub, SpendDashboard });
