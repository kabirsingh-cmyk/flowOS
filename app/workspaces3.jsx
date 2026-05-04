// MVEDA workspaces — part 3: Publishing, Insights, Inbox, Autonomy
const { useState: useState3, useMemo: useMemo3, useEffect: useEffect3, useRef: useRef3 } = React;

// ────────────────────────────── PUBLISHING QUEUE ──────────────────────────────
function PublishingQueue({ state, actions }) {
  const [editItem, setEditItem] = useState3(null);
  const queue = state.calendar.filter(c => ["approved", "scheduled", "review", "policy", "paused"].includes(c.status));

  const togglePause = (item) => {
    const next = item.status === "paused" ? "scheduled" : "paused";
    actions.updateItem(item.id, { status: next }, {
      logEvent: `${next === "paused" ? "paused" : "resumed"} · '${item.title}'`,
      notify: { tone: "neutral", text: `'${item.title}' ${next === "paused" ? "paused" : "resumed"}` },
    });
  };
  const pauseAll = () => {
    queue.forEach(q => { if (q.status !== "paused") actions.updateItem(q.id, { status: "paused" }); });
    actions.notify("warn", `Paused ${queue.length} items`);
    actions.log("Ana O.", `paused all queued items · ${queue.length}`);
  };
  const sendNow = () => {
    const first = queue.find(q => q.status !== "paused");
    if (!first) return actions.notify("warn", "Nothing to send");
    actions.updateItem(first.id, { status: "sent" }, {
      logEvent: `sent · '${first.title}'`,
      notify: { tone: "ok", text: `Sent '${first.title}' to ${first.channel}` },
    });
  };
  const time = (i) => {
    const base = 9 + i * 1.7;
    const h = Math.floor(base); const m = Math.floor((base - h) * 60);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  };

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>05 · Ship</div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Publishing Queue</h1>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>{queue.length} items scheduled · next send 09:42 · autopause available</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn size="sm" onClick={pauseAll}><Icon name="pause" size={12}/> Pause all</Btn>
          <Btn size="sm" variant="primary" onClick={sendNow}><Icon name="send" size={12}/> Send now</Btn>
        </div>
      </div>

      <div style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "70px 100px 110px 1fr 110px 110px 80px",
          padding: "10px 14px", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)",
          fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          <span>Time</span><span>Channel</span><span>Campaign</span><span>Item</span><span>Tone</span><span>Status</span><span/>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {queue.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Queue is empty.</div>}
          {queue.map((item, i) => {
            const isPaused = item.status === "paused";
            const chip = statusChip(isPaused ? "draft" : item.status);
            return (
              <div key={item.id} className="row-hover" style={{
                display: "grid", gridTemplateColumns: "70px 100px 110px 1fr 110px 110px 80px",
                padding: "12px 14px", borderBottom: "1px solid var(--rule)",
                alignItems: "center", fontSize: 12.5, opacity: isPaused ? 0.5 : 1,
              }}>
                <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{time(i)}</span>
                <span>{item.channel}</span>
                <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{item.campaign}</span>
                <span style={{ fontWeight: 500 }}>{item.title}</span>
                <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{item.tone}</span>
                <span>{isPaused ? <Chip>paused</Chip> : <Chip tone={chip.tone}>{chip.label}</Chip>}</span>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <Btn size="sm" variant="ghost" onClick={() => togglePause(item)}>
                    <Icon name={isPaused ? "play" : "pause"} size={11}/>
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setEditItem(item)}><Icon name="edit" size={11}/></Btn>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Drawer open={!!editItem} onClose={() => setEditItem(null)} title={editItem?.title || ""}
        actions={editItem && <>
          <Btn variant="ghost" onClick={() => setEditItem(null)}>Close</Btn>
          <Btn variant="danger" onClick={() => { actions.removeItem(editItem.id); setEditItem(null); }}>
            <Icon name="x" size={12}/> Remove
          </Btn>
          <Btn variant="primary" onClick={() => {
            actions.updateItem(editItem.id, { status: "sent" }, { logEvent: `sent · '${editItem.title}'`, notify: { tone: "ok", text: `Sent '${editItem.title}'` }});
            setEditItem(null);
          }}><Icon name="send" size={12}/> Send now</Btn>
        </>}>
        {editItem && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Chip tone="accent">{editItem.channel}</Chip>
              <Chip>{editItem.tone}</Chip>
              <Chip tone={statusChip(editItem.status).tone}>{editItem.status}</Chip>
            </div>
            <FormRow label="Scheduled for">
              <Input defaultValue={`${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][editItem.day]} · 09:42`}/>
            </FormRow>
            <FormRow label="Caption">
              <Textarea defaultValue={`Built for the 12th mile, not the first. Stride 03 · now yours.\n\n#trailready #northwarren`}/>
            </FormRow>
            <FormRow label="Campaign"><Input defaultValue={editItem.campaign}/></FormRow>
          </div>
        )}
      </Drawer>
    </div>
  );
}

