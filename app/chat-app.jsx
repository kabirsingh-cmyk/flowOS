// MVEDA Chat-OS — main app shell with channels, thread, canvas
const { useState: useStateApp, useEffect: useEffectApp, useMemo: useMemoApp, useReducer: useReducerApp } = React;

// ────────────────────────────── CHAT REDUCER ──────────────────────────────
function chatInit() {
  const ts = (h, m) => `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  return {
    activeChannel: "ch_morning",
    threads: {
      ch_you:      [...PERSONAL_HISTORY],
      ch_morning:  [{ kind: "briefing", briefing: BRIEFING, time: ts(6,0) }],
      ch_team:     [...TEAM_THREAD],
      ch_launches: [
        { kind: "agent", author: "Supervisor", time: "07:30", text: "Hair Ritual launch · 4 days out. 6 of 9 assets approved. Shall I run a final pre-flight and prep the publishing schedule?" },
      ],
      ch_creative: [
        { kind: "agent", author: "Drafter", time: "08:12", text: "3 new IG captions ready for review · Hair Mist · ritual tone.",
          artifact: { type: "drafts", items: [
            { title: "Three drops. Palms warmed. Drawn through the lengths." },
            { title: "Hair, but the way our grandmothers knew it." },
            { title: "A mist for the morning. A ritual for the week." },
          ] }
        },
      ],
      ch_paid: [
        { kind: "agent", author: "Analyst", time: "08:22", text: "Meta Ads ROAS dipped to 2.8x last 7d (vs 3.6x prior). Frequency on Body Oil Advantage+ campaign is 4.2 — likely creative fatigue. Shall Drafter cut new creative?" },
      ],
      ch_alerts: [
        { kind: "agent", author: "Brand Guard", time: "07:14", text: "1 caption auto-rejected · 'clinically proven' is on prohibited claims list. Drafter rewrote in your voice; awaiting your review." },
        { kind: "agent", author: "Inbox",       time: "08:02", text: "CX spike · Honey & Vanilla Body Oil cap leaks (14 reports, 7d). Auto-paused Meta Ads for that SKU and flagged the replenishment SMS. Open CX signals to confirm." },
        { kind: "agent", author: "Brand Guard", time: "08:18", text: "A/B winner · 'Add to ritual' beat 'Add to cart' on PDP CVR by 19% (88% confidence). Ready to promote into Brand Memory — open A/B tests." },
      ],
    },
    canvas: null, // { kind, data }
    typingAgent: null,
  };
}

function chatReducer(s, a) {
  switch (a.type) {
    case "SET_CHANNEL": return { ...s, activeChannel: a.id };
    case "POST": {
      const next = { ...s.threads, [a.channel]: [...(s.threads[a.channel] || []), a.message] };
      return { ...s, threads: next };
    }
    case "OPEN_CANVAS": return { ...s, canvas: a.canvas };
    case "CLOSE_CANVAS": return { ...s, canvas: null };
    case "SET_TYPING": return { ...s, typingAgent: a.agent };
    // ── Streaming support ──────────────────────────────────────────────────
    case "STREAM_START": {
      const msgs = s.threads[a.channel] || [];
      return { ...s, threads: { ...s.threads, [a.channel]: [...msgs, { kind: "agent", author: a.agent, time: a.time, text: "", streaming: true }] } };
    }
    case "STREAM_TOKEN": {
      const msgs = s.threads[a.channel] || [];
      if (!msgs.length) return s;
      const updated = [...msgs];
      const last = { ...updated[updated.length - 1] };
      last.text = (last.text || "") + a.token;
      updated[updated.length - 1] = last;
      return { ...s, threads: { ...s.threads, [a.channel]: updated } };
    }
    case "STREAM_DONE": {
      const msgs = s.threads[a.channel] || [];
      if (!msgs.length) return s;
      const updated = [...msgs];
      const last = { ...updated[updated.length - 1], streaming: false };
      if (a.artifact) last.artifact = a.artifact;
      updated[updated.length - 1] = last;
      return { ...s, threads: { ...s.threads, [a.channel]: updated } };
    }
    default: return s;
  }
}

// ────────────────────────────── AI RESPONSE LOGIC ──────────────────────────────
// ── Draft helper — platform-aware copy for fallback simulation ─────────────────
function makeDraftArtifact(t) {
  const platform =
    /instagram|ig\b/.test(t) ? "instagram" :
    /tiktok|tt\b/.test(t)    ? "tiktok"    :
    /linkedin|li\b/.test(t)  ? "linkedin"  :
    /facebook|fb\b/.test(t)  ? "facebook"  :
    /\bx\b|twitter|tweet/.test(t) ? "x"   :
    /youtube/.test(t)        ? "youtube"   :
    /pinterest|pin\b/.test(t) ? "pinterest" :
    /reddit/.test(t)         ? "reddit"    :
    /snap/.test(t)           ? "snapchat"  :
    /threads/.test(t)        ? "threads"   :
    /bluesky/.test(t)        ? "bluesky"   :
    /email/.test(t)          ? "email"     :
    /\bsms\b|text message/.test(t) ? "sms" :
    "instagram";

  const contentType =
    /reel/.test(t)         ? "Reel"      :
    /carousel/.test(t)     ? "Carousel"  :
    /story/.test(t)        ? "Story"     :
    /thread/.test(t)       ? "Thread"    :
    /\bemail\b/.test(t)    ? "Email"     :
    /\bsms\b/.test(t)      ? "SMS"       :
    /blog|article/.test(t) ? "Article"   :
    /video/.test(t)        ? "Video"     :
    "Post";

  const copies = {
    instagram: "Warm a few drops between your palms.\nDraw them slowly through damp lengths.\nReturn to it tomorrow — until it becomes yours.\n\n#ayurveda #hairritual #coldpressed",
    tiktok:    "POV: you just discovered the hair ritual your grandmother kept secret 🪷\n\nBhringraj. Saffron. Cold-pressed at source.\n\n#haircare #ayurveda #hairoil #hairgrowth",
    linkedin:  "The best-performing products in our portfolio weren't born from trend reports.\n\nThey were born from 5,000 years of Ayurvedic practice — and one question: what did our grandmothers know that we forgot?\n\nAt MVEDA, we cold-press every ingredient at source. Small batches. Nothing added. Here's why that matters for your skin.",
    facebook:  "There's a hair ritual older than any influencer trend.\n\nBhringraj. Saffron. Three drops, warmed between your palms.\n\nWe just made it easy to bring home. 🌿",
    x:         "hair care that doesn't ask you to hustle. just warm it, work it through, and let it do what it's done for centuries.",
    youtube:   "In this video: how we cold-press Bhringraj at source — and why the extraction method changes everything about what goes into your hair. No shortcuts. No heat damage. Just the way it's always been done.",
    pinterest: "5,000 years of Ayurveda. One ritual. Three drops of Bhringraj & Saffron Hair Oil, warmed between the palms.\n\nDiscover the MVEDA Hair Ritual ↓",
    reddit:    "We've been formulating Ayurvedic hair oils for 8 years. Here's what we've learned about Bhringraj that most brands get wrong — and why cold-pressing matters more than the ingredient list.",
    snapchat:  "Your grandma's hair secret? We bottled it. 3 drops of Bhringraj & Saffron. That's it. 🪷",
    threads:   "slow hair care is having a moment. bhringraj oil, three drops, palms warmed, drawn through the lengths. been doing this for centuries. we're just catching up.",
    bluesky:   "Warm three drops of Bhringraj & Saffron oil between your palms. Draw through damp lengths. That's it — 5,000 years of Ayurvedic practice in 90 seconds.",
    email:     "Subject: The ritual starts with three drops.\nPreview: Your hair remembers what your grandmother knew.\n\nWarm three drops of Bhringraj & Saffron Hair Oil between your palms. Draw them slowly through damp lengths. That's it — no 12-step routine, no clinical promises.\n\nJust 5,000 years of Ayurvedic practice, cold-pressed at source, and ready when you are.\n\n→ Shop the Hair Ritual",
    sms:       "Your Hair Ritual restock is here. Bhringraj & Saffron — small batch, cold-pressed. Shop before it sells out → mveda.co/hairritual",
  };

  const imagePrompts = {
    instagram: "Amber glass dropper bottle, saffron threads and dried bhringraj leaves on warm ivory linen, soft morning window light, flat lay, editorial, minimal",
    tiktok:    "Close-up of hands warming hair oil between palms, golden light, slow-motion aesthetic",
    linkedin:  "Overhead of cold-press extraction process, glass vessels, botanicals, clean lab setting, editorial photography",
    facebook:  "Lifestyle flat lay: hair oil bottle, comb, dried flowers, warm neutral background",
    x:         "Minimal product shot: amber bottle on white stone, single saffron thread",
    youtube:   "Split-frame: raw bhringraj plant on left, finished cold-pressed oil in glass on right, golden tones",
    pinterest: "Vertical flat lay: hair oil, copper comb, dried petals, ivory and gold palette, styled for Pinterest",
    reddit:    "Clean infographic comparing cold-press vs standard extraction, brand colours",
    snapchat:  "Vibrant close-up product shot, playful angle, amber bottle on colourful surface",
    threads:   "Moody close-up of oil in glass bowl with petals, ambient light",
    bluesky:   "Minimal top-down: dropper bottle and single saffron strand on pale marble",
  };

  return {
    type:        "draft_created",
    platform,
    contentType,
    copy:        copies[platform] || copies.instagram,
    imagePrompt: (platform !== "email" && platform !== "sms") ? (imagePrompts[platform] || imagePrompts.instagram) : null,
  };
}

function inferResponse(userText) {
  const t = userText.toLowerCase();

  // ── Creation-intent check — must come before workspace-routing patterns ──────
  const hasCreateVerb   = /\b(write|draft|create|generate|make me|give me)\b/.test(t);
  const hasContentNoun  = /\b(post|caption|reel|story|carousel|tweet|thread|email|sms|pin|article|blog|copy|content|video|short)\b/.test(t);
  if (hasCreateVerb && hasContentNoun) {
    const a = makeDraftArtifact(t);
    const platformLabel = a.platform.charAt(0).toUpperCase() + a.platform.slice(1);
    return [
      { delay: 400,  agent: "Drafter", text: `On it. Pulling brand voice and your last high-performing ${a.platform} posts for tone match.` },
      { delay: 1800, agent: "Drafter", text: `Here's your ${platformLabel} ${a.contentType.toLowerCase()}.`, artifact: a },
    ];
  }

  if (/strateg|channel mix|allocation|where should i|spend|ratio|budget split/.test(t)) {
    return [
      { delay: 500, agent: "Supervisor", text: "Pulling brand memory, your connector state, and industry benchmarks for ayurvedic skincare. Let me synthesize a channel mix." },
      { delay: 1500, agent: "Analyst", text: "Recommendation ready. Email + IG carry your retention; TikTok + Pmax handle launch reach. Two channels recommended that aren't connected — flagged in the canvas.",
        artifact: { type: "strategy",
          title: "Recommended channel mix · MVEDA",
          summary: "Acquisition · Growth stage · $25k/mo · 7 channels",
          version: 1,
          families: { "Organic social": 38, "Owned (email)": 24, "Paid search": 18, "Paid social": 20 },
        } },
    ];
  }
  if (/plan|content|next week|calendar|campaign/.test(t)) {
    return [
      { delay: 600, agent: "Supervisor", text: "Understood. Pulling brand context, last 4 weeks of performance, and your Hair Ritual launch timing. I'll route this to Drafter and have a plan for you in a moment." },
      { delay: 1400, agent: "Drafter", text: "Plan ready. 9 items, 5 channels, mixing ritual / quiet luxury / tradition pillars. Click to open.",
        artifact: { type: "campaign-plan", title: "Apr 27 → May 3 · Mixed", summary: "9 items · IG, TikTok, Email, Pmax, Advantage+", itemCount: 9 } },
    ];
  }
  if (/\bdraft\b|\bcaption\b/.test(t) && !hasCreateVerb) {
    // Catch plain "draft something" or "caption for X" without a create verb
    const a = makeDraftArtifact(t);
    const platformLabel = a.platform.charAt(0).toUpperCase() + a.platform.slice(1);
    return [
      { delay: 400,  agent: "Drafter", text: "On it. Pulling brand voice and your last high-performing posts for tone match." },
      { delay: 1600, agent: "Drafter", text: `Here's your ${platformLabel} ${a.contentType.toLowerCase()}.`, artifact: a },
    ];
  }
  if (/roas|metric|why|down|dip|performance/.test(t)) {
    return [
      { delay: 500, agent: "Analyst", text: "Pulling 30d performance by channel. One sec." },
      { delay: 1200, agent: "Analyst", text: "Meta Advantage+ ROAS dropped from 3.6x → 2.8x last 7d. Frequency hit 4.2 on Body Oil creative — that's the cause. Pmax holding steady at 4.1x. IG organic up.",
        artifact: { type: "metric", label: "Meta ROAS · 7d", value: "2.8x", delta: "−22%", note: "Creative fatigue (freq 4.2). Recommend cutting 2 new variants this week." } },
    ];
  }
  if (/inbox|triage|comment|dm/.test(t)) {
    return [
      { delay: 500, agent: "Inbox", text: "Triaging now. 14 open, 1 escalation (refund · day 32). Want me to draft replies for the 9 routine ones?" },
    ];
  }
  if (/google ads|pmax|set up.*campaign/.test(t)) {
    return [
      { delay: 500, agent: "Supervisor", text: "Need: budget, audience, dates. I have $200/day from your message. Defaulting to UK/US, broad-match seed keywords from Body Oil PDP. Brand Guard will check copy before launch." },
      { delay: 1300, agent: "Brand Guard", text: "Reviewed proposed Pmax keywords. All pass. 'Honey & vanilla body oil', 'Ayurvedic body oil', 'cold-pressed body oil' approved. 'Anti-aging' flagged — substituting 'lasting'." },
    ];
  }
  if (/sms|text message|postscript|opt[- ]?in|tcpa|short code/.test(t)) {
    return [
      { delay: 500, agent: "Supervisor", text: "Routing to SMS. We have Klaviyo SMS connected and Postscript available. Compliance gate is on by default — TCPA quiet hours enforced per recipient TZ." },
      { delay: 1300, agent: "Drafter", text: "Opening the SMS center.", artifact: { type: "workspace", target: "sms" } },
    ];
  }
  if (/seo|search console|backlink|keyword|ranking|blog post|article|cluster/.test(t)) {
    return [
      { delay: 500, agent: "Analyst", text: "Pulling Ahrefs + Search Console. Top movers, internal-link suggestions, and waiting briefs." },
      { delay: 1300, agent: "Analyst", text: "Open in canvas.", artifact: { type: "workspace", target: "seo" } },
    ];
  }
  if (/affiliat|referral|partner|creator code|payout/.test(t)) {
    return [
      { delay: 500, agent: "Supervisor", text: "Affiliate revenue, pending partner approvals, and the MV Tribe referral program — all in one view." },
      { delay: 1100, agent: "Supervisor", text: "Here.", artifact: { type: "workspace", target: "affiliate" } },
    ];
  }
  if (/retention|repeat|churn|lifecycle|cohort|replenish|ltv/.test(t)) {
    return [
      { delay: 500, agent: "Analyst", text: "Repeat purchase rate is 32% (90d) — up 3pp. VIP segment hasn't heard from you in 19 days. Pulling the dashboard." },
      { delay: 1300, agent: "Analyst", text: "Open.", artifact: { type: "workspace", target: "retention" } },
    ];
  }
  if (/return|rma|complaint|cx|gorgias|review|refund/.test(t)) {
    return [
      { delay: 500, agent: "Brand Guard", text: "CX signals — returns, RMA spikes, top complaint themes. One high-severity item: Honey & Vanilla body oil cap leak. Already auto-paused Meta Ads on that SKU." },
      { delay: 1300, agent: "Brand Guard", text: "Surfacing now.", artifact: { type: "workspace", target: "cx" } },
    ];
  }
  if (/bfcm|black friday|holiday|seasonal|diwali|capacity|playbook/.test(t)) {
    return [
      { delay: 500, agent: "Supervisor", text: "Seasonal mode. BFCM is preloaded; Mother's Day is currently active. Capacity plan caps spend at $8.4k/day during peaks." },
      { delay: 1300, agent: "Supervisor", text: "Open.", artifact: { type: "workspace", target: "seasonal" } },
    ];
  }
  if (/a\/b|ab test|split test|variant|optimizely|vwo|growthbook/.test(t)) {
    return [
      { delay: 500, agent: "Brand Guard", text: "A/B Lab. 2 winners ready to promote into Brand Memory; 1 still running on Hair Mist carousel." },
      { delay: 1200, agent: "Brand Guard", text: "Here.", artifact: { type: "workspace", target: "abtests" } },
    ];
  }
  if (/agency|guest|seat|invite|vendor|comment[- ]only|view[- ]only|permission/.test(t)) {
    return [
      { delay: 500, agent: "Supervisor", text: "Team & guests. Agencies default to comment-only on the channels you scope; you can upgrade to edit per-guest." },
      { delay: 1100, agent: "Supervisor", text: "Open.", artifact: { type: "workspace", target: "team" } },
    ];
  }
  if (/discount|promo code|% off|margin|simulator|coupon|bogo/.test(t)) {
    return [
      { delay: 500, agent: "Analyst", text: "Discount simulator + fatigue + active codes. WELCOME15 is showing fatigue — 6 of 12 weekly sends used it." },
      { delay: 1300, agent: "Analyst", text: "Opening.", artifact: { type: "workspace", target: "discounts" } },
    ];
  }
  if (/organic|social studio|instagram|tiktok|pinterest|youtube|reel|short|pin|schedule.*post|post.*schedule|posting.*time|best time/.test(t)) {
    return [
      { delay: 500, agent: "Supervisor", text: "Routing to Social Studio. I'll pull your connected accounts, the content queue, and any upcoming scheduling gaps." },
      { delay: 1200, agent: "Drafter", text: "Social Studio open. You've got 3 posts ready to schedule and a gap on Thursday — want me to fill it?",
        artifact: { type: "workspace", target: "organic" } },
    ];
  }
  if (/generate.*image|ai.*image|image.*ai|runware|fal\.ai|fal ai|midjourney|creative ai|generate.*video|heygen|higgsfield|luma|pika|kling/.test(t)) {
    return [
      { delay: 500, agent: "Drafter", text: "Opening the Creative AI tools. I'll check which generators you have connected — Runware, fal.ai, HeyGen, and others are available via the Connections panel." },
      { delay: 1200, agent: "Drafter", text: "Ready. Pick a connected tool below or compose in the Social Studio to use your default image generator.",
        artifact: { type: "workspace", target: "connections" } },
    ];
  }
  if (/mobile|phone|on the go|approve.*phone|on my phone/.test(t)) {
    return [
      { delay: 500, agent: "Supervisor", text: "Mobile preview — the inbox + approval gate flows are tuned for thumbs first. Open it to see the phone view." },
      { delay: 1100, agent: "Supervisor", text: "Open.", artifact: { type: "workspace", target: "mobile" } },
    ];
  }
  if (/brand|voice|memory|never use|word/.test(t)) {
    return [
      { delay: 500, agent: "Brand Guard", text: "Got it — adding to prohibited list. Drafter and all future generations will avoid the word. Existing drafts unaffected; want me to scan and flag the ones using it?" },
    ];
  }
  return [
    { delay: 500, agent: "Supervisor", text: "On it — let me think about the right team for this. One moment." },
    { delay: 1200, agent: "Supervisor", text: "I can help with that. Want me to start a draft, pull data, or queue this for the team to discuss?" },
  ];
}

