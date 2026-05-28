# Flow — Work Log

Reverse-chronological record of notable changes. New entries on top.

---

## 2026-05-27 · Track A · PR 1 chunk 1 — Zernio edit / unpublish / retry

**Scope:** New `api/zernio-publish.js` edge route + PublishingQueue UI hooks for post-lifecycle actions on already-published rows.

### Changes
- **NEW [api/zernio-publish.js](api/zernio-publish.js)** — edge route with `edit_post`, `unpublish_post`, `retry_post`. User JWT only (`requireAuth`), tenantId from the verified JWT. Uses the shared `api/lib/zernioClient.js` (`zernioFetch`, `getOrCreateZernioProfile`) and `api/lib/zernioMap.js` (`resolvePlatform`) — no helper duplication. Validates `postId` / `platform` / `content` inline (no zod). Endpoints forwarded per the Zernio OpenAPI spec at `~/Downloads/zernio-api-openapi.yaml`.
- **[app/store.jsx](app/store.jsx)** — append-only `// === TRACK A: PUBLISHING + ADS ===` block adds `editPost(itemId, {...})`, `unpublishPost(itemId, {...})`, `retryPost(itemId, {...})` async actions. Each calls `window.apiFetch("/api/zernio-publish", …)` and dispatches `CAL_UPDATE` plus a `NOTIFY` toast on success/failure. A matching marker block sits in the reducer for later PRs in this track. **No existing reducer cases or actions modified.**
- **[app/workspaces3.jsx](app/workspaces3.jsx)** — `getZernioPostId(item)` helper at top of file (reads the existing per-platform `<platform>PostId` field). Row-level Edit + Unpublish buttons added to the Published-7d table. In the existing edit drawer, conditional "Update post" (when `publishStatus === "published"`), "Unpublish" (same), and "Retry" (when `publishStatus === "failed"`) buttons in the actions slot — Update reuses `editDraft.body` as the new content.

### Why these specific endpoints first
The Zernio integration shipped `publish_now` / `schedule_post` but never the lifecycle actions (edit/unpublish/retry/metadata/bulk-upload/validators/queue-slots). The first three close the loop on "a publish failed or was wrong" without the user having to switch to the platform UI — highest-value subset and fastest to ship.

### Deliberately not done
- **Edit on non-X platforms** — Zernio's `/v1/posts/{postId}/edit` is currently twitter-only per OpenAPI spec. The button surfaces on any published row; the call will fail at the Zernio layer for other platforms until they expand support. I chose to forward the platform faithfully rather than gate client-side, so the UI lights up automatically when Zernio adds platforms. Worth a follow-up if the failure UX is too rough.
- **bulk_upload / validators / queue-slots** — land in later chunks of this PR (`PR 2` and `PR 3` per the branch plan).
- **CSV drawer / smart-slots picker / live char validation** — same.
- **`requireZernioAccountId` import is a `void`-discard placeholder** — `bulk_upload` (PR 2) needs it for per-platform account resolution; kept the import to surface the helper to future edits in this file.

### Verification
- `node --check api/zernio-publish.js` → OK
- `@babel/standalone` transform of `app/workspaces3.jsx` and `app/store.jsx` → OK (matches the Babel-CDN runtime)
- End-to-end run against a real Zernio tenant with a published X post is the natural smoke test once this lands.

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