// ────────────────────────────── INSIGHTS CENTER ──────────────────────────────
function InsightsCenter({ state, actions }) {
  const [tab, setTab] = useState3("overview");
  const [chatHistory, setChatHistory] = useState3([
    { role: "user", text: "how did mveda do on meta this week, break down organic vs ads" },
    { role: "ai", agent: "Analyst", streaming: false, text: "Here's MVEDA on Meta this week:\n\n**Organic (Instagram)**\nReach: 148,200 (+22% vs last week)\nEngagement rate: 4.8% (+0.6pp vs prior week)\nTop post: Saffron Ritual Reel — 42,100 reach, 2,840 likes, 1,240 saves\nFollower growth: +340 this week\n\n**Paid (Meta Ads)**\nSpend: $3,840 (of $7,700 budget)\nRevenue attributed: $26,140\nROAS: 6.8x blended\nBest campaign: Saffron Serum Retargeting — 8.5x ROAS, $2.40 CPL\n\n⚠️ Priority flag: Body Oil Advantage+ creative fatigue. Frequency at 4.2× (above 3× fatigue threshold). ROAS has declined from 7.6x → 4.1x over 7 days. Recommend rotating creative this week." },
  ]);
  const [chatInput, setChatInput] = useState3("");
  const chatEndRef = useRef3(null);

  const mult = { "7d": 0.5, "30d": 1, "90d": 2.4, "YTD": 5.1 }[state.dateRange] || 1;

  const brandId = state?.activeBrandId || state?.brandPreset?.id || "mveda";
  const isErickson = brandId === "erickson";

  const D = isErickson ? {
    aiNarrative: "Summer cooling season 6 weeks out — commercial refrigeration service demand across Seattle, Auburn & Lynnwood is tracking up 28%. Google Search is your top lead channel: 'commercial refrigeration repair Seattle' and 'walk-in cooler service WA' converting at 9.4% CTR. Post-service follow-up email hitting 54.2% open rate — highest revenue-per-send driver. LinkedIn pipeline has 4 facility manager leads in active conversation. Recommend increasing Google Search budget by $800 ahead of the June–August peak and sending the service contract renewal campaign to the 340-account lapsed segment.",
    social: [
      { platform: "LinkedIn",  id: "li", color: "oklch(48% 0.14 240)", followers: 1840,  followerDelta: "+64 (+3.6%)",   reach: Math.round(6200*mult),   reachDelta: "+28%",  engRate: 4.8, posts: Math.round(6*mult),  topCaption: "What restaurant operators get wrong about walk-in cooler maintenance (and how it costs them)", topReach: Math.round(2400*mult),  topLikes: Math.round(84*mult)   },
      { platform: "Facebook",  id: "fb", color: "oklch(48% 0.18 260)", followers: 3640,  followerDelta: "+32 (+0.9%)",   reach: Math.round(9800*mult),   reachDelta: "+14%",  engRate: 2.4, posts: Math.round(8*mult),  topCaption: "Walk-in cooler down at 11pm? We answer every call. 24/7 emergency service across WA, OR & ID.", topReach: Math.round(3200*mult),  topLikes: Math.round(142*mult)  },
      { platform: "YouTube",   id: "yt", color: "oklch(55% 0.22 25)",  followers: 280,   followerDelta: "+22 (+8.5%)",   reach: Math.round(11400*mult),  reachDelta: "+52%",  engRate: 3.6, posts: Math.round(2*mult),  topCaption: "How to spot a failing walk-in cooler compressor before it shuts down your kitchen", topReach: Math.round(8400*mult),  topLikes: Math.round(148*mult)  },
    ],
    paid: [
      { id: "p1", name: "Commercial refrigeration repair · Search", platform: "Google",   budget: Math.round(2800*mult), spend: Math.round(2540*mult), revenue: Math.round(22400*mult), roas: 8.8,  cpl: 38,  ctr: 9.4,  status: "active", trend: +0.6 },
      { id: "p2", name: "Walk-in cooler service · Seattle",         platform: "Google",   budget: Math.round(1400*mult), spend: Math.round(1240*mult), revenue: Math.round(10800*mult), roas: 8.7,  cpl: 42,  ctr: 7.8,  status: "active", trend: +0.4 },
      { id: "p3", name: "Erickson brand keywords",                  platform: "Google",   budget: Math.round(600*mult),  spend: Math.round(520*mult),  revenue: Math.round(4160*mult),  roas: 8.0,  cpl: 52,  ctr: 5.2,  status: "active", trend: +0.1 },
      { id: "p4", name: "Facility managers · LinkedIn",             platform: "LinkedIn", budget: Math.round(1000*mult), spend: Math.round(880*mult),  revenue: Math.round(12320*mult), roas: 14.0, cpl: 220, ctr: 1.6,  status: "active", trend: +0.8 },
      { id: "p5", name: "Local awareness · Facebook",               platform: "Meta",     budget: Math.round(400*mult),  spend: Math.round(340*mult),  revenue: Math.round(1360*mult),  roas: 4.0,  cpl: 68,  ctr: 1.0,  status: "paused", trend: -0.3 },
    ],
    email: [
      { id: "e1", name: "Post-service follow-up",            type: "flow",     sends: Math.round(980*mult),   openRate: 54.2, ctr: 18.4, revenue: Math.round(24500*mult), unsubRate: 0.0, status: "live" },
      { id: "e2", name: "Service contract renewal",          type: "flow",     sends: Math.round(340*mult),   openRate: 44.8, ctr: 14.2, revenue: Math.round(38400*mult), unsubRate: 0.1, status: "live" },
      { id: "e3", name: "Spring PM reminder — full list",    type: "campaign", sends: Math.round(1840*mult),  openRate: 38.6, ctr: 9.2,  revenue: Math.round(32000*mult), unsubRate: 0.2, status: "sent" },
      { id: "e4", name: "Summer cooling season prep",        type: "campaign", sends: Math.round(1840*mult),  openRate: null, ctr: null,  revenue: null,                   unsubRate: null, status: "draft" },
      { id: "e5", name: "Lapsed accounts · PM contract",    type: "campaign", sends: Math.round(340*mult),   openRate: null, ctr: null,  revenue: null,                   unsubRate: null, status: "draft" },
    ],
  } : {
    // original MVEDA data — keep exactly as-is
    aiNarrative: "TikTok is your fastest-growing channel — reach up 44% driven by the Hair Ritual Reel series (saves 2.4× account average). Meta Ads ROAS trending down on Body Oil Advantage+ (freq 4.2×, ROAS 6.8x → 4.1x) — new creative this week is the priority. Welcome flow is hitting 58% open rate, your #1 revenue-per-send driver. Organic Pinterest is quietly steady; consider increasing pin frequency to capture peak discovery season.",
    social: [
      { platform: "Instagram", id: "ig", color: "oklch(62% 0.18 340)", followers: 24810, followerDelta: "+340 (+1.4%)", reach: Math.round(148200*mult), reachDelta: "+22%", engRate: 4.8, posts: Math.round(24*mult), topCaption: "Three drops. Palms warmed. Drawn through the lengths.", topReach: Math.round(42100*mult), topLikes: Math.round(2840*mult) },
      { platform: "TikTok",    id: "tt", color: "oklch(18% 0.02 260)", followers: 31200, followerDelta: "+1,240 (+4.1%)", reach: Math.round(212400*mult), reachDelta: "+44%", engRate: 6.2, posts: Math.round(12*mult), topCaption: "Abhyanga self-massage · 3 minutes before bed", topReach: Math.round(98200*mult), topLikes: Math.round(8410*mult) },
      { platform: "Pinterest", id: "pn", color: "oklch(52% 0.20 28)",  followers: 8940,  followerDelta: "+120 (+1.3%)",  reach: Math.round(84200*mult),  reachDelta: "+8%",  engRate: 2.1, posts: Math.round(18*mult), topCaption: "The ritual board — MVEDA morning collection", topReach: Math.round(12400*mult), topLikes: Math.round(4210*mult) },
      { platform: "Facebook",  id: "fb", color: "oklch(48% 0.18 260)", followers: 12400, followerDelta: "+40 (+0.3%)",   reach: Math.round(28400*mult),  reachDelta: "+3%",  engRate: 1.4, posts: Math.round(8*mult),  topCaption: "Weekend ritual — share yours", topReach: Math.round(4200*mult),  topLikes: Math.round(280*mult) },
    ],
    paid: [
      { id: "p1", name: "Body Oil · Advantage+",       platform: "Meta",   budget: Math.round(4200*mult), spend: Math.round(3840*mult), revenue: Math.round(26140*mult), roas: 6.8, cpl: 4.12, ctr: 2.4, status: "active",  trend: -0.8 },
      { id: "p2", name: "Hair Ritual · Awareness",     platform: "Meta",   budget: Math.round(2100*mult), spend: Math.round(1920*mult), revenue: Math.round(11400*mult), roas: 5.9, cpl: 5.80, ctr: 1.9, status: "active",  trend: +0.4 },
      { id: "p3", name: "Saffron Serum · Retargeting", platform: "Meta",   budget: Math.round(1400*mult), spend: Math.round(1280*mult), revenue: Math.round(10880*mult), roas: 8.5, cpl: 2.40, ctr: 3.8, status: "active",  trend: +1.2 },
      { id: "p4", name: "Brand awareness · Reels",     platform: "TikTok", budget: Math.round(800*mult),  spend: Math.round(720*mult),  revenue: Math.round(3240*mult),  roas: 4.5, cpl: 6.10, ctr: 1.4, status: "paused",  trend: -0.2 },
      { id: "p5", name: "Neem Cleanser · Search",      platform: "Google", budget: Math.round(600*mult),  spend: Math.round(540*mult),  revenue: Math.round(4320*mult),  roas: 8.0, cpl: 3.20, ctr: 4.2, status: "active",  trend: +0.6 },
    ],
    email: [
      { id: "e1", name: "Welcome series",            type: "flow",     sends: Math.round(1840*mult),  openRate: 58.2, ctr: 12.4, revenue: Math.round(18200*mult), unsubRate: 0.1, status: "live" },
      { id: "e2", name: "Browse abandonment",         type: "flow",     sends: Math.round(3240*mult),  openRate: 42.1, ctr: 8.2,  revenue: Math.round(12400*mult), unsubRate: 0.2, status: "live" },
      { id: "e3", name: "Hair Ritual launch",         type: "campaign", sends: Math.round(24100*mult), openRate: 34.8, ctr: 5.2,  revenue: Math.round(14200*mult), unsubRate: 0.3, status: "sent" },
      { id: "e4", name: "Ritual subscription nudge",  type: "campaign", sends: Math.round(18400*mult), openRate: 36.4, ctr: 4.8,  revenue: Math.round(8240*mult),  unsubRate: 0.2, status: "sent" },
      { id: "e5", name: "Win-back · 90d lapsed",     type: "flow",     sends: Math.round(2140*mult),  openRate: 28.2, ctr: 6.1,  revenue: Math.round(6180*mult),  unsubRate: 0.4, status: "live" },
    ],
  };

  const tabs = ["overview", "social", "paid", "email", "ai"];
  const tabLabels = { overview: "Overview", social: "Social", paid: "Paid", email: "Email", ai: "AI Analyst" };

  function inferInsightResponse(q) {
    const lower = q.toLowerCase();
    if (isErickson) {
      if (/google|search|sem/.test(lower)) {
        return "**Google Search — Erickson Commercial Refrigeration this period**\n\nCommercial refrigeration repair (Seattle): 9.4% CTR · $2,540 spend · 8.8x ROAS\nWalk-in cooler service WA: 7.8% CTR · $1,240 spend · 8.7x ROAS\nBrand keywords: 5.2% CTR · $520 spend · 8.0x ROAS\n\n**Total Google: $4,300 spend → $37,360 revenue · 8.7x blended ROAS**\n\nHigh-intent commercial searches are converting at strong CPL ($38–$42). Top opportunity: expand to 'commercial refrigeration service OR' and 'walk-in freezer repair Idaho' — you have the service area but no coverage yet.";
      }
      if (/summer|seasonal|peak|cooling/.test(lower)) {
        return "**Summer Cooling Season Forecast — Erickson**\n\nSeattle area commercial cooling demand tracking up 28% as temps rise. Restaurants + grocery operations see highest emergency call volume May–August.\n\nRecommended actions:\n• Increase Google Search budget by $800/mo starting May\n• Send 'Summer cooling season prep' email to 1,840 contacts (draft ready)\n• Add emergency call extension to all Google Ads — direct dial from search\n• LinkedIn content: 'Pre-summer refrigeration checklist for restaurant operators'\n• Target seafood restaurants, grocery chains & catering operations — highest seasonal risk\n\nProjected Q3 revenue uplift: $55k–$80k with proactive outreach.";
      }
      if (/lead|cpl|cost per/.test(lower)) {
        return "**Lead Performance — Erickson this period**\n\nNew accounts won: 9 (+3 vs prior period)\nCost per new account by channel:\n• Google Search: $38 CPL (best volume channel)\n• LinkedIn (facility managers): $220 CPL (highest contract value)\n• Facebook: $68 CPL (paused — underperforming)\n\nAvg contract value: $8,400/year\nHighest-value lead source: LinkedIn (facility managers at restaurants, museums, commercial kitchens — avg contract $12k+)\n\nRecommend reactivating Facebook with a 'Free PM inspection' lead form targeting restaurant owners within 50 miles of Seattle, Auburn & Lynnwood.";
      }
      if (/linkedin|b2b|commercial|facility/.test(lower)) {
        return "**LinkedIn Performance — Erickson**\n\nOrganic: 6,200 reach (+28%) · 4.8% engagement · top post: walk-in cooler maintenance guide\nPaid (facility manager targeting): $880 spend · 1.6% CTR · 14.0x ROAS · 4 active leads\n\nLinkedIn is your highest contract-value channel — facility managers, restaurant groups and property managers convert at avg $12k+/year contracts. Current 4 active leads represent ~$48k pipeline.\n\nContent recommendation: case study featuring Museum of Pop Culture or O'Brien Auto Group — social proof from recognisable names converts well for commercial accounts.";
      }
      if (/email|klaviyo|renewal|contract/.test(lower)) {
        return "**Email Performance — Erickson**\n\nPost-service follow-up flow: 54.2% open rate · 18.4% CTR · $24,500 revenue MTD (your #1 revenue-per-send)\nService contract renewal flow: 44.8% open rate · 14.2% CTR · $38,400 revenue MTD\nSpring PM reminder campaign: 38.6% open rate · $32,000 revenue\n\n**Draft ready: Summer cooling prep campaign** (1,840 contacts) — schedule by May 10 to land before June demand peak.\n**Draft ready: Lapsed accounts PM contract** (340 accounts, $0 revenue last 18mo) — re-engagement offer with free inspection.\n\nEmail is your highest-margin channel — recommend prioritising both draft campaigns this week.";
      }
      return "Here's Erickson Commercial Refrigeration across connected channels for the trailing " + (state.dateRange || "30d") + " window:\n\nGoogle Search is your top lead volume channel (8.7x blended ROAS). LinkedIn is your highest-value channel — 4 facility manager leads, avg contract $12k+. Post-service email hitting 54.2% open rate, well above B2B benchmark. Summer cooling season incoming — recommend increasing Google budget and activating both email drafts.\n\nAsk me about Google, LinkedIn, email, seasonal demand, or lead costs for a deeper breakdown.";
    }
    if (/tiktok.*month|month.*tiktok/.test(lower)) {
      return "**TikTok: This Month vs Last Month**\n\nReach: 212,400 this month vs 147,500 last month (+44%)\nFollower growth: +1,240 this month vs +820 last month (+51%)\nEngagement rate: 6.2% vs 5.4% (+0.8pp)\nTop format: Hair Ritual Reel series driving outsized saves (2.4× account average)\n\nMomentum is accelerating — the Abhyanga content series is resonating strongly. Recommend doubling post frequency and testing a 60-second format this week.";
    }
    if (/product.*conversion|conversion.*product/.test(lower)) {
      return "**Product Conversions from Instagram**\n\nBody Oil: 34% of attributed conversions\nSaffron Serum: 28%\nHair Mist: 18%\nNeem Cleanser: 12%\nOther: 8%\n\nBody Oil and Saffron Serum together account for 62% of IG-driven conversions. Saffron Serum has the highest ROAS at 8.5x — recommend increasing reach for this SKU via retargeting expansion.";
    }
    if (/email.*revenue|revenue.*email/.test(lower)) {
      return "**Email Revenue Breakdown**\n\nWelcome flow: $18,200\nHair Ritual launch: $14,200\nBrowse abandonment: $12,400\nSubscription nudge: $8,240\nWin-back · 90d lapsed: $6,180\n\n**Total: $59,220**\n\nWelcome flow is your top revenue-per-send asset at 58.2% open rate — 3× industry average. Prioritise A/B testing the win-back flow subject line to improve its 28.2% open rate.";
    }
    if (/best.*day|best.*time|when.*post/.test(lower)) {
      return "**Best Times to Post by Platform**\n\n**Instagram:** Tuesday & Thursday 6–9am (peak saves + reach), weekday evenings 6–9pm for engagement\n\n**TikTok:** Weekday evenings 6–9pm (highest view velocity), Tuesday and Thursday perform best\n\n**Pinterest:** Weekend mornings 9am–12pm (discovery intent peaks Saturday), Tuesday also strong\n\n**Facebook:** Weekdays 9am–12pm for link clicks, low ROI on evenings\n\nFor maximum reach across all channels, Tuesday and Thursday 6–9am is your highest-density window.";
    }
    return "I've pulled data across your connected channels for that query. Based on the trailing " + (state.dateRange || "30d") + " window:\n\nInstagram is your highest-reach organic channel (+22% this period). TikTok is your fastest-growing (+44% reach, +4.1% follower growth). Paid channels are blending at 6.7x ROAS with Saffron Serum Retargeting leading at 8.5x. Email is your strongest revenue-per-send driver — welcome flow at 58.2% open rate.\n\nAsk me to break down any specific channel, campaign, or product for deeper analysis.";
  }

  useEffect3(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  function submitChat(text) {
    const q = text.trim();
    if (!q) return;
    const userMsg = { role: "user", text: q };
    const aiMsg = { role: "ai", agent: "Analyst", streaming: false, text: inferInsightResponse(q) };
    setChatHistory(prev => [...prev, userMsg, aiMsg]);
    setChatInput("");
  }

  function formatAiText(text) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return React.createElement("strong", { key: i }, part.slice(2, -2));
      }
      const lines = part.split(/\n\n|\n/g);
      const result = [];
      lines.forEach((line, j) => {
        result.push(line);
        if (j < lines.length - 1) result.push(React.createElement("br", { key: i + "-br-" + j }));
      });
      return result;
    });
  }

  const totalReach = D.social.reduce((s, p) => s + p.reach, 0);
  const totalFollowers = D.social.reduce((s, p) => s + p.followers, 0);
  const totalPaidSpend = D.paid.reduce((s, c) => s + c.spend, 0);
  const totalPaidRevenue = D.paid.reduce((s, c) => s + c.revenue, 0);
  const blendedROAS = (totalPaidRevenue / totalPaidSpend).toFixed(1);
  const totalEmailRevenue = D.email.reduce((s, e) => s + e.revenue, 0);
  const totalEmailSends = D.email.reduce((s, e) => s + e.sends, 0);
  const avgOpenRate = (D.email.reduce((s, e) => s + e.openRate, 0) / D.email.length).toFixed(1);
  const avgCTR = (D.email.reduce((s, e) => s + e.ctr, 0) / D.email.length).toFixed(1);
  const maxReach = Math.max(...D.social.map(p => p.reach));

  const roasBadgeTone = (roas) => roas >= 7 ? "ok" : roas >= 5 ? "accent" : "danger";
  const roasBadgeStyle = (roas) => {
    if (roas >= 7) return { background: "var(--success-wash)", color: "oklch(35% 0.1 155)", border: "1px solid var(--success)", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600 };
    if (roas >= 5) return { background: "var(--accent-wash)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600 };
    return { background: "var(--danger-wash,#fef2f2)", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600 };
  };

  const heatmapDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatmapTimes = ["6am", "9am", "12pm", "3pm", "6pm", "9pm"];
  function heatmapLevel(dayIdx, timeIdx) {
    const d = heatmapDays[dayIdx];
    const t = heatmapTimes[timeIdx];
    const isWeekend = dayIdx >= 5;
    const isWeekday = dayIdx < 5;
    if ((d === "Tue" || d === "Thu") && (t === "6am" || t === "9am")) return "high";
    if (isWeekday && (t === "6pm" || t === "9pm")) return "med";
    if (isWeekend && (t === "9am" || t === "12pm")) return "med";
    return "low";
  }

  function renderOverview() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ padding: 20, borderRadius: 8, background: "var(--accent-wash)", border: "1px solid var(--accent)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>✦</span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>AI analysis</span>
          </div>
          <div style={{ fontSize: 14.5, fontStyle: "italic", fontFamily: "Georgia, serif", lineHeight: 1.65, color: "var(--ink)" }}>{D.aiNarrative}</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 10, letterSpacing: "0.04em" }}>Updates when new data syncs · 30 min ago</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--gap)" }}>
          <Kpi label="Total reach" value={`${(totalReach/1000).toFixed(0)}k`} delta={22} unit="%" sparkline={[0.3,0.4,0.5,0.45,0.6,0.55,0.65,0.7,0.72,0.78,0.85]}/>
          <Kpi label="Blended ROAS" value={`${blendedROAS}x`} delta={0} unit="" sparkline={[0.6,0.65,0.7,0.68,0.72,0.75,0.78,0.74,0.76,0.78,0.8]}/>
          <Kpi label="Email revenue" value={`$${(totalEmailRevenue/1000).toFixed(1)}k`} delta={14} unit="%" sparkline={[0.4,0.5,0.55,0.6,0.65,0.7,0.68,0.72,0.75,0.8,0.85]}/>
          <Kpi label="Total followers" value={totalFollowers.toLocaleString()} delta={6} unit="%" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
          <Card title="Channel performance" meta="reach · all platforms">
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {D.social.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }}/>
                  <div style={{ width: 72, fontSize: 12.5, fontWeight: 500, flexShrink: 0 }}>{p.platform}</div>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--paper-2)", overflow: "hidden" }}>
                    <div style={{ width: `${(p.reach / maxReach) * 100}%`, height: "100%", background: p.color, transition: "width .4s ease" }}/>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", width: 54, textAlign: "right", flexShrink: 0 }}>{(p.reach/1000).toFixed(0)}k</div>
                  <div style={{ width: 44, flexShrink: 0 }}>
                    <span style={{ fontSize: 10.5, padding: "2px 5px", borderRadius: 3, background: "var(--success-wash)", color: "oklch(35% 0.1 155)", fontFamily: "var(--font-mono)" }}>{p.reachDelta}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Flags &amp; opportunities" meta="intelligence">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <div style={{ padding: 12, borderRadius: 5, background: "var(--warn-wash)", border: "1px solid oklch(75% 0.12 75)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>⚠ Meta creative fatigue</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45 }}>Body Oil Advantage+ freq 4.2×, ROAS down 0.8x. Refresh creative.</div>
              </div>
              <div style={{ padding: 12, borderRadius: 5, background: "var(--success-wash)", border: "1px solid var(--success)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "oklch(35% 0.1 155)" }}>↑ TikTok breakout</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45 }}>Hair Ritual Reel series 2.4× account average on saves. Scale this format.</div>
              </div>
              <div style={{ padding: 12, borderRadius: 5, background: "var(--accent-wash)", border: "1px solid var(--accent)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--accent)" }}>✦ Email milestone</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45 }}>Welcome flow hit 58% open rate, above industry 3× benchmark.</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  function renderSocial() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
          {D.social.map(p => (
            <div key={p.id} style={{ border: "1px solid var(--rule)", borderLeft: `4px solid ${p.color}`, borderRadius: 6, background: "var(--paper)", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }}/>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{p.platform}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Followers</div>
                  <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{p.followers.toLocaleString()}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{p.followerDelta}</div>
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Reach</div>
                  <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{(p.reach/1000).toFixed(0)}k</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{p.reachDelta}</div>
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Eng. rate</div>
                  <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{p.engRate}%</div>
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Posts</div>
                  <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{p.posts}</div>
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 12 }}>
                <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Top post</div>
                <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>"{p.topCaption}"</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{(p.topReach/1000).toFixed(0)}k reach</span>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.topLikes.toLocaleString()} likes</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Card title="Top posts this period" meta="by reach">
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 80px 80px 80px", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <span>Platform</span><span>Caption</span><span>Reach</span><span>Likes</span><span>Eng.</span>
            </div>
            {D.social.map((p, i) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr 80px 80px 80px", gap: 12, padding: "11px 0", borderBottom: i < D.social.length - 1 ? "1px solid var(--rule)" : 0, alignItems: "center", fontSize: 12.5 }}>
                <span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: "var(--paper-2)", border: "1px solid var(--rule)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, display: "inline-block" }}/>
                    {p.platform}
                  </span>
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-2)", fontStyle: "italic", fontSize: 12 }}>
                  {p.topCaption.length > 60 ? p.topCaption.slice(0, 60) + "…" : p.topCaption}
                </span>
                <span className="mono" style={{ fontSize: 11.5 }}>{(p.topReach/1000).toFixed(0)}k</span>
                <span className="mono" style={{ fontSize: 11.5 }}>{p.topLikes.toLocaleString()}</span>
                <span className="mono" style={{ fontSize: 11.5 }}>{p.engRate}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Best time to post" meta="engagement heat map">
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <div style={{ width: 40 }}/>
              {heatmapDays.map(d => (
                <div key={d} style={{ width: 32, textAlign: "center", fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--muted)", letterSpacing: "0.04em" }}>{d}</div>
              ))}
            </div>
            {heatmapTimes.map((t, ti) => (
              <div key={t} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                <div style={{ width: 40, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", textAlign: "right", paddingRight: 6 }}>{t}</div>
                {heatmapDays.map((d, di) => {
                  const level = heatmapLevel(di, ti);
                  const bg = level === "high" ? "var(--success)" : level === "med" ? "var(--accent-wash)" : "var(--paper-2)";
                  const border = level === "med" ? "1px solid var(--accent)" : "1px solid var(--rule)";
                  return (
                    <div key={d} title={`${d} ${t} · ${level === "high" ? "high" : level === "med" ? "medium" : "low"} engagement`} style={{ width: 32, height: 26, borderRadius: 3, background: bg, border, transition: "background .2s" }}/>
                  );
                })}
              </div>
            ))}
            <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted)" }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: "var(--success)" }}/> High (IG: Tue/Thu 6–9am)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted)" }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: "var(--accent-wash)", border: "1px solid var(--accent)" }}/> Medium (TikTok evenings · Pinterest weekends)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted)" }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: "var(--paper-2)", border: "1px solid var(--rule)" }}/> Low
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  function renderPaid() {
    const metaCamps = D.paid.filter(c => c.platform === "Meta");
    const ttCamps = D.paid.filter(c => c.platform === "TikTok");
    const gCamps = D.paid.filter(c => c.platform === "Google");
    const metaROAS = (metaCamps.reduce((s,c) => s + c.revenue, 0) / metaCamps.reduce((s,c) => s + c.spend, 0)).toFixed(1);
    const ttROAS = (ttCamps.reduce((s,c) => s + c.revenue, 0) / ttCamps.reduce((s,c) => s + c.spend, 0)).toFixed(1);
    const gROAS = (gCamps.reduce((s,c) => s + c.revenue, 0) / gCamps.reduce((s,c) => s + c.spend, 0)).toFixed(1);
    const totalClicks = D.paid.reduce((s,c) => s + Math.round(c.spend * c.ctr / 100 * 10), 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--gap)" }}>
          <Kpi label="Total spend" value={`$${(totalPaidSpend/1000).toFixed(1)}k`} delta={0} unit="" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
          <Kpi label="Total revenue" value={`$${(totalPaidRevenue/1000).toFixed(0)}k`} delta={8} unit="%" sparkline={[0.4,0.5,0.55,0.6,0.65,0.7,0.68,0.72,0.75,0.8,0.85]}/>
          <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: "14px 16px", background: "var(--paper)" }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Blended ROAS</div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em", color: "oklch(35% 0.1 155)" }}>{blendedROAS}x</div>
          </div>
          <Kpi label="Est. clicks" value={totalClicks.toLocaleString()} delta={5} unit="%" sparkline={[0.5,0.6,0.55,0.65,0.7,0.68,0.72,0.75,0.78,0.8,0.85]}/>
        </div>

        <Card title="Campaigns" meta={`${D.paid.length} active · trailing ${state.dateRange}`}>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 70px 80px 58px 46px 52px 64px", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <span>Campaign</span><span>Platform</span><span>Budget</span><span>Spend</span><span>Revenue</span><span>ROAS</span><span>CTR</span><span>Trend</span><span>Status</span>
            </div>
            {D.paid.map((c, i) => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 70px 80px 58px 46px 52px 64px", gap: 10, padding: "11px 0", borderBottom: i < D.paid.length - 1 ? "1px solid var(--rule)" : 0, alignItems: "center", fontSize: 12.5 }}>
                <span style={{ fontWeight: 500 }}>{c.name}</span>
                <span>
                  <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, background: "var(--paper-2)", border: "1px solid var(--rule)", fontFamily: "var(--font-mono)" }}>{c.platform}</span>
                </span>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>${(c.budget/1000).toFixed(1)}k</span>
                <span className="mono" style={{ fontSize: 11.5 }}>${(c.spend/1000).toFixed(1)}k</span>
                <span className="mono" style={{ fontSize: 11.5 }}>${(c.revenue/1000).toFixed(0)}k</span>
                <span><span style={roasBadgeStyle(c.roas)}>{c.roas}x</span></span>
                <span className="mono" style={{ fontSize: 11.5 }}>{c.ctr}%</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: c.trend > 0 ? "oklch(35% 0.1 155)" : c.trend < 0 ? "var(--danger)" : "var(--muted)" }}>
                  {c.trend > 0 ? "↑" : c.trend < 0 ? "↓" : "→"}
                  <span className="mono" style={{ fontSize: 10, marginLeft: 2 }}>{Math.abs(c.trend)}</span>
                </span>
                <span>
                  <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)", background: c.status === "active" ? "var(--success-wash)" : "var(--paper-2)", color: c.status === "active" ? "oklch(35% 0.1 155)" : "var(--muted)", border: c.status === "active" ? "1px solid var(--success)" : "1px solid var(--rule)" }}>{c.status}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--gap)" }}>
          {[{ label: "Meta blended ROAS", value: metaROAS, color: "oklch(48% 0.18 260)" }, { label: "TikTok ROAS", value: ttROAS, color: "oklch(18% 0.02 260)" }, { label: "Google ROAS", value: gROAS, color: "oklch(62% 0.18 160)" }].map(({ label, value, color }) => (
            <div key={label} style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: "18px 20px", background: "var(--paper)" }}>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", color }}>{value}x</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderEmail() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--gap)" }}>
          <Kpi label="Total sends" value={totalEmailSends.toLocaleString()} delta={12} unit="%" sparkline={[0.4,0.5,0.55,0.6,0.65,0.7,0.68,0.72,0.75,0.8,0.85]}/>
          <Kpi label="Avg open rate" value={`${avgOpenRate}%`} delta={3.2} unit="pp" sparkline={[0.5,0.55,0.6,0.58,0.62,0.65,0.68,0.7,0.72,0.75,0.8]}/>
          <Kpi label="Avg CTR" value={`${avgCTR}%`} delta={1.4} unit="pp" sparkline={[0.4,0.45,0.5,0.55,0.58,0.6,0.62,0.65,0.68,0.7,0.75]}/>
          <Kpi label="Email revenue" value={`$${(totalEmailRevenue/1000).toFixed(1)}k`} delta={14} unit="%" sparkline={[0.3,0.4,0.5,0.55,0.6,0.65,0.7,0.72,0.76,0.8,0.85]}/>
        </div>

        <Card title="Campaigns &amp; flows" meta={`${D.email.length} sequences · trailing ${state.dateRange}`}>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 1fr 46px 80px 58px 60px", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <span>Name</span><span>Type</span><span>Sends</span><span>Open rate</span><span>CTR</span><span>Revenue</span><span>Unsub %</span><span>Status</span>
            </div>
            {D.email.map((e, i) => (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 1fr 46px 80px 58px 60px", gap: 10, padding: "11px 0", borderBottom: i < D.email.length - 1 ? "1px solid var(--rule)" : 0, alignItems: "center", fontSize: 12.5 }}>
                <span style={{ fontWeight: 500 }}>{e.name}</span>
                <span>
                  <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)", background: e.type === "flow" ? "var(--accent-wash)" : "var(--paper-2)", color: e.type === "flow" ? "var(--accent)" : "var(--muted)", border: e.type === "flow" ? "1px solid var(--accent)" : "1px solid var(--rule)" }}>{e.type}</span>
                </span>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{e.sends.toLocaleString()}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--paper-2)", overflow: "hidden" }}>
                    <div style={{ width: `${(e.openRate / 70) * 100}%`, height: "100%", background: e.openRate >= 50 ? "var(--success)" : e.openRate >= 35 ? "var(--accent)" : "var(--muted)", transition: "width .4s ease" }}/>
                  </div>
                  <span className="mono" style={{ fontSize: 11, width: 36, flexShrink: 0 }}>{e.openRate}%</span>
                </div>
                <span className="mono" style={{ fontSize: 11.5 }}>{e.ctr}%</span>
                <span className="mono" style={{ fontSize: 11.5 }}>${(e.revenue/1000).toFixed(1)}k</span>
                <span className="mono" style={{ fontSize: 11.5, color: e.unsubRate >= 0.4 ? "var(--danger)" : "var(--muted)" }}>{e.unsubRate}%</span>
                <span>
                  <span style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)", background: e.status === "live" ? "var(--success-wash)" : "var(--paper-2)", color: e.status === "live" ? "oklch(35% 0.1 155)" : "var(--muted)", border: e.status === "live" ? "1px solid var(--success)" : "1px solid var(--rule)" }}>{e.status}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ border: "1px solid var(--rule)", borderRadius: 6, padding: "16px 20px", background: "var(--paper)", display: "flex", alignItems: "center", gap: 24 }}>
          <div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>List health</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>24,118 subscribers</div>
          </div>
          <div style={{ width: 1, height: 36, background: "var(--rule)" }}/>
          <div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 2 }}>MTD growth</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "oklch(35% 0.1 155)" }}>+412</div>
          </div>
          <div style={{ width: 1, height: 36, background: "var(--rule)" }}/>
          <div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 2 }}>Avg engagement score</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>68 / 100</div>
          </div>
        </div>
      </div>
    );
  }

  function renderAI() {
    const exampleChips = ["TikTok vs last month", "Product conversions from IG", "Email revenue breakdown", "Best time to post"];
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: 400 }}>
        <div style={{ flex: 1, overflow: "auto", padding: "0 0 16px" }}>
          {chatHistory.map((msg, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              {msg.role === "user" ? (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "72%", background: "var(--ink)", color: "var(--paper)", borderRadius: "12px 12px 2px 12px", padding: "10px 14px", fontSize: 13.5, lineHeight: 1.5 }}>
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "84%" }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>Agent · {msg.agent}</div>
                  <div style={{ background: "var(--paper-2)", border: "1px solid var(--rule)", borderRadius: "2px 12px 12px 12px", padding: "12px 16px", fontSize: 13.5, lineHeight: 1.6, color: "var(--ink)" }}>
                    {formatAiText(msg.text)}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef}/>
        </div>
        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {exampleChips.map(chip => (
              <button key={chip} onClick={() => { setChatInput(chip); submitChat(chip); }}
                style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, border: "1px solid var(--rule)", background: "var(--paper-2)", color: "var(--ink-2)", cursor: "pointer", fontFamily: "inherit", transition: "background .12s" }}>
                {chip}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea rows={2} value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitChat(chatInput); } }}
              placeholder="Ask anything about your channels, campaigns, or content…"
              style={{ flex: 1, resize: "none", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--paper)", padding: "9px 12px", fontSize: 13, fontFamily: "inherit", color: "var(--ink)", outline: "none", lineHeight: 1.5 }}
            />
            <button onClick={() => submitChat(chatInput)}
              style={{ height: 56, padding: "0 18px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--ink)", color: "var(--paper)", fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: 500, flexShrink: 0 }}>
              ↵ Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "sticky", top: 0, background: "var(--paper)", zIndex: 10, borderBottom: "1px solid var(--rule)", padding: "18px 32px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>06 · Learn</div>
            <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em", margin: "4px 0 0" }}>Insights Center</h1>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {["7d", "30d", "90d", "YTD"].map(r => (
              <Btn key={r} size="sm" variant={state.dateRange === r ? "primary" : "default"} onClick={() => actions.setDateRange(r)}>{r}</Btn>
            ))}
            <div style={{ width: 1, height: 20, background: "var(--rule)", margin: "0 4px" }}/>
            <Btn size="sm" variant="ghost"><Icon name="download" size={12}/> Export</Btn>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: "8px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                background: "transparent", border: "none", borderBottom: tab === t ? "2px solid var(--ink)" : "2px solid transparent",
                color: tab === t ? "var(--ink)" : "var(--muted)", fontWeight: tab === t ? 600 : 400,
                transition: "color .12s", marginBottom: -1,
              }}>
              {tabLabels[t]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
        {tab === "overview" && renderOverview()}
        {tab === "social"   && renderSocial()}
        {tab === "paid"     && renderPaid()}
        {tab === "email"    && renderEmail()}
        {tab === "ai"       && renderAI()}
      </div>
    </div>
  );
}

