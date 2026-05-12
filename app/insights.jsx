/**
 * InsightsCenter — replaces the stub in workspaces3.jsx
 * Structure: Summary → Recommended Actions → Insights → Data by Channel → Analytics Chat
 *
 * Loaded after workspaces3.jsx so window.InsightsCenter is overwritten.
 */

(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  // ─── Constants ────────────────────────────────────────────────────────────────

  const PERIODS = [
    { value: "7d",  label: "7 days"  },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
  ];

  // Channel display config
  const CHANNEL_META = {
    meta_ads:    { label: "Meta Ads",     icon: "📘", group: "paid",    color: "#1877F2" },
    google_ads:  { label: "Google Ads",   icon: "🔍", group: "paid",    color: "#4285F4" },
    tiktok_ads:  { label: "TikTok Ads",   icon: "🎵", group: "paid",    color: "#000000" },
    ga4:         { label: "Web / GA4",    icon: "📊", group: "organic", color: "#E37400" },
    ig_organic:  { label: "Instagram",    icon: "📸", group: "organic", color: "#E1306C" },
    tiktok_org:  { label: "TikTok",       icon: "🎵", group: "organic", color: "#69C9D0" },
    pinterest:   { label: "Pinterest",    icon: "📌", group: "organic", color: "#E60023" },
    klaviyo:     { label: "Email",        icon: "📧", group: "owned",   color: "#2C9B63" },
    sms:         { label: "SMS",          icon: "💬", group: "owned",   color: "#7C3AED" },
    shopify:     { label: "Shopify",      icon: "🛍️", group: "owned",   color: "#96BF48" },
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
    klaviyo:    ["campaigns_sent","open_rate","click_rate","revenue","sends"],
    shopify:    ["orders","revenue","aov","unique_customers","net_revenue"],
  };

  function fmtMetricLabel(key) {
    const labels = {
      spend: "Spend", roas: "ROAS", ctr: "CTR", cpm: "CPM", cpc: "CPC",
      impressions: "Impressions", clicks: "Clicks", conversions: "Conversions",
      revenue: "Revenue", conv_value: "Conv. Value", sessions: "Sessions",
      active_users: "Active Users", bounce_rate: "Bounce Rate",
      engagement_rate: "Engagement", avg_session_dur: "Avg. Duration",
      campaigns_sent: "Campaigns", open_rate: "Open Rate",
      click_rate: "Click Rate", sends: "Sends",
      orders: "Orders", aov: "AOV", unique_customers: "Customers",
      net_revenue: "Net Revenue",
    };
    return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function fmtMetricValue(key, val) {
    if (val === null || val === undefined || val === 0) return "—";
    const curr = ["spend","cpc","cpm","revenue","conv_value","aov","net_revenue"].includes(key);
    const pct  = ["ctr","bounce_rate","engagement_rate","open_rate","click_rate"].includes(key);
    const mult = ["roas"].includes(key);
    const dur  = ["avg_session_dur"].includes(key);
    if (curr)  return `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (pct)   return `${(Number(val) * (val > 1 ? 1 : 100)).toFixed(1)}%`;
    if (mult)  return `${Number(val).toFixed(2)}×`;
    if (dur)   return `${Math.round(val)}s`;
    if (Number.isInteger(val) || val > 100) return Number(Math.round(val)).toLocaleString("en-US");
    return Number(val).toFixed(2);
  }

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

    // Derive top KPIs from snapshots
    const kpis = [];
    const shop = snapshots.find(s => s.channel === "shopify");
    const meta = snapshots.find(s => s.channel === "meta_ads");
    const gads = snapshots.find(s => s.channel === "google_ads");
    const mail = snapshots.find(s => s.channel === "klaviyo");
    const web  = snapshots.find(s => s.channel === "ga4");

    if (shop) kpis.push({ label: "Revenue",    value: fmtMetricValue("revenue", shop.metrics?.revenue),    sub: "Shopify" });
    if (shop) kpis.push({ label: "Orders",     value: fmtMetricValue("orders", shop.metrics?.orders),      sub: "Shopify" });
    if (meta) kpis.push({ label: "ROAS",       value: fmtMetricValue("roas", meta.metrics?.roas),          sub: "Meta Ads" });
    if (gads) kpis.push({ label: "ROAS",       value: fmtMetricValue("roas", gads.metrics?.roas),          sub: "Google Ads" });
    if (mail) kpis.push({ label: "Open Rate",  value: fmtMetricValue("open_rate", mail.metrics?.open_rate), sub: "Email" });
    if (web)  kpis.push({ label: "Sessions",   value: fmtMetricValue("sessions", web.metrics?.sessions),   sub: "Web" });

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
                  Open →
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ─── Insights cards ───────────────────────────────────────────────────────────

  function InsightsGrid({ items, loading }) {
    if (loading) return null;
    if (!items || items.length === 0) return null;

    return (
      <section style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 12px" }}>
          Insights
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {items.map((item, i) => {
            const channelMeta = Object.values(CHANNEL_META).find(m => m.label.toLowerCase() === (item.channel || "").toLowerCase());
            return (
              <div key={i} style={{
                background: "var(--paper)", border: "1px solid var(--rule)",
                borderRadius: 8, padding: "14px 16px",
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
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>{item.body}</div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // ─── Data by Channel ──────────────────────────────────────────────────────────

  function ChannelMetricTable({ snapshot }) {
    const meta   = CHANNEL_META[snapshot.channel] || { label: snapshot.channel, icon: "📊", color: "#666" };
    const keys   = CHANNEL_KEY_METRICS[snapshot.channel] || Object.keys(snapshot.metrics).filter(k => k !== "period" && k !== "date_start" && k !== "date_end");
    const values = snapshot.metrics;

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
          {values.period && (
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
              {values.date_start && values.date_end ? `${values.date_start} → ${values.date_end}` : values.period}
            </span>
          )}
        </div>
        {/* Metric grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
          {keys.map((key, i) => (
            <div key={key} style={{
              padding: "10px 14px",
              borderRight: "1px solid var(--rule)",
              borderBottom: "1px solid var(--rule)",
            }}>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {fmtMetricLabel(key)}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace" }}>
                {fmtMetricValue(key, values[key])}
              </div>
            </div>
          ))}
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
    const [messages, setMessages] = useState([]);
    const [input, setInput]   = useState("");
    const [busy, setBusy]     = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
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

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            specialist: "analyst",
            tenantId,
            // Inject analytics context via a special brand override
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

  // ─── Main InsightsCenter component ────────────────────────────────────────────

  function InsightsCenter({ state }) {
    const tenantId   = state?.auth?.user?.id || state?.tenantId || null;
    const [period, setPeriod]         = useState("30d");
    const [snapshots, setSnapshots]   = useState([]);
    const [insights, setInsights]     = useState(null);
    const [loading, setLoading]       = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [error, setError]           = useState(null);

    const supaUrl = window.__SUPABASE_URL__;
    const supaKey = window.__SUPABASE_ANON_KEY__;

    // Load existing data from Supabase on mount / period change
    const loadCached = useCallback(async () => {
      if (!tenantId) return;
      setLoading(true);
      setError(null);
      try {
        const [snapRes, insRes] = await Promise.all([
          fetch(`${supaUrl}/rest/v1/analytics_snapshots?tenant_id=eq.${encodeURIComponent(tenantId)}&period=eq.${encodeURIComponent(period)}&select=*`,
            { headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}` } }),
          fetch(`${supaUrl}/rest/v1/analytics_insights?tenant_id=eq.${encodeURIComponent(tenantId)}&period=eq.${encodeURIComponent(period)}&select=*&order=generated_at.desc&limit=1`,
            { headers: { "apikey": supaKey, "Authorization": `Bearer ${supaKey}` } }),
        ]);

        if (snapRes.ok) {
          const rows = await snapRes.json();
          setSnapshots(rows.map(r => ({ channel: r.channel, metrics: r.metrics, fetched_at: r.fetched_at })));
          if (rows.length > 0) {
            setLastUpdated(rows.sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at))[0].fetched_at);
          }
        }

        if (insRes.ok) {
          const rows = await insRes.json();
          if (rows.length > 0) {
            setInsights({
              summary:             rows[0].summary,
              insights:            rows[0].insights || [],
              recommended_actions: rows[0].recommended_actions || [],
            });
          }
        }
      } catch (e) {
        setError("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    }, [tenantId, period, supaUrl, supaKey]);

    useEffect(() => { loadCached(); }, [loadCached]);

    // Pull live data from Composio + re-generate insights
    async function handleRefresh() {
      if (!tenantId || refreshing) return;
      setRefreshing(true);
      setError(null);
      try {
        const res = await fetch("/api/analytics-ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, period }),
        });
        const data = await res.json();
        if (data.ok) {
          // Reload from DB to pick up freshly written data
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
      // Dispatch a navigation event the shell listens to
      window.dispatchEvent(new CustomEvent("flowos:navigate", { detail: { workspace } }));
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

        {/* Error banner */}
        {error && (
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
          ) : !hasData ? (
            <EmptyState onRefresh={handleRefresh} loading={refreshing} />
          ) : (
            <>
              <SummarySection insights={insights} snapshots={snapshots} loading={loading} />
              <RecommendedActions actions={insights?.recommended_actions} loading={loading} onNavigate={handleNavigate} />
              <InsightsGrid items={insights?.insights} loading={loading} />
              <DataByChannel snapshots={snapshots} loading={loading} />
              <AnalyticsChat tenantId={tenantId} snapshots={snapshots} insights={insights} period={period} />
            </>
          )}
        </div>
      </div>
    );
  }

  // Override the stub from workspaces3.jsx
  window.InsightsCenter = InsightsCenter;
})();
