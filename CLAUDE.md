# FlowOS — Claude Context

Read this at the start of every session. It replaces the need to re-discover the architecture by reading source files.

> **Coding guidelines** (Think Before Coding · Simplicity First · Surgical Changes · Goal-Driven Execution) are in `~/CLAUDE.md` and apply here.

---

## What this is

**FlowOS** — an AI marketing operating system for brands. Multi-tenant SPA. One logged-in brand at a time (tenant switching via seed presets). Production stack: Vercel (edge functions) + Supabase (auth + data) + Anthropic (Claude) + Composio (platform tool execution).

Two seed brands in `seed.jsx`: **MVEDA** (Ayurvedic skincare, DTC) and **Erickson Refrigeration** (B2B commercial HVAC).

---

## Critical architecture facts

### No build step — Babel CDN at runtime

```html
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>
<script type="text/babel" src="app/chat-app.jsx"></script>
```

JSX is compiled in the browser by Babel standalone. There is no Webpack, Vite, or bundler. No `import`/`export` in frontend files (they're not modules). Everything communicates via `window` globals.

### Script load order matters — it is the dependency graph

`index.html` loads scripts in this exact order:

```
supabase.jsx      → exposes: sb (Supabase client)
seed.jsx          → exposes: SEED
ui.jsx            → exposes: Btn, Icon, Chip, Dot, statusChip, ...
store.jsx         → exposes: useMvedaStore
workspaces1.jsx   → exposes: CommandCenter, BrandMemory
workspaces2.jsx   → exposes: CampaignPlanner, ContentStudio
workspaces3.jsx   → exposes: PublishingQueue, InboxEscalation, AutonomySettings
workspaces4.jsx   → exposes: Connections, BrandImportModal, ConnectorIcon
chat-data.jsx     → exposes: SPECIALISTS, CHANNELS, BRIEFING, TEAM_THREAD, PERSONAL_HISTORY, SUGGESTIONS
chat-ui.jsx       → exposes: SpecialistAvatar, UserAvatar, ArtifactCard, Message, BriefingCard, Composer
channel-strategy.jsx → exposes: ChannelStrategyCanvas, computeChannelStrategy
features.jsx      → exposes: OrganicSocialStudio, SmsCenter, SeoStudio, AffiliateProgram, ...
studio.jsx        → exposes: StudioHub, EmailStudio, SearchStudio, SettingsHub
login.jsx         → exposes: LoginScreen
onboarding.jsx    → exposes: OnboardingWizard, applyPalette, BRAND_PALETTES
agents.jsx        → exposes: AgentsWorkspace
insights.jsx      → exposes: InsightsCenter
ai.jsx            → exposes: sendAIMessage
chat-app.jsx      → mounts ReactDOM.createRoot → <ChatOS/>
```

A file can only use globals defined by files loaded before it. If you add a new component, put it in the right file or add a new file before `chat-app.jsx` in `index.html`.

### All files use IIFE wrapping except the last two

```js
(function () {
  // workspaces1/2/3/4, features, studio, etc.
  // Components defined here, then exported at the bottom:
  Object.assign(window, { MyComponent, anotherThing });
})();
```

`chat-app.jsx` does NOT use an IIFE — it runs at top level and calls `ReactDOM.createRoot`.

### Hook aliases — one set per file

Every file aliases React hooks to avoid collisions across the global scope:

| File | useState | useMemo | useEffect | useRef | useReducer | useCallback |
|---|---|---|---|---|---|---|
| `ui.jsx` | useState | useMemo | useEffect | useRef | — | — |
| `ui2.jsx` | useStateUI2 | — | useEffectUI2 | useRefUI2 | — | — |
| `store.jsx` | — | — | — | — | useReducerStore | useCallbackStore |
| `workspaces1.jsx` | useState1 | useMemo1 | useEffect1 | useRef1 | — | — |
| `workspaces2.jsx` | useState2 | useMemo2 | useEffect2 | — | — | — |
| `workspaces3.jsx` | useState3 | useMemo3 | useEffect3 | useRef3 | — | — |
| `workspaces4.jsx` | useState4 | useMemo4 | useEffect4 | useRef4 | — | — |
| `chat-app.jsx` | useStateApp | useMemoApp | useEffectApp | — | useReducerApp | — |
| `chat-ui.jsx` | useStateChat | useMemoChat | useEffectChat | useRefChat | — | — |
| `features.jsx` | useStateF | useMemoF | useEffectF | useRefF | — | — |
| `studio.jsx` | useStateS | — | — | — | — | — |
| `onboarding.jsx` | useStateOB | — | useEffectOB | useRefOB | — | — |
| `agents.jsx` | useStateA | — | useEffectA | — | — | useCallbackA |
| `channel-strategy.jsx` | useStateCS | useMemoCS | useEffectCS | — | — | — |
| `insights.jsx` | useStateI | — | useEffectI | useRefI | — | useCallbackI |

**Always use the alias for the file you're editing.** Never use bare `useState` unless you're in `ui.jsx`.

---

## Layout contract — 3-column, always

```jsx
// chat-app.jsx — ChatOSAuthed render
<div style={{ display: "grid", gridTemplateColumns: "56px 1fr 320px", height: "100vh" }}>
  <NavRail .../>          {/* col 1: 56px icon nav */}
  <Canvas .../>           {/* col 2: workspace/canvas — always present */}
  <div>                   {/* col 3: 320px chat rail — always present */}
    <ChatRailHeader .../>
    <Thread .../>
    <Composer .../>
  </div>
</div>
```

- The chat rail is **never** conditionally hidden — it's always 320px
- The canvas defaults to `CommandCenter` when no workspace is open (`chat.canvas === null`)
- `activeCanvas = chat.canvas || { kind: "workspace", target: "command" }`

---

## State architecture

### Global app state: `useMvedaStore()` in `store.jsx`

All workspaces read from `state` and mutate via `actions`. Returns `[state, actions]`.

**Key state slices:**

```js
state.calendar        // publishing queue items (all statuses including "draft")
state.inbox           // customer message items
state.connectors      // { [connectorId]: { connected, status, note, syncCount } }
state.brandPreset     // currently active brand object (null = default MVEDA)
state.notifications   // toast array
state.activity        // audit log
state.activePlan      // chat-authored campaign brief (set by campaign_planner specialist)
                      // null when no plan; { title, summary, itemCount, goal, audience,
                      // timeline, budget, channels[], brief (markdown), createdAt }
                      // CampaignPlanner workspace renders this when present; falls back
                      // to default grid when null. Actions: setActivePlan, clearActivePlan.
state.calendar items shape:
  { id, platform, kind, title, body, imagePrompt, imageUrl, imageStatus,
    status, scheduledAt, scheduledDate, day, channel, tone, campaign, fromChat, sourceBriefId, createdAt,
    // After Schedule (publishable platform — row queued in scheduled_posts):
    scheduledPostId, fireAtUtc,
    // After publish (per platform — only the matching set is populated):
    publishStatus, publishError,
    linkedinPostId,  linkedinUrl,  linkedinAuthorUrn,
    facebookPostId,  facebookUrl,  facebookPageId,
    xPostId,         xUrl,
    instagramPostId, instagramUrl, instagramCreationId, instagramAccountId,
    redditPostId,    redditUrl,    redditSubreddit, redditTitle }

  imageStatus: "none" | "pending" | "completed" | "failed" | "failed_content_policy"
    — set on QUEUE_ADD_DRAFT based on whether imagePrompt is present
    — patched via actions.updateItem(id, { imageUrl, imageStatus }) once
      /api/generate returns. Rendered as a 36×36 thumbnail in the queue
      Drafts strip and as a full preview in the draft drawer.
  actions.addDraft(platform, contentType, copy, imagePrompt, id?, sourceBriefId?) — id is
    optional; pass one if you need to patch the row later (chat-to-create does).
    sourceBriefId is optional and only set when the draft was spawned from a
    campaign brief (state.activePlan.id). No UI consumes it yet — see WORKLOG.md
    2026-05-19 and BACKLOG.md "Campaign brief persistence + cross-feature wiring".
```

**Adding a new action — always touch both places:**

1. Add a `case "MY_ACTION":` in `mveda_reducer` in `store.jsx`
2. Add the method to the `actions` object inside `useMvedaStore()`

Example:
```js
// In reducer:
case "QUEUE_ADD_DRAFT": {
  const item = { id: "d_" + Math.random().toString(36).slice(2,8), ...a };
  return { ...s, calendar: [item, ...s.calendar],
    notifications: [notify("ok", "Draft added"), ...s.notifications] };
}
// In actions:
addDraft: (platform, contentType, copy, imagePrompt) =>
  dispatch({ type: "QUEUE_ADD_DRAFT", platform, contentType, copy, imagePrompt }),
```

### Chat state: `chatReducer` in `chat-app.jsx`

Separate from the store. Manages threads, active channel, canvas state, typing indicator.

Key actions: `POST`, `STREAM_START`, `STREAM_TOKEN`, `STREAM_DONE`, `OPEN_CANVAS`, `CLOSE_CANVAS`, `SET_CHANNEL`, `SET_TYPING`.

`STREAM_DONE` accepts an optional `artifact` — attaches it to the last message in the thread.

---

## Workspace routing

Workspaces are registered in `CanvasBody` in `chat-app.jsx`:

```js
const Comp = {
  planner: CampaignPlanner,   inbox: InboxEscalation,
  memory: BrandMemory,        insights: InsightsCenter,
  connections: Connections,   autonomy: AutonomySettings,
  publish: PublishingQueue,   command: CommandCenter,
  studio: StudioHub,          emailstudio: EmailStudio,
  searchstudio: SearchStudio, organic: OrganicSocialStudio,
  sms: SmsCenter,             seo: SeoStudio,
  affiliate: AffiliateProgram, retention: RetentionDashboard,
  cx: CxSignals,              seasonal: SeasonalMode,
  abtests: AbTestLab,         team: TeamSeats,
  discounts: DiscountOps,     mobile: MobileShell,
  settings: SettingsHub,      agents: AgentsWorkspace,
}[canvas.target];
```

To open a workspace from code: `openWorkspace("publish")` or dispatch `{ type: "OPEN_CANVAS", canvas: { kind: "workspace", target: "publish" } }`.

To open a workspace from the chat AI: use the `open_workspace` tool with the target string above.

---

## AI / chat pipeline

### `ai.jsx` — `sendAIMessage()`

```
User sends message
  → callSpecialist("supervisor") → /api/chat
  → Supervisor may call delegate_to("drafter") → callSpecialist("drafter")
  → Each specialist response dispatches STREAM_START / STREAM_TOKEN / STREAM_DONE
  → STREAM_DONE can carry an artifact: { type, ...data }
```

### Artifact types rendered inline in chat (`chat-ui.jsx` → `ArtifactCard`):

| type | What renders |
|---|---|
| `draft_created` | `DraftCreatedCard` — copy with platform badge, char count, "Send to queue" |
| `email_draft` | `EmailDraftCard` — subject/preheader/body + "Push to Klaviyo" → POST `/api/klaviyo` `create_draft_campaign` |
| `sms_draft` | `SmsDraftCard` — body + char counter, STOP-footer warning + "Push to Klaviyo SMS" → POST `/api/klaviyo` `create_draft_sms` |
| `email_sequence` | `EmailSequenceCard` — multi-email drip (onboarding/nurture/re-engagement/win-back/launch/etc.). Collapsed email list (number/day/purpose) expanding to subject options, preview, body, CTA, segment. Footer surfaces branching, exit condition, A/B tests, benchmarks. "Open in Email Studio" → `onOpen({ kind: "open_emailstudio" })` |
| `drafts` | Simple list preview → "Open all in canvas" |
| `metric` | Big number card |
| `strategy` | Channel mix bar chart |
| `campaign-plan` | Campaign summary → opens planner |
| `media_plan` | `MediaPlanCard` — title + total monthly budget + summary + goal. Each channel row shows priority, name, allocation bar, %, monthly spend. Tap row to expand format / target CAC (with measured/estimated confidence) / expected conversions / CAC source / rationale. Footer surfaces excluded channels, risks, assumptions. Data-source chip (Tenant data / Mixed / Benchmarks) signals CAC provenance at a glance. |
| `email` | Email preview → expand (legacy seeded) |
| `policy-review` | Flag list |
| `workspace` | (handled before render — opens workspace directly) |

### Fallback simulation (`inferResponse` in `chat-app.jsx`)

When `/api/chat` fails or ANTHROPIC_API_KEY is missing, `inferResponse(userText)` runs pattern matching and returns an array of `{ delay, agent, text, artifact }` objects. Edit this to add new simulated responses.

**Creation-intent detection fires first** (before workspace-routing patterns):
```js
const hasCreateVerb  = /\b(write|draft|create|generate|make me|give me)\b/.test(t);
const hasContentNoun = /\b(post|caption|reel|story|carousel|...)\b/.test(t);
if (hasCreateVerb && hasContentNoun) { return makeDraftArtifact(t); }
```

### Internal tools available to Claude (defined in `api/chat.js`):

| Tool | Available to | Effect |
|---|---|---|
| `delegate_to` | Supervisor | Routes to specialist (enum: drafter, analyst, brand_guard, inbox, campaign_planner, seo_auditor, media_planner) |
| `open_workspace` | Supervisor, **Campaign Planner**, **SEO Auditor**, **Media Planner** | Opens a workspace panel. SEO Auditor calls it with target `"seo"` after producing an audit. Media Planner has no dedicated workspace yet, but the tool is in its set for future use. |
| `show_drafts` | Supervisor | Opens drafts canvas |
| `show_metric` | Supervisor | Shows metric card |
| `create_draft` | **Drafter** | Produces `draft_created` artifact in chat |
| `create_email_draft` | **Drafter** | Produces `email_draft` artifact (subject/preheader/body) |
| `create_sms_draft` | **Drafter** | Produces `sms_draft` artifact (body ≤160, audienceHint, includeStopFooter) |
| `create_email_sequence` | **Drafter** | Produces `email_sequence` artifact — sequenceType, goal, audience, emails[], branchingLogic, exitCondition, abTestSuggestions, benchmarks. Triggered by drip/nurture/onboarding/re-engagement/win-back/launch language. Supervisor delegates to drafter for these. |
| `create_campaign_plan` | **Campaign Planner** | Produces `campaign-plan` artifact (title, summary, itemCount, goal, audience, timeline, channels) — usually paired with `open_workspace("planner")` |
| `create_seo_audit` | **SEO Auditor** | Produces `seo_audit` artifact — url, auditType, overallAssessment (strong_foundation/needs_work/critical_issues), executiveSummary, keywords[], onPageIssues[], contentGaps[], technicalChecks[], competitors[]/competitorNames[], quickWins[], strategicInvestments[]. Replaces the legacy markdown dump. Rendered by `SeoAuditCard` in [chat-ui.jsx](app/chat-ui.jsx) with one collapsible section per table; "Open in SEO Studio" action dispatches `open_seostudio` → `openWorkspace("seo")`. Paired with `open_workspace("seo")`. |
| `create_media_plan` | **Media Planner** | Produces `media_plan` artifact — title, summary, goal, audience, timeline, currency (default USD), totalBudgetMonthly, dataSource (tenant_analytics/benchmarks_only/mixed), channels[] (priority, monthlySpend, pctOfTotal, format, targetCAC, cacConfidence measured/estimated, cacSource, expectedConversions, rationale), excluded[], risks[], assumptions[]. Channel monthlySpend values must sum to totalBudgetMonthly; pctOfTotal must sum to 100. Specialist reads the tenant's latest `analytics_insights` row (same fetch path as Analyst) so CAC numbers can be anchored to real data when available. Rendered by `MediaPlanCard` in [chat-ui.jsx](app/chat-ui.jsx). PM-validated. |
| `web_search` (Anthropic server tool, `web_search_20250305`) | **SEO Auditor** | Anthropic-executed web search. Capped at `max_uses: 10` per audit. Returns `server_tool_use` + `web_search_tool_result` blocks inline — we don't execute or post results back; our `tool_use` filter in `runToolLoop` naturally ignores server-tool blocks. Defined as `WEB_SEARCH_TOOL` constant in [api/chat.js](api/chat.js). |

---

## Connector system

### Connector catalog (`seed.jsx` is the source of truth)

The canonical connector list (now 54 connectors — Luma AI and AudioStack removed 2026-05-24) lives in `SEED.connectorCatalog` in [seed.jsx](app/seed.jsx). Every entry has:

```js
{
  id,         // FlowOS-stable slug, used as the key everywhere
  name,       // display name
  category,   // canonical category (Paid Search / Paid Audio / Paid Social / Organic Social / Email Marketing / SMS Marketing / Email Verification / SEO & Search / E-commerce / A/B Testing / AI Video / Image / AI Audio / Voice / Analytics / CRM & Marketing Ops)
  group,      // pill-filter bucket: "Social" | "Ads" | "Email" | "SMS" | "Commerce" | "Analytics" | "Creative AI"
  desc,       // short description — tooltip + setup modal
  auth,       // "OAuth" | "API key" | "Manual" — drives Connect-modal fork (paragraph vs. input vs. handoff explanation)
  provider,   // "composio" | "zernio" | "direct" — drives the initiate path (provider-agnostic surface)
              // "pipedream" is REMOVED — all Pipedream connectors migrated 2026-05-24
  slug,       // Simple Icons CDN slug, or null
  domain,     // Google S2 favicon fallback host (always set)
}
```

`ConnectorIcon` in [workspaces4.jsx](app/workspaces4.jsx) resolves logos in three stages: Simple Icons CDN → Google S2 favicon → deterministic LetterMark fallback (no logo asset needed in-repo).

When adding a new connector, update **all** of these:

1. `seed.jsx` — catalog row (above shape) + `connectorState` default + Erickson's `brandConnectorStates.erickson`
2. `agents.jsx` — `CONNECTOR_LABELS` display name map
3. `channel-strategy.jsx` — `connectedSet` id→display-name map if it's a publishing channel
4. `api/brand-import.js` — `CONNECTOR_IDS` array (Claude can recommend these)
5. `store.jsx` — `channelRules` if it's a publishing channel that users approve via AutonomySettings

### Setup flow (Connect modal → popup → polling, or API-key direct)

The connect surface in [workspaces4.jsx](app/workspaces4.jsx) is provider-agnostic — the same Connect modal serves Composio, Pipedream, and Direct API connectors:

1. Click an unconnected tile → opens the dumb Connect modal (logo + one paragraph + one button). API-key connectors additionally surface a `<password>` input.
2. On submit, the flow forks by `connector.auth`:
   - **OAuth** → POST `/api/<provider>` `initiate_connection` with `redirectUri`; `window.open(redirectUrl, ...)`; tile flips amber.
   - **API key (Composio)** → POST `/api/composio` `initiate_connection` with `apiKey`; Composio creates a `use_custom_auth` auth_config + connected_account synchronously. No popup. Tile flips green on success.
   - **API key (direct)** → POST `/api/<id>` `initiate_connection` with the credential bag; the route validates against the provider's REST API and persists into `connector_credentials`.
   - **Manual** → no backend call. Modal explains the creative-handoff workflow and the button flips the local tile to "in use". Used today for Spotify Ads (no public API).
3. OAuth popup behaviour: closes immediately on flow start; tile shows amber "Connecting…". Popup blocked → falls back to `window.location.href` + legacy `?composio_connected=` URL-param hydration.
4. Polling: every 1.5s the host posts `connection_status` to verify. On success → write to Supabase `channels`, dispatch `setConnector`, tile flips green. 3-minute timeout; popup-closed → short grace then cancel.
5. The OAuth popup lands on [oauth-callback.html](oauth-callback.html) (static, served at site root) which `postMessage`s `{ type: "flowos_oauth_connected", app }` to the opener as a fast-path then self-closes after 1.5s. Polling is the redundant fallback.
6. Click a Connected tile → `ManageConnectorModal` (status + Read/Write/Admin permission toggles + Re-sync + Disconnect). Permissions live on `state.connectors[id].permissions = { read, write, admin }` (default `{true,true,false}`); persisted to client state only — server-side enforcement is a follow-up.

### Zernio integration state (2026-05-24 — new)

[api/zernio.js](api/zernio.js) handles all 15 social platforms via Zernio's OAuth-as-a-service. Auth: `ZERNIO_API_KEY` + `X-External-User-ID: {tenantId}` per call. Zernio manages per-user OAuth tokens internally.

| Scope | Zernio slugs | FlowOS IDs |
|---|---|---|
| **Organic Social** | facebook, instagram, linkedin, tiktok, pinterest, youtube, twitter, reddit, bluesky, threads, googlebusiness, whatsapp, telegram, snapchat, discord | fb, ig, li, tt, pn, yt, x, gbusiness (+ full names pass through) |
| **Paid Social** | metaads, linkedinads, tiktokads, xads, pinterestads | metaads, liads, ttads, xads, pinads |
| **Paid Search** | googleads | googleads |

FlowOS IDs resolved to Zernio slugs in `PLATFORM_ID_MAP` (zernio.js): `x→twitter`, `gbusiness→googlebusiness`, `liads→linkedinads`, `ttads→tiktokads`, `pinads→pinterestads`. `metaads` and `xads` match in both.

Multi-tenancy: each tenant gets one Zernio profile (created on first connect via `POST /v1/profiles`, stored in `connector_credentials(user_id, platform='zernio_profile')`). The `profileId` is passed as a query param to `GET /v1/connect/{platform}?profileId=...`. Zernio account IDs (`_id` from `GET /v1/accounts`) are stored in `channels.composio_connection_id` and loaded automatically for publish calls.

`googleads` uses Zernio for OAuth (`googleads` slug). Connection flow goes through `api/zernio.js`; campaign actions go through `api/google-ads.js` (Zernio-backed since 2026-05-24).

Platform routes (`/api/linkedin` etc.) are thin proxies — they auth-check, then forward to `/api/zernio` with `platform` set.

### Composio integration state (non-social only)

[api/composio.js](api/composio.js) handles OAuth and API-key flows for **non-social** toolkits only. Social platforms migrated to Zernio 2026-05-24.

| Mode | Works for |
|---|---|
| **OAuth (Composio managed)** | ga4, gsc, hubspot, salesforce, mailchimp |
| **API key (Composio custom auth)** | klaviyo (+ klaviyo_sms), ahrefs, moz, elevenlabs, heygen |
| **OAuth (needs custom app in Composio dashboard)** | shopify |

`/api/composio` debug actions: `list_toolkits`, `verify_app`. `COMPOSIO_SOCIAL_SLUGS` in [api/chat.js](api/chat.js) excludes social toolkits from the tool-fetch for the Claude prompt.

### Pipedream integration state (verified against live api.pipedream.com)

**Pipedream REMOVED (2026-05-24).** [api/pipedream.js](api/pipedream.js) is now a 410 tombstone. All connectors formerly on Pipedream have migrated:
- `pn`, `pinads` (Pinterest) → Zernio (`provider: "zernio"`)
- `sendgrid` → Direct (`/api/sendgrid.js`)
- `twilio` → Direct (`/api/twilio.js`)
- `runware` → Direct (`/api/runware.js`)

Pipedream env vars (`PIPEDREAM_PROJECT_ID`, `PIPEDREAM_CLIENT_ID`, `PIPEDREAM_CLIENT_SECRET`, `PIPEDREAM_ENVIRONMENT`) are no longer read at runtime.

`/api/pipedream` debug actions: `list_apps` (3000 apps available), `verify_app` (per-id check). Regression-check the APP_MAP against live Pipedream:

```bash
PIPEDREAM_PROJECT_ID=<id> PIPEDREAM_CLIENT_ID=<id> PIPEDREAM_CLIENT_SECRET=<secret> \
  node scripts/verify-pipedream.mjs
```

WordPress was originally on Pipedream per the canonical doc but isn't in Pipedream's actual catalog → reclassified to `provider: "direct"` (WordPress Application Passwords or REST OAuth, wired in its own follow-up).

### Direct-API integration state

Per-tenant API-key connectors that don't go through Composio or Pipedream live behind their own `/api/<provider>` routes and share persistence via `api/lib/directCredentials.js` (writes to `public.connector_credentials`, mirrored to `channels` for the tile state). The frontend route table is `DIRECT_API_ROUTES` in [workspaces4.jsx](app/workspaces4.jsx); connector ids not in that map fall through to a local setTimeout simulation.

| FlowOS id | Route | Validation endpoint | State |
|---|---|---|---|
| `replicate`  | `/api/replicate`  | `GET /v1/account`                           | ✓ |
| `higgsfield` | `/api/higgsfield` | `GET /models`                               | ✓ |
| `optimizely` | `/api/optimizely` | `GET /v2/projects` (Bearer PAT)             | ✓ |
| `wordpress`  | `/api/wordpress`  | `GET <siteUrl>/wp-json/wp/v2/users/me?context=edit` (Basic Auth — Application Password). 3-input credential: `{siteUrl, username, appPassword}` stored as a JSON blob in `secret_value`. | ✓ |
| `spotifyads` | — (none) | Manual handoff — `auth: "Manual"` in seed.jsx. Spotify Ad Studio has no public API, and the partner-only Marketing API requires a signed agreement. FlowOS owns the creative (script via Claude, audio via ElevenLabs, video if needed via Higgsfield); the user uploads manually to adstudio.spotify.com. Connect flow flips the tile to "in use" via `actions.setConnector` without any backend call. No credential stored. | ✓ (manual) |

**Dropped from catalog 2026-05-24**: Luma AI (removed — no agent workflows, no direct API usage), AudioStack (removed — same). API routes `/api/luma` and `/api/audiostack` remain in the repo as tombstones but are no longer reachable from the frontend.

**Dropped from catalog 2026-05-18**: VWO, AB Tasty, Loops.so (scope cut — Optimizely covers A/B Testing alone). MailerLite, Moosend, ActiveCampaign, Hunter (scope cut — Klaviyo + Mailchimp + SendGrid cover email; lifecycle email use case is satisfied). Attentive (scope cut — Klaviyo SMS is sufficient for now; Twilio retained for transactional/dev-side messaging only). Microsoft Ads (scope cut — not a priority channel; Bing/Audience Network spend not material for the brands in scope). To restore any of these: row in `seed.jsx connectorCatalog` + default `connectorState` + `brandConnectorStates.erickson`, entry in `agents.jsx CONNECTOR_LABELS`, id in `api/brand-import.js CONNECTOR_IDS`, slug in `api/composio.js` or `api/pipedream.js` APP_MAP (+ matching verify script), and (for direct API-key ones) `/api/<id>.js` + a row in `DIRECT_API_ROUTES`. **Bringing back a Direct OAuth connector requires rebuilding the OAuth scaffolding that was removed alongside Microsoft Ads** — `saveOAuthCredential` / `loadOAuthCredential` / `signOAuthState` / `verifyOAuthState` helpers in `directCredentials.js`, a `DIRECT_OAUTH_ROUTES` map + handleConnectSubmit fork in `workspaces4.jsx`, and `?direct_connected=` / `?ok=0&error=` handling in `oauth-callback.html`. PR #26 has the reference implementation. Microsoft Ads also had an agent block in `agents.jsx`, a channel definition in `channel-strategy.jsx`, a channelRules row in `store.jsx`, and a section in `full-mapping.md` — all removed.

All API-key routes follow the same shape: `action=initiate_connection` validates the supplied credential against the provider's REST API, persists into `connector_credentials`, and upserts a `channels` row with `status=connected`. `action=disconnect` deletes the credential and flips the channels row. Downstream API routes (e.g. `/api/generate`) can read the per-tenant key with `loadCredential({ tenantId, platform })` and fall back to the global env-var key if absent.

**Manual / creative-handoff connectors** (`auth: "Manual"` in seed.jsx) — for channels with no public API. Today only Spotify Ads. Click "Connect" → modal explains that FlowOS owns the creative + the user uploads manually → "Mark as in use" button flips `state.connectors[id].connected = true` with `note: "Manual upload · creative handoff"`. No backend call, no credential row. Disconnect just flips the local state back. Adding more Manual connectors requires no API code; just a catalog row + brand-import inclusion if the agent should know to recommend the channel.

WordPress is the one connector whose credential isn't a single string — `secret_value` is a JSON blob `{ siteUrl, username, appPassword }`; downstream callers must `JSON.parse(secret)` and base64-encode `${username}:${appPassword}` for the `Authorization: Basic …` header. Surfaced in the Connect modal via the `DIRECT_EXTRA_FIELDS` map in [workspaces4.jsx](app/workspaces4.jsx) — any future multi-input direct connector can add an entry there instead of forking the modal.

---

## API routes (Vercel Edge Functions)

All in `/api/`. All use `export const config = { runtime: "edge" }`.

| Route | Purpose |
|---|---|
| `POST /api/chat` | Anthropic proxy + Composio tool execution. Takes `{ messages, specialist, tenantId, brand }`. |
| `POST /api/brand-import` | Scrapes URL via Jina AI, sends to Claude, upserts to Supabase `brands` table. |
| `POST /api/analytics-ingest` | Fetches analytics from connected platforms via Composio, stores snapshots. |
| `POST /api/generate` | Image/video generation via Runware, Replicate, HeyGen, Higgsfield, etc. Provider selection: if tenant has a Replicate key in connector_credentials it wins; otherwise uses the explicit `provider` param. Writes to `generation_usage` on every job (fire-and-forget). |
| `POST /api/zernio` | **Zernio social publishing** — all 15 social platforms via a single OAuth-as-a-service provider. Actions: `initiate_connection`, `connection_status`, `disconnect`, `publish_now`, `schedule_post`, `get_analytics`, `get_dms`, `get_comments`, `boost_post`, `resolve_authors`. Dual-auth for `publish_now` / `schedule_post` (user JWT or cron). Env: `ZERNIO_API_KEY`. |
| `POST /api/linkedin` | LinkedIn posting — thin proxy to `/api/zernio` with `platform: "linkedin"`. Actions: `resolve_author` → `resolve_authors`, `publish_now`. |
| `POST /api/facebook` | Facebook posting — thin proxy to `/api/zernio` with `platform: "facebook"`. Actions: `resolve_pages` → `resolve_authors`, `publish_now`. |
| `POST /api/x` | X posting — thin proxy to `/api/zernio` with `platform: "x"`. Action: `publish_now` (enforces ≤280 chars). |
| `POST /api/instagram` | Instagram posting — thin proxy to `/api/zernio` with `platform: "instagram"`. Actions: `resolve_accounts` → `resolve_authors`, `publish_now`. |
| `POST /api/reddit` | Reddit posting — thin proxy to `/api/zernio` with `platform: "reddit"`. Actions: `search_subreddits` (stub → empty), `publish_now`. |
| `POST /api/tiktok` | TikTok posting — thin proxy to `/api/zernio`. Action: `publish_now`. |
| `POST /api/pinterest` | Pinterest posting — thin proxy to `/api/zernio`. Action: `publish_now`. |
| `POST /api/threads` | Threads posting — thin proxy to `/api/zernio`. Action: `publish_now`. |
| `POST /api/bluesky` | Bluesky posting — thin proxy to `/api/zernio`. Action: `publish_now`. |
| `POST /api/youtube` | YouTube posting — thin proxy to `/api/zernio`. Action: `publish_now`. |
| `POST /api/klaviyo` | Klaviyo push via Composio. Actions: `create_draft_campaign` (email — template + campaign + assign), `create_draft_sms` (SMS — single campaign with inline message body, ≤160 chars, no template), `list_audiences`. Audience resolution shared (fuzzy name match → fallback to largest list). Writes land in `state.outbound.{emails,sms}` and surface in EmailStudio / SmsCenter `ChatDraftsToKlaviyo*` strips. |
| `GET/POST/PATCH /api/proactive-emails` | Flavor #1 (Proactive) for email. POST reads latest `analytics_insights` for tenant, classifies `recommended_actions` into 5 rules (R1 win-back · R2 replenish · R3 rescue · R4 cart aging · R5 VIP quiet, max 2/run), Claude-generates subject/preheader/body using brand voice, persists to `proactive_emails`. Idempotent by `(tenant, rule, source_insight_id)`. Demo fallback emits 1 seeded draft if no insights row exists. GET hydrates `state.outbound.proactiveEmails`. PATCH updates status/Klaviyo IDs after client push. |
| `GET/POST/PATCH /api/proactive-sms` | Flavor #1 (Proactive) for SMS. POST reads latest `analytics_insights`, classifies into 4 rules (S1 win-back · S2 replenish · S3 cart-recovery · S4 VIP, max 2/run), Claude-generates body ≤160 chars, persists to `proactive_sms`. Idempotent by `(tenant, rule, source_insight_id)`. Demo fallback (S1 win-back) when no insights row. GET hydrates `state.outbound.proactiveSms`. PATCH updates status/Klaviyo IDs. Auth: `requireAuthOrCron`. |
| `POST /api/scheduled-posts` | Platform-agnostic schedule queue. Actions: `create` (writes a `scheduled_posts` row with snapshot payload + UTC fire_at), `list` (returns tenant's open rows + last-7-day published for `PublishingQueue` hydration), `cancel` (flips `pending` → `cancelled`). Frontend writes here from `handleSchedule` in `workspaces3.jsx`. |
| `GET  /api/cron/daily-analytics` | Vercel Cron (06:00 UTC) — calls analytics-ingest for all tenants. |
| `GET  /api/cron/proactive-emails` | Vercel Cron (07:30 UTC) — iterates tenants and POSTs to /api/proactive-emails. |
| `GET  /api/cron/proactive-sms` | Vercel Cron (08:00 UTC) — iterates tenants and POSTs to /api/proactive-sms. 30 min after proactive-emails. |
| `GET  /api/cron/fire-scheduled` | Vercel Cron (`* * * * *` — **requires Pro** for guaranteed 1-min execution; Hobby cron schedules will be rejected at deploy). Calls Supabase RPC `claim_due_scheduled_posts(20)` which atomically picks due `pending` rows via `FOR UPDATE SKIP LOCKED`, transitions them to `publishing`, then POSTs `${origin}/api/<platform>` with the row's snapshot payload. PATCHes the row to `published`/`failed`. Idempotent by construction — same row can never be claimed twice concurrently. |
| `POST /api/google-ads` | **Zernio-backed** Google Ads wrapper (migrated from Composio 2026-05-24). Actions: `list_customer_ids`, `list_campaigns`, `create_campaign`, `update_budget`, `enable_campaign`, `pause_campaign`, `keyword_ideas`, `campaign_detail`, `generate_copy`. Frontend contract unchanged (`{ ok, data }`). Uses `ZERNIO_API_KEY`; resolves Zernio `accountId` via the tenant's Zernio profile. Pass `customerId` (Google Ads account number) in params; if omitted, uses the first connected account. |
| `POST /api/replicate` `POST /api/higgsfield` | Direct-API connector routes (provider: "direct" in seed.jsx). Actions: `initiate_connection` (validates apiKey against the provider's REST API, persists to `connector_credentials`, flips `channels` to connected), `disconnect`. Shared persistence helper in [api/lib/directCredentials.js](api/lib/directCredentials.js). `/api/luma` and `/api/audiostack` exist as tombstones (connectors removed from catalog 2026-05-24). |
| `GET/POST /api/google-ads-auth` | **REMOVED — 410 Gone tombstone.** Returns `{ error: "Google Ads OAuth has moved to Composio…", code: "GONE_USE_COMPOSIO" }`. Connect flow now goes through `/api/composio` like every other OAuth connector. The old `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` env vars are no longer read at runtime. |

### Auth pattern (every /api/* handler)

All auth helpers live in [api/lib/auth.js](api/lib/auth.js). Each returns either a `Response` (failure — caller `return`s it) or `{ tenantId, claims, ... }` on success. tenantId is **always** the verified JWT sub — never trusted from the request body or query.

```js
import { requireAuth, requireCron, requireAuthOrCron } from "./lib/auth.js";

// User-only endpoint (chat, brand-import, generate, klaviyo, scheduled-posts,
// google-ads, composio, pipedream, the four active Direct-API connector routes —
// replicate / higgsfield / optimizely / wordpress — and
// GET on proactive-* endpoints):
const auth = await requireAuth(req);
if (auth instanceof Response) return auth;
const tenantId = auth.tenantId;
// For action-dispatch endpoints, override body.tenantId so handlers can't be
// tricked by a client-supplied value:
//   body = { ...body, tenantId: auth.tenantId };

// Cron-only endpoint (api/cron/*):
const cronAuth = requireCron(req);   // fails closed if CRON_SECRET unset
if (cronAuth instanceof Response) return cronAuth;

// Dual-auth — user JWT OR cron secret (analytics-ingest, proactive-drafts/
// emails POST, and the five platform handlers linkedin/facebook/x/instagram/
// reddit). For the cron path the body MUST carry the tenantId — for
// scheduled posts that's stamped at queue time in /api/scheduled-posts so
// the cron can't be tricked into acting on a tenantId of an attacker's
// choosing.
const { tenantId: bodyTenantId } = body;
const auth = await requireAuthOrCron(req, bodyTenantId);
if (auth instanceof Response) return auth;
const tenantId = auth.tenantId;
```

### OAuth state (google-ads-auth)

The OAuth callback can't carry a user JWT (Google performs the redirect). Instead the `connect` step (requireAuth + tenantId from JWT) HMAC-signs `{tenantId, nonce, exp}` with `OAUTH_STATE_SECRET` and puts the signed blob in the OAuth `state` param. The callback verifies the HMAC and reads tenantId from the *signed* payload, never from the raw URL. State has a 10-minute TTL.

### Dev seed bypass JWT

`?seed=mveda` / `?seed=erickson` in [app/chat-app.jsx](app/chat-app.jsx) calls `/api/dev/mint-token` to obtain a short-lived (1h) JWT signed with `SUPABASE_JWT_SECRET`. The endpoint is hard-gated on `VERCEL_ENV !== "production"` (404s in prod). Sub is a deterministic UUID per seed (so `auth.uid()::text` works in RLS policies). Token is held in `window.flowAuth` and used by `apiFetch()` for every /api/* call.

### Frontend fetch helper

`window.apiFetch(input, init)` — defined in [app/supabase.jsx](app/supabase.jsx) — auto-attaches the Authorization header to every /api/* call. Plain `fetch` is reserved for `/api/dev/mint-token` (the bootstrap that mints the token). Direct Supabase REST reads in [app/insights.jsx](app/insights.jsx) attach the user JWT as `Authorization: Bearer ${access_token}` while keeping the anon key as `apikey` — RLS in [db/migrations/007_core_schema_and_rls.sql](db/migrations/007_core_schema_and_rls.sql) does the row filtering.

### Required env vars added by this work

```
SUPABASE_JWT_SECRET   — verifies user JWTs in requireAuth (Supabase project settings)
OAUTH_STATE_SECRET    — HMAC for google-ads-auth OAuth state (any high-entropy string)
CRON_SECRET           — already required; now fail-closed (no longer optional)
```

### Supabase tables:

All public-schema tables have RLS enabled (see [db/migrations/007_core_schema_and_rls.sql](db/migrations/007_core_schema_and_rls.sql)). Service-role (server-side) writes bypass RLS; the anon key + user JWT path is row-filtered by `tenant_id = auth.uid()::text` (or `user_id = auth.uid()::text` for the legacy-named tables).

- `brands` — brand profiles, one per tenant. Primary key: `user_id` (text). Columns include `voice` jsonb (`{tone, personality, bannedPhrases, attributes, antiAttributes}`), `values` jsonb, `claims` jsonb, `prohibited_topics` jsonb, `messaging` jsonb (`{valuePropositions}`), `terminology` jsonb (`{approved, prohibited}`), `palette` / `palette_vars`, plus the full Claude analysis blob in `brand_analysis`. The `messaging` and `terminology` columns power `buildBrandVoiceBlock` in [api/chat.js](api/chat.js) — added 2026-05-19 (see [supabase/migrations/2026-05-19-brand-voice-fields.sql](supabase/migrations/2026-05-19-brand-voice-fields.sql)).
- `channels` — per-tenant connected platform records. `(user_id, platform)` unique. Stores `composio_connection_id`, `account_handle`, `followers_count`, `status`.
- `posts` — per-tenant social-post drafts and history. Written by Organic Social Studio.
- `analytics_snapshots` — raw per-channel metrics. Keys: `tenant_id`, `channel`, `period`.
- `analytics_insights` — Claude-generated summaries. Keys: `tenant_id`, `period`.
- `agent_overrides` — custom system prompts per agent per tenant.
- `google_ads_tokens` — **DEPRECATED** (2026-05-17 Composio cutover). No longer read or written by runtime. Safe to drop once any reconnecting tenant has completed the new Composio flow. Original schema: `tenant_id` (pk), `refresh_token`, `customer_id`, `all_customer_ids` (array).
- `scheduled_posts` — queued posts awaiting cron firing. Columns: `tenant_id` (text), `item_id` (calendar row id), `platform`, `fire_at` (timestamptz UTC), `payload` (jsonb — snapshot of `/api/<platform>` publish_now body, minus `action` and `tenantId`), `status` (`pending`|`publishing`|`published`|`failed`|`cancelled`), `attempts`, `last_error`, `fire_attempted_at`, `published_at`, `result` (jsonb response). Unique partial index on `item_id` where `status in (pending,publishing)` prevents double-queueing. `payload` is a snapshot, not a reference — editing the calendar row after Schedule does NOT change what fires; an explicit reschedule (cancel + new Schedule) is required.
- `connector_credentials` — per-tenant API keys for Direct-API connectors (Replicate, Higgsfield, Optimizely, WordPress; others as wired). Primary key `(user_id, platform)`. Columns: `secret_kind` (default `api_key`), `secret_value`, `validated_at`, `updated_at`. Service-role only (RLS enabled, no policies). Migration: [supabase/migrations/2026-05-18-connector-credentials.sql](supabase/migrations/2026-05-18-connector-credentials.sql).
- `proactive_drafts` — weekly social calendar drafts (status `pending`/`archived`). Keys: `tenant_id`, `status`.
- `proactive_emails` — analytics-triggered email drafts. Keys: `tenant_id`, `rule`, `source_insight_id`. Unique index enforces idempotency. Status: `proactive_draft` → `pushed` (via /api/klaviyo) | `dismissed`.
- `proactive_sms` — analytics-triggered SMS drafts (flavor #1 for SMS channel). Keys: `tenant_id`, `rule`, `source_insight_id`. 4 rules: S1_winback, S2_replenish, S3_cart, S4_vip. Status: `proactive_draft` → `pushed` | `dismissed`. Surfaced in SmsCenter as `ProactiveSmsDrafts`. Migration: [supabase/migrations/2026-05-23-proactive-sms.sql](supabase/migrations/2026-05-23-proactive-sms.sql).
- `generation_usage` — per-job AI generation cost tracking. Columns: `id uuid`, `tenant_id text`, `provider text` (runware/replicate/heygen/higgsfield/elevenlabs), `model text`, `job_type text` (image/video/voice/avatar), `job_id text`, `cost_estimate numeric`, `status text`, `created_at timestamptz`. Written by `/api/generate` on every generate_image and generate_video call (fire-and-forget, non-blocking). RLS: tenant can read own rows. Migration: [supabase/migrations/2026-05-24-generation-usage.sql](supabase/migrations/2026-05-24-generation-usage.sql).

---

## CSS / design system

### Custom properties (set on `:root` or `document.documentElement`):

```
--paper, --paper-2, --paper-3    backgrounds (lightest → darkest)
--ink, --ink-2                   primary text, secondary text
--muted, --muted-2               placeholder, disabled
--rule, --rule-strong            borders
--accent                         brand primary colour
--accent-ink                     darker accent for text
--accent-wash                    faint accent background tint
--font-sans, --font-serif, --font-mono
```

All colour values use **OKLCH** — `oklch(L% C H)`. Never use hex in component styles.

### Palette application:
`applyPalette(palette)` in `onboarding.jsx` iterates `palette.vars` and sets CSS custom properties on `document.documentElement`. Called on login if Supabase returns a saved palette.

### UI primitives (from `ui.jsx` and `ui2.jsx`):
`Btn`, `Chip`, `Icon`, `Dot`, `statusChip`, `Drawer`, `Input`, `Textarea`, `FormRow`, `Slider`, `Toggle`, `EditableList`, `NotifBell`

---

## Content creation pipeline

Three flavors, all active:

| Flavor | How triggered | Output | Status |
|---|---|---|---|
| **#2 Chat-to-create** | User types creation request in chat rail | `draft_created` artifact inline → "Send to queue" | ✅ built |
| **#3 Edit in Flow** | Click any draft in Publishing Queue | Controlled drawer: edit copy, image prompt, schedule | ✅ built |
| **#1 Proactive (social)** | `proactive-drafts` cron, daily 07:00 UTC | Drafts land in PublishingQueue Drafts strip | ✅ built |
| **#1 Proactive (email)** | `proactive-emails` cron, daily 07:30 UTC. Reads `analytics_insights.recommended_actions`, classifies into 5 rules, drafts via Claude in brand voice. | `state.outbound.proactiveEmails` → ProactiveEmailDrafts card in EmailStudio. User clicks **Approve & push** → `/api/klaviyo` `create_draft_campaign`. | ✅ built |

### Platform × content type → creation tool mapping:
See `full-mapping.md` in project root for the full 100+ row table.

Quick reference:
- **Text/copy** → Claude (`api/chat.js`)
- **Static images** → Runware (`api/generate.js` — `provider: 'runware'`, sync, returns `rawUrl` inline)
- **Video (Kling/Veo/Seedance/Wan)** → Runware (`api/generate.js` — `videoInference`, usually async, poll via `job_status`)
- **UGC/avatar video** → HeyGen (`api/generate.js`)
- **Cinematic video** → Higgsfield `cinematic_studio_3_0` or `kling3_0` (`api/generate.js`)
- **Voice-over** → ElevenLabs (`api/generate.js`)

### `/api/generate` — provider contract

Adapters in `api/lib/providerRouter.js` return `{ providerJobId, status?, rawUrl?, thumbnailUrl? }`.
When `status` is `completed` or `failed_content_policy`, `handleGenerateImage` /
`handleGenerateVideo` persist the row terminal on first write (with
`raw_url`, `thumbnail_url`, `completed_at`) — no polling needed for sync
providers like Runware image. Async paths return `status: 'pending'`; clients
poll via `action: 'job_status'`.

### Custom scene strings in `buildPrompt`

`api/lib/assetPrompts.js` `resolveScene` checks `intent.scene` then
`intent.extra.scene` before falling back to the library / brand override.
Chat-to-create passes the LLM's imagePrompt through `promptIntent.extra.scene`
so the user's scene description survives the prompt assembly while the
format-context / preservation / lighting / camera / negatives blocks still wrap it.

---

## Publishing Queue data shape

`state.calendar` contains all items regardless of status. Filter by status for display:

```js
const scheduled = state.calendar.filter(c =>
  ["approved", "scheduled", "review", "policy", "paused"].includes(c.status)
);
const drafts = state.calendar.filter(c => c.status === "draft");
```

Chat-created drafts have `fromChat: true`, `platform` (lowercase slug), `kind` (content type), `body` (full copy), `imagePrompt`.
Planner-created items have `channel` (display name), `tone`, `campaign`, `day` (0–6 = Mon–Sun).

---

## Environment variables

```
ANTHROPIC_API_KEY        Claude API — required for live AI
ANTHROPIC_MODEL          Main Claude model (default: claude-opus-4-5) — used by chat, insights, drafts, brand-import
ANTHROPIC_MODEL_FAST     Fast Claude model (default: claude-haiku-4-5-20251001) — used by title gen, SMS drafts, Google Ads copy
SUPABASE_URL             Supabase project URL
SUPABASE_SERVICE_KEY     Supabase service role key (server-side only)
COMPOSIO_API_KEY2        Composio tool execution (non-social only: ads, analytics, CRM, email, SEO)
CRON_SECRET              Vercel cron auth — REQUIRED (fail-closed; see api/lib/auth.js)
SUPABASE_JWT_SECRET      Verifies user JWTs in requireAuth (Supabase project settings → JWT Secret)
OAUTH_STATE_SECRET       HMAC for google-ads-auth OAuth state — any high-entropy string
ZERNIO_API_KEY           Zernio social publishing — all 15 platforms (added 2026-05-24)
ZERNIO_WEBHOOK_SECRET    Zernio webhook HMAC verification (added 2026-05-24)
RUNWARE_API_KEY          Runware image + video generation (global fallback; per-tenant key takes priority)
HIGGSFIELD_API_KEY       Higgsfield video (cinematic_studio_3_0, kling3_0)
REPLICATE_API_KEY        Replicate ML models — global fallback; per-tenant key via connector_credentials
APP_ORIGIN               CORS allowlist origin (e.g. https://flowos.vercel.app) — defaults to * if unset
GOOGLE_ADS_DEVELOPER_TOKEN  DEPRECATED — no longer read (Composio cutover 2026-05-17)
GOOGLE_ADS_CLIENT_ID        DEPRECATED — no longer read (Composio cutover 2026-05-17)
GOOGLE_ADS_CLIENT_SECRET    DEPRECATED — no longer read (Composio cutover 2026-05-17)
PIPEDREAM_PROJECT_ID         REMOVED — Pipedream integration removed 2026-05-24
PIPEDREAM_CLIENT_ID          REMOVED
PIPEDREAM_CLIENT_SECRET      REMOVED
PIPEDREAM_ENVIRONMENT        REMOVED
```

Frontend uses the Supabase anon key baked into `supabase.jsx` (public — safe).

---

## Key anti-patterns — don't do these

- **Don't use bare `useState`** in workspace files — use the aliased version for that file
- **Don't `import` anything** in frontend `.jsx` files — no modules, globals only
- **Don't add `type="module"`** to script tags in `index.html` — breaks Babel standalone
- **Don't write new components in `chat-app.jsx`** — it's the shell only. Components belong in the appropriate workspace or UI file
- **Don't use hex colours in component styles** — use OKLCH or CSS custom properties
- **Don't forget the second tenant** (Erickson) when updating seed connector state
- **Don't call `actions.addDraft` from a new file** without confirming `useMvedaStore` is loaded before it in `index.html`

---

## Deployment

- **Git remote**: `github.com/kabirsingh-cmyk/flowOS` — `main` branch
- **Vercel**: auto-deploys on push to `main`. `outputDirectory: "."` (no build step).
- **Cron**: `/api/cron/daily-analytics` at `0 6 * * *` — requires Vercel Pro for guaranteed execution.

---

## Session protocol

### Start of session
1. Read `DAILY_BRIEF.md` first — it has today's health status and prioritised "build next" recommendations generated by Claude. If the file doesn't exist yet, read `SPRINT.md` instead.
2. Surface the brief's top recommendations to Kabir before asking what to work on.

### End of every session
1. **Update `SPRINT.md`**: move completed items to "Just shipped", update "Now" with what's actually in progress, mark any new bugs you found.
2. **Update `BACKLOG.md`**: flip `in-progress` → `done` for anything completed this session. Mark new bugs or tasks you discovered.
3. **Run the health check**: `node scripts/health-check.mjs` — fix any issues before ending.
4. **Update this file**: only if you added new workspace targets, connector IDs, artifact types, API routes, or hook aliases.

---

*Keep this file updated when you add new workspace targets, connector IDs, artifact types, or API routes.*
