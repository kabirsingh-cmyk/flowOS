// MVEDA store — central state + action dispatchers
// All workspaces read from `state` and mutate via `actions`.
const { useReducer: useReducerStore, useCallback: useCallbackStore } = React;

// Platforms with a working publish path via Zernio (createPlatformHandler in api/lib/platformPublisher.js).
// All 15 organic social platforms are covered. Anything not in this set gets
// noPublishPath: true → queue shows "export or post manually" instead of Schedule.
const PLATFORM_PUBLISHERS = new Set([
  "linkedin", "facebook", "x", "instagram", "reddit",
  "tiktok", "pinterest", "threads", "bluesky", "youtube",
  "snapchat", "googlebusiness", "gbusiness", "telegram", "whatsapp", "discord",
]);

// Default channel rules — shipped product config, identical for everyone.
// Seed brands and real users start with this set; users may adjust per channel
// in AutonomySettings. Listed connectors must match SEED.connectorCatalog ids.
const DEFAULT_CHANNEL_RULES = [
  { name: "Instagram",  publish: "auto",  reply: "human", ai: "review" },
  { name: "LinkedIn",   publish: "auto",  reply: "human", ai: "review" },
  { name: "TikTok",     publish: "auto",  reply: "human", ai: "review" },
  { name: "Facebook",   publish: "human", reply: "human", ai: "review" },
  { name: "YouTube",    publish: "human", reply: "n/a",   ai: "review" },
  { name: "Email",      publish: "human", reply: "n/a",   ai: "n/a"    },
  { name: "Google Ads",    publish: "human", reply: "n/a",   ai: "review" },
  { name: "Spotify Ads",   publish: "human", reply: "n/a",   ai: "review" },
  { name: "Meta Ads",      publish: "human", reply: "n/a",   ai: "review" },
  { name: "TikTok Ads",    publish: "human", reply: "n/a",   ai: "review" },
  { name: "LinkedIn Ads",  publish: "human", reply: "n/a",   ai: "review" },
  { name: "Pinterest Ads", publish: "human", reply: "n/a",   ai: "review" },
  { name: "X Ads",         publish: "human", reply: "n/a",   ai: "review" },
  { name: "X",             publish: "auto",  reply: "human", ai: "review" },
  { name: "Pinterest",     publish: "auto",  reply: "n/a",   ai: "review" },
  { name: "Threads",       publish: "auto",  reply: "human", ai: "review" },
  { name: "Bluesky",       publish: "auto",  reply: "human", ai: "review" },
  { name: "WhatsApp",      publish: "human", reply: "human", ai: "review" },
  { name: "Telegram",      publish: "human", reply: "human", ai: "review" },
  { name: "Snapchat",      publish: "auto",  reply: "n/a",   ai: "review" },
  { name: "Discord",       publish: "human", reply: "human", ai: "review" },
  { name: "Google Business", publish: "human", reply: "human", ai: "review" },
];

