(function () {
// MVEDA workspaces — part 3: Publishing, Insights, Inbox, Autonomy
const { useState: useState3, useMemo: useMemo3, useEffect: useEffect3, useRef: useRef3 } = React;

// Per-platform mapping from calendar row → Zernio internal post _id.
// publish_now responses store this in <platform>PostId fields (see
// PLATFORM_PUBLISHERS.resultFields). Zernio's edit/unpublish/retry endpoints
// key on the internal _id, not the platform-native post id.
function getZernioPostId(item) {
  if (!item) return null;
  return item.linkedinPostId  || item.facebookPostId  || item.xPostId
      || item.instagramPostId || item.redditPostId    || null;
}

// Minimal RFC4180-ish CSV parser. Handles quoted fields with embedded
// commas, newlines, and escaped quotes ("" → "). Trailing newline tolerated.
// Returns { header: string[], rows: string[][] }.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* swallow */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows.shift() || [];
  return { header, rows: rows.filter(r => r.length && r.some(v => v !== "")) };
}

// Heuristic auto-mapping from CSV header names → our 4 logical fields.
function autoMapColumns(header) {
  const norm = h => h.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const find = patterns => {
    for (const h of header) {
      const n = norm(h);
      if (patterns.some(p => n === p || n.includes(p))) return h;
    }
    return "";
  };
  return {
    platform:      find(["platform", "channel", "network"]),
    content:       find(["content", "body", "text", "caption", "message", "post"]),
    scheduled_for: find(["scheduledfor", "scheduledat", "scheduletime", "schedule", "datetime", "date"]),
    media_urls:    find(["mediaurls", "media", "imageurl", "image", "video", "attachments"]),
  };
}

// ────────────────────────────── PUBLISHING QUEUE ──────────────────────────────
function PublishingQueue({ state, actions }) {
  const [view, setView]           = useState3("calendar"); // "calendar" | "list"
  const [editItem, setEditItem]   = useState3(null);
  const [editDraft, setEditDraft] = useState3(null); // controlled form state
  const [generating, setGenerating] = useState3(false);
  const [author, setAuthor]         = useState3("");        // selected author URN/ID (platform-native)
  const [resolvingAuthor, setResolvingAuthor] = useState3(false);
  const [publishing, setPublishing] = useState3(false);
  const [scheduling, setScheduling] = useState3(false);
  const [generatingImage, setGeneratingImage] = useState3(false);
  const [redditTitle, setRedditTitle] = useState3("");      // Reddit-specific title field

  // CSV import (Track A — PR 1.2)
  const [csvOpen,       setCsvOpen]       = useState3(false);
  const [csvFileName,   setCsvFileName]   = useState3("");
  const [csvHeader,     setCsvHeader]     = useState3([]);    // string[] of column names parsed from CSV
  const [csvRows,       setCsvRows]       = useState3([]);    // array of object rows keyed by header
  const [csvMapping,    setCsvMapping]    = useState3({ platform: "", content: "", scheduled_for: "", media_urls: "" });
  const [csvSubmitting, setCsvSubmitting] = useState3(false);
  const [csvResult,     setCsvResult]     = useState3(null);  // { total, valid, invalid, results, warnings, dryRun }

  const resetCsv = () => {
    setCsvFileName(""); setCsvHeader([]); setCsvRows([]);
    setCsvMapping({ platform: "", content: "", scheduled_for: "", media_urls: "" });
    setCsvResult(null);
  };

  // Hydrate scheduled_posts rows into the calendar on mount. The cron writes
  // status transitions to that table — clients reconcile here. Per-platform
  // postId/postUrl mapping mirrors PLATFORM_PUBLISHERS.resultFields but is
  // duplicated as a static map because this effect runs before the publisher
  // map is in scope (PLATFORM_PUBLISHERS lives inside the drawer closure).
  useEffect3(() => {
    const tenantId = state.auth?.id;
    if (!tenantId) return;
    let cancelled = false;

    const RESULT_BY_PLATFORM = {
      linkedin: (result, payload) => ({
        linkedinPostId:    result?.postId || null,
        linkedinUrl:       result?.postUrl || null,
        linkedinAuthorUrn: payload?.authorUrn || null,
      }),
      facebook: (result, payload) => ({
        facebookPostId: result?.postId || null,
        facebookUrl:    result?.postUrl || null,
        facebookPageId: payload?.pageId || null,
      }),
      x: (result) => ({
        xPostId: result?.postId || null,
        xUrl:    result?.postUrl || null,
      }),
      instagram: (result, payload) => ({
        instagramPostId:     result?.postId || null,
        instagramUrl:        result?.postUrl || null,
        instagramCreationId: result?.creationId || null,
        instagramAccountId:  payload?.igUserId || null,
      }),
      reddit: (result, payload) => ({
        redditPostId:    result?.postId || null,
        redditUrl:       result?.postUrl || null,
        redditSubreddit: payload?.subreddit || null,
      }),
    };

    (async () => {
      try {
        const res = await apiFetch("/api/scheduled-posts", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action: "list" }),
        }).then(r => r.json());
        if (cancelled || !res?.ok) return;
        for (const row of res.rows || []) {
          const map = RESULT_BY_PLATFORM[row.platform] || (() => ({}));
          if (row.status === "pending") {
            actions.updateItem(row.item_id, {
              status:          "scheduled",
              scheduledPostId: row.id,
              fireAtUtc:       row.fire_at,
            });
          } else if (row.status === "publishing") {
            actions.updateItem(row.item_id, {
              status:          "scheduled",
              scheduledPostId: row.id,
              fireAtUtc:       row.fire_at,
              publishStatus:   "publishing",
            });
          } else if (row.status === "failed") {
            actions.updateItem(row.item_id, {
              scheduledPostId: row.id,
              fireAtUtc:       row.fire_at,
              publishStatus:   "failed",
              publishError:    row.last_error || "Scheduled fire failed",
            });
          } else if (row.status === "published") {
            actions.updateItem(row.item_id, {
              status:          "sent",
              publishStatus:   "published",
              scheduledPostId: row.id,
              publishedAt:     row.published_at || null,
              ...map(row.result, row.payload),
            });
          }
        }
      } catch (e) {
        // Silent on hydrate failure — calendar still works from local state.
        console.warn("[PublishingQueue] scheduled-posts hydrate failed:", e.message);
      }
    })();

    return () => { cancelled = true; };
  }, [state.auth?.id]);

  const handleGenerateDrafts = async () => {
    setGenerating(true);
    try {
      const res = await apiFetch("/api/proactive-drafts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          brand:    state.brandPreset || null,
          days:     7,
          count:    7,
        }),
      });
      const data = await res.json();
      if (data.ok && data.drafts?.length) {
        // Filter out platforms where the AI rule is disabled in Autonomy Settings
        const aiBlocked = new Set(
          (state.channelRules || [])
            .filter(r => r.ai === "n/a")
            .map(r => r.name.toLowerCase())
        );
        const allowed = data.drafts.filter(d => !aiBlocked.has((d.platform || "").toLowerCase()));
        if (allowed.length > 0) {
          actions.loadProactiveDrafts(allowed);
          actions.notify("ok", `${allowed.length} proactive draft${allowed.length !== 1 ? "s" : ""} ready · ${data.source === "claude" ? "Claude" : "template"}`);
        } else {
          actions.notify("warn", "All generated platforms are blocked by Autonomy Settings — update AI rules");
        }
      } else {
        actions.notify("warn", data.error || "No drafts returned");
      }
    } catch (e) {
      actions.notify("warn", "Draft generation failed — check connection");
    }
    setGenerating(false);
  };

  // Sync editDraft when editItem changes
  useEffect3(() => {
    if (editItem) {
      setEditDraft({
        body:          editItem.body        || editItem.title || "",
        imagePrompt:   editItem.imagePrompt || "",
        scheduledAt:   editItem.scheduledAt || "",
        scheduledDate: editItem.scheduledDate || "",
        day:           editItem.day != null ? String(editItem.day) : "",
        campaign:      editItem.campaign    || "",
      });
    } else {
      setEditDraft(null);
    }
  }, [editItem?.id]);

  // ── Per-platform publishing dispatch ─────────────────────────────────────
  // Each entry describes what the drawer needs to do for that platform:
  //   needsAuthor      — show the "Post as" selector
  //   authorLabel      — what to call the picker (e.g. "Post as", "Subreddit")
  //   authorFreeText   — render a text input instead of a dropdown
  //   connectorId      — seed.connectors key holding meta.authors
  //   resolveAction    — action string to POST to /api/<platform> when meta empty
  //   apiPath          — endpoint to POST to
  //   needsImage       — image is required (IG)
  //   needsTitle       — Reddit-specific title field
  //   buildPayload     — produces the publish_now JSON body
  //   resultFields     — maps server response → calendar row patch
  //   logLabel         — for activity log
  const PLATFORM_PUBLISHERS = {
    linkedin: {
      needsAuthor:  true,
      authorLabel:  "Post as",
      authorHint:   "LinkedIn requires an author URN — defaults to your first managed page",
      connectorId:  "li",
      apiPath:      "/api/linkedin",
      resolveAction:"resolve_author",
      buildPayload: ({ tenantId, authorUrn, text, imageUrl, kind, title }) => {
        // For Articles: prepend the title as the opening line so LinkedIn readers
        // see the headline even though this posts as long-form text (Zernio does
        // not yet expose the LinkedIn Articles API separately).
        const isArticle = /article/i.test(kind || "");
        const body = isArticle && title ? `${title}\n\n${text}` : text;
        return { action: "publish_now", tenantId, authorUrn, text: body, imageUrl };
      },
      resultFields: (res, authorUrn) => ({
        linkedinPostId:    res.postId || null,
        linkedinUrl:       res.postUrl || null,
        linkedinAuthorUrn: authorUrn,
      }),
      logLabel: "LinkedIn",
    },
    facebook: {
      needsAuthor:  true,
      authorLabel:  "Post as",
      authorHint:   "Choose the Page to post to",
      connectorId:  "fb",
      apiPath:      "/api/facebook",
      resolveAction:"resolve_pages",
      buildPayload: ({ tenantId, authorUrn, text, imageUrl }) => ({
        action: "publish_now", tenantId, pageId: authorUrn, text, imageUrl,
      }),
      resultFields: (res, authorUrn) => ({
        facebookPostId:  res.postId || null,
        facebookUrl:     res.postUrl || null,
        facebookPageId:  authorUrn,
      }),
      logLabel: "Facebook",
    },
    x: {
      needsAuthor:  false,
      apiPath:      "/api/x",
      // X supports: text-only, single image, up to 4 images (mediaUrls), or 1 video.
      buildPayload: ({ tenantId, text, imageUrl, videoUrl, mediaUrls, kind }) => {
        const k = (kind || "").toLowerCase();
        const isVideo = /video|gif/.test(k);
        // X allows up to 4 images in one post via mediaUrls[]
        const hasMulti = Array.isArray(mediaUrls) && mediaUrls.length > 1;
        return {
          action: "publish_now",
          tenantId,
          text,
          ...(isVideo    && videoUrl       ? { videoUrl }  :
              hasMulti                     ? { mediaUrls } :
              imageUrl                     ? { imageUrl }  : {}),
        };
      },
      resultFields: (res) => ({
        xPostId: res.postId || null,
        xUrl:    res.postUrl || null,
      }),
      logLabel: "X",
    },
    instagram: {
      needsAuthor:  true,
      authorLabel:  "Post as",
      authorHint:   "Requires a Business or Creator IG account linked to a managed FB Page",
      connectorId:  "ig",
      apiPath:      "/api/instagram",
      resolveAction:"resolve_accounts",
      // Reels and Shorts use video; carousels use multiple images; posts use a single image.
      // needsImage is true only for non-video, non-carousel kinds.
      needsImage: (kind) => {
        const k = (kind || "").toLowerCase();
        return !/reel|short|video/.test(k);
      },
      buildPayload: ({ tenantId, authorUrn, text, imageUrl, videoUrl, mediaUrls, kind }) => {
        const k = (kind || "").toLowerCase();
        const isReel      = /reel|short|video/.test(k);
        const isCarousel  = /carousel/.test(k);
        return {
          action:    "publish_now",
          tenantId,
          igUserId:  authorUrn,
          caption:   text,
          ...(isCarousel && mediaUrls?.length ? { mediaUrls } :
              isReel     && videoUrl          ? { videoUrl }  :
              imageUrl                        ? { imageUrl }  : {}),
        };
      },
      resultFields: (res, authorUrn) => ({
        instagramPostId:       res.postId || null,
        instagramUrl:          res.postUrl || null,
        instagramCreationId:   res.creationId || null,
        instagramAccountId:    authorUrn,
      }),
      logLabel: "Instagram",
    },
    reddit: {
      needsAuthor:    true,
      authorLabel:    "Subreddit",
      authorHint:     "Subreddit name without r/ — e.g. \"ayurveda\"",
      authorFreeText: true,
      connectorId:    "reddit",
      apiPath:        "/api/reddit",
      needsTitle:     true,
      buildPayload:   ({ tenantId, authorUrn, text, imageUrl, title }) => ({
        action: "publish_now", tenantId, subreddit: authorUrn, title, text, imageUrl,
      }),
      resultFields: (res, authorUrn) => ({
        redditPostId:    res.postId || null,
        redditUrl:       res.postUrl || null,
        redditSubreddit: authorUrn,
      }),
      logLabel: "Reddit",
    },
  };

  // ── Resolve author list when a publishable platform's draft is opened ────
  useEffect3(() => {
    if (!editItem) { setAuthor(""); setRedditTitle(""); return; }
    const pkey = (editItem.platform || editItem.channel || "").toLowerCase();
    const pub  = PLATFORM_PUBLISHERS[pkey];

    // Seed Reddit title from any prior value on the row
    setRedditTitle(editItem.redditTitle || "");

    if (!pub || !pub.needsAuthor) { setAuthor(""); return; }

    // Free-text author (Reddit) — just seed from prior value if any
    if (pub.authorFreeText) {
      setAuthor(editItem.redditSubreddit || "");
      return;
    }

    const meta    = state.connectors?.[pub.connectorId]?.meta || { authors: [] };
    const authors = meta.authors || [];
    const pickDefault = (list) => {
      // Prefer organization/page over person, otherwise first
      const org = list.find(a => a.kind === "organization" || a.kind === "page" || a.kind === "ig_business");
      return (org || list[0])?.urn || "";
    };

    if (authors.length > 0) {
      setAuthor(pickDefault(authors));
      return;
    }

    if (!pub.resolveAction) return; // platform has no resolve flow

    setResolvingAuthor(true);
    apiFetch(pub.apiPath, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: pub.resolveAction }),
    })
      .then(r => r.json())
      .then(res => {
        if (res?.ok) {
          const list = res.authors || [];
          actions.setConnector(pub.connectorId, { meta: { authors: list } });
          setAuthor(pickDefault(list));
          if (list.length === 0 && pkey === "instagram") {
            actions.notify("warn", "Instagram posting requires a Business or Creator account linked to a managed Facebook Page");
          }
        } else {
          actions.notify("warn", `${pub.logLabel} author lookup failed: ${res?.error || "unknown"}`);
        }
      })
      .catch(e => actions.notify("warn", `${pub.logLabel} author lookup failed: ${e.message}`))
      .finally(() => setResolvingAuthor(false));
  }, [editItem?.id]);

  const DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const SLOTS = [
    { id: "morning",   label: "Morning",   hours: [6,  12] },
    { id: "afternoon", label: "Afternoon", hours: [12, 18] },
    { id: "evening",   label: "Evening",   hours: [18, 24] },
  ];

  // Character limits per platform
  const CHAR_LIMIT = {
    instagram: 2200, tiktok: 2200, linkedin: 3000, facebook: 63206,
    x: 280, twitter: 280, pinterest: 500, youtube: 5000,
    threads: 500, bluesky: 300, reddit: 40000,
    sms: 160, snapchat: 250,
  };

  const CH_COLOR = {
    Instagram: "oklch(62% 0.18 340)", TikTok:      "oklch(45% 0.08 260)",
    Email:     "oklch(56% 0.14 250)", SMS:          "oklch(55% 0.16 150)",
    "Google Ads": "oklch(60% 0.18 30)", "Meta Ads": "oklch(48% 0.18 260)",
    Pinterest: "oklch(52% 0.20 28)",  YouTube:      "oklch(55% 0.22 25)",
    X:         "var(--ink)",          LinkedIn:     "oklch(48% 0.14 235)",
    Facebook:  "oklch(50% 0.18 265)", Reddit:       "oklch(58% 0.22 30)",
    Snapchat:  "oklch(88% 0.18 100)", Threads:      "var(--ink)",
    Bluesky:   "oklch(56% 0.18 240)",
    // platform slugs (fromChat drafts)
    instagram: "oklch(62% 0.18 340)", tiktok: "oklch(45% 0.08 260)",
    linkedin:  "oklch(48% 0.14 235)", facebook: "oklch(50% 0.18 265)",
    x:         "var(--ink)",          pinterest: "oklch(52% 0.20 28)",
    youtube:   "oklch(55% 0.22 25)",  email: "oklch(56% 0.14 250)",
    sms:       "oklch(55% 0.16 150)", reddit: "oklch(58% 0.22 30)",
    snapchat:  "oklch(88% 0.18 100)", threads: "var(--ink)",
    bluesky:   "oklch(56% 0.18 240)",
  };
  const CH_ABBR = {
    Instagram: "IG", TikTok: "TT", Email: "Em", SMS: "SMS",
    "Google Ads": "Goo", "Meta Ads": "FB", Pinterest: "Pin", YouTube: "YT",
    X: "X", LinkedIn: "LI", Facebook: "FB", Reddit: "Rd",
    Snapchat: "Sn", Threads: "Th", Bluesky: "Bk",
    instagram: "IG", tiktok: "TT", email: "Em", sms: "SMS",
    x: "X", linkedin: "LI", facebook: "FB", pinterest: "Pin",
    youtube: "YT", reddit: "Rd", snapchat: "Sn", threads: "Th", bluesky: "Bk",
  };

  // Split calendar into scheduled + unscheduled drafts
  const scheduled = state.calendar.filter(c =>
    ["approved", "scheduled", "review", "policy", "paused"].includes(c.status)
  );
  const drafts = state.calendar.filter(c => c.status === "draft");
  // legacy alias so calendar grid still works
  const queue = scheduled;

  // Recently published — last 7 days, newest first
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sentPosts = state.calendar
    .filter(c => c.status === "sent")
    .filter(c => !c.publishedAt || new Date(c.publishedAt).getTime() >= sevenDaysAgo)
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  const slotOf = (item) => {
    const h = parseInt((item.scheduledAt || "09:00").split(":")[0], 10);
    if (h < 12) return "morning";
    if (h < 18) return "afternoon";
    return "evening";
  };

  const grid = useMemo3(() => {
    const g = {};
    DAYS.forEach((_, i) => { g[i] = { morning: [], afternoon: [], evening: [] }; });
    queue.forEach(item => {
      const d = item.day ?? 0;
      if (g[d]) g[d][slotOf(item)].push(item);
    });
    return g;
  }, [queue.length]);

  const todayItems = queue
    .filter(item => (item.day ?? 0) === 0)
    .sort((a, b) => (a.scheduledAt || "").localeCompare(b.scheduledAt || ""));

  const togglePause = (item) => {
    const next = item.status === "paused" ? "scheduled" : "paused";
    actions.updateItem(item.id, { status: next }, {
      logEvent: `${next === "paused" ? "paused" : "resumed"} · '${item.title}'`,
      notify: { tone: "neutral", text: `'${item.title}' ${next === "paused" ? "paused" : "resumed"}` },
    });
  };

  const dotOf = (status) =>
    status === "approved" || status === "scheduled" ? "ok"
    : status === "review" || status === "policy"    ? "warn"
    : "neutral";

  return (
    <div className="anim-fade" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--rule)", background: "var(--paper)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>05 · Ship</div>
            <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.025em", margin: "4px 0 0" }}>Publishing Queue</h1>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[
              { id: "calendar", label: "Calendar" },
              { id: "list",     label: "Queue" },
              { id: "sent",     label: `Published${sentPosts.length ? " · " + sentPosts.length : ""}` },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setView(id)} style={{
                padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                border: "1px solid " + (id === view ? "var(--rule-strong)" : "var(--rule)"),
                background: id === view ? "var(--paper-3)" : "var(--paper)",
                color: id === view ? "var(--ink)" : "var(--muted)",
                cursor: "pointer", fontFamily: "var(--font-sans)",
              }}>{label}</button>
            ))}
            <Btn size="sm" variant="primary" data-testid="generate-drafts-btn" onClick={handleGenerateDrafts} disabled={generating}
              style={{ minWidth: 130 }}>
              {generating
                ? <><span className="dot-pulse" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "currentColor", marginRight: 6 }}/> Generating…</>
                : <><Icon name="edit" size={11}/> Generate drafts</>
              }
            </Btn>
            <Btn size="sm" onClick={() => { resetCsv(); setCsvOpen(true); }}>
              <Icon name="upload" size={11}/> Import CSV
            </Btn>
            <Btn size="sm" onClick={() => {
              queue.forEach(q => { if (q.status !== "paused") actions.updateItem(q.id, { status: "paused" }); });
              actions.notify("warn", `Paused ${queue.length} items`);
            }}><Icon name="pause" size={11}/> Pause all</Btn>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>

        {/* ── Drafts strip (unscheduled, from chat or proactive) ── */}
        {drafts.length > 0 && (
          <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--rule)", background: "oklch(97% 0.006 240 / 0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Drafts · {drafts.length}
              </div>
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>— not yet scheduled</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {drafts.map(item => {
                const platformKey = item.platform || item.channel || "";
                const color = CH_COLOR[platformKey] || "var(--accent)";
                const abbr  = CH_ABBR[platformKey]  || platformKey.slice(0, 2).toUpperCase();
                const hasImage    = item.imageStatus === "completed" && item.imageUrl;
                const imgPending  = item.imageStatus === "pending";
                const imgFailed   = item.imageStatus === "failed" || item.imageStatus === "failed_content_policy";
                return (
                  <div key={item.id} data-testid="draft-item" onClick={() => setEditItem(item)} className="cell-btn"
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                      border: "1px dashed var(--rule-strong)", borderRadius: 6,
                      background: "var(--paper)", cursor: "pointer", maxWidth: 260,
                    }}>
                    {hasImage ? (
                      <img src={item.imageUrl} alt=""
                        style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0, border: `1px solid ${color}` }}/>
                    ) : imgPending ? (
                      <div title="Generating image…" style={{
                        width: 36, height: 36, borderRadius: 4, flexShrink: 0,
                        background: "var(--paper-3)", border: "1px dashed var(--rule-strong)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, color: "var(--muted)", letterSpacing: "0.04em",
                      }}>···</div>
                    ) : imgFailed ? (
                      <div title="Image generation failed" style={{
                        width: 36, height: 36, borderRadius: 4, flexShrink: 0,
                        background: "var(--paper-2)", border: "1px solid var(--rule)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, color: "oklch(48% 0.16 25)",
                      }}>!</div>
                    ) : (
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }}/>
                    )}
                    <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {(item.body || item.title || "").slice(0, 50)}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>
                        {abbr} · {item.kind || item.contentType || "Post"} · draft
                      </div>
                      {item.noPublishPath && (
                        <div style={{
                          fontSize: 10, padding: "3px 6px", borderRadius: 3,
                          background: "oklch(96% 0.04 340)", border: "1px solid oklch(82% 0.12 340)",
                          color: "oklch(35% 0.14 340)", fontWeight: 500,
                        }}>
                          No publisher — export or post manually
                        </div>
                      )}
                    </div>
                    <Icon name="edit" size={11} style={{ color: "var(--muted)", flexShrink: 0 }}/>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Today strip ── */}
        {todayItems.length > 0 && (
          <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--rule)", background: "var(--paper)" }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              Today · {DAYS[0]}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {todayItems.map(item => {
                const color    = CH_COLOR[item.channel] || "var(--accent)";
                const isPaused = item.status === "paused";
                return (
                  <div key={item.id} onClick={() => setEditItem(item)} className="cell-btn"
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                      border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper-2)",
                      cursor: "pointer", opacity: isPaused ? 0.55 : 1, maxWidth: 240,
                    }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }}/>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>{item.scheduledAt} · {CH_ABBR[item.channel] || item.channel}</div>
                    </div>
                    <Dot status={dotOf(item.status)}/>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "sent" ? (
          /* ── Recently Published ── */
          <div style={{ padding: "16px 24px" }}>
            {sentPosts.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                No posts published in the last 7 days.
              </div>
            ) : (
              <div style={{ border: "1px solid var(--rule)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "140px 80px 1fr 120px",
                  padding: "8px 12px", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)",
                  fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                }}>
                  <span>Published</span><span>Platform</span><span>Content</span><span/>
                </div>
                {sentPosts.map(item => {
                  const pkey  = (item.platform || item.channel || "").toLowerCase();
                  const color = CH_COLOR[pkey] || "var(--accent)";
                  const abbr  = CH_ABBR[pkey] || pkey.slice(0, 2).toUpperCase();
                  const postUrl = item.linkedinUrl || item.facebookUrl || item.xUrl || item.instagramUrl || item.redditUrl || null;
                  const publishedLabel = item.publishedAt
                    ? new Date(item.publishedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—";
                  return (
                    <div key={item.id} className="row-hover" style={{
                      display: "grid", gridTemplateColumns: "140px 80px 1fr 120px",
                      padding: "10px 12px", borderBottom: "1px solid var(--rule)",
                      alignItems: "center", fontSize: 12,
                    }}>
                      <span className="mono" style={{ color: "var(--muted)", fontSize: 10 }}>
                        {publishedLabel}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }}/>
                        {abbr}
                      </span>
                      <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>
                        {item.body || item.title || ""}
                      </span>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, alignItems: "center" }}>
                        {postUrl && (
                          <a href={postUrl} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
                            View ↗
                          </a>
                        )}
                        <Btn size="sm" variant="ghost" onClick={() => setEditItem(item)} title="Edit">
                          <Icon name="edit" size={11}/>
                        </Btn>
                        {getZernioPostId(item) && (
                          <Btn size="sm" variant="ghost" title="Unpublish"
                            onClick={async () => {
                              if (!window.confirm("Delete this post from the platform?")) return;
                              await actions.unpublishPost(item.id, {
                                postId:   getZernioPostId(item),
                                platform: (item.platform || item.channel || "").toLowerCase(),
                              });
                            }}>
                            <Icon name="x" size={11}/>
                          </Btn>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : view === "calendar" ? (
          /* ── Weekly calendar grid ── */
          <div style={{ padding: "16px 24px" }}>
            {/* Day header row */}
            <div style={{ display: "grid", gridTemplateColumns: "72px repeat(7, 1fr)", gap: 5, marginBottom: 5 }}>
              <div/>
              {DAYS.map((d, i) => (
                <div key={d} style={{
                  textAlign: "center", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
                  color: i === 0 ? "var(--accent)" : "var(--muted)", padding: "4px 0",
                }}>{d}</div>
              ))}
            </div>

            {/* Slot rows */}
            {SLOTS.map(slot => (
              <div key={slot.id} style={{ display: "grid", gridTemplateColumns: "72px repeat(7, 1fr)", gap: 5, marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 8, paddingTop: 7 }}>
                  <span className="mono" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {slot.label}
                  </span>
                </div>
                {DAYS.map((_, dayIdx) => {
                  const items = grid[dayIdx]?.[slot.id] || [];
                  return (
                    <div key={dayIdx} style={{
                      minHeight: 52, background: "var(--paper)", border: "1px solid var(--rule)",
                      borderRadius: 5, padding: 4, display: "flex", flexDirection: "column", gap: 3,
                    }}>
                      {items.map(item => {
                        const color    = CH_COLOR[item.channel] || "var(--accent)";
                        const abbr     = CH_ABBR[item.channel] || item.channel.slice(0, 2);
                        const isPaused = item.status === "paused";
                        return (
                          <div key={item.id} onClick={() => setEditItem(item)} className="cell-btn"
                            style={{
                              display: "flex", alignItems: "center", gap: 4, padding: "3px 5px",
                              borderRadius: 3, background: "var(--paper-2)", cursor: "pointer",
                              borderLeft: `2px solid ${color}`, opacity: isPaused ? 0.5 : 1,
                            }}>
                            <span className="mono" style={{ fontSize: 9, color: "var(--muted)", flexShrink: 0 }}>{abbr}</span>
                            <span style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.title}</span>
                            <Dot status={dotOf(item.status)}/>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          /* ── List view ── */
          <div style={{ padding: "16px 24px" }}>
            <div style={{ border: "1px solid var(--rule)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "90px 90px 1fr 90px 90px 64px",
                padding: "8px 12px", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)",
                fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)",
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                <span>Day / Time</span><span>Channel</span><span>Item</span>
                <span>Campaign</span><span>Status</span><span/>
              </div>
              {queue.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Queue empty.</div>
              )}
              {[...queue]
                .sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || (a.scheduledAt || "").localeCompare(b.scheduledAt || ""))
                .map(item => {
                  const isPaused = item.status === "paused";
                  const chip     = statusChip(isPaused ? "draft" : item.status);
                  const color    = CH_COLOR[item.channel] || "var(--accent)";
                  return (
                    <div key={item.id} className="row-hover" style={{
                      display: "grid", gridTemplateColumns: "90px 90px 1fr 90px 90px 64px",
                      padding: "10px 12px", borderBottom: "1px solid var(--rule)",
                      alignItems: "center", fontSize: 12, opacity: isPaused ? 0.55 : 1,
                    }}>
                      <span className="mono" style={{ color: "var(--muted)", fontSize: 10 }}>
                        {DAYS[item.day ?? 0]} {item.scheduledAt}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }}/>
                        {CH_ABBR[item.channel] || item.channel}
                      </span>
                      <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>{item.campaign}</span>
                      <span><Chip tone={chip.tone}>{isPaused ? "paused" : chip.label}</Chip></span>
                      <div style={{ display: "flex", gap: 3, justifyContent: "flex-end" }}>
                        <Btn size="sm" variant="ghost" onClick={() => togglePause(item)}>
                          <Icon name={isPaused ? "play" : "pause"} size={11}/>
                        </Btn>
                        <Btn size="sm" variant="ghost" onClick={() => setEditItem(item)}>
                          <Icon name="edit" size={11}/>
                        </Btn>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* ── Edit drawer ── */}
      {editItem && editDraft && (() => {
        const isDraft     = editItem.status === "draft";
        const platformKey = (editItem.platform || editItem.channel || "").toLowerCase();
        const charLimit   = CHAR_LIMIT[platformKey] || null;
        const charCount   = (editDraft.body || "").length;
        const overLimit   = charLimit && charCount > charLimit;
        const platformLabel = editItem.platform
          ? editItem.platform.charAt(0).toUpperCase() + editItem.platform.slice(1)
          : editItem.channel;
        const kindLabel = editItem.kind || editItem.contentType || "Post";

        const handleSave = () => {
          actions.updateItem(editItem.id, {
            body:          editDraft.body,
            title:         editDraft.body.slice(0, 80),
            imagePrompt:   editDraft.imagePrompt || null,
            scheduledAt:   editDraft.scheduledAt || null,
            scheduledDate: editDraft.scheduledDate || null,
            day:           editDraft.day !== "" ? Number(editDraft.day) : null,
            campaign:      editDraft.campaign || null,
          }, {
            logEvent: `edited · '${editDraft.body.slice(0, 40)}'`,
            notify:   { tone: "ok", text: "Draft saved" },
          });
          setEditItem(null);
        };

        const pub = PLATFORM_PUBLISHERS[platformKey];
        const hasImage = editItem.imageStatus === "completed" && !!editItem.imageUrl;
        const needsImageGuard = !!(pub?.needsImage && !hasImage);

        const generateImageFromDrawer = () => {
          const prompt = editDraft.imagePrompt?.trim();
          if (!prompt) { actions.notify("warn", "Add an image prompt first"); return; }
          const aspectRatio =
            /story|reel/i.test(editItem.kind || "") ? "9:16" :
            /carousel|pin/i.test(editItem.kind || "") ? "4:5" : "1:1";
          setGeneratingImage(true);
          actions.updateItem(editItem.id, { imageStatus: "pending" });
          setEditItem(prev => ({ ...prev, imageStatus: "pending", imageUrl: null }));
          apiFetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "generate_image", provider: "runware", model: "runware:101@1",
              aspectRatio, resolution: "1k",
              promptIntent: { kind: "feed_hero", extra: { scene: prompt } },
            }),
          })
            .then(r => r.json())
            .then(res => {
              if (res?.ok && res.rawUrl) {
                actions.updateItem(editItem.id, { imageUrl: res.rawUrl, imageStatus: "completed" });
                setEditItem(prev => ({ ...prev, imageUrl: res.rawUrl, imageStatus: "completed" }));
              } else {
                const st = res?.status === "failed_content_policy" ? "failed_content_policy" : "failed";
                actions.updateItem(editItem.id, { imageStatus: st });
                setEditItem(prev => ({ ...prev, imageStatus: st }));
                actions.notify("warn", `Image generation failed: ${res?.error || "unknown"}`);
              }
            })
            .catch(e => {
              actions.updateItem(editItem.id, { imageStatus: "failed" });
              setEditItem(prev => ({ ...prev, imageStatus: "failed" }));
              actions.notify("warn", `Image generation failed: ${e.message}`);
            })
            .finally(() => setGeneratingImage(false));
        };

        // Compose an ISO-UTC fire timestamp from the drawer's local date+time
        // inputs. Returns null if either field is empty or unparseable.
        const composeFireAt = () => {
          const date = editDraft.scheduledDate;
          const time = editDraft.scheduledAt;
          if (!date || !time) return null;
          // new Date("2026-05-20T14:30") parses as local time → toISOString() UTC.
          const d = new Date(`${date}T${time}`);
          if (Number.isNaN(d.getTime())) return null;
          return d.toISOString();
        };

        const handleSchedule = async () => {
          const fireAtIso = composeFireAt();
          if (!fireAtIso) {
            actions.notify("warn", "Pick a date and time first");
            return;
          }
          if (Date.parse(fireAtIso) <= Date.now()) {
            actions.notify("warn", "Scheduled time must be in the future");
            return;
          }
          // Derive day-of-week (Mon=0…Sun=6) for the calendar grid.
          const jsDay = new Date(fireAtIso).getDay(); // Sun=0…Sat=6
          const calendarDay = (jsDay + 6) % 7;        // Mon=0…Sun=6

          // Platforms without a Composio publisher (email/sms/tiktok/etc.)
          // can't actually fire — keep the legacy local-only flip so the UI
          // still reflects the user's intent on the calendar grid.
          if (!pub) {
            actions.updateItem(editItem.id, {
              body:          editDraft.body,
              title:         editDraft.body.slice(0, 80),
              imagePrompt:   editDraft.imagePrompt || null,
              scheduledAt:   editDraft.scheduledAt,
              scheduledDate: editDraft.scheduledDate,
              day:           calendarDay,
              status:        "scheduled",
              campaign:      editDraft.campaign || null,
            }, {
              logEvent: `scheduled · '${editDraft.body.slice(0, 40)}'`,
              notify:   { tone: "ok", text: `Scheduled · ${platformLabel}` },
            });
            setEditItem(null);
            return;
          }

          // Publishable platform — validate the same preconditions handleSendNow
          // checks. If we let a row through without an author, the cron will
          // just fail at fire_at; better to surface the error now.
          if (pub.needsAuthor && !author) {
            actions.notify("warn", `${pub.logLabel} author not selected — pick one or wait for resolve to finish`);
            return;
          }
          if (overLimit) {
            actions.notify("warn", `${pub.logLabel} limit ${charLimit} chars exceeded (${charCount})`);
            return;
          }
          if (pub.needsTitle && !redditTitle.trim()) {
            actions.notify("warn", "Reddit posts require a title");
            return;
          }
          const schedKind  = editItem.kind || "";
          const hasImage   = editItem.imageStatus === "completed" && editItem.imageUrl;
          const hasVideo   = !!editItem.videoUrl;
          const schedNeedsImage = typeof pub.needsImage === "function"
            ? pub.needsImage(schedKind)
            : pub.needsImage;
          if (schedNeedsImage && !hasImage) {
            actions.notify("warn", "Instagram requires an image — generate one or pick another platform");
            return;
          }

          // Snapshot the publish_now payload at schedule time. Later edits to
          // the calendar row don't change what the cron posts — that's a
          // deliberate "schedule = commit" contract.
          const payload = pub.buildPayload({
            tenantId:  state.auth?.id,
            authorUrn: author,
            text:      editDraft.body,
            imageUrl:  hasImage ? editItem.imageUrl : null,
            videoUrl:  hasVideo ? editItem.videoUrl : null,
            mediaUrls: editItem.mediaUrls || null,
            kind:      schedKind,
            title:     pub.needsTitle ? redditTitle.trim() : undefined,
          });
          // tenantId travels on the scheduled_posts row itself, not inside
          // payload — strip it so the snapshot stays pure platform-body shape.
          delete payload.tenantId;
          // action is re-attached by the cron when it fires.
          delete payload.action;

          setScheduling(true);
          try {
            const res = await apiFetch("/api/scheduled-posts", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({
                action:   "create",
                itemId:   editItem.id,
                platform: platformKey,
                fireAt:   fireAtIso,
                payload,
              }),
            }).then(r => r.json());

            if (!res?.ok) {
              actions.notify("warn", `Schedule failed: ${res?.error || "unknown"}`);
              return;
            }

            actions.updateItem(editItem.id, {
              body:             editDraft.body,
              title:            editDraft.body.slice(0, 80),
              imagePrompt:      editDraft.imagePrompt || null,
              scheduledAt:      editDraft.scheduledAt,
              scheduledDate:    editDraft.scheduledDate,
              day:              calendarDay,
              status:           "scheduled",
              campaign:         editDraft.campaign || null,
              scheduledPostId:  res.id,
              fireAtUtc:        res.fireAt,
              publishStatus:    null,
              publishError:     null,
              ...(pub.needsTitle ? { redditTitle: redditTitle.trim() } : {}),
            }, {
              logEvent: `scheduled to ${pub.logLabel} · '${editDraft.body.slice(0, 40)}' · ${new Date(fireAtIso).toLocaleString()}`,
              notify:   { tone: "ok", text: `Scheduled · ${pub.logLabel} · fires ${new Date(fireAtIso).toLocaleString()}` },
            });
            setEditItem(null);
          } catch (e) {
            actions.notify("warn", `Schedule failed: ${e.message}`);
          } finally {
            setScheduling(false);
          }
        };

        const handleUnschedule = async () => {
          if (!editItem.scheduledPostId) return;
          setScheduling(true);
          try {
            const res = await apiFetch("/api/scheduled-posts", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ action: "cancel", id: editItem.scheduledPostId }),
            }).then(r => r.json());
            if (!res?.ok && res?.cancelled === 0) {
              actions.notify("warn", "Could not unschedule — post may already be firing");
              return;
            }
            actions.updateItem(editItem.id, {
              status:          "draft",
              scheduledPostId: null,
              fireAtUtc:       null,
            }, {
              logEvent: `unscheduled · ${platformLabel}`,
              notify:   { tone: "ok", text: "Unscheduled — post returned to drafts" },
            });
            setEditItem(null);
          } catch (e) {
            actions.notify("warn", `Unschedule failed: ${e.message}`);
          } finally {
            setScheduling(false);
          }
        };

        const isQueued = !!(editItem.scheduledPostId && editItem.status === "scheduled");

        const PLATFORM_TO_RULE = {
          instagram: "Instagram", linkedin: "LinkedIn", tiktok: "TikTok",
          facebook: "Facebook",   youtube: "YouTube",   email: "Email",
          x: "X", twitter: "X",  pinterest: "Pinterest", reddit: "Reddit",
        };
        const handleSendNow = async () => {
          // Enforce channel publish rule from Autonomy Settings
          const ruleName = PLATFORM_TO_RULE[platformKey] || editItem.channel;
          const rule     = (state.channelRules || []).find(r => r.name === ruleName);
          if (rule && rule.publish === "human") {
            actions.notify("warn", `${ruleName || platformLabel} requires manual approval — update in Autonomy Settings`);
            return;
          }

          if (pub) {
            if (pub.needsAuthor && !author) {
              actions.notify("warn", `${pub.logLabel} author not selected — pick one or wait for resolve to finish`);
              return;
            }
            if (overLimit) {
              actions.notify("warn", `${pub.logLabel} limit ${charLimit} chars exceeded (${charCount})`);
              return;
            }
            if (pub.needsTitle && !redditTitle.trim()) {
              actions.notify("warn", "Reddit posts require a title");
              return;
            }
            const itemKind  = editItem.kind || "";
            const hasImage  = editItem.imageStatus === "completed" && editItem.imageUrl;
            const hasVideo  = !!editItem.videoUrl;
            const needsImageCheck = typeof pub.needsImage === "function"
              ? pub.needsImage(itemKind)
              : pub.needsImage;
            if (needsImageCheck && !hasImage) {
              actions.notify("warn", "Instagram requires an image — generate one or pick another platform");
              return;
            }

            setPublishing(true);
            actions.updateItem(editItem.id, { publishStatus: "publishing", publishError: null });
            try {
              const payload = pub.buildPayload({
                tenantId:   state.auth?.id,
                authorUrn:  author,
                text:       editDraft.body,
                imageUrl:   hasImage ? editItem.imageUrl : null,
                videoUrl:   hasVideo ? editItem.videoUrl : null,
                mediaUrls:  editItem.mediaUrls || null,
                kind:       itemKind,
                title:      pub.needsTitle ? redditTitle.trim() : (editItem.title || undefined),
              });
              const res = await apiFetch(pub.apiPath, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(payload),
              }).then(r => r.json());

              if (res?.ok) {
                actions.updateItem(editItem.id, {
                  body:           editDraft.body,
                  title:          editDraft.body.slice(0, 80),
                  status:         "sent",
                  publishStatus:  "published",
                  publishedAt:    new Date().toISOString(),
                  ...(pub.needsTitle ? { redditTitle: redditTitle.trim() } : {}),
                  ...pub.resultFields(res, author),
                }, {
                  logEvent: `published to ${pub.logLabel} · '${editDraft.body.slice(0, 40)}'`,
                  notify:   {
                    tone: "ok",
                    text: `Published to ${pub.logLabel}${res.postUrl ? " · " + res.postUrl : ""}`,
                  },
                });
                setEditItem(null);
              } else {
                const err = res?.error || "publish failed";
                actions.updateItem(editItem.id, { publishStatus: "failed", publishError: err },
                  { notify: { tone: "warn", text: `${pub.logLabel} publish failed: ${err}` } });
              }
            } catch (e) {
              actions.updateItem(editItem.id, { publishStatus: "failed", publishError: e.message },
                { notify: { tone: "warn", text: `${pub.logLabel} publish failed: ${e.message}` } });
            } finally {
              setPublishing(false);
            }
            return;
          }

          // Platforms without a Composio publisher — local-only "sent" flip
          actions.updateItem(editItem.id, {
            body:        editDraft.body,
            title:       editDraft.body.slice(0, 80),
            status:      "sent",
            publishedAt: new Date().toISOString(),
          }, {
            logEvent: `sent · '${editDraft.body.slice(0, 40)}'`,
            notify:   { tone: "ok", text: `Sent · ${platformLabel}` },
          });
          setEditItem(null);
        };

        const zernioPostId = getZernioPostId(editItem);
        const isPublished  = editItem.publishStatus === "published";
        const isFailed     = editItem.publishStatus === "failed";

        const handleEditOnPlatform = async () => {
          if (!zernioPostId) {
            actions.notify("warn", "No platform post id on this row — can't edit");
            return;
          }
          const res = await actions.editPost(editItem.id, {
            postId:   zernioPostId,
            platform: platformKey,
            content:  editDraft.body,
          });
          if (res?.ok) setEditItem(null);
        };

        const handleUnpublishOnPlatform = async () => {
          if (!zernioPostId) {
            actions.notify("warn", "No platform post id on this row — can't unpublish");
            return;
          }
          if (!window.confirm(`Delete this post from ${platformLabel}?`)) return;
          const res = await actions.unpublishPost(editItem.id, {
            postId: zernioPostId, platform: platformKey,
          });
          if (res?.ok) setEditItem(null);
        };

        const handleRetryOnPlatform = async () => {
          if (!zernioPostId) {
            actions.notify("warn", "No platform post id on this row — can't retry");
            return;
          }
          const res = await actions.retryPost(editItem.id, { postId: zernioPostId });
          if (res?.ok) setEditItem(null);
        };

        return (
          <Drawer open={true} onClose={() => setEditItem(null)}
            title={`${platformLabel} · ${kindLabel}`}
            actions={<>
              {!isDraft && !isQueued && !isPublished && !isFailed && (
                <Btn variant="ghost" onClick={() => { togglePause(editItem); setEditItem(null); }}>
                  <Icon name={editItem.status === "paused" ? "play" : "pause"} size={12}/>
                  {editItem.status === "paused" ? " Resume" : " Pause"}
                </Btn>
              )}
              {isQueued && (
                <Btn variant="ghost" onClick={handleUnschedule} disabled={scheduling}>
                  <Icon name="x" size={12}/> {scheduling ? "Cancelling…" : "Unschedule"}
                </Btn>
              )}
              {isPublished && zernioPostId && (
                <Btn variant="ghost" onClick={handleUnpublishOnPlatform}>
                  <Icon name="x" size={12}/> Unpublish
                </Btn>
              )}
              {isFailed && zernioPostId && (
                <Btn variant="ghost" onClick={handleRetryOnPlatform}>
                  <Icon name="play" size={12}/> Retry
                </Btn>
              )}
              {isPublished && zernioPostId && (
                <Btn variant="primary" onClick={handleEditOnPlatform}
                  disabled={overLimit || !editDraft.body?.trim()}>
                  <Icon name="edit" size={12}/> Update post
                </Btn>
              )}
              <Btn variant="danger" onClick={() => { actions.removeItem(editItem.id); setEditItem(null); }}>
                <Icon name="x" size={12}/> Remove
              </Btn>
              {/* Schedule (drafts). For publishable platforms this writes a
                  row to scheduled_posts; cron fires it at fire_at. */}
              {isDraft && (
                <Btn variant="ghost" onClick={handleSchedule}
                  disabled={!editDraft.scheduledAt || !editDraft.scheduledDate || publishing || scheduling || needsImageGuard}>
                  <Icon name="calendar" size={12}/> {scheduling ? "Scheduling…" : "Schedule"}
                </Btn>
              )}
              {/* Publish now — any platform with a publisher, or any non-draft */}
              {(pub || !isDraft) && (() => {
                const disabled = publishing
                  || (pub && (resolvingAuthor
                      || (pub.needsAuthor && !author)
                      || overLimit
                      || (pub.needsTitle && !redditTitle.trim())
                      || needsImageGuard));
                return (
                  <Btn variant="primary" onClick={handleSendNow} disabled={disabled}>
                    <Icon name="send" size={12}/> {publishing ? "Publishing…" : (pub ? "Publish now" : "Send now")}
                  </Btn>
                );
              })()}
            </>}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Status chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Chip tone="accent">{platformLabel}</Chip>
                <Chip>{kindLabel}</Chip>
                <Chip tone={isDraft ? "warn" : statusChip(editItem.status).tone}>
                  {editItem.status}
                </Chip>
                {editItem.fromChat && <Chip tone="accent">from chat</Chip>}
                {editItem.publishStatus === "published" && <Chip tone="ok">published</Chip>}
                {editItem.publishStatus === "failed" && <Chip tone="warn">publish failed</Chip>}
              </div>

              {/* Queued-post warning — edits here don't affect the snapshot the cron fires */}
              {isQueued && (
                <div style={{
                  padding: "10px 14px", borderRadius: 5, fontSize: 12.5,
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  background: "oklch(96% 0.04 250)", border: "1px solid oklch(80% 0.10 250)",
                  color: "oklch(35% 0.12 250)",
                }}>
                  <Icon name="calendar" size={12}/>
                  <span style={{ flex: 1 }}>
                    Scheduled for {editItem.fireAtUtc ? new Date(editItem.fireAtUtc).toLocaleString() : "a future time"} — edits made here won't change what fires. Unschedule to modify.
                  </span>
                </div>
              )}

              {/* No-publish-path callout — shown for platforms without a working publisher */}
              {editItem.noPublishPath && (
                <div style={{
                  padding: "10px 14px", borderRadius: 5, fontSize: 12.5,
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  background: "oklch(96% 0.04 340)", border: "1px solid oklch(82% 0.12 340)",
                  color: "oklch(35% 0.14 340)",
                }}>
                  No publish path — {platformLabel} isn't connected to a publisher yet. Export or post manually.
                </div>
              )}

              {/* Image-required callout — shown for IG drafts without a completed image */}
              {needsImageGuard && (
                <div style={{
                  padding: "10px 14px", borderRadius: 5, fontSize: 12.5,
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  background: "oklch(96% 0.04 340)", border: "1px solid oklch(82% 0.12 340)",
                  color: "oklch(35% 0.14 340)",
                }}>
                  <span style={{ flex: 1 }}>
                    Instagram requires an image.
                    {editItem.imageStatus === "pending" ? " Generating…" : " Add a prompt below and generate one."}
                  </span>
                  {editDraft.imagePrompt?.trim() && editItem.imageStatus !== "pending" && (
                    <Btn size="sm" onClick={generateImageFromDrawer} disabled={generatingImage}>
                      {generatingImage ? "Generating…" : "Generate image"}
                    </Btn>
                  )}
                </div>
              )}

              {/* Per-platform author picker (dropdown or free-text) */}
              {pub && pub.needsAuthor && (() => {
                const KIND_LABEL = { organization: "Page", page: "Page", person: "Personal", ig_business: "IG Business", subreddit: "Subreddit" };
                const authors = state.connectors?.[pub.connectorId]?.meta?.authors || [];
                if (pub.authorFreeText) {
                  return (
                    <FormRow label={pub.authorLabel} hint={pub.authorHint}>
                      <Input
                        value={author}
                        onChange={e => setAuthor(e.target.value.replace(/^\/?r\//, "").trim())}
                        placeholder="ayurveda"
                      />
                    </FormRow>
                  );
                }
                return (
                  <FormRow label={pub.authorLabel} hint={pub.authorHint}>
                    <select
                      value={author}
                      disabled={resolvingAuthor || authors.length === 0}
                      onChange={e => setAuthor(e.target.value)}
                      style={{
                        width: "100%", padding: "6px 8px", fontSize: 12.5,
                        border: "1px solid var(--rule)", borderRadius: 4,
                        background: "var(--paper-2)", color: "var(--ink)",
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      {resolvingAuthor && <option value="">resolving author…</option>}
                      {!resolvingAuthor && authors.length === 0 && (
                        <option value="">
                          {platformKey === "instagram"
                            ? "no IG Business account — link one to a managed FB Page"
                            : "no author available — check connector"}
                        </option>
                      )}
                      {authors.map(a => (
                        <option key={a.urn} value={a.urn}>
                          {(KIND_LABEL[a.kind] || a.kind || "Author") + " · " + (a.name || a.urn)}
                        </option>
                      ))}
                    </select>
                  </FormRow>
                );
              })()}

              {/* Reddit — required title (separate from body) */}
              {pub && pub.needsTitle && (
                <FormRow label="Title" hint="Subreddits reject submissions without a title (max 300 chars)">
                  <Input
                    value={redditTitle}
                    onChange={e => setRedditTitle(e.target.value.slice(0, 300))}
                    placeholder="Post title"
                  />
                </FormRow>
              )}

              {/* Posted-link / error display (any platform with publisher) */}
              {pub && (editItem.linkedinUrl || editItem.facebookUrl || editItem.xUrl || editItem.instagramUrl || editItem.redditUrl || editItem.publishError) && (
                <div style={{ fontSize: 11.5, display: "flex", flexDirection: "column", gap: 4 }}>
                  {(() => {
                    const url = editItem.linkedinUrl || editItem.facebookUrl || editItem.xUrl || editItem.instagramUrl || editItem.redditUrl;
                    if (!url) return null;
                    return (
                      <a href={url} target="_blank" rel="noreferrer"
                        style={{ color: "var(--accent-ink)", textDecoration: "underline" }}>
                        View on {pub.logLabel} ↗
                      </a>
                    );
                  })()}
                  {editItem.publishError && (
                    <div style={{ fontSize: 11, color: "oklch(48% 0.16 25)" }}>
                      Last error: {editItem.publishError}
                    </div>
                  )}
                </div>
              )}

              {/* Copy / Caption editor */}
              <FormRow label="Copy">
                <div style={{ position: "relative" }}>
                  <Textarea
                    value={editDraft.body}
                    onChange={e => setEditDraft(d => ({ ...d, body: e.target.value }))}
                    rows={6}
                    style={{ borderColor: overLimit ? "oklch(48% 0.16 25)" : undefined }}
                    placeholder="Write your copy here…"
                  />
                  {charLimit && (
                    <div style={{
                      position: "absolute", bottom: 8, right: 10,
                      fontSize: 10, fontFamily: "var(--font-mono)",
                      color: overLimit ? "oklch(48% 0.16 25)" : "var(--muted)",
                    }}>
                      {charCount}/{charLimit}
                    </div>
                  )}
                </div>
              </FormRow>

              {/* Image prompt (always show for visual formats, hidden for email/sms) */}
              {platformKey !== "email" && platformKey !== "sms" && (
                <FormRow label="Image prompt" hint="Runware will generate from this description">
                  <Textarea
                    value={editDraft.imagePrompt}
                    onChange={e => setEditDraft(d => ({ ...d, imagePrompt: e.target.value }))}
                    rows={2}
                    placeholder="Describe the visual — subject, mood, lighting, style…"
                  />
                </FormRow>
              )}

              {/* Generated image preview */}
              {platformKey !== "email" && platformKey !== "sms" && editItem.imageStatus && editItem.imageStatus !== "none" && (
                <FormRow label="Generated image">
                  {editItem.imageStatus === "completed" && editItem.imageUrl ? (
                    <img
                      src={editItem.imageUrl}
                      alt="Generated"
                      style={{
                        width: "100%", maxHeight: 320, objectFit: "cover",
                        borderRadius: 4, border: "1px solid var(--rule)",
                      }}
                    />
                  ) : editItem.imageStatus === "pending" ? (
                    <div style={{
                      padding: "20px 14px", textAlign: "center", fontSize: 12,
                      color: "var(--muted)", border: "1px dashed var(--rule)",
                      borderRadius: 4, background: "var(--paper-2)",
                    }}>
                      Generating image…
                    </div>
                  ) : (
                    <div style={{
                      padding: "12px 14px", fontSize: 12, color: "oklch(48% 0.16 25)",
                      border: "1px solid var(--rule)", borderRadius: 4, background: "var(--paper-2)",
                    }}>
                      Image generation {editItem.imageStatus === "failed_content_policy" ? "blocked by content policy" : "failed"}
                    </div>
                  )}
                </FormRow>
              )}

              {/* Schedule section — absolute date + time. Stored UTC at submit. */}
              <FormRow label="Schedule" hint="Fires at this date/time in your local zone (stored as UTC)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>Date</div>
                    <Input
                      type="date"
                      value={editDraft.scheduledDate}
                      onChange={e => setEditDraft(d => ({ ...d, scheduledDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>Time</div>
                    <Input
                      type="time"
                      value={editDraft.scheduledAt}
                      onChange={e => setEditDraft(d => ({ ...d, scheduledAt: e.target.value }))}
                    />
                  </div>
                </div>
              </FormRow>

              {/* Campaign (non-draft items) */}
              {!editItem.fromChat && (
                <FormRow label="Campaign">
                  <Input
                    value={editDraft.campaign}
                    onChange={e => setEditDraft(d => ({ ...d, campaign: e.target.value }))}
                    placeholder="Campaign name"
                  />
                </FormRow>
              )}

              {/* Save button (separate from the drawer action bar for inline feel) */}
              <div style={{ paddingTop: 4 }}>
                <Btn variant="ghost" onClick={handleSave} style={{ width: "100%" }}>
                  Save changes
                </Btn>
              </div>

            </div>
          </Drawer>
        );
      })()}

      {csvOpen && (
        <Drawer open={true} onClose={() => { setCsvOpen(false); resetCsv(); }}
          title="Import CSV"
          actions={<>
            <Btn variant="ghost" onClick={() => { setCsvOpen(false); resetCsv(); }}>
              <Icon name="x" size={12}/> Cancel
            </Btn>
            {csvRows.length > 0 && !csvResult && (() => {
              const mapped = csvMapping.platform && csvMapping.content;
              return (
                <>
                  <Btn variant="ghost" disabled={!mapped || csvSubmitting}
                    onClick={async () => {
                      setCsvSubmitting(true);
                      const posts = csvRows.map(r => ({
                        platform:     r[csvMapping.platform],
                        content:      r[csvMapping.content],
                        scheduledFor: csvMapping.scheduled_for ? r[csvMapping.scheduled_for] : undefined,
                        media:        csvMapping.media_urls ? r[csvMapping.media_urls] : undefined,
                      }));
                      const res = await actions.importCSV({ posts, dryRun: true });
                      setCsvSubmitting(false);
                      if (res?.ok) setCsvResult({ ...res.data, dryRun: true });
                    }}>
                    <Icon name="eye" size={12}/> Dry run
                  </Btn>
                  <Btn variant="primary" disabled={!mapped || csvSubmitting}
                    onClick={async () => {
                      setCsvSubmitting(true);
                      const posts = csvRows.map(r => ({
                        platform:     r[csvMapping.platform],
                        content:      r[csvMapping.content],
                        scheduledFor: csvMapping.scheduled_for ? r[csvMapping.scheduled_for] : undefined,
                        media:        csvMapping.media_urls ? r[csvMapping.media_urls] : undefined,
                      }));
                      const res = await actions.importCSV({ posts, dryRun: false });
                      setCsvSubmitting(false);
                      if (res?.ok) setCsvResult({ ...res.data, dryRun: false });
                    }}>
                    <Icon name="upload" size={12}/> {csvSubmitting ? "Uploading…" : `Import ${csvRows.length}`}
                  </Btn>
                </>
              );
            })()}
            {csvResult && (
              <Btn variant="primary" onClick={() => { setCsvOpen(false); resetCsv(); }}>
                <Icon name="check" size={12}/> Done
              </Btn>
            )}
          </>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Step 1 — file picker */}
            {csvRows.length === 0 && (
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Step 1 · Choose a CSV
                </div>
                <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px" }}>
                  Header row required. Up to 200 rows per import. Columns can be in any order — you'll map them in the next step.
                </p>
                <input type="file" accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const text = String(reader.result || "");
                      const { header, rows } = parseCsv(text);
                      if (!header.length || !rows.length) {
                        actions.notify("warn", "CSV looks empty — need a header row and at least one data row");
                        return;
                      }
                      const objectRows = rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
                      setCsvFileName(f.name);
                      setCsvHeader(header);
                      setCsvRows(objectRows);
                      setCsvMapping(autoMapColumns(header));
                    };
                    reader.readAsText(f);
                  }}/>
              </div>
            )}

            {/* Step 2 — column mapping + preview */}
            {csvRows.length > 0 && !csvResult && (
              <>
                <div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                    Step 2 · Map columns
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                    {csvFileName} · {csvRows.length} rows
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, alignItems: "center" }}>
                    {[
                      ["platform",      "Platform *",     true],
                      ["content",       "Content *",      true],
                      ["scheduled_for", "Scheduled for",  false],
                      ["media_urls",    "Media URLs",     false],
                    ].map(([key, label, required]) => (
                      <React.Fragment key={key}>
                        <label style={{ fontSize: 12, color: "var(--ink)" }}>
                          {label}
                        </label>
                        <select value={csvMapping[key]} onChange={(e) => setCsvMapping({ ...csvMapping, [key]: e.target.value })}
                          style={{ padding: "5px 8px", fontSize: 12, border: "1px solid var(--rule)", borderRadius: 4, background: "var(--paper)", color: "var(--ink)" }}>
                          <option value="">{required ? "— select —" : "— none —"}</option>
                          {csvHeader.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                    Preview · first {Math.min(10, csvRows.length)} of {csvRows.length}
                  </div>
                  <div style={{ border: "1px solid var(--rule)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 100px", padding: "6px 10px", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      <span>Platform</span><span>Content</span><span>Scheduled</span><span>Media</span>
                    </div>
                    {csvRows.slice(0, 10).map((r, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 100px", padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11.5, alignItems: "center" }}>
                        <span style={{ fontWeight: 500 }}>{csvMapping.platform ? r[csvMapping.platform] || "—" : "—"}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                          {csvMapping.content ? r[csvMapping.content] || "—" : "—"}
                        </span>
                        <span style={{ color: "var(--muted)", fontSize: 10.5 }}>
                          {csvMapping.scheduled_for ? r[csvMapping.scheduled_for] || "—" : "—"}
                        </span>
                        <span style={{ color: "var(--muted)", fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {csvMapping.media_urls ? r[csvMapping.media_urls] || "—" : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 3 — results */}
            {csvResult && (
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  {csvResult.dryRun ? "Dry-run results" : "Import results"}
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <Chip tone="ok">{csvResult.valid} ok</Chip>
                  {csvResult.invalid > 0 && <Chip tone="warn">{csvResult.invalid} failed</Chip>}
                  <Chip>{csvResult.total} total</Chip>
                  {csvResult.dryRun && <Chip tone="accent">dry run</Chip>}
                </div>
                {(csvResult.warnings || []).length > 0 && (
                  <div style={{ marginBottom: 12, fontSize: 11.5, color: "oklch(45% 0.12 60)" }}>
                    Warnings: {csvResult.warnings.join(", ")}
                  </div>
                )}
                <div style={{ border: "1px solid var(--rule)", borderRadius: 5, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "60px 80px 1fr", padding: "6px 10px", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    <span>Row</span><span>Status</span><span>Detail</span>
                  </div>
                  {(csvResult.results || []).map((r) => (
                    <div key={r.rowIndex} style={{ display: "grid", gridTemplateColumns: "60px 80px 1fr", padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11.5, alignItems: "center" }}>
                      <span className="mono" style={{ color: "var(--muted)" }}>#{r.rowIndex}</span>
                      <span><Chip tone={r.ok ? "ok" : "warn"}>{r.ok ? "ok" : "failed"}</Chip></span>
                      <span style={{ color: r.ok ? "var(--ink)" : "oklch(45% 0.14 25)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.ok ? (r.createdPostId || "queued") : (r.errors || []).join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </div>
  );
}


function timeAgoFromDate(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

// ────────────────────────────── INBOX & ESCALATION ──────────────────────────────
function InboxEscalation({ state, actions }) {
  const [fetchedItems, setFetchedItems] = useState3(null);
  const [isLoading, setIsLoading] = useState3(true);

  useEffect3(() => {
    let mounted = true;
    let intervalId = null;

    async function fetchInbox() {
      try {
        const { data, error } = await sb
          .from("inbox_events")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        if (!mounted) return;

        if (data && data.length > 0) {
          setFetchedItems(data.map(row => ({
            id: row.id,
            author: row.author_name || row.author_handle || "Unknown",
            source: `${row.platform} · ${row.event_type}`,
            text: row.text || "",
            risk: row.risk || "low",
            status: row.status || "open",
            draft: row.ai_draft || "",
            reason: row.ai_triage_note || "",
            timeAgo: timeAgoFromDate(row.created_at),
            category: row.event_type,
            platform: row.platform,
            eventType: row.event_type,
            externalId: row.external_id,
          })));
        } else {
          setFetchedItems([]);
        }
      } catch (e) {
        console.error("[InboxEscalation] fetch error:", e);
        if (mounted) setFetchedItems(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchInbox();
    intervalId = setInterval(fetchInbox, 30000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const inboxSource = (fetchedItems && fetchedItems.length > 0) ? fetchedItems : state.inbox;
  const open     = inboxSource.filter(i => i.status !== "replied" && i.status !== "archived");
  const urgent   = open.filter(i => i.risk === "high" || i.risk === "medium")
                       .sort((a, b) => (a.risk === "high" ? -1 : b.risk === "high" ? 1 : 0));
  const ready    = open.filter(i => i.risk === "low");

  const defaultId = (urgent[0] || ready[0])?.id;
  const [selectedId, setSelectedId] = useState3(defaultId);
  const [draft, setDraft]           = useState3("");

  const selected = open.find(i => i.id === selectedId) || urgent[0] || ready[0];

  React.useEffect(() => {
    if (selected) setDraft(selected.draft || "");
  }, [selectedId, selected?.id]);

  const riskBorder = { high: "var(--danger)", medium: "var(--warn)", low: "var(--success)" };
  const riskTone   = { high: "danger",        medium: "warn",        low: "ok" };

  const archive = (item) => {
    actions.updateInbox(item.id, { status: "archived" }, {
      logEvent: `archived · ${item.author}`,
      notify:   { tone: "neutral", text: `Archived · ${item.author}` },
    });
    // fire-and-forget DB sync
    sb.from("inbox_events").update({ status: "archived" }).eq("id", item.id).then(() => {}, () => {});
  };

  const INBOX_CHANNEL_NAMES = ["Instagram", "LinkedIn", "TikTok", "Facebook", "X", "Twitter", "YouTube", "Email", "Pinterest"];
  const sendReply = async (item, replyDraft) => {
    // Enforce reply rule from Autonomy Settings
    const matchedChannel = INBOX_CHANNEL_NAMES.find(ch => (item.source || "").startsWith(ch));
    const rule = matchedChannel ? (state.channelRules || []).find(r => r.name === matchedChannel) : null;
    if (rule && rule.reply === "n/a") {
      actions.notify("warn", `${matchedChannel}: replies not configured — check Autonomy Settings`);
      return;
    }

    // Daily cap enforcement for auto mode
    if (state.autonomyMode === "auto" && rule && rule.reply === "auto") {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count, error } = await sb
        .from("inbox_events")
        .select("id", { count: "exact" })
        .eq("status", "replied")
        .gte("updated_at", startOfDay.toISOString());
      if (!error && count >= state.thresholds.dailyCap) {
        actions.notify("warn", `Daily auto-reply cap reached (${state.thresholds.dailyCap}) — reply queued for manual review`);
        return;
      }
    }

    // Seed/demo items have no externalId — fall back to local-only update
    if (!item.externalId || !item.platform) {
      actions.updateInbox(item.id, { status: "replied", draft: replyDraft }, {
        logEvent: `replied · ${item.source} · ${item.author}`,
        notify:   { tone: "ok", text: `Reply sent to ${item.author}` },
      });
      sb.from("inbox_events").update({ status: "replied" }).eq("id", item.id).then(() => {}, () => {});
      return;
    }

    const action = item.eventType === "dm" ? "reply_dm" : "reply_comment";
    const payload = {
      action,
      platform: item.platform,
      text: replyDraft,
    };
    if (action === "reply_dm") {
      payload.conversation_id = item.externalId;
    } else {
      payload.comment_id = item.externalId;
    }

    try {
      const res = await apiFetch("/api/zernio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({ ok: false, error: "Invalid response" }));
      if (!result.ok) {
        actions.notify("danger", `Reply failed — ${result.error || "check connection"}`);
        return;
      }
      // Success: update local state + DB
      actions.updateInbox(item.id, { status: "replied", draft: replyDraft }, {
        logEvent: `replied · ${item.source} · ${item.author}`,
        notify:   { tone: "ok", text: `Reply sent to ${item.author}` },
      });
      sb.from("inbox_events").update({ status: "replied" }).eq("id", item.id).then(() => {}, () => {});
    } catch (e) {
      console.error("[sendReply]", e);
      actions.notify("danger", "Reply failed — check connection");
    }
  };

  // Left panel row
  const Row = ({ item, section }) => {
    const isActive = selected?.id === item.id;
    const border   = riskBorder[item.risk] || "var(--rule)";
    return (
      <div onClick={() => setSelectedId(item.id)} className="cell-btn"
        style={{
          padding: "11px 14px", cursor: "pointer",
          borderBottom: "1px solid var(--rule)",
          borderLeft: `3px solid ${isActive ? border : "transparent"}`,
          background: isActive ? "var(--paper-2)" : "transparent",
          transition: "background 0.1s",
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{item.author}</span>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.04em" }}>{item.timeAgo}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, letterSpacing: "0.02em" }}>
          {item.source}
        </div>
        <div style={{
          fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.4,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>{item.text}</div>
      </div>
    );
  };

  if (open.length === 0) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
      Inbox clear.
    </div>
  );

  return (
    <div className="anim-fade" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--rule)", background: "var(--paper)", flexShrink: 0 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>07 · Listen</div>
        <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.025em", margin: "4px 0 8px" }}>Inbox</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {urgent.length > 0 && <Chip tone="danger">{urgent.length} need a decision</Chip>}
          {ready.length  > 0 && <Chip tone="ok">{ready.length} ready to send</Chip>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", flex: 1, minHeight: 0 }}>

        {/* ── Left panel ── */}
        <div style={{ borderRight: "1px solid var(--rule)", background: "var(--paper)", overflow: "auto", display: "flex", flexDirection: "column" }}>
          {isLoading ? (
            <div style={{ padding: "20px 14px", color: "var(--muted)", fontSize: 12 }}>
              Loading…
            </div>
          ) : (
            <>
              {urgent.length > 0 && (
                <>
                  <div style={{ padding: "8px 14px 4px", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
                    <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Needs a decision</span>
                  </div>
                  {urgent.map(item => <Row key={item.id} item={item}/>)}
                </>
              )}
              {ready.length > 0 && (
                <>
                  <div style={{ padding: "8px 14px 4px", background: "var(--paper-2)", borderBottom: "1px solid var(--rule)", borderTop: urgent.length > 0 ? "1px solid var(--rule)" : "none" }}>
                    <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Ready to send</span>
                  </div>
                  {ready.map(item => <Row key={item.id} item={item}/>)}
                </>
              )}
            </>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div key={selected.id} className="anim-slide" style={{ background: "var(--paper)", overflow: "auto", display: "flex", flexDirection: "column" }}>

            {/* Sender + meta */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--rule)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                {selected.source} · {selected.timeAgo} ago
              </div>
              <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em" }}>{selected.author}</div>
              <div style={{ marginTop: 6 }}>
                <Chip tone={riskTone[selected.risk] || "neutral"}>{selected.category}</Chip>
              </div>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>

              {/* ── AI Triage block — FIRST ── */}
              <div style={{
                padding: "14px 16px",
                borderRadius: 6,
                border: "1px solid var(--rule)",
                borderLeft: `3px solid ${riskBorder[selected.risk] || "var(--rule)"}`,
                background: "var(--paper-2)",
              }}>
                <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="shield" size={11}/> AI Triage
                </div>
                <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>
                  {selected.reason || "No triage note."}
                </div>
              </div>

              {/* ── Message ── */}
              <div>
                <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Message</div>
                <div style={{
                  padding: "14px 16px", background: "var(--paper-2)",
                  borderRadius: 5, border: "1px solid var(--rule)",
                  fontSize: 14, lineHeight: 1.65, color: "var(--ink)",
                  fontFamily: "var(--font-serif)", letterSpacing: "-0.01em",
                }}>
                  "{selected.text}"
                </div>
              </div>

              {/* ── Response area ── */}
              {selected.risk === "high" ? (
                <div style={{
                  padding: "14px 16px", border: "1px solid var(--rule)",
                  borderLeft: "3px solid var(--danger)", borderRadius: 5,
                  background: "var(--paper-2)",
                }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--danger)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Hard boundary — no AI reply</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                    This category is blocked from AI drafting. Forward directly to your comms lead.
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Drafted reply</div>
                    <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)" }}>brand voice · {selected.risk === "low" ? "auto" : "review"}</div>
                  </div>
                  {selected.draft ? (
                    <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
                      style={{ borderLeft: "3px solid var(--accent)" }}/>
                  ) : (
                    <div style={{
                      padding: "14px 16px", border: "1px solid var(--rule)",
                      borderLeft: "3px solid var(--warn)", borderRadius: 5,
                      fontSize: 13, color: "var(--muted)", fontStyle: "italic",
                    }}>
                      No auto-draft — requires human review before reply.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Actions ── */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--rule)", background: "var(--paper)", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
              <Btn size="sm" variant="ghost" onClick={() => archive(selected)}>
                <Icon name="x" size={12}/> Archive
              </Btn>
              {selected.risk === "high" ? (
                <Btn size="sm" variant="primary" onClick={() => archive(selected)}>
                  <Icon name="send" size={12}/> Forward to comms →
                </Btn>
              ) : selected.draft ? (
                <Btn size="sm" variant="primary" onClick={() => sendReply(selected, draft)}>
                  <Icon name="send" size={12}/> {selected.risk === "low" ? "Send reply" : "Approve & send"}
                </Btn>
              ) : (
                <Btn size="sm" variant="default" disabled>
                  Human review required
                </Btn>
              )}
            </div>
          </div>
        )}
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

Object.assign(window, { PublishingQueue, InboxEscalation, AutonomySettings });
})();