// ────────────────────────────── CHANNEL LIST ──────────────────────────────
function ChannelList({ channels, active, onSelect, brandImported, brandPreset, auth, onLogout }) {
  const personal = channels.filter(c => c.kind === "personal");
  const team = channels.filter(c => c.kind === "team");

  return (
    <aside style={{
      width: 260, background: "var(--paper)", borderRight: "1px solid var(--rule)",
      display: "flex", flexDirection: "column", minHeight: 0,
    }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 5, background: "var(--ink)", color: "var(--paper)", display: "grid", placeItems: "center", fontFamily: "var(--font-serif)", fontSize: 17 }}>F</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>FlowOS</div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>AI Marketing OS</div>
        </div>
      </div>

      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px", border: "1px solid var(--rule)", borderRadius: 5,
          background: brandImported ? "var(--success-wash)" : "var(--paper-2)",
        }}>
          <Icon name={brandImported ? "check" : "globe"} size={12}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{brandImported ? (brandPreset?.name || "Your brand") : "yourbrand.com"}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>{brandImported ? "brand active" : "default brand"}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "10px 8px" }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 10px 4px" }}>Personal</div>
        {personal.map(c => <ChannelRow key={c.id} channel={c} active={active === c.id} onSelect={onSelect}/>)}

        <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "14px 10px 4px" }}>Team</div>
        {team.map(c => <ChannelRow key={c.id} channel={c} active={active === c.id} onSelect={onSelect}/>)}

        <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "14px 10px 4px" }}>Specialists</div>
        {SPECIALISTS.slice(1).map(sp => (
          <div key={sp.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", fontSize: 12.5, color: "var(--ink-2)" }}>
            <SpecialistAvatar id={sp.id} size={20}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5 }}>{sp.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{sp.role}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--rule)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <UserAvatar name={auth?.name || "Greg O"} src={auth?.avatar} size={22}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth?.name || "Greg O."}</div>
          {auth?.via && <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.04em" }}>via {auth.via}</div>}
        </div>
        {onLogout && (
          <button onClick={onLogout} title="Sign out"
            style={{ background: "transparent", border: "none", padding: 4, color: "var(--muted)", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            <Icon name="x" size={12}/>
          </button>
        )}
      </div>
    </aside>
  );
}

function ChannelRow({ channel, active, onSelect }) {
  return (
    <div onClick={() => onSelect(channel.id)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 10px", borderRadius: 4, cursor: "pointer",
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--paper)" : "var(--ink-2)",
        marginBottom: 1,
      }}>
      <Icon name={channel.icon} size={12}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{channel.name}</div>
        <div style={{ fontSize: 10.5, opacity: active ? 0.7 : 1, color: active ? "var(--paper)" : "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{channel.sub}</div>
      </div>
      {channel.unread > 0 && (
        <span className="mono" style={{
          fontSize: 9.5, padding: "1px 5px", borderRadius: 3,
          background: active ? "var(--paper)" : "var(--accent)", color: active ? "var(--ink)" : "var(--paper)",
        }}>{channel.unread}</span>
      )}
    </div>
  );
}

// ─────────────── NAV RAIL ───────────────
function NavRail({ active, onOpen, state, actions }) {
  const items = [
    { icon: "grid",     label: "Command",  t: "command"   },
    { icon: "spark",    label: "Studio",   t: "studio"    },
    { icon: "calendar", label: "Planner",  t: "planner"   },
    { icon: "chart",    label: "Insights", t: "insights"  },
    { icon: "inbox",    label: "Inbox",    t: "inbox"     },
    { icon: "flash",    label: "Agents",   t: "agents"    },
    { icon: "sliders",  label: "Settings", t: "settings"  },
  ];

  const [acctOpen, setAcctOpen] = React.useState(false);
  const ACCOUNTS = [
    { id: "mveda",    name: "MVEDA",                  sub: "DTC Skincare",       initial: "M", color: "oklch(58% 0.13 60)"  },
    { id: "erickson", name: "Erickson Refrigeration",  sub: "HVAC & Services",    initial: "E", color: "oklch(42% 0.18 250)" },
  ];
  const activeBrandId = state?.activeBrandId || "mveda";
  const current = ACCOUNTS.find(a => a.id === activeBrandId) || ACCOUNTS[0];

  return (
    <nav style={{ width: 56, background: "var(--paper)", borderRight: "1px solid var(--rule)", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", minHeight: 0 }}>
      {/* Account switcher */}
      <div style={{ width: "100%", padding: "0 6px 10px", position: "relative" }}>
        <button onClick={() => setAcctOpen(o => !o)} style={{
          width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          background: "none", border: "none", cursor: "pointer", padding: "4px 0",
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: current.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{current.initial}</div>
          <span style={{ fontSize: 7.5, color: "var(--muted)", letterSpacing: "0.04em", maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{current.name}</span>
        </button>
        {acctOpen && (
          <>
            <div onClick={() => setAcctOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }}/>
            <div style={{ position: "fixed", left: 58, top: 10, zIndex: 200, width: 220, background: "var(--paper)", border: "1px solid var(--rule-strong)", borderRadius: 8, boxShadow: "0 8px 32px -8px oklch(20% 0.02 80 / 0.25)", overflow: "hidden" }}>
              <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", padding: "10px 12px 6px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Switch account</div>
              {ACCOUNTS.map(a => (
                <button key={a.id} onClick={() => { actions?.switchBrand(a.id); setAcctOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "none", background: a.id === activeBrandId ? "var(--paper-2)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: a.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{a.initial}</div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{a.sub}</div>
                  </div>
                  {a.id === activeBrandId && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>active</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", overflow: "auto" }}>
        {items.map(({ icon, label, t }) => {
          const on = active === t;
          return (
            <button key={t} title={label} onClick={() => onOpen(t)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "8px 4px", border: "none",
              background: on ? "var(--paper-2)" : "transparent",
              color: on ? "var(--ink)" : "var(--muted)",
              borderLeft: `2px solid ${on ? "var(--accent)" : "transparent"}`,
              cursor: "pointer", transition: "all 0.12s", width: "100%",
            }}>
              <Icon name={icon} size={15}/>
              <span style={{ fontSize: 9, fontFamily: "var(--font-sans)", letterSpacing: "0.03em" }}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─────────────── CHAT HEADER ───────────────
function ChatHeader({ channels, activeId, onSelect, brandImported, brandPreset, auth, onLogout }) {
  const ch = channels.find(c => c.id === activeId);
  const SHORT = { "Greg · AI": "AI", "Greg's scratchpad": "Notes", "Brand drops": "Brand", "Hair Ritual": "Ritual", "Morning briefing": "Briefing", "Inbox": "Inbox" };
  return (
    <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--rule)", background: "var(--paper)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ch?.name || "Chat"}</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>{ch?.sub || ""}</div>
      </div>
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        {channels.map(c => (
          <button key={c.id} onClick={() => onSelect(c.id)} title={c.name} style={{
            padding: "2px 7px", borderRadius: 4, fontSize: 10, border: "none",
            background: c.id === activeId ? "var(--ink)" : "var(--paper-2)",
            color: c.id === activeId ? "var(--paper)" : "var(--muted)",
            cursor: "pointer", fontFamily: "var(--font-sans)", fontWeight: 500,
          }}>{SHORT[c.name] || c.name.slice(0, 7)}</button>
        ))}
      </div>
      {brandImported && (
        <div style={{ fontSize: 9.5, color: "var(--muted)", padding: "2px 6px", background: "var(--success-wash)", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
          {brandPreset?.name || "brand"}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <UserAvatar name={auth?.name || "G"} src={auth?.avatar} size={20}/>
        {onLogout && <button onClick={onLogout} title="Sign out" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 3, display: "flex" }}><Icon name="x" size={11}/></button>}
      </div>
    </div>
  );
}

// ─────────────── CHAT RAIL HEADER (compact, right-rail mode) ───────────────
function ChatRailHeader({ channels, activeId, onSelect, auth, onLogout }) {
  const ch = channels.find(c => c.id === activeId);
  return (
    <div style={{
      padding: "8px 10px", borderBottom: "1px solid var(--rule)", background: "var(--paper)",
      display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
    }}>
      <span style={{
        fontSize: 11.5, fontWeight: 600, flex: 1, minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        letterSpacing: "-0.01em",
      }}>{ch?.name || "Chat"}</span>
      <select value={activeId} onChange={e => onSelect(e.target.value)} style={{
        fontSize: 10, border: "1px solid var(--rule)", borderRadius: 4,
        background: "var(--paper-2)", color: "var(--muted)", padding: "2px 4px",
        fontFamily: "var(--font-sans)", cursor: "pointer", maxWidth: 90,
      }}>
        {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <UserAvatar name={auth?.name || "G"} src={auth?.avatar} size={18}/>
      {onLogout && (
        <button onClick={onLogout} title="Sign out"
          style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 2, display: "flex" }}>
          <Icon name="x" size={10}/>
        </button>
      )}
    </div>
  );
}

// ────────────────────────────── CANVAS ──────────────────────────────
function Canvas({ canvas, onClose, state, actions, go }) {
  if (!canvas) return null;

  const titleMap = {
    calendar: "Campaign plan", drafts: "Drafts", email: "Email draft",
    strategy: "Channel strategy",
  };
  const workspaceTitles = {
    planner: "Campaign Planner", inbox: "Inbox & Escalation", memory: "Brand Memory",
    insights: "Insights Center", connections: "Connections", autonomy: "Autonomy Settings",
    publish: "Publishing Queue", command: "Command Center",
    studio: "Studio", emailstudio: "Email Studio", searchstudio: "Search Studio",
    organic: "Social Studio",
    sms: "SMS", seo: "SEO Studio", affiliate: "Affiliate & referral",
    retention: "Retention", cx: "CX signals", seasonal: "Seasonal mode",
    abtests: "A/B tests", team: "Team & guests", discounts: "Discount ops",
    mobile: "Mobile preview", settings: "Settings", agents: "Agents",
  };

  const isHome = canvas.kind === "workspace" && canvas.target === "command";
  const label  = canvas.kind === "workspace"
    ? (workspaceTitles[canvas.target] || canvas.target)
    : (titleMap[canvas.kind] || canvas.kind);

  return (
    <div style={{ background: "var(--paper-2)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {!isHome && (
        <div style={{
          padding: "6px 16px", borderBottom: "1px solid var(--rule)", background: "var(--paper)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, height: 32,
        }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {label}
          </span>
          {onClose && <Btn size="sm" variant="ghost" onClick={onClose}><Icon name="x" size={11}/> Close</Btn>}
        </div>
      )}
      <div style={{ flex: 1, overflow: "auto" }}>
        <CanvasBody canvas={canvas} state={state} actions={actions} go={go}/>
      </div>
    </div>
  );
}

function CanvasBody({ canvas, state, actions, go }) {
  if (canvas.kind === "workspace") {
    const Comp = {
      planner: CampaignPlanner, inbox: InboxEscalation, memory: BrandMemory,
      insights: InsightsCenter, connections: Connections, autonomy: AutonomySettings,
      publish: PublishingQueue, command: CommandCenter,
      studio: StudioHub, emailstudio: EmailStudio, searchstudio: SearchStudio,
      organic: OrganicSocialStudio,
      sms: SmsCenter, seo: SeoStudio, affiliate: AffiliateProgram,
      retention: RetentionDashboard, cx: CxSignals, seasonal: SeasonalMode,
      abtests: AbTestLab, team: TeamSeats, discounts: DiscountOps, mobile: MobileShell,
      settings: SettingsHub,
      agents: AgentsWorkspace,
    }[canvas.target];
    if (!Comp) return <div style={{ padding: 40, color: "var(--muted)" }}>Unknown workspace</div>;
    return <Comp state={state} actions={actions} go={go} payload={{}}/>;
  }
  if (canvas.kind === "calendar") {
    return <CampaignPlanner state={state} actions={actions} go={() => {}} payload={{}}/>;
  }
  if (canvas.kind === "strategy") {
    return <ChannelStrategyCanvas state={state} actions={actions}/>;
  }
  if (canvas.kind === "drafts") {
    const items = canvas.data.items;
    return (
      <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Drafts · {items.length}</div>
        {items.map((d, i) => (
          <div key={i} style={{ background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 6, padding: 18 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Draft {i+1} · IG · Ritual</div>
            <div className="serif" style={{ fontSize: 18, lineHeight: 1.4, color: "var(--ink)", letterSpacing: "-0.01em" }}>"{d.title}"</div>
            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
              <Btn size="sm" variant="primary"><Icon name="check" size={11}/> Approve</Btn>
              <Btn size="sm"><Icon name="edit" size={11}/> Edit</Btn>
              <Btn size="sm" variant="ghost"><Icon name="x" size={11}/> Reject</Btn>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (canvas.kind === "email") {
    const e = canvas.data;
    return (
      <div style={{ padding: "28px 32px" }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Email · Draft</div>
        <div className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 8 }}>{e.subject}</div>
        <div style={{ marginTop: 16, padding: 20, background: "var(--paper)", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-line" }}>{e.body}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
          <Btn size="sm" variant="primary"><Icon name="send" size={11}/> Send</Btn>
          <Btn size="sm"><Icon name="edit" size={11}/> Edit in Klaviyo</Btn>
        </div>
      </div>
    );
  }
  return null;
}

// ────────────────────────────── THREAD ──────────────────────────────
function Thread({ messages, channel, onOpenArtifact, onConfirm, onAction, typingAgent }) {
  const scrollRef = useRefChat();
  useEffectChat(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, typingAgent]);

  return (
    <div ref={scrollRef} style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--rule)", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{channel.name}</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{channel.sub}</div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", border: "1px solid var(--rule)", borderRadius: 999, fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
          <Dot status="ok"/> online
        </span>
      </div>

      {messages.map((m, i) => {
        if (m.kind === "briefing") return <BriefingCard key={i} briefing={m.briefing} onAction={onAction}/>;
        return <Message key={i} m={m} onOpen={onOpenArtifact} onConfirm={onConfirm}/>;
      })}

      {typingAgent && (
        <div style={{ display: "flex", gap: 10, padding: "10px 18px", color: "var(--muted)", fontSize: 12.5, alignItems: "center" }}>
          <SpecialistAvatar id={typingAgent.toLowerCase().replace(/\s+/g,"")} size={22}/>
          <span>{typingAgent} is working</span>
          <span className="dot-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }}/>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── AUTH HELPERS ──────────────────────────────
function mapUser(sbUser) {
  const meta     = sbUser.user_metadata || {};
  const provider = sbUser.app_metadata?.provider || "email";
  // Google sends full_name; email/password signup sends name
  const raw  = meta.full_name || meta.name || sbUser.email?.split("@")[0] || "User";
  const name = raw.includes(" ")
    ? raw  // already formatted (Google full name)
    : raw.split(/[._-]/).map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ");
  const via    = provider === "google" ? "Google" : "email";
  const avatar = meta.avatar_url || meta.picture || null;
  return { id: sbUser.id, email: sbUser.email, name, via, avatar, at: Date.now() };
}

// ────────────────────────────── MAIN APP ──────────────────────────────
function ChatOS() {
  const [auth, setAuth]           = useStateApp("loading"); // "loading" | null | user-object
  const [onboarded, setOnboarded] = useStateApp(false);

  const checkOnboarded = async (userId) => {
    try {
      const { data } = await sb.from("brands").select("id, palette").eq("user_id", userId).limit(1);
      if (data && data.length > 0) {
        setOnboarded(true);
        if (data[0].palette) applyPalette(data[0].palette);
        return;
      }
    } catch {}
    // Fall back to localStorage
    try {
      const saved = localStorage.getItem("flowos_onboarding");
      if (saved) {
        setOnboarded(true);
        const ob = JSON.parse(saved);
        if (ob.chosenPalette) applyPalette(ob.chosenPalette);
      }
    } catch {}
  };

  useEffectApp(() => {
    const initializedRef = { current: false };

    // Check for existing session on mount — just set auth state.
    // checkOnboarded will be called by onAuthStateChange which fires
    // immediately with the current session, avoiding a double round-trip.
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuth(mapUser(session.user));
      } else {
        setAuth(null);
      }
    });

    // onAuthStateChange fires immediately with the current session on mount,
    // so checkOnboarded runs exactly once per login here.
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setAuth(session?.user ? mapUser(session.user) : null);
      if (session?.user && !initializedRef.current) {
        initializedRef.current = true;
        checkOnboarded(session.user.id);
      }
      if (!session?.user) {
        initializedRef.current = false;
        setOnboarded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await sb.auth.signOut();
    try { localStorage.removeItem("flowos_onboarding"); } catch {}
    Object.keys(BRAND_PALETTES[0].vars).forEach(k => document.documentElement.style.removeProperty(k));
    setOnboarded(false);
  };

  // Loading — checking session
  if (auth === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--paper-2)", color: "var(--muted)", fontSize: 13, fontFamily: "var(--font-sans)", letterSpacing: "0.04em" }}>
        Loading…
      </div>
    );
  }

  if (!auth) {
    return (
      <>
        <style>{ANIM_STYLE}</style>
        <LoginScreen />
      </>
    );
  }

  if (!onboarded) {
    return (
      <>
        <style>{ANIM_STYLE}</style>
        <OnboardingWizard auth={auth} onComplete={() => setOnboarded(true)}/>
      </>
    );
  }

  return <ChatOSAuthed auth={auth} onLogout={handleLogout}/>;
}

function ChatOSAuthed({ auth, onLogout }) {
  const [chat, dispatch] = useReducerApp(chatReducer, undefined, chatInit);
  const [state, actions] = useMvedaStore();
  const [tweakOpen, setTweakOpen] = useStateApp(false);

  useEffectApp(() => {
    const onMsg = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweakOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setTweakOpen(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffectApp(() => {
    const onNavigate = (e) => {
      const target = e.detail?.workspace;
      if (target) dispatch({ type: "OPEN_CANVAS", canvas: { kind: "workspace", target } });
    };
    window.addEventListener("flowos:navigate", onNavigate);
    return () => window.removeEventListener("flowos:navigate", onNavigate);
  }, []);

  const channel = CHANNELS.find(c => c.id === chat.activeChannel) || CHANNELS[0];
  const messages = chat.threads[channel.id] || [];

  const post = (channelId, message) => dispatch({ type: "POST", channel: channelId, message });
  const openCanvas = (canvas) => dispatch({ type: "OPEN_CANVAS", canvas });
  const closeCanvas = () => dispatch({ type: "CLOSE_CANVAS" });
  const openWorkspace = (target) => dispatch({ type: "OPEN_CANVAS", canvas: { kind: "workspace", target } });

  const simulateFallback = (userText, t) => {
    const responses = inferResponse(userText);
    let cumulative = 0;
    responses.forEach((r, i) => {
      cumulative += r.delay;
      setTimeout(() => {
        if (i === 0) dispatch({ type: "SET_TYPING", agent: r.agent });
        post(channel.id, { kind: "agent", author: r.agent, time: t, text: r.text, artifact: r.artifact });
        if (i === responses.length - 1) dispatch({ type: "SET_TYPING", agent: null });
      }, cumulative);
    });
  };

  // ── Artifact action handler — intercepts queue_draft and open_queue ──────────
  const handleArtifactAction = (args) => {
    if (args.kind === "queue_draft") {
      const d = args.data;
      actions.addDraft(d.platform, d.contentType, d.copy, d.imagePrompt);
      return;
    }
    if (args.kind === "open_queue") {
      openWorkspace("publish");
      return;
    }
    openCanvas(args);
  };

  const onSend = ({ text, files }) => {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    let userText = text;
    if (files?.length) userText = (userText ? userText + "\n\n" : "") + files.map(f => `[${f.kind}: ${f.label}]`).join(" ");
    post(channel.id, { kind: "user", author: auth?.name || "Greg", time: t, text: userText });

    sendAIMessage({
      userText,
      threadMessages: messages,
      channelId: channel.id,
      dispatch,
      openWorkspace,
      openCanvas,
      t,
      onFallback: simulateFallback,
      tenantId:   auth?.id,
      brand:      state.brandPreset || null,
    });
  };

  const onConfirm = (m, yes) => {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    post(channel.id, { kind: "agent", author: "Supervisor", time: t,
      text: yes ? "Sent. Logged in audit trail. I'll watch for a reply." : "Held as draft. You can edit anytime in the canvas." });
    actions.notify(yes ? "ok" : "neutral", yes ? "Email sent" : "Saved as draft");
  };

  const onBriefingAction = (n) => {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    if (n.suggested) {
      onSend({ text: n.suggested });
    } else if (n.id === "n1") {
      openWorkspace("command");
    } else if (n.id === "n2") {
      post(channel.id, { kind: "user", author: "Greg", time: t, text: "Show me the CTR forecast for moving the IG hero Wed → Thu." });
      setTimeout(() => post(channel.id, { kind: "agent", author: "Analyst", time: t,
        text: "Modeled both placements against your last 8 IG hero posts. Thursday at 9am is forecast +14% CTR vs Wed at 11am — Thursday consistently outperforms midweek for ritual/quiet luxury content. Recommend the move.",
        artifact: { type: "metric", label: "CTR forecast · move to Thu", value: "+14%", delta: "vs Wed", note: "Based on last 8 hero posts. Confidence: 78%." } }), 1200);
    } else if (n.id === "n3") {
      openWorkspace("inbox");
    }
  };

  const setDensityAndPersist = (d) => {
    document.documentElement.setAttribute("data-density", d);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { density: d } }, "*");
  };

  const activeCanvas = chat.canvas || { kind: "workspace", target: "command" };

  const handleNav = (t) => {
    if (t === "command") dispatch({ type: "CLOSE_CANVAS" });
    else openWorkspace(t);
  };

  return (
    <>
      <style>{ANIM_STYLE}</style>
      <div style={{
        display: "grid", gridTemplateColumns: "56px 1fr 320px",
        height: "100vh", background: "var(--paper-2)",
      }} data-screen-label="FlowOS">

        <NavRail active={activeCanvas.target} onOpen={handleNav} state={state} actions={actions}/>

        {/* Centre: workspace / canvas */}
        <Canvas
          canvas={activeCanvas}
          onClose={chat.canvas ? closeCanvas : null}
          state={{ ...state, auth }}
          actions={actions}
          go={openWorkspace}
        />

        {/* Right rail: chat */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderLeft: "1px solid var(--rule)", background: "var(--paper)" }}>
          <ChatRailHeader
            channels={CHANNELS}
            activeId={channel.id}
            onSelect={id => dispatch({ type: "SET_CHANNEL", id })}
            auth={auth}
            onLogout={onLogout}
          />
          <Thread
            messages={messages}
            channel={channel}
            onOpenArtifact={handleArtifactAction}
            onConfirm={onConfirm}
            onAction={onBriefingAction}
            typingAgent={chat.typingAgent}
          />
          <Composer onSend={onSend} channelName={channel.name}/>
        </div>

        {tweakOpen && (
          <div style={{
            position: "fixed", right: 20, bottom: 20, zIndex: 40,
            width: 280, background: "var(--paper)",
            border: "1px solid var(--rule-strong)", borderRadius: 8,
            padding: 16, boxShadow: "0 20px 40px -20px oklch(20% 0.02 80 / 0.35)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>Tweaks</div>
              <Chip>live</Chip>
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Density</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {["balanced", "comfortable"].map(d => (
                <button key={d} onClick={() => setDensityAndPersist(d)} style={{
                  flex: 1, padding: "7px 10px", borderRadius: 4, fontSize: 11.5, fontWeight: 500,
                  border: "1px solid var(--rule)", background: "var(--paper)", color: "var(--ink)",
                  cursor: "pointer", textTransform: "capitalize", fontFamily: "var(--font-sans)",
                }}>{d}</button>
              ))}
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>AI proactivity</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {["reactive", "daily", "always"].map(p => (
                <button key={p} style={{
                  flex: 1, padding: "7px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                  border: "1px solid " + (p === "daily" ? "var(--ink)" : "var(--rule)"),
                  background: p === "daily" ? "var(--ink)" : "var(--paper)",
                  color: p === "daily" ? "var(--paper)" : "var(--ink)",
                  cursor: "pointer", textTransform: "capitalize", fontFamily: "var(--font-sans)",
                }}>{p}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.45 }}>
              Reactive = waits for you. Daily = morning briefing only. Always = pings you when things need attention.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ChatOS/>);