// Initial store state.
//
// seedMode:
//   "mveda" | "erickson"  → demo session via ?seed= URL param. Whiteboard
//                           filled from SEED so the workspaces feel populated
//                           without requiring real data. The activeBrandId
//                           becomes the seed key, which makes SWITCH_BRAND work.
//   null (real user)      → all demo slices start empty. Brand-derived slices
//                           (brandValues, approvedClaims, prohibited, brandPreset)
//                           are overlaid at login by SET_BRAND from the
//                           user's Supabase brands row. The activeBrandId is
//                           the Supabase user id (auth.id) — SWITCH_BRAND
//                           becomes a no-op outside seed mode (existing guard
//                           in the reducer covers this since auth.id won't
//                           match a SEED.brandPresets key).
//
// userId: passed in for real users so activeBrandId is uniquely identifies
//   the tenant. Ignored in seed mode.
//
// Config defaults (autonomyMode, channelRules, thresholds, dateRange) are
// product defaults — identical for all sessions.
function mveda_initialState({ seedMode = null, userId = null } = {}) {
  const isSeed = seedMode === "mveda" || seedMode === "erickson";
  return {
    // ── Config defaults (same for everyone) ──
    autonomyMode: "assisted",
    channelRules: DEFAULT_CHANNEL_RULES.map(r => ({ ...r })),
    thresholds: { confidence: 85, dailyCap: 12, sla: 90 },
    dateRange: "30d",
    notifications: [],

    // ── Identity ──
    activeBrandId: isSeed ? seedMode : userId,
    brandImported: isSeed ? (SEED.brandImported || false) : false,
    brandPreset:   null, // overlaid at login by SET_BRAND for real users

    // ── Demo-vs-empty slices ──
    calendar:   isSeed ? SEED.calendar.map(c => ({ ...c })) : [],
    toneModes:  isSeed ? SEED.toneModes.map(m => ({ ...m, approved: [...m.approved], avoided: [...m.avoided] })) : [],
    approvals:  isSeed ? SEED.approvals.map(a => ({ ...a, status: "open" })) : [],
    inbox:      isSeed ? SEED.inbox.map(i => ({ ...i })) : [],
    assets:     isSeed ? SEED.assets.map(a => ({ ...a })) : [],
    trendBrief: isSeed ? SEED.trendBrief.map(t => ({ ...t })) : [],
    activity:   isSeed ? SEED.audit.map(a => ({ ...a, id: "e_" + crypto.randomUUID() })) : [],
    connectors: isSeed ? { ...SEED.connectorState } : {},

    // Brand-safety floor — empty for real users, overlaid by SET_BRAND
    // from the user's brand row (values/claims/prohibited_topics arrays).
    brandValues:    isSeed ? [...SEED.brandValues]     : [],
    approvedClaims: isSeed ? [...SEED.approvedClaims]  : [],
    prohibited:     isSeed ? [...SEED.prohibited]      : [],

    // Feature-specific demo data
    smsCampaigns:    isSeed ? SEED.smsCampaigns.map(c => ({ ...c })) : [],
    smsAutomations:  isSeed ? SEED.smsAutomations.map(a => ({ ...a })) : [],
    smsCompliance:   isSeed ? { ...SEED.smsCompliance } : {},
    seoArticles:     isSeed ? SEED.seoArticles.map(a => ({ ...a })) : [],
    seoKeywords:     isSeed ? SEED.seoKeywords.map(k => ({ ...k })) : [],
    seoBacklinks:    isSeed ? SEED.seoBacklinks.map(b => ({ ...b })) : [],
    seoInternalSuggestions: isSeed ? SEED.seoInternalSuggestions.map(s => ({ ...s })) : [],
    affiliateProgram:   isSeed ? { ...SEED.affiliateProgram } : {},
    affiliatePartners:  isSeed ? SEED.affiliatePartners.map(p => ({ ...p })) : [],
    referralProgram:    isSeed ? { ...SEED.referralProgram } : {},
    retention:          isSeed ? JSON.parse(JSON.stringify(SEED.retention)) : {},
    cxSignals:          isSeed ? JSON.parse(JSON.stringify(SEED.cxSignals)) : {},
    seasonalPlaybooks:  isSeed ? SEED.seasonalPlaybooks.map(p => ({ ...p })) : [],
    capacityPlan:       isSeed ? { ...SEED.capacityPlan } : {},
    abTests:            isSeed ? SEED.abTests.map(t => ({ ...t })) : [],
    abFedBrandRules:    isSeed ? SEED.abFedBrandRules.map(r => ({ ...r })) : [],
    team:               isSeed ? SEED.team.map(t => ({ ...t })) : [],
    guests:             isSeed ? SEED.guests.map(g => ({ ...g, scope: [...g.scope] })) : [],
    discountHistory:    isSeed ? SEED.discountHistory.map(d => ({ ...d })) : [],
    marginFloors:       isSeed ? { ...SEED.marginFloors } : {},
    discountFatigue:    isSeed
      ? { ...SEED.discountFatigue, alerts: [...SEED.discountFatigue.alerts] }
      : { alerts: [] },

    // Chat-authored outbound assets pushed to external platforms (Klaviyo, SMS providers, etc).
    // Separate from `calendar` because the lifecycle is platform-driven, not internal.
    // Always starts empty — populated at runtime by chat-to-create + proactive cron loads.
    outbound: {
      emails: [], // { id, subject, preheader, bodyHtml, bodyText, audienceHint, status, klaviyoTemplateId, klaviyoCampaignId, klaviyoMessageId, klaviyoUrl, audience, error, createdAt }
      sms:    [], // { id, body, audienceHint, status, klaviyoCampaignId, klaviyoMessageId, klaviyoUrl, audience, warnings, error, createdAt }
      // Analytics-triggered email drafts (flavor #1 Proactive). Lifecycle is server → review → push.
      // status: "proactive_draft" | "pushing" | "klaviyo_draft" | "failed" | "dismissed"
      // shape: { id, rule, ruleLabel, subject, preheader, body, audienceHint, reason, source, status, klaviyoUrl, klaviyoCampaignId, audience, error, createdAt }
      proactiveEmails: [],
      // Analytics-triggered SMS drafts. Same lifecycle, simpler shape (no subject/preheader).
      // status: "proactive_draft" | "pushing" | "klaviyo_draft" | "failed" | "dismissed"
      // shape: { id, rule, ruleLabel, body, audienceHint, reason, source, status, klaviyoUrl, klaviyoCampaignId, klaviyoMessageId, audience, error, createdAt }
      proactiveSms: [],
    },

    // Chat-authored campaign brief from the campaign_planner specialist.
    // CampaignPlanner workspace renders this when present; falls back to its
    // default grid view when null.
    // Shape: { title, summary, itemCount, goal, audience, timeline, budget, channels[], brief (markdown), createdAt }
    activePlan: null,

    // === TRACK CLAUDE: LEADS + CAMPAIGNS ===
    // Persistent campaign plans hydrated from /api/campaign-plans (PR C1).
    // Each row: { id, tenantId, title, status, summary, goal, audience,
    //   timeline, budget, channels[], brief, sourceChatThreadId, sourceSpecialist,
    //   createdAt, updatedAt, activatedAt, archivedAt }
    // status ∈ draft | active | paused | archived
    campaignPlans: [],
    // === END TRACK CLAUDE ===
  };
}

