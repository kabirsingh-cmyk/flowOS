# Flow — Work Log

Reverse-chronological record of notable changes. New entries on top.

---

## 2026-05-27 · Track B Phase 2 — Analytics depth (PR 3 + 3.1)

**Scope:** Insights workspace now renders real Zernio organic-social data with trend deltas and sparklines. Cron hardened with retry logic. Store has analytics state slice.

### PR 3 (d7cef74) — Frontend rewire
- `app/insights.jsx` — added 6 Zernio organic social channels (fb_organic, ig_organic, li_organic, tt_organic, yt_organic, gmb) with platform-specific metric keys. Handles Zernio nested `{ total, values, breakdowns }` format via `resolveMetricValue()`. Fetches `analytics_primitives`. New `PrimitivesSection` component. Summary KPI strip includes organic social highlights.
- `app/channel-strategy.jsx` — fetches connected channels from Supabase `channels` table + legacy `state.connectors`. Fetches recent `analytics_snapshots` to compute `channelPerf` scores. Channels with live performance data get up to 12% score boost in the recommended mix.

### PR 3.1 (0b2070e) — Trend deltas, sparklines, cron hardening
- `app/insights.jsx` — `TrendDeltas` component computes half-over-half deltas from Zernio time-series `values` arrays (top 8 by absolute delta, ▲/▼ indicators). `FollowerCharts` component renders SVG sparklines for every metric with a `values` array. `Sparkline` helper renders simple SVG path, color-matched to channel meta.
- `api/cron/daily-analytics.js` — `fetchWithRetry` helper with exponential backoff (retries 5xx + 429). `callZernioAnalytics` uses 2 retries. `persistSnapshots` / `persistPrimitives` check response status. `processTenant` collects per-endpoint errors in `endpointErrors` array. `analytics-ingest` call wrapped in try/catch with its own retry.
- `app/store.jsx` — append-only block: `ANALYTICS_PERIOD_SET` + `ANALYTICS_REFRESH_STATE` reducer cases, `setAnalyticsPeriod` + `setAnalyticsRefreshState` actions. Default state: `analyticsPeriod='30d'`, `analyticsRefreshing=false`, `analyticsLastRefresh=null`.

### Deliberately not done
- No top-posts section in insights.jsx — Zernio's analytics endpoints are account-level; post-level analytics (`linkedin_post_analytics`, `youtube_daily_views`) require post IDs/URNs that the cron doesn't yet collect. Will revisit when the publishing pipeline stores post IDs persistently.
- No historical snapshot table — trend deltas are computed from within-period time-series splits (second half vs first half), not true period-over-period comparisons. This is sufficient for directional signals but not for year-over-year analysis.
- insights.jsx local state not yet wired to store.jsx analytics slice — the store actions exist but insights.jsx still manages its own period/refresh state. A future refactor can lift this up.

---

## 2026-05-19 · Calendar items carry sourceBriefId (data-only)

**Scope:** Schema-only plumbing. No UI consumes the field yet.

Added a `sourceBriefId` field to the `state.calendar` item shape so that drafts spawned from a campaign brief can carry a back-reference to the brief that created them. This is groundwork for the linkage use case noted in [BACKLOG.md](BACKLOG.md) ("Campaign brief persistence + cross-feature wiring") — specifically the third bullet: PublishingQueue items knowing which brief they came from.

### Changes
- [app/store.jsx](app/store.jsx) — `QUEUE_ADD_DRAFT` reducer writes `sourceBriefId: a.sourceBriefId || null` onto new draft rows. `addDraft` action signature extended: `addDraft(platform, contentType, copy, imagePrompt, id?, sourceBriefId?)`. Existing callers pass `undefined` and get `null` on the row.
- [app/store.jsx](app/store.jsx) — `ACTIVE_PLAN_SET` reducer now assigns `id: "br_<random>"` to the active plan if the caller didn't supply one, so brief items have a stable reference target. Spread order fixed so the generated id isn't overwritten by `undefined` from the input plan.
- [CLAUDE.md](CLAUDE.md) — documented the new field on the calendar item shape and on the `addDraft` action signature.

### Deliberately not done
- No UI surface that displays "Part of: <brief title>" anywhere in PublishingQueue or the drawer.
- No callsite passes `sourceBriefId` today — `create_campaign_plan` writes the brief into `state.activePlan` but doesn't push calendar items. The flow that converts a brief's section-5 calendar table into actual queue rows is the next piece of work, and it'll be the first writer of this field.
- No persistence. `sourceBriefId` references `state.activePlan.id`, which is a client-only id that disappears on refresh. If/when briefs persist to Supabase (see BACKLOG.md), the id format and the FK shape will need to match.

### Why now
Cheap to add the field today before any rows exist; expensive to backfill later if rows already do. Adding the field with no consumer is normally premature, but here it's a one-line schema decision that costs nothing and unblocks the brief→queue flow whenever someone builds it.
