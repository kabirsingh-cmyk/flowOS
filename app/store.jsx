// MVEDA store — central state + action dispatchers
// All workspaces read from `state` and mutate via `actions`.
const { useReducer: useReducerStore, useCallback: useCallbackStore } = React;

function mveda_initialState() {
  return {
    calendar: SEED.calendar.map(c => ({ ...c })),
    toneModes: SEED.toneModes.map(m => ({ ...m, approved: [...m.approved], avoided: [...m.avoided] })),
    approvals: SEED.approvals.map(a => ({ ...a, status: "open" })),
    inbox: SEED.inbox.map(i => ({ ...i })),
    assets: SEED.assets.map(a => ({ ...a })),
    trendBrief: SEED.trendBrief.map(t => ({ ...t })),
    brandValues: [...SEED.brandValues],
    approvedClaims: [...SEED.approvedClaims],
    prohibited: [...SEED.prohibited],
    autonomyMode: "assisted",
    channelRules: [
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
    ],
    thresholds: { confidence: 85, dailyCap: 12, sla: 90 },
    activity: SEED.audit.map(a => ({ ...a, id: "e_" + Math.random().toString(36).slice(2,8) })),
    notifications: [],
    dateRange: "30d",
    activeBrandId: "mveda",
    connectors: { ...SEED.connectorState },
    brandImported: SEED.brandImported || false,
    brandPreset: null, // gets set when user imports

    // New feature state
    smsCampaigns: SEED.smsCampaigns.map(c => ({ ...c })),
    smsAutomations: SEED.smsAutomations.map(a => ({ ...a })),
    smsCompliance: { ...SEED.smsCompliance },
    seoArticles: SEED.seoArticles.map(a => ({ ...a })),
    seoKeywords: SEED.seoKeywords.map(k => ({ ...k })),
    seoBacklinks: SEED.seoBacklinks.map(b => ({ ...b })),
    seoInternalSuggestions: SEED.seoInternalSuggestions.map(s => ({ ...s })),
    affiliateProgram: { ...SEED.affiliateProgram },
    affiliatePartners: SEED.affiliatePartners.map(p => ({ ...p })),
    referralProgram: { ...SEED.referralProgram },
    retention: JSON.parse(JSON.stringify(SEED.retention)),
    cxSignals: JSON.parse(JSON.stringify(SEED.cxSignals)),
    seasonalPlaybooks: SEED.seasonalPlaybooks.map(p => ({ ...p })),
    capacityPlan: { ...SEED.capacityPlan },
    abTests: SEED.abTests.map(t => ({ ...t })),
    abFedBrandRules: SEED.abFedBrandRules.map(r => ({ ...r })),
    team: SEED.team.map(t => ({ ...t })),
    guests: SEED.guests.map(g => ({ ...g, scope: [...g.scope] })),
    discountHistory: SEED.discountHistory.map(d => ({ ...d })),
    marginFloors: { ...SEED.marginFloors },
    discountFatigue: { ...SEED.discountFatigue, alerts: [...SEED.discountFatigue.alerts] },

    // Chat-authored outbound assets pushed to external platforms (Klaviyo, SMS providers, etc).
    // Separate from `calendar` because the lifecycle is platform-driven, not internal.
    outbound: {
      emails: [], // { id, subject, preheader, bodyHtml, bodyText, audienceHint, status, klaviyoTemplateId, klaviyoCampaignId, klaviyoMessageId, klaviyoUrl, audience, error, createdAt }
      sms:    [], // { id, body, audienceHint, status, klaviyoCampaignId, klaviyoMessageId, klaviyoUrl, audience, warnings, error, createdAt }
      // Analytics-triggered email drafts (flavor #1 Proactive). Lifecycle is server → review → push.
      // status: "proactive_draft" | "pushing" | "klaviyo_draft" | "failed" | "dismissed"
      // shape: { id, rule, ruleLabel, subject, preheader, body, audienceHint, reason, source, status, klaviyoUrl, klaviyoCampaignId, audience, error, createdAt }
      proactiveEmails: [],
    },
  };
}

function mveda_reducer(s, a) {
  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };
  const log = (actor, event) => ({ id: "e_"+Math.random().toString(36).slice(2,8), t: now(), actor, event });
  const notify = (tone, text) => ({ id: "n_"+Math.random().toString(36).slice(2,8), tone, text, at: Date.now() });

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
      const test = { id: "ab_" + Math.random().toString(36).slice(2,6), subject: a.subject, variantA: a.variantA, variantB: a.variantB, status: "running", confidence: 0, lift: "—", linkedDraftId: a.linkedDraftId };
      return { ...s, abTests: [test, ...s.abTests],
        activity: [log("Drafter", `A/B test created from draft · ${a.subject}`), ...s.activity],
        notifications: [notify("ok", `A/B test launched`), ...s.notifications] };
    }

    case "GUEST_INVITE":
      return { ...s, guests: [{ id: "g_" + Math.random().toString(36).slice(2,6), ...a.guest, last: "just now" }, ...s.guests],
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
          id:          d.id || "p_" + Math.random().toString(36).slice(2,8),
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
      const item = {
        id:          a.id || ("d_" + Math.random().toString(36).slice(2,8)),
        platform:    a.platform,
        kind:        a.contentType,
        title:       (a.copy || "").slice(0, 80),
        body:        a.copy,
        imagePrompt: a.imagePrompt || null,
        imageUrl:    null,
        imageStatus: a.imagePrompt ? "pending" : "none",
        status:      "draft",
        scheduledAt: null,
        fromChat:    true,
        day:         null,
        channel:     a.platform,
        tone:        "Chat draft",
        createdAt:   new Date().toISOString(),
      };
      return { ...s,
        calendar: [item, ...s.calendar],
        activity: [log("Drafter", `chat draft created · ${a.platform} ${a.contentType}`), ...s.activity],
        notifications: [notify("ok", `Draft added to queue · ${a.platform}`), ...s.notifications],
      };
    }
    case "OUTBOUND_EMAIL_ADD": {
      const email = {
        id:                a.id || ("oe_" + Math.random().toString(36).slice(2, 8)),
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
    case "OUTBOUND_SMS_ADD": {
      const sms = {
        id:                a.id || ("os_" + Math.random().toString(36).slice(2, 8)),
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
    default: return s;
  }
}

function useMvedaStore() {
  const [state, dispatch] = useReducerStore(mveda_reducer, undefined, mveda_initialState);
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
    addDraft: (platform, contentType, copy, imagePrompt, id) =>
      dispatch({ type: "QUEUE_ADD_DRAFT", platform, contentType, copy, imagePrompt, id }),
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
  };
  return [state, actions];
}

Object.assign(window, { useMvedaStore });