function mveda_reducer(s, a) {
  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };
  const log = (actor, event) => ({ id: "e_"+crypto.randomUUID(), t: now(), actor, event });
  const notify = (tone, text) => ({ id: "n_"+crypto.randomUUID(), tone, text, at: Date.now() });

  switch (a.type) {
    case "CAL_ADD": {
      return { ...s,
        calendar: [...s.calendar, ...a.items],
        activity: [log("Supervisor", `generated plan · ${a.items.length} items · '${a.campaign}'`), ...s.activity],
        notifications: [notify("ok", `${a.items.length} items added to calendar`), ...s.notifications],
      };
    }
    case "CAL_UPDATE": {
      return { ...s,
        calendar: s.calendar.map(c => c.id === a.id ? { ...c, ...a.patch } : c),
        activity: a.logEvent ? [log(a.actor || "Ana O.", a.logEvent), ...s.activity] : s.activity,
        notifications: a.notify ? [notify(a.notify.tone, a.notify.text), ...s.notifications] : s.notifications,
      };
    }
    case "CAL_REMOVE": {
      const item = s.calendar.find(c => c.id === a.id);
      return { ...s,
        calendar: s.calendar.filter(c => c.id !== a.id),
        activity: [log("Ana O.", `removed · '${item?.title || a.id}'`), ...s.activity],
        notifications: [notify("neutral", `Removed '${item?.title || "item"}'`), ...s.notifications],
      };
    }
    case "APPROVAL_RESOLVE": {
      const ap = s.approvals.find(x => x.id === a.id);
      let cal = s.calendar;
      if (ap?.itemId) {
        cal = cal.map(c => c.id === ap.itemId ? { ...c, status: a.outcome === "approve" ? "scheduled" : c.status } : c);
      }
      let inbox = s.inbox;
      if (ap?.inboxId) {
        inbox = inbox.map(i => i.id === ap.inboxId ? { ...i, status: a.outcome === "approve" ? "replied" : i.status } : i);
      }
      return { ...s,
        approvals: s.approvals.filter(x => x.id !== a.id),
        calendar: cal, inbox,
        activity: [log("Ana O.", `${a.outcome} · '${ap?.title || a.id}'`), ...s.activity],
        notifications: [notify(a.outcome === "approve" ? "ok" : "warn", `${a.outcome === "approve" ? "Approved" : "Sent back"} · ${ap?.title}`), ...s.notifications],
      };
    }
    case "TM_UPDATE": {
      return { ...s,
        toneModes: s.toneModes.map(m => m.id === a.id ? { ...m, ...a.patch } : m),
        activity: [log("Ana O.", `edited tone mode · '${a.patch.name || s.toneModes.find(m=>m.id===a.id)?.name}'`), ...s.activity],
        notifications: [notify("ok", `Tone mode saved`), ...s.notifications],
      };
    }
    case "TM_ADD_VOCAB": {
      return { ...s,
        toneModes: s.toneModes.map(m => m.id === a.id ? { ...m, [a.list]: [...m[a.list], a.word] } : m),
      };
    }
    case "TM_REMOVE_VOCAB": {
      return { ...s,
        toneModes: s.toneModes.map(m => m.id === a.id ? { ...m, [a.list]: m[a.list].filter(w => w !== a.word) } : m),
      };
    }
    case "TM_ADD": {
      const id = "tm_" + a.mode.name.toLowerCase().replace(/\s+/g,"_");
      return { ...s,
        toneModes: [...s.toneModes, { ...a.mode, id, status: "active", isDefault: false, usage: 0, performance: "—" }],
        activity: [log("Ana O.", `proposed new tone mode · '${a.mode.name}' · pending approval`), ...s.activity],
        notifications: [notify("accent", `'${a.mode.name}' proposed — requires approval`), ...s.notifications],
      };
    }
    case "INBOX_UPDATE": {
      return { ...s,
        inbox: s.inbox.map(i => i.id === a.id ? { ...i, ...a.patch } : i),
        activity: a.logEvent ? [log(a.actor || "Ana O.", a.logEvent), ...s.activity] : s.activity,
        notifications: a.notify ? [notify(a.notify.tone, a.notify.text), ...s.notifications] : s.notifications,
      };
    }
    case "TREND_SET": {
      return { ...s,
        trendBrief: s.trendBrief.map(t => t.id === a.id ? { ...t, status: a.status } : t),
        activity: [log("Ana O.", `trend '${s.trendBrief.find(t=>t.id===a.id)?.title}' → ${a.status}`), ...s.activity],
      };
    }
    case "ASSET_UPDATE": {
      return { ...s,
        assets: s.assets.map(x => x.id === a.id ? { ...x, ...a.patch } : x),
        activity: [log("Ana O.", `asset · ${a.patch.status || "updated"}`), ...s.activity],
        notifications: a.notify ? [notify(a.notify.tone, a.notify.text), ...s.notifications] : s.notifications,
      };
    }
    case "AUTONOMY_MODE":   return { ...s, autonomyMode: a.mode, activity: [log("Ana O.", `autonomy mode → ${a.mode}`), ...s.activity], notifications: [notify("accent", `Autonomy set to ${a.mode}`), ...s.notifications] };
    case "CHANNEL_RULE":    return { ...s, channelRules: s.channelRules.map(r => r.name === a.name ? { ...r, [a.field]: a.value } : r) };
    case "THRESHOLD":       return { ...s, thresholds: { ...s.thresholds, [a.key]: a.value } };
    case "BRAND_VALUE_ADD":    return { ...s, brandValues: [...s.brandValues, a.value] };
    case "BRAND_VALUE_REMOVE": return { ...s, brandValues: s.brandValues.filter(v => v !== a.value) };
    case "CLAIM_ADD":       return { ...s, approvedClaims: [...s.approvedClaims, a.claim], activity: [log("Ana O.", `added approved claim`), ...s.activity] };
    case "CLAIM_REMOVE":    return { ...s, approvedClaims: s.approvedClaims.filter(c => c !== a.claim), activity: [log("Ana O.", `removed approved claim`), ...s.activity] };
    case "RANGE_SET":       return { ...s, dateRange: a.range };
    case "NOTIFY":          return { ...s, notifications: [notify(a.tone, a.text), ...s.notifications] };
    case "NOTIFY_CLEAR":    return { ...s, notifications: s.notifications.filter(n => n.id !== a.id) };
    case "CLEAR_ALL_NOTIF": return { ...s, notifications: [] };
    case "LOG":             return { ...s, activity: [log(a.actor, a.event), ...s.activity] };
    case "CONNECTOR_SET": {
      return { ...s,
        connectors: { ...s.connectors, [a.id]: { ...(s.connectors[a.id] || {}), ...a.patch } },
        activity: a.logEvent ? [log("Priya K.", a.logEvent), ...s.activity] : s.activity,
        notifications: a.notify ? [notify(a.notify.tone, a.notify.text), ...s.notifications] : s.notifications,
      };
    }
    case "BRAND_IMPORTED": {
      return { ...s,
        brandImported: true,
        brandPreset: a.preset,
        brandValues: a.preset.values || s.brandValues,
        approvedClaims: a.preset.claims || s.approvedClaims,
        activity: [log("Priya K.", `imported brand · ${a.preset.url || a.preset.name}`), ...s.activity],
        notifications: [notify("ok", `Brand applied · ${a.preset.name}`), ...s.notifications],
      };
    }
    case "BRAND_RESET": {
      return { ...s, brandImported: false, brandPreset: null,
        notifications: [notify("neutral", "Brand reset to default"), ...s.notifications],
      };
    }
    case "SET_BRAND": {
      // Silent overlay from a Supabase `brands` row at login. No notifications,
      // no activity log — the user didn't take an action, they just signed in.
      // Snake-case → camel-case at the reducer boundary so consumers of
      // brandPreset see the same shape as SEED.brandPresets.
      // Connector state is intentionally NOT seeded here — `recommended_connectors`
      // is a hint, not ground truth. Real connector state lives in the `channels`
      // table (separate hydration).
      const b = a.brand;
      if (!b) return s;
      const preset = {
        name:                  b.name || "My Brand",
        industry:              b.industry || null,
        website:               b.website || null,
        voice:                 b.voice || null,
        values:                b.values || null,
        claims:                b.claims || null,
        prohibitedTopics:      b.prohibited_topics || null,
        targetAudience:        b.target_audience || null,
        recommendedConnectors: b.recommended_connectors || null,
        competitors:           b.competitors || null,
        messaging:             b.messaging || null,
        terminology:           b.terminology || null,
        brandAnalysis:         b.brand_analysis || null,
      };

      // Synthesize a single default tone mode from the brand voice. brand-import.js
      // currently outputs ONE voice (attributes / antiAttributes / bannedPhrases),
      // not the multi-tone structure SEED.toneModes uses. Until brand-import is
      // extended to produce multiple tone modes, this gives real users at least
      // one tone reflecting their actual brand instead of an empty list.
      // Follow-up: extend api/brand-import.js prompt to output a toneModes array
      // (name + approved + avoided + when-to-use), then map directly here.
      const v = b.voice || {};
      const approved = Array.isArray(v.attributes) ? v.attributes : [];
      const avoided  = [
        ...(Array.isArray(v.antiAttributes) ? v.antiAttributes : []),
        ...(Array.isArray(v.bannedPhrases)  ? v.bannedPhrases  : []),
      ];
      const synthesizedTone = (approved.length || avoided.length) ? [{
        id:           "tm_brand_default",
        name:         v.tone || "Brand voice",
        status:       "active",
        isDefault:    true,
        register:     v.personality || "",
        approved,
        avoided,
        rhythm:       "",
        whenToUse:    "",
        whenNotToUse: "",
        example:      "",
        performance:  "—",
        usage:        0,
      }] : null;

      return { ...s,
        brandImported:  true,
        brandPreset:    preset,
        brandValues:    Array.isArray(b.values)             ? b.values             : s.brandValues,
        approvedClaims: Array.isArray(b.claims)             ? b.claims             : s.approvedClaims,
        prohibited:     Array.isArray(b.prohibited_topics)  ? b.prohibited_topics  : s.prohibited,
        toneModes:      synthesizedTone || s.toneModes,
      };
    }
    case "SWITCH_BRAND": {
      const preset = SEED.brandPresets[a.brandId];
      if (!preset) return s;
      const brandConn = SEED.brandConnectorStates?.[a.brandId];
      return {
        ...s,
        activeBrandId: a.brandId,
        brandPreset:   preset,
        brandImported: true,
        connectors:    brandConn ? { ...brandConn } : { ...SEED.connectorState },
        notifications: [{ id: Date.now(), tone: "ok",     text: `Switched to ${preset.name}` }, ...s.notifications],
        activity:      [{ id: Date.now(), user: "System", text: `Switched account to ${preset.name}`, ts: new Date().toISOString() }, ...s.activity],
      };
    }
    case "SMS_UPDATE":
      return { ...s, smsCampaigns: s.smsCampaigns.map(c => c.id === a.id ? { ...c, ...a.patch } : c),
        activity: a.logEvent ? [log("Ana O.", a.logEvent), ...s.activity] : s.activity,
        notifications: a.notify ? [notify(a.notify.tone, a.notify.text), ...s.notifications] : s.notifications };
    case "SMS_AUTOMATION_TOGGLE":
      return { ...s, smsAutomations: s.smsAutomations.map(x => x.id === a.id ? { ...x, status: x.status === "live" ? "paused" : "live" } : x),
        activity: [log("Ana O.", `SMS automation toggled · ${a.id}`), ...s.activity] };

    case "SEO_ARTICLE_UPDATE":
      return { ...s, seoArticles: s.seoArticles.map(x => x.id === a.id ? { ...x, ...a.patch } : x),
        activity: [log("Drafter", `SEO article · ${a.patch.status || "updated"}`), ...s.activity] };
    case "SEO_LINK_ACCEPT":
      return { ...s, seoInternalSuggestions: s.seoInternalSuggestions.filter((_,i) => i !== a.idx),
        activity: [log("Drafter", `internal link added · ${a.suggestion?.from} → ${a.suggestion?.to}`), ...s.activity],
        notifications: [notify("ok", `Internal link added`), ...s.notifications] };

    case "AFFILIATE_UPDATE":
      return { ...s, affiliatePartners: s.affiliatePartners.map(p => p.id === a.id ? { ...p, ...a.patch } : p),
        activity: [log("Ana O.", `affiliate · ${a.patch.status || "updated"}`), ...s.activity] };

    case "AB_UPDATE":
      return { ...s, abTests: s.abTests.map(t => t.id === a.id ? { ...t, ...a.patch } : t),
        activity: [log("Brand Guard", `A/B test · ${a.patch.status || "updated"}`), ...s.activity] };
    case "AB_PROMOTE_TO_BRAND":
      return { ...s, abFedBrandRules: [{ rule: a.rule, source: a.source }, ...s.abFedBrandRules],
        activity: [log("Brand Guard", `promoted A/B winner to brand rule · ${a.rule}`), ...s.activity],
        notifications: [notify("ok", `Brand rule added from A/B winner`), ...s.notifications] };
    case "AB_CREATE_FROM_DRAFT": {
      const test = { id: "ab_" + crypto.randomUUID(), subject: a.subject, variantA: a.variantA, variantB: a.variantB, status: "running", confidence: 0, lift: "—", linkedDraftId: a.linkedDraftId };
      return { ...s, abTests: [test, ...s.abTests],
        activity: [log("Drafter", `A/B test created from draft · ${a.subject}`), ...s.activity],
        notifications: [notify("ok", `A/B test launched`), ...s.notifications] };
    }

    case "GUEST_INVITE":
      return { ...s, guests: [{ id: "g_" + crypto.randomUUID(), ...a.guest, last: "just now" }, ...s.guests],
        activity: [log("Greg", `invited guest · ${a.guest.name}`), ...s.activity],
        notifications: [notify("ok", `Invite sent · ${a.guest.email}`), ...s.notifications] };
    case "GUEST_REMOVE":
      return { ...s, guests: s.guests.filter(g => g.id !== a.id),
        activity: [log("Greg", `removed guest · ${a.id}`), ...s.activity] };
    case "GUEST_UPDATE":
      return { ...s, guests: s.guests.map(g => g.id === a.id ? { ...g, ...a.patch } : g) };

    case "DISCOUNT_UPDATE":
      return { ...s, discountHistory: s.discountHistory.map(d => d.id === a.id ? { ...d, ...a.patch } : d),
        activity: [log("Ana O.", `discount ${a.patch.status || "updated"} · ${s.discountHistory.find(d=>d.id===a.id)?.code}`), ...s.activity] };

    case "SEASONAL_TOGGLE":
      return { ...s, seasonalPlaybooks: s.seasonalPlaybooks.map(p => p.id === a.id ? { ...p, status: p.status === "active" ? "preloaded" : "active" } : p),
        activity: [log("Supervisor", `seasonal playbook · ${a.id}`), ...s.activity] };

    case "STRATEGY_APPLY": {
      const next = {
        ...(s.strategy || {}),
        ...a.payload,
        version: (s.strategy?.version || 0) + 1,
        approvedAt: Date.now(),
        approvedBy: "Greg",
      };
      return { ...s, strategy: next,
        activity: [log("Greg", `approved channel strategy v${next.version} · ${a.payload.goal} / ${a.payload.stage}`), ...s.activity],
        notifications: [notify("ok", `Channel strategy v${next.version} approved · routed to Planning`), ...s.notifications],
      };
    }
    case "QUEUE_LOAD_PROACTIVE": {
      // Bulk-load proactive drafts into calendar, deduplicating by id so refresh-reloads are idempotent
      const existingIds = new Set(s.calendar.map(c => c.id));
      const newItems = (a.items || [])
        .filter(d => !existingIds.has(d.id))
        .map(d => ({
          id:          d.id || "p_" + crypto.randomUUID(),
          platform:    d.platform,
          kind:        d.contentType,
          title:       (d.copy || "").slice(0, 80),
          body:        d.copy,
          imagePrompt: d.imagePrompt || null,
          status:      "draft",
          scheduledAt: d.suggestedTime || null,
          fromChat:    false,
          day:         d.suggestedDay ?? null,
          channel:     d.platform,
          tone:        "Proactive",
          source:      "proactive",
          createdAt:   new Date().toISOString(),
        }));
      if (newItems.length === 0) return s;
      return { ...s,
        calendar: [...newItems, ...s.calendar],
        notifications: [notify("ok", `${newItems.length} proactive draft${newItems.length !== 1 ? "s" : ""} loaded`), ...s.notifications],
      };
    }
    case "QUEUE_ADD_DRAFT": {
      const platformKey = (a.platform || "").toLowerCase();
      const item = {
        id:            a.id || ("d_" + crypto.randomUUID()),
        platform:      a.platform,
        kind:          a.contentType,
        title:         (a.copy || "").slice(0, 80),
        body:          a.copy,
        imagePrompt:   a.imagePrompt || null,
        imageUrl:      null,
        imageStatus:   a.imagePrompt ? "pending" : "none",
        status:        "draft",
        scheduledAt:   null,
        fromChat:      true,
        day:           null,
        channel:       a.platform,
        tone:          "Chat draft",
        sourceBriefId: a.sourceBriefId || null,
        noPublishPath: !PLATFORM_PUBLISHERS.has(platformKey),
        createdAt:     new Date().toISOString(),
      };
      return { ...s,
        calendar: [item, ...s.calendar],
        activity: [log("Drafter", `chat draft created · ${a.platform} ${a.contentType}`), ...s.activity],
        notifications: [notify("ok", `Draft added to queue · ${a.platform}`), ...s.notifications],
      };
    }
    case "OUTBOUND_EMAIL_ADD": {
      const email = {
        id:                a.id || ("oe_" + crypto.randomUUID()),
        subject:           a.subject || "",
        preheader:         a.preheader || "",
        bodyHtml:          a.bodyHtml || "",
        bodyText:          a.bodyText || "",
        audienceHint:      a.audienceHint || "",
        status:            a.status || "pushing",
        klaviyoTemplateId: null,
        klaviyoCampaignId: null,
        klaviyoMessageId:  null,
        klaviyoUrl:        null,
        audience:          null,
        error:             null,
        createdAt:         new Date().toISOString(),
        fromChat:          a.fromChat !== false,
      };
      return { ...s,
        outbound: { ...s.outbound, emails: [email, ...s.outbound.emails] },
        activity: [log("Drafter", `email push started · ${email.subject.slice(0, 60)}`), ...s.activity],
      };
    }
    case "OUTBOUND_EMAIL_UPDATE": {
      const emails = s.outbound.emails.map(e =>
        e.id === a.id ? { ...e, ...a.patch } : e
      );
      const next = { ...s, outbound: { ...s.outbound, emails } };
      if (a.notify) next.notifications = [notify(a.notify.tone, a.notify.text), ...s.notifications];
      return next;
    }
    case "PROACTIVE_EMAILS_LOAD": {
      // Bulk-hydrate from /api/proactive-emails GET. Dedupe by id so refreshes are idempotent.
      const existingIds = new Set(s.outbound.proactiveEmails.map(e => e.id));
      const incoming = (a.items || []).filter(e => !existingIds.has(e.id));
      if (incoming.length === 0) return s;
      const merged = [...incoming, ...s.outbound.proactiveEmails];
      return { ...s,
        outbound: { ...s.outbound, proactiveEmails: merged },
        notifications: [notify("accent", `${incoming.length} proactive email draft${incoming.length !== 1 ? "s" : ""} ready in Email Studio`), ...s.notifications],
      };
    }
    case "PROACTIVE_EMAIL_UPDATE": {
      const proactiveEmails = s.outbound.proactiveEmails.map(e =>
        e.id === a.id ? { ...e, ...a.patch } : e
      );
      const next = { ...s, outbound: { ...s.outbound, proactiveEmails } };
      if (a.notify) next.notifications = [notify(a.notify.tone, a.notify.text), ...s.notifications];
      return next;
    }
    case "PROACTIVE_EMAIL_REMOVE": {
      const proactiveEmails = s.outbound.proactiveEmails.filter(e => e.id !== a.id);
      const next = { ...s, outbound: { ...s.outbound, proactiveEmails } };
      if (a.notify) next.notifications = [notify(a.notify.tone, a.notify.text), ...s.notifications];
      return next;
    }
    case "PROACTIVE_SMS_LOAD": {
      const existingIds = new Set(s.outbound.proactiveSms.map(e => e.id));
      const incoming = (a.items || []).filter(e => !existingIds.has(e.id));
      if (incoming.length === 0) return s;
      const merged = [...incoming, ...s.outbound.proactiveSms];
      return { ...s,
        outbound: { ...s.outbound, proactiveSms: merged },
        notifications: [notify("accent", `${incoming.length} proactive SMS draft${incoming.length !== 1 ? "s" : ""} ready in SMS Center`), ...s.notifications],
      };
    }
    case "PROACTIVE_SMS_UPDATE": {
      const proactiveSms = s.outbound.proactiveSms.map(e =>
        e.id === a.id ? { ...e, ...a.patch } : e
      );
      const next = { ...s, outbound: { ...s.outbound, proactiveSms } };
      if (a.notify) next.notifications = [notify(a.notify.tone, a.notify.text), ...s.notifications];
      return next;
    }
    case "PROACTIVE_SMS_REMOVE": {
      const proactiveSms = s.outbound.proactiveSms.filter(e => e.id !== a.id);
      const next = { ...s, outbound: { ...s.outbound, proactiveSms } };
      if (a.notify) next.notifications = [notify(a.notify.tone, a.notify.text), ...s.notifications];
      return next;
    }
    case "OUTBOUND_SMS_ADD": {
      const sms = {
        id:                a.id || ("os_" + crypto.randomUUID()),
        body:              a.body || "",
        audienceHint:      a.audienceHint || "",
        status:            a.status || "pushing",
        klaviyoCampaignId: null,
        klaviyoMessageId:  null,
        klaviyoUrl:        null,
        audience:          null,
        warnings:          a.warnings || {},
        error:             null,
        createdAt:         new Date().toISOString(),
        fromChat:          a.fromChat !== false,
      };
      return { ...s,
        outbound: { ...s.outbound, sms: [sms, ...s.outbound.sms] },
        activity: [log("Drafter", `sms push started · ${sms.body.slice(0, 60)}`), ...s.activity],
      };
    }
    case "OUTBOUND_SMS_UPDATE": {
      const sms = s.outbound.sms.map(x =>
        x.id === a.id ? { ...x, ...a.patch } : x
      );
      const next = { ...s, outbound: { ...s.outbound, sms } };
      if (a.notify) next.notifications = [notify(a.notify.tone, a.notify.text), ...s.notifications];
      return next;
    }
    case "ACTIVE_PLAN_SET": {
      return {
        ...s,
        activePlan: a.plan ? {
          ...a.plan,
          id:        a.plan.id || ("br_" + crypto.randomUUID()),
          createdAt: a.plan.createdAt || new Date().toISOString(),
        } : null,
        notifications: a.plan
          ? [notify("ok", `Campaign brief ready: ${a.plan.title || "Untitled"}`), ...s.notifications]
          : s.notifications,
      };
    }
    case "ACTIVE_PLAN_CLEAR": {
      return { ...s, activePlan: null };
    }
    // === TRACK A: PUBLISHING + ADS ===
    // Reducer cases for Track A (publishing + ads). PR 1 uses CAL_UPDATE for
    // optimistic queue mutations; new cases land here as later PRs need them.
    // === END TRACK A ===
    // === TRACK B: HYGIENE + HEALTH ===
    case "CONN_HEALTH_LOAD": {
      const next = { ...s.connectors };
      for (const { id, health } of (a.items || [])) {
        if (!id) continue;
        next[id] = { ...(next[id] || {}), health: health || null };
      }
      return { ...s, connectors: next };
    }
    // === END TRACK B ===
    // === TRACK CLAUDE: LEADS + CAMPAIGNS ===
    case "CAMPAIGN_PLAN_LOAD": {
      // Replace the whole list (called by loadCampaignPlans after a fresh fetch).
      const plans = Array.isArray(a.plans) ? a.plans : [];
      return { ...s, campaignPlans: plans };
    }
    case "CAMPAIGN_PLAN_UPSERT": {
      // Insert or merge a single plan row. Used after create/update/status transitions.
      if (!a.plan?.id) return s;
      const idx = s.campaignPlans.findIndex(p => p.id === a.plan.id);
      const next = idx >= 0
        ? s.campaignPlans.map((p, i) => i === idx ? { ...p, ...a.plan } : p)
        : [a.plan, ...s.campaignPlans];
      return { ...s, campaignPlans: next };
    }
    case "CAMPAIGN_PLAN_REMOVE": {
      if (!a.id) return s;
      return { ...s, campaignPlans: s.campaignPlans.filter(p => p.id !== a.id) };
    }
    // === END TRACK CLAUDE ===
    default: return s;
  }
}

