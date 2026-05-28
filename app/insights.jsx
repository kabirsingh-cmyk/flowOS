/**
 * InsightsCenter
 * Structure: Summary → Recommended Actions → Insights → Data by Channel → Analytics Chat
 */

(function () {
  const useStateI    = React.useState;
  const useEffectI   = React.useEffect;
  const useRefI      = React.useRef;
  const useCallbackI = React.useCallback;

  // ─── Constants ────────────────────────────────────────────────────────────────

  const PERIODS = [
    { value: "7d",  label: "7 days"  },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
  ];

  // Channel display config
  const CHANNEL_META = {
    meta_ads:    { label: "Meta Ads",      icon: "📘", group: "paid",    color: "#1877F2" },
    google_ads:  { label: "Google Ads",    icon: "🔍", group: "paid",    color: "#4285F4" },
    tiktok_ads:  { label: "TikTok Ads",    icon: "🎵", group: "paid",    color: "#000000" },
    ga4:         { label: "Web / GA4",     icon: "📊", group: "organic", color: "#E37400" },
    gsc:         { label: "Search Console",icon: "🔎", group: "organic", color: "#34A853" },
    ig_organic:  { label: "Instagram",     icon: "📸", group: "organic", color: "#E1306C" },
    tiktok_org:  { label: "TikTok",        icon: "🎵", group: "organic", color: "#69C9D0" },
    pinterest:   { label: "Pinterest",     icon: "📌", group: "organic", color: "#E60023" },
    klaviyo:     { label: "Email",         icon: "📧", group: "owned",   color: "#2C9B63" },
    sms:         { label: "SMS",           icon: "💬", group: "owned",   color: "#7C3AED" },
    shopify:     { label: "Shopify",       icon: "🛍️", group: "owned",   color: "#96BF48" },
    // Track B — Zernio organic social
    fb_organic:  { label: "Facebook",      icon: "👍", group: "organic", color: "#1877F2" },
    li_organic:  { label: "LinkedIn",      icon: "💼", group: "organic", color: "#0A66C2" },
    tt_organic:  { label: "TikTok",        icon: "🎵", group: "organic", color: "#69C9D0" },
    yt_organic:  { label: "YouTube",       icon: "▶️", group: "organic", color: "#FF0000" },
    gmb:         { label: "Google Business",icon: "🗺️", group: "organic", color: "#EA4335" },
  };

  const CHANNEL_GROUPS = [
    { key: "paid",    label: "Paid" },
    { key: "organic", label: "Organic" },
    { key: "owned",   label: "Owned" },
  ];

  // Key metrics to show per channel (in order)
  const CHANNEL_KEY_METRICS = {
    meta_ads:   ["spend","roas","ctr","cpm","cpc","impressions","clicks","conversions","revenue"],
    google_ads: ["spend","roas","ctr","cpc","impressions","clicks","conversions","conv_value"],
    ga4:        ["sessions","active_users","bounce_rate","engagement_rate","conversions","revenue"],
    gsc:        ["clicks","impressions","avg_ctr","avg_position"],
    klaviyo:    ["campaigns_sent","open_rate","click_rate","revenue","sends"],
    shopify:    ["orders","revenue","aov","unique_customers","net_revenue"],
    // Track B — Zernio organic social (metric names from Zernio API)
    fb_organic:  ["page_fans","page_impressions","page_engaged_users","page_post_engagements","page_reactions_total"],
    ig_organic:  ["reach","impressions","accounts_engaged","total_interactions","follower_count"],
    li_organic:  ["impressions","clicks","engagements","followers_gained","followers"],
    tt_organic:  ["follower_count","likes_count","video_count","followers_gained","followers_lost"],
    yt_organic:  ["views","estimatedMinutesWatched","subscribersGained","subscribersLost","averageViewDuration"],
    gmb:         ["views","clicks","calls","directionRequests","photoViews"],
  };

  function fmtMetricLabel(key) {
    const labels = {
      spend: "Spend", roas: "ROAS", ctr: "CTR", cpm: "CPM", cpc: "CPC",
      impressions: "Impressions", clicks: "Clicks", conversions: "Conversions",
      revenue: "Revenue", conv_value: "Conv. Value", sessions: "Sessions",
      active_users: "Active Users", bounce_rate: "Bounce Rate",
      engagement_rate: "Engagement", avg_session_dur: "Avg. Duration",
      avg_ctr: "Avg. CTR", avg_position: "Avg. Position",
      campaigns_sent: "Campaigns", open_rate: "Open Rate",
      click_rate: "Click Rate", sends: "Sends",
      orders: "Orders", aov: "AOV", unique_customers: "Customers",
      net_revenue: "Net Revenue",
      // Track B — Zernio organic social
      reach: "Reach", accounts_engaged: "Engaged", total_interactions: "Interactions",
      follower_count: "Followers", following_count: "Following", likes_count: "Likes",
      video_count: "Videos", views: "Views", estimatedMinutesWatched: "Watch Min",
      averageViewDuration: "Avg View", subscribersGained: "Subscribers +",
      subscribersLost: "Subscribers -", followers_gained: "Followers +",
      followers_lost: "Followers -", page_fans: "Page Fans",
      page_impressions: "Impressions", page_engaged_users: "Engaged",
      page_post_engagements: "Post Eng.", page_reactions_total: "Reactions",
      engagements: "Engagements", calls: "Calls", directionRequests: "Directions",
      photoViews: "Photo Views",
    };
    return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function fmtMetricValue(key, val) {
    if (val === null || val === undefined || val === 0) return "—";
    const curr = ["spend","cpc","cpm","revenue","conv_value","aov","net_revenue"].includes(key);
    const pct  = ["ctr","bounce_rate","engagement_rate","open_rate","click_rate","avg_ctr"].includes(key);
    const mult = ["roas"].includes(key);
    const dur  = ["avg_session_dur","averageViewDuration"].includes(key);
    const mins = ["estimatedMinutesWatched"].includes(key);
    if (curr)  return `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (pct)   return `${(Number(val) * (val > 1 ? 1 : 100)).toFixed(1)}%`;
    if (mult)  return `${Number(val).toFixed(2)}×`;
    if (dur)   return `${Math.round(val)}s`;
    if (mins)  return `${Math.round(val)}m`;
    if (Number.isInteger(val) || val > 100) return Number(Math.round(val)).toLocaleString("en-US");
    return Number(val).toFixed(2);
  }

  // ─── CTA label maps ──────────────────────────────────────────────────────────

  const WORKSPACE_LABELS = {
    emailstudio:  "Open in EmailStudio",
    studio:       "Open Studio",
    planner:      "Create campaign",
    organic:      "Open Social Studio",
    searchstudio: "Open Search Studio",
    seo:          "Open SEO Studio",
    insights:     "View Analytics",
    connections:  "Connect Platform",
    publish:      "Open Queue",
    sms:          "Open SMS Center",
  };

  // Maps insight channel → workspace to navigate to
  const CHANNEL_WORKSPACE = {
    klaviyo:         "emailstudio",
    email:           "emailstudio",
    meta_ads:        "studio",
    google_ads:      "studio",
    gsc:             "searchstudio",
    ga4:             "insights",
    shopify:         "insights",
    "cross-channel": "planner",
  };

  // ─── Shared micro-components ─────────────────────────────────────────────────
  // Spinner, Chip, Dot are provided by ui.jsx via window globals

  // Map insight severity → Dot status
  function SeverityDot({ severity }) {
    const statusMap = { warning: "warn", ok: "ok", info: "err" };
    return <Dot status={statusMap[severity] || "err"} />;
  }

  // Map action priority → Chip tone
  function PriorityBadge({ priority }) {
    const toneMap = { high: "danger", medium: "warn", low: "ok" };
    return <Chip tone={toneMap[priority] || "neutral"}>{priority}</Chip>;
  }

  // ─── Summary + KPI strip ─────────────────────────────────────────────────────

  function SummarySection({ insights, snapshots, loading }) {
    if (loading) return <Spinner />;
    if (!insights) return null;

    // Derive top KPIs from snapshots (legacy Composio + Zernio organic social)
    const kpis = [];
    const shop = snapshots.find(s => s.channel === "shopify");
    const meta = snapshots.find(s => s.channel === "meta_ads");
    const gads = snapshots.find(s => s.channel === "google_ads");
    const mail = snapshots.find(s => s.channel === "klaviyo");
    const web  = snapshots.find(s => s.channel === "ga4");
    const gsc  = snapshots.find(s => s.channel === "gsc");
    // Track B — Zernio organic social highlights
    const ig   = snapshots.find(s => s.channel === "ig_organic");
    const tt   = snapshots.find(s => s.channel === "tt_organic");
    const yt   = snapshots.find(s => s.channel === "yt_organic");
    const li   = snapshots.find(s => s.channel === "li_organic");

    if (shop) kpis.push({ label: "Revenue",       value: fmtMetricValue("revenue",   shop.metrics?.revenue),          sub: "Shopify" });
    if (shop) kpis.push({ label: "Orders",        value: fmtMetricValue("orders",    shop.metrics?.orders),           sub: "Shopify" });
    if (meta) kpis.push({ label: "ROAS",          value: fmtMetricValue("roas",      meta.metrics?.roas),             sub: "Meta Ads" });
    if (gads) kpis.push({ label: "ROAS",          value: fmtMetricValue("roas",      gads.metrics?.roas),             sub: "Google Ads" });
    if (mail) kpis.push({ label: "Open Rate",     value: fmtMetricValue("open_rate", mail.metrics?.open_rate),        sub: "Email" });
    if (web)  kpis.push({ label: "Sessions",      value: fmtMetricValue("sessions",  web.metrics?.sessions),          sub: "Web" });
    if (gsc)  kpis.push({ label: "Search Clicks", value: fmtMetricValue("clicks",    gsc.metrics?.clicks),            sub: "Search Console" });
    if (ig)   kpis.push({ label: "Reach",         value: fmtMetricValue("reach",     resolveMetricValue(ig.metrics?.reach)),   sub: "Instagram" });
    if (tt)   kpis.push({ label: "Followers",     value: fmtMetricValue("follower_count", resolveMetricValue(tt.metrics?.follower_count)), sub: "TikTok" });
    if (yt)   kpis.push({ label: "Views",         value: fmtMetricValue("views",     resolveMetricValue(yt.metrics?.views)),   sub: "YouTube" });
    if (li)   kpis.push({ label: "Impressions",   value: fmtMetricValue("impressions", resolveMetricValue(li.metrics?.impressions)), sub: "LinkedIn" });

    return (
      <section style={{ marginBottom: 28 }}>
        {/* Summary text */}
        {insights.summary && (
          <div style={{
            background: "var(--paper)", border: "1px solid var(--rule)",
            borderRadius: 10, padding: "16px 20px", marginBottom: 16,
            fontSize: 14, lineHeight: 1.65, color: "var(--ink)",
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: 8 }}>
              AI Summary
            </span>
            {insights.summary}
          </div>
        )}

        {/* KPI strip */}
        {kpis.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {kpis.map((kpi, i) => (
              <div key={i} style={{
                background: "var(--paper)", border: "1px solid var(--rule)",
                borderRadius: 8, padding: "10px 16px", flex: "1 1 120px",
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{kpi.sub}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace" }}>{kpi.value}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  // ─── Recommended Actions ──────────────────────────────────────────────────────

  function RecommendedActions({ actions, loading, onNavigate }) {
    if (loading) return null;
    if (!actions || actions.length === 0) return null;

    return (
      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 12px" }}>
          Recommended Actions
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {actions.map((item, i) => (
            <div key={i} style={{
              background: "var(--paper)", border: "1px solid var(--rule)",
              borderRadius: 8, padding: "12px 16px",
              display: "flex", alignItems: "flex-start", gap: 12,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: i === 0 ? "#FEF2F2" : "var(--paper-2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: i === 0 ? "#EF4444" : "var(--muted)",
                flexShrink: 0, marginTop: 1,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{item.action}</span>
                  <PriorityBadge priority={item.priority} />
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{item.reason}</div>
              </div>
              {item.workspace && onNavigate && (
                <button
                  onClick={() => onNavigate(item.workspace)}
                  style={{
                    padding: "4px 12px", borderRadius: 6, border: "1px solid var(--rule)",
                    background: "transparent", fontSize: 11.5, color: "var(--muted)",
                    cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                  }}
                >
                  {WORKSPACE_LABELS[item.workspace] || "Open →"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ─── Insights cards ───────────────────────────────────────────────────────────

  function InsightsGrid({ items, loading, onNavigate }) {
    if (loading) return null;
    if (!items || items.length === 0) return null;

    return (
      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 12px" }}>
          Insights
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {items.map((item, i) => {
            // Key-first lookup so "gsc", "ga4", "klaviyo" etc. resolve by key before falling back to label match
            const channelMeta = CHANNEL_META[(item.channel || "").toLowerCase()] ||
              Object.values(CHANNEL_META).find(m => m.label.toLowerCase() === (item.channel || "").toLowerCase());
            const ws = CHANNEL_WORKSPACE[(item.channel || "").toLowerCase()];
            return (
              <div key={i} style={{
                background: "var(--paper)", border: "1px solid var(--rule)",
                borderRadius: 8, padding: "14px 16px",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <SeverityDot severity={item.severity} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", lineHeight: 1.3 }}>{item.title}</div>
                    {item.channel && (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {channelMeta?.icon} {item.channel}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, flex: 1 }}>{item.body}</div>
                {ws && onNavigate && (
                  <button
                    onClick={() => onNavigate(ws)}
                    style={{
                      marginTop: 10, padding: "4px 12px", borderRadius: 6,
                      border: "1px solid var(--rule)", background: "transparent",
                      fontSize: 11.5, color: "var(--muted)", cursor: "pointer",
                      alignSelf: "flex-start",
                    }}
                  >
                    {WORKSPACE_LABELS[ws] || "Open →"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // ─── Data by Channel ──────────────────────────────────────────────────────────

  // Extract a scalar value from Zernio's nested metric format { total, values, breakdowns }
  // or fall back to plain number/string for legacy Composio data.
  function resolveMetricValue(raw) {
    if (raw === null || raw === undefined) return undefined;
    if (typeof raw === "number" || typeof raw === "string") return raw;
    if (typeof raw === "object") {
      if (typeof raw.total === "number" || typeof raw.total === "string") return raw.total;
      // If no total, return count of values array as a fallback
      if (Array.isArray(raw.values)) return raw.values.length;
      if (Array.isArray(raw.breakdowns)) return raw.breakdowns.length;
    }
    return undefined;
  }

  function ChannelMetricTable({ snapshot }) {
    const meta   = CHANNEL_META[snapshot.channel] || { label: snapshot.channel, icon: "📊", color: "#666" };
    // Zernio payloads have metrics as objects; legacy Composio payloads are flat.
    const isZernio = snapshot.endpoint && snapshot.endpoint !== "legacy";
    const rawMetrics = snapshot.metrics || {};
    // For Zernio data, prefer known keys; for legacy, use all flat keys
    const keys = CHANNEL_KEY_METRICS[snapshot.channel]
      || Object.keys(rawMetrics).filter(k => k !== "period" && k !== "date_start" && k !== "date_end" && !Array.isArray(rawMetrics[k]));
    // Zernio responses often include a dateRange object inside metrics
    const dateRange = rawMetrics.dateRange || {};

    return (
      <div style={{
        background: "var(--paper)", border: "1px solid var(--rule)",
        borderRadius: 8, overflow: "hidden",
      }}>
        {/* Channel header */}
        <div style={{
          padding: "10px 16px", borderBottom: "1px solid var(--rule)",
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--paper-2)",
        }}>
          <span style={{ fontSize: 16 }}>{meta.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{meta.label}</span>
          {isZernio && snapshot.endpoint && (
            <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {snapshot.endpoint.replace(/_/g, " ")}
            </span>
          )}
          {(rawMetrics.period || dateRange.since) && (
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
              {dateRange.since && dateRange.until ? `${dateRange.since} → ${dateRange.until}` : rawMetrics.period}
            </span>
          )}
        </div>
        {/* Metric grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
          {keys.map((key) => {
            const rawVal = rawMetrics[key];
            const val = isZernio ? resolveMetricValue(rawVal) : rawVal;
            return (
              <div key={key} style={{
                padding: "10px 14px",
                borderRight: "1px solid var(--rule)",
                borderBottom: "1px solid var(--rule)",
              }}>
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {fmtMetricLabel(key)}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace" }}>
                  {fmtMetricValue(key, val)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function DataByChannel({ snapshots, loading }) {
    if (loading) return null;
    if (!snapshots || snapshots.length === 0) return null;

    return (
      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 12px" }}>
          Data by Channel
        </h3>
        {CHANNEL_GROUPS.map(group => {
          const groupSnaps = snapshots.filter(s => (CHANNEL_META[s.channel]?.group || "owned") === group.key);
          if (groupSnaps.length === 0) return null;
          return (
            <div key={group.key} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8, letterSpacing: "0.05em" }}>
                {group.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {groupSnaps.map(s => <ChannelMetricTable key={s.channel} snapshot={s} />)}
              </div>
            </div>
          );
        })}
      </section>
    );
  }

  // ─── Analytics Chat ───────────────────────────────────────────────────────────

  function AnalyticsChat({ tenantId, snapshots, insights, period }) {
    const [messages, setMessages] = useStateI([]);
    const [input, setInput]   = useStateI("");
    const [busy, setBusy]     = useStateI(false);
    const bottomRef = useRefI(null);

    useEffectI(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function sendMessage(e) {
      e?.preventDefault();
      const text = input.trim();
      if (!text || busy) return;
      setInput("");
      const userMsg = { role: "user", content: text };
      setMessages(prev => [...prev, userMsg]);
      setBusy(true);

      try {
        // Build context from current snapshots + insights
        const contextParts = [];
        if (insights?.summary) contextParts.push(`CURRENT ANALYSIS SUMMARY:\n${insights.summary}`);
        if (snapshots.length > 0) {
          contextParts.push("CURRENT METRICS DATA:\n" + snapshots.map(s =>
            `${CHANNEL_META[s.channel]?.label || s.channel}:\n${JSON.stringify(s.metrics, null, 2)}`
          ).join("\n\n"));
        }

        const systemContext = contextParts.length
          ? `You are a marketing analyst with access to the following real performance data:\n\n${contextParts.join("\n\n")}\n\nAnswer questions using this data. Reference specific numbers. Be concise and direct.`
          : "You are a marketing analyst. The user has not yet refreshed their analytics data. Encourage them to click Refresh to pull in live metrics.";

        const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            specialist: "analyst",
            brand: { name: "Analytics Assistant", voice: { tone: systemContext } },
          }),
        });

        const data = await res.json();
        const assistantText = data?.content?.find(b => b.type === "text")?.text || "I couldn't process that.";
        setMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
      } catch (err) {
        setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
      } finally {
        setBusy(false);
      }
    }

    const placeholder = snapshots.length > 0
      ? `Ask about your ${period} performance...`
      : "Refresh analytics first, then ask questions…";

    return (
      <section style={{ marginBottom: 0 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 12px" }}>
          Analytics Chat
        </h3>
        <div style={{
          background: "var(--paper)", border: "1px solid var(--rule)",
          borderRadius: 10, overflow: "hidden",
          display: "flex", flexDirection: "column",
          minHeight: 280,
        }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
            {messages.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", paddingTop: 40 }}>
                Ask anything about your marketing data
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                marginBottom: 12,
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "82%", padding: "8px 12px",
                  borderRadius: msg.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                  background: msg.role === "user" ? "var(--accent)" : "var(--paper-2)",
                  color: msg.role === "user" ? "#fff" : "var(--ink)",
                  fontSize: 13.5, lineHeight: 1.55,
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {busy && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
                <div style={{
                  padding: "8px 14px", borderRadius: "10px 10px 10px 2px",
                  background: "var(--paper-2)", display: "flex", gap: 4, alignItems: "center",
                }}>
                  {[0, 1, 2].map(j => (
                    <span key={j} className="dot-pulse" style={{
                      display: "inline-block", width: 5, height: 5, borderRadius: "50%",
                      background: "var(--muted)",
                      animationDelay: `${j * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{
            borderTop: "1px solid var(--rule)", padding: "10px 12px",
            display: "flex", gap: 8,
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={placeholder}
              disabled={busy}
              style={{
                flex: 1, background: "var(--paper-2)", border: "1px solid var(--rule)",
                borderRadius: 8, padding: "8px 12px", fontSize: 13.5,
                color: "var(--ink)", outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              style={{
                padding: "8px 16px", borderRadius: 8,
                background: input.trim() && !busy ? "var(--accent)" : "var(--paper-2)",
                color: input.trim() && !busy ? "#fff" : "var(--muted)",
                border: "none", cursor: input.trim() && !busy ? "pointer" : "default",
                fontSize: 13, fontWeight: 500, transition: "all 0.15s",
              }}
            >
              Send
            </button>
          </form>
        </div>
      </section>
    );
  }

  // ─── Cross-platform Primitives ───────────────────────────────────────────────

  function PrimitivesSection({ primitives, loading }) {
    if (loading) return null;
    if (!primitives || primitives.length === 0) return null;

    const PRIMITIVE_LABELS = {
      best_time:         "Best Time to Post",
      content_decay:     "Content Decay",
      posting_frequency: "Posting Frequency",
      post_timeline:     "Post Timeline",
      daily_metrics:     "Daily Metrics",
    };

    return (
      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 12px" }}>
          Cross-Platform Primitives
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {primitives.map((p, i) => {
            const payload = p.payload || {};
            const label = PRIMITIVE_LABELS[p.primitive] || p.primitive;
            return (
              <div key={i} style={{
                background: "var(--paper)", border: "1px solid var(--rule)",
                borderRadius: 8, padding: "14px 16px",
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.6 }}>
                  {typeof payload === "object" ? (
                    Object.entries(payload).slice(0, 4).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ color: "var(--muted)" }}>{k.replace(/_/g, " ")}</span>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
                          {typeof v === "number" ? v.toLocaleString() : String(v).slice(0, 24)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span>{String(payload).slice(0, 120)}</span>
                  )}
                </div>
                {p.platform && (
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>
                    Platform: {p.platform}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // ─── Cohorts / Demographics ───────────────────────────────────────────────────

  const COHORT_LABELS = {
    age: "Age", gender: "Gender", country: "Country", city: "City", device: "Device",
  };

  function CohortsSection({ cohorts, loading }) {
    if (loading) return null;
    if (!cohorts || cohorts.length === 0) return null;

    // Group by channel for display
    const byChannel = {};
    cohorts.forEach(c => {
      if (!byChannel[c.channel]) byChannel[c.channel] = [];
      byChannel[c.channel].push(c);
    });

    return (
      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 12px" }}>
          Audience Breakdowns
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {Object.entries(byChannel).map(([channel, items]) => {
            const meta = CHANNEL_META[channel] || { label: channel, icon: "📊", color: "#666" };
            return items.map((c, i) => (
              <CohortCard key={`${channel}-${c.cohort_type}-${i}`} channelMeta={meta} cohort={c} />
            ));
          })}
        </div>
      </section>
    );
  }

  function CohortCard({ channelMeta, cohort }) {
    const breakdowns = (cohort.breakdowns || []).slice(0, 6);
    const maxPct = breakdowns.length > 0 ? Math.max(...breakdowns.map(b => b.pct || 0)) : 0;

    return (
      <div style={{
        background: "var(--paper)", border: "1px solid var(--rule)",
        borderRadius: 8, padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>{channelMeta.icon}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
            {channelMeta.label}
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {COHORT_LABELS[cohort.cohort_type] || cohort.cohort_type}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {breakdowns.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 70, fontSize: 11.5, color: "var(--muted)", textAlign: "right", flexShrink: 0 }}>
                {b.label}
              </div>
              <div style={{ flex: 1, height: 10, background: "var(--paper-2)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                  width: `${maxPct > 0 ? (b.pct / maxPct * 100) : 0}%`,
                  height: "100%", background: channelMeta.color,
                  borderRadius: 5, opacity: 0.85,
                  transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ width: 45, fontSize: 11.5, color: "var(--ink)", fontWeight: 500, textAlign: "right", flexShrink: 0, fontFamily: "JetBrains Mono, monospace" }}>
                {typeof b.pct === "number" ? `${b.pct}%` : fmtMetricValue(cohort.cohort_type, b.value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────────

  function ErrorState({ onRetry, errorMsg }) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "60px 24px", textAlign: "center", gap: 12,
      }}>
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>Could not load analytics</div>
        <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 320, lineHeight: 1.6 }}>
          {errorMsg || "Check your connection and make sure you're signed in."}
        </div>
        <button
          onClick={onRetry}
          style={{
            marginTop: 8, padding: "9px 20px", borderRadius: 8,
            background: "var(--accent)", color: "#fff", border: "none",
            fontSize: 13.5, fontWeight: 500, cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────────

  function EmptyState({ onRefresh, loading }) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "60px 24px", textAlign: "center", gap: 12,
      }}>
        <div style={{ fontSize: 36 }}>📊</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>No analytics data yet</div>
        <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 320, lineHeight: 1.6 }}>
          Connect a platform in Settings → Connections, then click Refresh to pull live metrics and AI insights.
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            marginTop: 8, padding: "9px 20px", borderRadius: 8,
            background: "var(--accent)", color: "#fff", border: "none",
            fontSize: 13.5, fontWeight: 500, cursor: "pointer",
          }}
        >
          {loading ? "Refreshing…" : "Refresh Now"}
        </button>
      </div>
    );
  }

  // ─── Comparison View ──────────────────────────────────────────────────────────

  const HIGHER_IS_BETTER = new Set([
    "roas","ctr","engagement_rate","open_rate","click_rate","revenue","conv_value",
    "conversions","impressions","clicks","reach","sessions","active_users","orders",
    "aov","unique_customers","net_revenue","page_fans","page_impressions",
    "page_engaged_users","page_post_engagements","page_reactions_total",
    "accounts_engaged","total_interactions","follower_count","following_count",
    "likes_count","video_count","views","estimatedMinutesWatched","subscribersGained",
    "followers_gained","engagements","calls","directionRequests","photoViews","sends","campaigns_sent",
  ]);
  const LOWER_IS_BETTER = new Set([
    "bounce_rate","cpc","cpm","avg_position","subscribersLost","followers_lost",
  ]);

  function ComparisonView({ snapshots, selection, onToggle }) {
    const available = snapshots.filter(s => CHANNEL_META[s.channel]);

    if (available.length < 2) {
      return (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--muted)", fontSize: 14 }}>
          Connect at least two platforms to use comparison mode.
        </div>
      );
    }

    const selectedSnaps = selection.map(key => available.find(s => s.channel === key)).filter(Boolean);

    return (
      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 12px" }}>
          Compare Channels
        </h3>

        {/* Channel picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {available.map(s => {
            const meta = CHANNEL_META[s.channel];
            const selected = selection.includes(s.channel);
            return (
              <button
                key={s.channel}
                onClick={() => onToggle(s.channel)}
                style={{
                  padding: "6px 12px", borderRadius: 6,
                  border: selected ? `1.5px solid ${meta.color}` : "1px solid var(--rule)",
                  background: selected ? `${meta.color}15` : "var(--paper)",
                  color: selected ? meta.color : "var(--muted)",
                  fontSize: 12.5, fontWeight: selected ? 600 : 400,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                {selected && <span style={{ fontSize: 11, marginLeft: 2 }}>✓</span>}
              </button>
            );
          })}
        </div>

        {selection.length < 2 && (
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
            Select 2–4 channels to compare side-by-side.
          </div>
        )}

        {selectedSnaps.length >= 2 && (
          <ComparisonTable snaps={selectedSnaps} />
        )}
      </section>
    );
  }

  function ComparisonTable({ snaps }) {
    // Gather all metric keys that appear in at least 2 selected channels
    const keyCounts = {};
    snaps.forEach(s => {
      const keys = Object.keys(s.metrics || {}).filter(k => k !== "period" && k !== "dateRange" && k !== "date_start" && k !== "date_end" && !Array.isArray(s.metrics[k]));
      keys.forEach(k => { keyCounts[k] = (keyCounts[k] || 0) + 1; });
    });
    const sharedKeys = Object.keys(keyCounts).filter(k => keyCounts[k] >= 2);
    // Prefer known key order; append any extras alphabetically
    const orderedKnown = [];
    const allKnown = new Set();
    snaps.forEach(s => {
      (CHANNEL_KEY_METRICS[s.channel] || []).forEach(k => allKnown.add(k));
    });
    allKnown.forEach(k => { if (sharedKeys.includes(k)) orderedKnown.push(k); });
    const extras = sharedKeys.filter(k => !allKnown.has(k)).sort();
    const metricKeys = [...orderedKnown, ...extras];

    if (metricKeys.length === 0) {
      return (
        <div style={{ fontSize: 13, color: "var(--muted)", padding: "20px 0" }}>
          No overlapping metrics across the selected channels.
        </div>
      );
    }

    const getVal = (snap, key) => {
      const raw = snap.metrics?.[key];
      return snap.endpoint && snap.endpoint !== "legacy" ? resolveMetricValue(raw) : raw;
    };

    const cellStyle = {
      padding: "10px 14px", borderBottom: "1px solid var(--rule)", borderRight: "1px solid var(--rule)",
      fontSize: 13.5, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace",
    };
    const headerCell = {
      padding: "10px 14px", borderBottom: "1px solid var(--rule)", borderRight: "1px solid var(--rule)",
      background: "var(--paper-2)", fontSize: 12, fontWeight: 600, color: "var(--ink)",
      whiteSpace: "nowrap",
    };

    return (
      <div style={{
        background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden",
        overflowX: "auto",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}>
          <thead>
            <tr>
              <th style={{ ...headerCell, textAlign: "left", position: "sticky", left: 0, zIndex: 1 }}>Metric</th>
              {snaps.map(s => {
                const meta = CHANNEL_META[s.channel];
                return (
                  <th key={s.channel} style={{ ...headerCell, textAlign: "right" }}>
                    <span style={{ marginRight: 6 }}>{meta.icon}</span>
                    {meta.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {metricKeys.map(key => {
              const vals = snaps.map(s => ({ snap: s, val: getVal(s, key) }));
              const numeric = vals.filter(v => typeof v.val === "number" && !isNaN(v.val));
              let bestVal = null;
              if (numeric.length > 0) {
                if (LOWER_IS_BETTER.has(key)) {
                  bestVal = Math.min(...numeric.map(v => v.val));
                } else if (HIGHER_IS_BETTER.has(key)) {
                  bestVal = Math.max(...numeric.map(v => v.val));
                }
              }
              return (
                <tr key={key}>
                  <td style={{ ...cellStyle, textAlign: "left", position: "sticky", left: 0, background: "var(--paper)", zIndex: 1, fontFamily: "inherit", fontWeight: 500 }}>
                    {fmtMetricLabel(key)}
                  </td>
                  {vals.map(({ snap, val }) => {
                    const isBest = bestVal !== null && typeof val === "number" && val === bestVal;
                    return (
                      <td key={snap.channel} style={{ ...cellStyle, textAlign: "right", background: isBest ? "rgba(34,197,94,0.08)" : "transparent", color: isBest ? "#16A34A" : "var(--ink)", fontWeight: isBest ? 600 : 400 }}>
                        {fmtMetricValue(key, val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ─── Main InsightsCenter component ────────────────────────────────────────────

  function InsightsCenter({ state }) {
    const tenantId   = state?.auth?.user?.id || state?.tenantId || null;
    const [period, setPeriod]           = useStateI("30d");
    const [snapshots, setSnapshots]     = useStateI([]);
    const [primitives, setPrimitives]   = useStateI([]);
    const [insights, setInsights]       = useStateI(null);
    const [loading, setLoading]         = useStateI(false);
    const [refreshing, setRefreshing]   = useStateI(false);
    const [lastUpdated, setLastUpdated] = useStateI(null);
    const [error, setError]             = useStateI(null);
    const [compareMode, setCompareMode] = useStateI(false);
    const [compareSelection, setCompareSelection] = useStateI([]);
    const [cohorts, setCohorts] = useStateI([]);

    const sb = window.sb;

    // Load existing data from Supabase on mount / period change
    const loadCached = useCallbackI(async () => {
      if (!tenantId || !sb) return;
      setLoading(true);
      setError(null);
      try {
        const [snapRes, primRes, insRes, cohortRes] = await Promise.all([
          sb.from("analytics_snapshots")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("period", period),
          sb.from("analytics_primitives")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("period", period)
            .order("captured_at", { ascending: false }),
          sb.from("analytics_insights")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("period", period)
            .order("generated_at", { ascending: false })
            .limit(1),
          sb.from("analytics_cohorts")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("period", period)
            .order("fetched_at", { ascending: false }),
        ]);

        if (snapRes.error) throw new Error(snapRes.error.message || "Snapshot fetch failed");
        if (primRes.error) throw new Error(primRes.error.message || "Primitives fetch failed");
        if (insRes.error)  throw new Error(insRes.error.message  || "Insights fetch failed");
        if (cohortRes.error) throw new Error(cohortRes.error.message || "Cohorts fetch failed");

        if (Array.isArray(snapRes.data)) {
          const rows = snapRes.data;
          setSnapshots(rows.map(r => ({
            channel: r.channel,
            endpoint: r.endpoint,
            metrics: r.metrics,
            fetched_at: r.fetched_at,
          })));
          if (rows.length > 0) {
            setLastUpdated(rows.slice().sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at))[0].fetched_at);
          }
        }

        if (Array.isArray(primRes.data)) {
          setPrimitives(primRes.data.map(r => ({
            primitive: r.primitive,
            platform: r.platform,
            payload: r.payload,
            captured_at: r.captured_at,
          })));
        }

        if (Array.isArray(insRes.data) && insRes.data.length > 0) {
          const row = insRes.data[0];
          setInsights({
            summary:             row.summary,
            insights:            row.insights || [],
            recommended_actions: row.recommended_actions || [],
          });
        }

        if (Array.isArray(cohortRes.data)) {
          setCohorts(cohortRes.data.map(r => ({
            channel: r.channel,
            cohort_type: r.cohort_type,
            breakdowns: r.breakdowns,
            meta: r.meta,
            fetched_at: r.fetched_at,
          })));
        }
      } catch (e) {
        setError(e.message || "Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    }, [tenantId, period]);

    useEffectI(() => { loadCached(); }, [loadCached]);

    // Pull live data from connected platforms + re-generate insights
    async function handleRefresh() {
      if (!tenantId || refreshing) return;
      setRefreshing(true);
      setError(null);
      try {
        const res = await apiFetch("/api/analytics-ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period }),
        });
        const data = await res.json();
        if (data.ok) {
          await loadCached();
        } else {
          setError(data.error || "Refresh failed");
        }
      } catch (e) {
        setError("Network error during refresh");
      } finally {
        setRefreshing(false);
      }
    }

    function handleNavigate(workspace) {
      window.dispatchEvent(new CustomEvent("flowos:navigate", { detail: { workspace } }));
    }

    function toggleCompareChannel(key) {
      setCompareSelection(prev => {
        if (prev.includes(key)) return prev.filter(k => k !== key);
        if (prev.length >= 4) return prev; // max 4
        return [...prev, key];
      });
    }

    const hasData = snapshots.length > 0 || insights;

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--paper-2)" }}>
        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px", background: "var(--paper)", borderBottom: "1px solid var(--rule)",
          flexShrink: 0, gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Analytics</span>
            {lastUpdated && (
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                Updated {new Date(lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Period selector */}
            <div style={{ display: "flex", gap: 2, background: "var(--paper-2)", border: "1px solid var(--rule)", borderRadius: 7, padding: 2 }}>
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  style={{
                    padding: "4px 12px", borderRadius: 5, border: "none",
                    background: period === p.value ? "var(--paper)" : "transparent",
                    color: period === p.value ? "var(--ink)" : "var(--muted)",
                    fontSize: 12, fontWeight: period === p.value ? 500 : 400,
                    cursor: "pointer",
                    boxShadow: period === p.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Compare toggle */}
            <button
              onClick={() => {
                setCompareMode(v => !v);
                if (compareMode) setCompareSelection([]);
              }}
              style={{
                padding: "6px 14px", borderRadius: 7,
                background: compareMode ? "var(--ink)" : "var(--paper-2)",
                color: compareMode ? "#fff" : "var(--muted)",
                border: "1px solid var(--rule)",
                fontSize: 12.5, fontWeight: 500, cursor: "pointer",
              }}
            >
              {compareMode ? "Exit Compare" : "⊕ Compare"}
            </button>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                padding: "6px 14px", borderRadius: 7,
                background: refreshing ? "var(--paper-2)" : "var(--accent)",
                color: refreshing ? "var(--muted)" : "#fff",
                border: "1px solid var(--rule)",
                fontSize: 12.5, fontWeight: 500, cursor: refreshing ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {refreshing && (
                <span style={{
                  display: "inline-block", width: 10, height: 10, borderRadius: "50%",
                  border: "1.5px solid var(--muted)", borderTopColor: "transparent",
                  animation: "spin 0.7s linear infinite",
                }} />
              )}
              {refreshing ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {/* Error banner (shows alongside data when a refresh fails) */}
        {error && hasData && (
          <div style={{
            background: "#FEF2F2", borderBottom: "1px solid #FECACA",
            padding: "8px 20px", fontSize: 13, color: "#DC2626",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 40px" }}>
          {loading && !hasData ? (
            <Spinner />
          ) : !hasData && error ? (
            <ErrorState onRetry={loadCached} errorMsg={error} />
          ) : !hasData ? (
            <EmptyState onRefresh={handleRefresh} loading={refreshing} />
          ) : (
            <>
              {compareMode ? (
                <ComparisonView
                  snapshots={snapshots}
                  selection={compareSelection}
                  onToggle={toggleCompareChannel}
                />
              ) : (
                <>
                  <SummarySection insights={insights} snapshots={snapshots} loading={loading} />
                  <RecommendedActions actions={insights?.recommended_actions} loading={loading} onNavigate={handleNavigate} />
                  <InsightsGrid items={insights?.insights} loading={loading} onNavigate={handleNavigate} />
                  <PrimitivesSection primitives={primitives} loading={loading} />
                  <CohortsSection cohorts={cohorts} loading={loading} />
                  <DataByChannel snapshots={snapshots} loading={loading} />
                  <AnalyticsChat tenantId={tenantId} snapshots={snapshots} insights={insights} period={period} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Override the stub from workspaces3.jsx
  window.InsightsCenter = InsightsCenter;
})();