// ────────────────────────────── INBOX & ESCALATION ──────────────────────────────
function InboxEscalation({ state, actions }) {
  const open = state.inbox.filter(i => i.status !== "replied" && i.status !== "archived");
  const [selectedId, setSelectedId] = useState3(open[0]?.id || state.inbox[0]?.id);
  const [draft, setDraft] = useState3("");
  const selected = state.inbox.find(i => i.id === selectedId) || open[0];

  React.useEffect(() => { if (selected) setDraft(selected.draft); }, [selectedId, selected?.id]);

  if (!selected) return <div style={{ padding: 40, color: "var(--muted)" }}>Inbox empty.</div>;

  const riskTone = selected.risk === "high" ? "danger" : selected.risk === "medium" ? "warn" : "ok";

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>07 · Listen</div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Inbox &amp; Escalation</h1>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>{open.length} inbound · {open.filter(i => i.risk !== "low").length} need a human</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "var(--gap)", flex: 1, minHeight: 0 }}>
        <div style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", overflow: "auto" }}>
          {state.inbox.map((item, i) => {
            if (item.status === "replied" || item.status === "archived") return null;
            const rt = item.risk === "high" ? "danger" : item.risk === "medium" ? "warn" : "ok";
            return (
              <div key={item.id} onClick={() => setSelectedId(item.id)} className="cell-btn"
                style={{
                  padding: "14px 16px",
                  borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                  background: selected?.id === item.id ? "var(--paper-2)" : "transparent",
                  cursor: "pointer",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em" }}>{item.source}</span>
                  <Chip tone={rt}>{item.risk}</Chip>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{item.author}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {item.text}
                </div>
              </div>
            );
          })}
          {open.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Inbox clear.</div>}
        </div>

        <div key={selected.id} className="anim-slide" style={{ border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper)", padding: 22, overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{selected.source} · {selected.category}</div>
              <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.015em", marginTop: 4 }}>{selected.author}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Chip tone={riskTone}>risk: {selected.risk}</Chip>
              {selected.risk !== "low" && <Chip tone="accent">human required</Chip>}
            </div>
          </div>

          <div style={{ padding: 16, background: "var(--paper-2)", borderRadius: 5, border: "1px solid var(--rule)", marginBottom: 20, fontSize: 14, lineHeight: 1.55, color: "var(--ink)" }}>
            {selected.text}
          </div>

          <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Drafted response</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>Supervisor · tone: {selected.risk === "low" ? "Wink" : "Direct"}</div>
          </div>
          {selected.risk === "high" ? (
            <div style={{
              padding: 16, border: "1px solid var(--rule)",
              borderLeft: "3px solid var(--danger)", borderRadius: 5,
              fontSize: 14, lineHeight: 1.55, marginBottom: 18,
              color: "var(--muted)", fontStyle: "italic",
            }}>
              — routing to press contact — <br/>
              <span style={{ fontSize: 12 }}>Press/PR is a hard boundary. No AI reply permitted. Draft handed to comms lead.</span>
            </div>
          ) : (
            <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
              style={{ marginBottom: 18, borderLeft: "3px solid var(--accent)" }}/>
          )}

          <div style={{ padding: 14, background: "var(--paper-2)", borderRadius: 5, marginBottom: 20, fontSize: 12 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              <Icon name="shield" size={11}/> Policy Guard · decision
            </div>
            {selected.risk === "low" && <div><Chip tone="ok">allow</Chip> <span style={{ color: "var(--ink-2)", marginLeft: 8 }}>low-risk · product question · confidence 0.91 · auto-reply permitted</span></div>}
            {selected.risk === "medium" && <div><Chip tone="warn">require approval</Chip> <span style={{ color: "var(--ink-2)", marginLeft: 8 }}>medium-risk category · service/partnership · must route to human</span></div>}
            {selected.risk === "high" && <div><Chip tone="danger">require approval</Chip> <span style={{ color: "var(--ink-2)", marginLeft: 8 }}>hard boundary · press/PR · no AI-drafted reply permitted</span></div>}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn size="sm" variant="ghost" onClick={() => actions.updateInbox(selected.id, { status: "archived" }, {
              logEvent: `archived inbox · ${selected.author}`, notify: { tone: "neutral", text: `Archived message from ${selected.author}` }
            })}><Icon name="x" size={12}/> Archive</Btn>
            <Btn size="sm" variant={selected.risk === "high" ? "default" : "primary"} disabled={selected.risk === "high"}
              onClick={() => actions.updateInbox(selected.id, { status: "replied", draft }, {
                logEvent: `replied · ${selected.source} · ${selected.author}`,
                notify: { tone: "ok", text: `Reply sent to ${selected.author}` }
              })}>
              <Icon name="send" size={12}/> {selected.risk === "low" ? "Send reply" : "Approve & send"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── AUTONOMY SETTINGS ──────────────────────────────
function AutonomySettings({ state, actions }) {
  const modes = [
    { id: "manual", name: "Manual / Copilot", desc: "Drafts and recommendations only. Nothing leaves the building without you.", risk: "lowest" },
    { id: "assisted", name: "Assisted Autonomous", desc: "Low-risk tasks run automatically. High-risk routes to approval.", risk: "recommended" },
    { id: "auto", name: "Autonomous with guardrails", desc: "Approved patterns publish within configured limits. Full audit.", risk: "advanced" },
  ];

  const cycleRule = (name, field, current) => {
    const options = field === "ai"
      ? ["review", "auto", "n/a"]
      : field === "reply"
        ? ["human", "auto", "n/a"]
        : ["human", "auto"];
    const avail = options.filter(o => o !== "n/a" || current === "n/a");
    if (current === "n/a") return;
    const idx = avail.indexOf(current);
    const next = avail[(idx + 1) % avail.length];
    actions.setChannelRule(name, field, next);
  };

  return (
    <div className="anim-fade" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24, height: "100%", overflow: "auto" }}>
      <div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>08 · Control</div>
        <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", margin: "6px 0 0" }}>Autonomy Settings</h1>
        <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>Global mode sets defaults. Channel rules can override within bounds.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--gap)" }}>
        {modes.map(m => (
          <button key={m.id} onClick={() => actions.setAutonomyMode(m.id)}
            style={{
              textAlign: "left", padding: 20,
              border: `1px solid ${state.autonomyMode === m.id ? "var(--ink)" : "var(--rule)"}`,
              background: state.autonomyMode === m.id ? "var(--paper-2)" : "var(--paper)",
              borderRadius: 6, cursor: "pointer",
              transition: "all .12s ease",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{m.risk}</span>
              {state.autonomyMode === m.id && <Chip tone="ink">active</Chip>}
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.015em" }}>{m.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{m.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
        <Card title="Channel rules" meta="click to cycle">
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 90px 90px 80px",
            fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted)",
            textTransform: "uppercase", letterSpacing: "0.06em",
            padding: "6px 0", borderBottom: "1px solid var(--rule)",
          }}>
            <span>Channel</span><span>Publish</span><span>Reply</span><span>AI assets</span>
          </div>
          {state.channelRules.map(c => (
            <div key={c.name} style={{
              display: "grid", gridTemplateColumns: "1fr 90px 90px 80px",
              padding: "10px 0", borderBottom: "1px solid var(--rule)",
              alignItems: "center", fontSize: 12.5,
            }}>
              <span style={{ fontWeight: 500 }}>{c.name}</span>
              <span><button onClick={() => cycleRule(c.name, "publish", c.publish)} style={ruleBtn(c.publish === "auto")}>{c.publish}</button></span>
              <span>{c.reply === "n/a" ? <span style={{ color: "var(--muted-2)" }}>—</span> : <button onClick={() => cycleRule(c.name, "reply", c.reply)} style={ruleBtn(c.reply === "auto")}>{c.reply}</button>}</span>
              <span>{c.ai === "n/a" ? <span style={{ color: "var(--muted-2)" }}>—</span> : <button onClick={() => cycleRule(c.name, "ai", c.ai)} style={ruleBtn(c.ai === "auto", c.ai === "review")}>{c.ai}</button>}</span>
            </div>
          ))}
        </Card>

        <Card title="Hard boundaries" meta="always require a human">
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              "Strategy changes", "Paid spend changes", "Crisis, legal, or PR responses",
              "Core brand memory edits", "New tone mode creation",
              "AI-generated video asset publish", "Custom high-risk actions (set by owner)",
            ].map((t, i) => (
              <div key={t} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 0", borderTop: i === 0 ? 0 : "1px solid var(--rule)",
                fontSize: 13,
              }}>
                <Icon name="lock" size={12}/>
                <span style={{ flex: 1 }}>{t}</span>
                <Chip>enforced</Chip>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Thresholds" meta="confidence + limits · drag to change">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          <ThresholdSlider label="Auto-reply confidence" suffix="min" unit=""
            value={state.thresholds.confidence} min={50} max={99}
            onChange={v => actions.setThreshold("confidence", v)}/>
          <ThresholdSlider label="Daily auto-publish cap" suffix="posts" unit=""
            value={state.thresholds.dailyCap} min={1} max={40}
            onChange={v => actions.setThreshold("dailyCap", v)}/>
          <ThresholdSlider label="Approval SLA" suffix="then escalate" unit="min"
            value={state.thresholds.sla} min={15} max={240}
            onChange={v => actions.setThreshold("sla", v)}/>
        </div>
      </Card>
    </div>
  );
}

function ruleBtn(isAuto, isReview) {
  const bg = isAuto ? "var(--success-wash)" : isReview ? "var(--warn-wash)" : "var(--paper-3)";
  const fg = isAuto ? "oklch(35% 0.1 155)" : isReview ? "oklch(38% 0.1 75)" : "var(--ink-2)";
  return {
    background: bg, color: fg, border: "0", borderRadius: 3,
    padding: "2px 7px", fontSize: 10.5, fontFamily: "var(--font-mono)",
    letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500,
    cursor: "pointer",
  };
}

function ThresholdSlider({ label, value, unit, suffix, min, max, onChange }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1 }}>{value}{unit}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em" }}>{suffix}</div>
      </div>
      <Slider value={value} onChange={onChange} min={min} max={max}/>
    </div>
  );
}

Object.assign(window, { PublishingQueue, InsightsCenter, InboxEscalation, AutonomySettings });