// useMvedaStore(seedMode, userId)
//   seedMode: "mveda" | "erickson" | null — passed by ChatOSAuthed from URL
//             param state. null = real user session.
//   userId:   Supabase user id for real users; ignored in seed mode.
// Both are read by mveda_initialState on first render and not re-read after
// (useReducer's init arg only runs once). They're stable per-session by
// construction — ChatOS sets them before ChatOSAuthed mounts.
function useMvedaStore(seedMode = null, userId = null) {
  const [state, dispatch] = useReducerStore(mveda_reducer, { seedMode, userId }, mveda_initialState);
  const actions = {
    addCampaign: (items, campaignName) => dispatch({ type: "CAL_ADD", items, campaign: campaignName }),
    updateItem:  (id, patch, opts={}) => dispatch({ type: "CAL_UPDATE", id, patch, logEvent: opts.logEvent, actor: opts.actor, notify: opts.notify }),
    removeItem:  (id) => dispatch({ type: "CAL_REMOVE", id }),
    resolveApproval: (id, outcome) => dispatch({ type: "APPROVAL_RESOLVE", id, outcome }),
    updateToneMode:  (id, patch) => dispatch({ type: "TM_UPDATE", id, patch }),
    addToneVocab:    (id, list, word) => dispatch({ type: "TM_ADD_VOCAB", id, list, word }),
    removeToneVocab: (id, list, word) => dispatch({ type: "TM_REMOVE_VOCAB", id, list, word }),
    addToneMode:     (mode) => dispatch({ type: "TM_ADD", mode }),
    updateInbox:     (id, patch, opts={}) => dispatch({ type: "INBOX_UPDATE", id, patch, logEvent: opts.logEvent, actor: opts.actor, notify: opts.notify }),
    setTrendStatus:  (id, status) => dispatch({ type: "TREND_SET", id, status }),
    updateAsset:     (id, patch, opts={}) => dispatch({ type: "ASSET_UPDATE", id, patch, notify: opts.notify }),
    setAutonomyMode: (mode) => dispatch({ type: "AUTONOMY_MODE", mode }),
    setChannelRule:  (name, field, value) => dispatch({ type: "CHANNEL_RULE", name, field, value }),
    setThreshold:    (key, value) => dispatch({ type: "THRESHOLD", key, value }),
    addBrandValue:   (value) => dispatch({ type: "BRAND_VALUE_ADD", value }),
    removeBrandValue:(value) => dispatch({ type: "BRAND_VALUE_REMOVE", value }),
    addClaim:        (claim) => dispatch({ type: "CLAIM_ADD", claim }),
    removeClaim:     (claim) => dispatch({ type: "CLAIM_REMOVE", claim }),
    setDateRange:    (range) => dispatch({ type: "RANGE_SET", range }),
    notify:          (tone, text) => dispatch({ type: "NOTIFY", tone, text }),
    dismissNotif:    (id) => dispatch({ type: "NOTIFY_CLEAR", id }),
    clearAllNotif:   () => dispatch({ type: "CLEAR_ALL_NOTIF" }),
    log:             (actor, event) => dispatch({ type: "LOG", actor, event }),
    setConnector:    (id, patch, opts={}) => dispatch({ type: "CONNECTOR_SET", id, patch, logEvent: opts.logEvent, notify: opts.notify }),
    importBrand:     (preset) => dispatch({ type: "BRAND_IMPORTED", preset }),
    setBrand:        (brand)  => dispatch({ type: "SET_BRAND", brand }),
    resetBrand:      () => dispatch({ type: "BRAND_RESET" }),
    switchBrand:     (brandId) => dispatch({ type: "SWITCH_BRAND", brandId }),
    applyStrategy:   (payload) => dispatch({ type: "STRATEGY_APPLY", payload }),

    updateSms:        (id, patch, opts={}) => dispatch({ type: "SMS_UPDATE", id, patch, logEvent: opts.logEvent, notify: opts.notify }),
    toggleSmsAutomation: (id) => dispatch({ type: "SMS_AUTOMATION_TOGGLE", id }),
    updateSeoArticle: (id, patch) => dispatch({ type: "SEO_ARTICLE_UPDATE", id, patch }),
    acceptInternalLink: (idx, suggestion) => dispatch({ type: "SEO_LINK_ACCEPT", idx, suggestion }),
    updateAffiliate:  (id, patch) => dispatch({ type: "AFFILIATE_UPDATE", id, patch }),
    updateAbTest:     (id, patch) => dispatch({ type: "AB_UPDATE", id, patch }),
    promoteAbToBrand: (rule, source) => dispatch({ type: "AB_PROMOTE_TO_BRAND", rule, source }),
    createAbFromDraft:(payload) => dispatch({ type: "AB_CREATE_FROM_DRAFT", ...payload }),
    inviteGuest:      (guest) => dispatch({ type: "GUEST_INVITE", guest }),
    removeGuest:      (id) => dispatch({ type: "GUEST_REMOVE", id }),
    updateGuest:      (id, patch) => dispatch({ type: "GUEST_UPDATE", id, patch }),
    updateDiscount:   (id, patch) => dispatch({ type: "DISCOUNT_UPDATE", id, patch }),
    toggleSeasonal:   (id) => dispatch({ type: "SEASONAL_TOGGLE", id }),
    addDraft: (platform, contentType, copy, imagePrompt, id, sourceBriefId) =>
      dispatch({ type: "QUEUE_ADD_DRAFT", platform, contentType, copy, imagePrompt, id, sourceBriefId }),
    loadProactiveDrafts: (items) =>
      dispatch({ type: "QUEUE_LOAD_PROACTIVE", items }),
    addOutboundEmail: (payload) =>
      dispatch({ type: "OUTBOUND_EMAIL_ADD", ...payload }),
    updateOutboundEmail: (id, patch, opts = {}) =>
      dispatch({ type: "OUTBOUND_EMAIL_UPDATE", id, patch, notify: opts.notify }),
    addOutboundSms: (payload) =>
      dispatch({ type: "OUTBOUND_SMS_ADD", ...payload }),
    updateOutboundSms: (id, patch, opts = {}) =>
      dispatch({ type: "OUTBOUND_SMS_UPDATE", id, patch, notify: opts.notify }),
    loadProactiveEmails: (items) =>
      dispatch({ type: "PROACTIVE_EMAILS_LOAD", items }),
    updateProactiveEmail: (id, patch, opts = {}) =>
      dispatch({ type: "PROACTIVE_EMAIL_UPDATE", id, patch, notify: opts.notify }),
    removeProactiveEmail: (id, opts = {}) =>
      dispatch({ type: "PROACTIVE_EMAIL_REMOVE", id, notify: opts.notify }),
    loadProactiveSms: (items) =>
      dispatch({ type: "PROACTIVE_SMS_LOAD", items }),
    updateProactiveSms: (id, patch, opts = {}) =>
      dispatch({ type: "PROACTIVE_SMS_UPDATE", id, patch, notify: opts.notify }),
    removeProactiveSms: (id, opts = {}) =>
      dispatch({ type: "PROACTIVE_SMS_REMOVE", id, notify: opts.notify }),
    // PR C1: dispatches as before AND fires a one-time DB persist so the
    // chat-emitted plan survives refresh. If the plan already has a DB id
    // (came from loadCampaignPlans or createCampaignPlan), the persist is
    // skipped. Fire-and-forget — on failure the plan stays in-memory and the
    // user can retry via the Save button in CampaignPlanner.
    setActivePlan: (plan) => {
      dispatch({ type: "ACTIVE_PLAN_SET", plan });
      if (plan && !plan.id && window.apiFetch) {
        actions.createCampaignPlan({
          title:              plan.title || "Untitled campaign",
          summary:            plan.summary,
          goal:               plan.goal,
          audience:           plan.audience,
          timeline:           plan.timeline,
          budget:             plan.budget,
          channels:           plan.channels,
          brief:              plan.brief,
          sourceSpecialist:   "campaign_planner",
        }).then(r => {
          if (r.ok && r.plan?.id) {
            // Re-dispatch with the DB id stamped so subsequent edits patch the same row.
            dispatch({ type: "ACTIVE_PLAN_SET", plan: { ...plan, id: r.plan.id } });
          }
        }).catch(() => {});
      }
    },
    clearActivePlan: () => dispatch({ type: "ACTIVE_PLAN_CLEAR" }),

    // === TRACK A: PUBLISHING + ADS ===
    // Async helpers wrap window.apiFetch + dispatch CAL_UPDATE. Each resolves
    // to { ok: true, ... } or { ok: false, error } so callers can toast/log.
    editPost: async (itemId, { postId, platform, content }) => {
      if (!postId || !platform || !content) {
        return { ok: false, error: "postId, platform, content required" };
      }
      try {
        const res = await window.apiFetch("/api/zernio-publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "edit_post", postId, platform, content }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          dispatch({ type: "NOTIFY", tone: "warn", text: `Edit failed: ${data.error || res.status}` });
          return { ok: false, error: data.error || `HTTP ${res.status}` };
        }
        dispatch({
          type:  "CAL_UPDATE",
          id:    itemId,
          patch: { body: content, ...(data.postId ? { xPostId: data.postId } : {}), ...(data.url ? { xUrl: data.url } : {}) },
          notify: { tone: "ok", text: "Post edited" },
        });
        return { ok: true, data };
      } catch (e) {
        dispatch({ type: "NOTIFY", tone: "warn", text: `Edit failed: ${e.message}` });
        return { ok: false, error: e.message };
      }
    },
    unpublishPost: async (itemId, { postId, platform }) => {
      if (!postId || !platform) return { ok: false, error: "postId, platform required" };
      try {
        const res = await window.apiFetch("/api/zernio-publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unpublish_post", postId, platform }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          dispatch({ type: "NOTIFY", tone: "warn", text: `Unpublish failed: ${data.error || res.status}` });
          return { ok: false, error: data.error || `HTTP ${res.status}` };
        }
        dispatch({
          type:  "CAL_UPDATE",
          id:    itemId,
          patch: { status: "draft", publishStatus: "unpublished" },
          notify: { tone: "ok", text: "Post unpublished" },
        });
        return { ok: true, data };
      } catch (e) {
        dispatch({ type: "NOTIFY", tone: "warn", text: `Unpublish failed: ${e.message}` });
        return { ok: false, error: e.message };
      }
    },
    importCSV: async ({ posts, dryRun }) => {
      if (!Array.isArray(posts) || posts.length === 0) {
        return { ok: false, error: "posts[] required" };
      }
      try {
        const res = await window.apiFetch("/api/zernio-publish", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "bulk_upload", posts, dryRun: !!dryRun }),
        });
        const data = await res.json();
        if (!res.ok) {
          dispatch({ type: "NOTIFY", tone: "warn", text: `Bulk upload failed: ${data.error || res.status}` });
          return { ok: false, error: data.error || `HTTP ${res.status}` };
        }
        if (!dryRun) {
          const tone = data.invalid === 0 ? "ok" : (data.valid === 0 ? "warn" : "accent");
          dispatch({ type: "NOTIFY", tone, text: `CSV import · ${data.valid}/${data.total} queued${data.invalid ? `, ${data.invalid} failed` : ""}` });
        }
        return { ok: true, data };
      } catch (e) {
        dispatch({ type: "NOTIFY", tone: "warn", text: `Bulk upload failed: ${e.message}` });
        return { ok: false, error: e.message };
      }
    },
    retryPost: async (itemId, { postId }) => {
      if (!postId) return { ok: false, error: "postId required" };
      try {
        const res = await window.apiFetch("/api/zernio-publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry_post", postId }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          dispatch({ type: "NOTIFY", tone: "warn", text: `Retry failed: ${data.error || res.status}` });
          return { ok: false, error: data.error || `HTTP ${res.status}` };
        }
        const patch = { publishStatus: data.status || "published", publishError: null };
        if (data.status === "published") patch.status = "scheduled";
        dispatch({
          type:  "CAL_UPDATE",
          id:    itemId,
          patch,
          notify: { tone: "ok", text: data.status === "published" ? "Post retried · published" : "Retry queued" },
        });
        return { ok: true, data };
      } catch (e) {
        dispatch({ type: "NOTIFY", tone: "warn", text: `Retry failed: ${e.message}` });
        return { ok: false, error: e.message };
      }
    },
    // === END TRACK A ===
    // === TRACK B: HYGIENE + HEALTH ===
    loadAccountHealth: (items) =>
      dispatch({ type: "CONN_HEALTH_LOAD", items: items || [] }),
    // === END TRACK B ===
    // === TRACK CLAUDE: LEADS + CAMPAIGNS ===
    // All campaign-plan helpers wrap window.apiFetch + dispatch.
    // Each resolves to { ok, plan? } so callers can toast/log.
    loadCampaignPlans: async ({ status } = {}) => {
      try {
        const res = await window.apiFetch("/api/campaign-plans", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "list_plans", ...(status ? { status } : {}) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
        // DB rows come back snake_case; expose them as-is + add a camelCase mirror
        // for the few fields the UI reads frequently.
        const plans = (data.rows || []).map(row => ({
          ...row,
          createdAt:   row.created_at,
          updatedAt:   row.updated_at,
          activatedAt: row.activated_at,
          archivedAt:  row.archived_at,
        }));
        dispatch({ type: "CAMPAIGN_PLAN_LOAD", plans });
        // If a plan is currently active in the UI and we just hydrated a fresher
        // copy of it, sync activePlan so it doesn't show stale data after refresh.
        return { ok: true, plans };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    createCampaignPlan: async (plan) => {
      try {
        const res = await window.apiFetch("/api/campaign-plans", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "create_plan", ...plan }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          dispatch({ type: "NOTIFY", tone: "warn", text: `Plan create failed: ${data.error || res.status}` });
          return { ok: false, error: data.error || `HTTP ${res.status}` };
        }
        dispatch({ type: "CAMPAIGN_PLAN_UPSERT", plan: data.plan });
        return { ok: true, plan: data.plan };
      } catch (e) {
        dispatch({ type: "NOTIFY", tone: "warn", text: `Plan create failed: ${e.message}` });
        return { ok: false, error: e.message };
      }
    },
    updateCampaignPlan: async (id, patch) => {
      if (!id) return { ok: false, error: "id required" };
      try {
        const res = await window.apiFetch("/api/campaign-plans", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "update_plan", id, ...patch }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
        dispatch({ type: "CAMPAIGN_PLAN_UPSERT", plan: data.plan });
        return { ok: true, plan: data.plan };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    // Status transitions — thin wrappers that hit /api/campaign-plans and
    // patch the matching row in state.campaignPlans. They DO NOT touch
    // state.activePlan; that's the caller's responsibility (CampaignPlanner
    // sidebar manages focus).
    activateCampaignPlan: async (id) => {
      if (!id) return { ok: false, error: "id required" };
      try {
        const res = await window.apiFetch("/api/campaign-plans", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "activate_plan", id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          dispatch({ type: "NOTIFY", tone: "warn", text: `Activate failed: ${data.error || res.status}` });
          return { ok: false, error: data.error || `HTTP ${res.status}` };
        }
        dispatch({ type: "CAMPAIGN_PLAN_UPSERT", plan: data.plan });
        dispatch({ type: "NOTIFY", tone: "ok", text: `Activated: ${data.plan.title}` });
        return { ok: true, plan: data.plan };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    pauseCampaignPlan: async (id) => {
      if (!id) return { ok: false, error: "id required" };
      try {
        const res = await window.apiFetch("/api/campaign-plans", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "pause_plan", id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
        dispatch({ type: "CAMPAIGN_PLAN_UPSERT", plan: data.plan });
        return { ok: true, plan: data.plan };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    archiveCampaignPlan: async (id) => {
      if (!id) return { ok: false, error: "id required" };
      try {
        const res = await window.apiFetch("/api/campaign-plans", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "archive_plan", id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
        dispatch({ type: "CAMPAIGN_PLAN_UPSERT", plan: data.plan });
        return { ok: true, plan: data.plan };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    deleteCampaignPlan: async (id) => {
      if (!id) return { ok: false, error: "id required" };
      try {
        const res = await window.apiFetch("/api/campaign-plans", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "delete_plan", id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
        dispatch({ type: "CAMPAIGN_PLAN_REMOVE", id });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    // === END TRACK CLAUDE ===
  };
  return [state, actions];
}

Object.assign(window, { useMvedaStore });
