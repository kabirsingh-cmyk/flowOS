# FlowOS — Claude Context

Read this at the start of every session. It replaces the need to re-discover the architecture by reading source files.

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
workspaces3.jsx   → exposes: PublishingQueue, InsightsCenter, InboxEscalation, AutonomySettings
workspaces4.jsx   → exposes: Connections, BrandImportModal, ConnectorIcon
chat-data.jsx     → exposes: SPECIALISTS, CHANNELS, BRIEFING, TEAM_THREAD, PERSONAL_HISTORY, SUGGESTIONS
chat-ui.jsx       → exposes: SpecialistAvatar, UserAvatar, ArtifactCard, Message, BriefingCard, Composer
channel-strategy.jsx → exposes: ChannelStrategyCanvas, computeChannelStrategy
features.jsx      → exposes: OrganicSocialStudio, SmsCenter, SeoStudio, AffiliateProgram, ...
studio.jsx        → exposes: StudioHub, EmailStudio, SearchStudio, SettingsHub
login.jsx         → exposes: LoginScreen
onboarding.jsx    → exposes: OnboardingWizard, applyPalette, BRAND_PALETTES
agents.jsx        → exposes: AgentsWorkspace
insights.jsx      → exposes: InsightsCenter (overrides workspaces3 version)
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

| File | useState | useMemo | useEffect | useRef | useReducer |
|---|---|---|---|---|---|
| `ui.jsx` | useState | useMemo | useEffect | useRef | — |
| `ui2.jsx` | useStateUI2 | — | useEffectUI2 | useRefUI2 | — |
| `store.jsx` | — | — | — | — | useReducerStore |
| `workspaces1.jsx` | useState1 | useMemo1 | useEffect1 | useRef1 | — |
| `workspaces2.jsx` | useState2 | useMemo2 | useEffect2 | — | — |
| `workspaces3.jsx` | useState3 | useMemo3 | useEffect3 | useRef3 | — |
| `workspaces4.jsx` | useState4 | useMemo4 | useEffect4 | useRef4 | — |
| `chat-app.jsx` | useStateApp | useMemoApp | useEffectApp | — | useReducerApp |
| `chat-ui.jsx` | useStateChat | useMemoChat | useEffectChat | useRefChat | — |
| `features.jsx` | useStateF | useMemoF | useEffectF | useRefF | — |
| `studio.jsx` | useStateS | — | — | — | — |
| `onboarding.jsx` | useStateOB | — | useEffectOB | useRefOB | — |
| `agents.jsx` | useStateA | — | useEffectA | — | — |
| `channel-strategy.jsx` | useStateCS | useMemoCS | useEffectCS | — | — |

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
state.calendar items shape:
  { id, platform, kind, title, body, imagePrompt, imageUrl, imageStatus,
    status, scheduledAt, scheduledDate, day, channel, tone, campaign, fromChat, createdAt,
    // After Schedule (publishable platform — row queued in scheduled_posts):
    scheduledPostId, fireAtUtc,
    // After publish (per platform — only the matching set is populated):
    publishStatus, publishError,
    linkedinPostId,  linkedinUrl,  linkedinAuthorUrn,
    facebookPostId,  facebookUrl,  facebookPageId,
    xPostId,         xUrl,
    instagramPostId, instagramUrl, instagramCreationId, instagramAccountId,
    redditPostId,    redditUrl,    redditSubreddit, redditTitle, redditImageAsLink }

  imageStatus: "none" | "pending" | "completed" | "failed" | "failed_content_policy"
    — set on QUEUE_ADD_DRAFT based on whether imagePrompt is present
    — patched via actions.updateItem(id, { imageUrl, imageStatus }) once
      /api/generate returns. Rendered as a 36×36 thumbnail in the queue
      Drafts strip and as a full preview in the draft drawer.
  actions.addDraft(platform, contentType, copy, imagePrompt, id?) — id is
    optional; pass one if you need to patch the row later (chat-to-create does).
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
| `drafts` | Simple list preview → "Open all in canvas" |
| `metric` | Big number card |
| `strategy` | Channel mix bar chart |
| `campaign-plan` | Campaign summary → opens planner |
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
| `delegate_to` | Supervisor | Routes to specialist |
| `open_workspace` | Supervisor | Opens a workspace panel |
| `show_drafts` | Supervisor | Opens drafts canvas |
| `show_metric` | Supervisor | Shows metric card |
| `create_draft` | **Drafter** | Produces `draft_created` artifact in chat |
| `create_email_draft` | **Drafter** | Produces `email_draft` artifact (subject/preheader/body) |
| `create_sms_draft` | **Drafter** | Produces `sms_draft` artifact (body ≤160, audienceHint, includeStopFooter) |

---

## Connector system

### Connector IDs (`seed.jsx` + `brand-import.js`)

When adding a new connector, update **all** of these:

1. `seed.jsx` — connector definition object `{ id, category, name, desc, auth, icon }` in the connectors array
2. `seed.jsx` — `connectorState` default status `{ connected, status, note, syncCount }`
3. `seed.jsx` — second tenant's connector state (Erickson)
4. `workspaces4.jsx` — `CONN_STYLE` color/letter map for the avatar badge
5. `agents.jsx` — `CONNECTOR_LABELS` display name map
6. `channel-strategy.jsx` — `connectedSet` id→name map
7. `api/brand-import.js` — `CONNECTOR_IDS` array (Claude can recommend these)
8. `store.jsx` — add to `channelRules` array if it's a publishing channel

### Connector categories (used in Settings → Connections grouping):
`Social`, `Email`, `SMS`, `Search Ads`, `Social Ads`, `Commerce`, `Analytics`, `SEO`, `Affiliate`, `Experimentation`, `Creative AI`, `MCP · Custom`

---

## API routes (Vercel Edge Functions)

All in `/api/`. All use `export const config = { runtime: "edge" }`.

| Route | Purpose |
|---|---|
| `POST /api/chat` | Anthropic proxy + Composio tool execution. Takes `{ messages, specialist, tenantId, brand }`. |
| `POST /api/brand-import` | Scrapes URL via Jina AI, sends to Claude, upserts to Supabase `brands` table. |
| `POST /api/analytics-ingest` | Fetches analytics from connected platforms via Composio, stores snapshots. |
| `POST /api/generate` | Image/video generation via Runware, HeyGen, Runway, etc. |
| `POST /api/linkedin` | LinkedIn organic posting via Composio. Actions: `resolve_author` (returns normalized `authors:[{urn,name,kind}]`, kind ∈ "person"\|"organization", caches into `state.connectors.li.meta.authors`), `publish_now` (authorUrn + text + optional imageUrl — uploads via `LINKEDIN_INITIALIZE_IMAGE_UPLOAD`, posts via `LINKEDIN_CREATE_LINKED_IN_POST`). Scheduling not yet wired — see `/BACKLOG.md`. |
| `POST /api/facebook` | Facebook Page posting via Composio. Actions: `resolve_pages` (`FACEBOOK_LIST_MANAGED_PAGES` → `authors:[{urn:pageId,kind:"page",extra:{igUserId?}}]`), `publish_now` (pageId + text + optional imageUrl — `FACEBOOK_CREATE_PHOTO_POST` for images, else `FACEBOOK_CREATE_POST`). Page tokens are injected transparently by Composio when `page_id` is supplied. |
| `POST /api/x` | X (Twitter) posting via Composio. Single authenticated user — no author picker. Action: `publish_now` (text ≤280 + optional imageUrl). Image flow: fetch bytes → `TWITTER_UPLOAD_MEDIA` (base64) → `TWITTER_CREATION_OF_A_POST` with `media_media_ids:[id]`. |
| `POST /api/instagram` | Instagram Business posting via Composio. Actions: `resolve_accounts` (thin wrapper over `FACEBOOK_LIST_MANAGED_PAGES` with `fields=...,instagram_business_account` — IG accounts are reachable only via linked FB Pages), `publish_now` (igUserId + caption ≤2200 + **required** imageUrl — two-step: `INSTAGRAM_POST_IG_USER_MEDIA` → `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH`). Personal IG accounts can't post via API; drawer surfaces a warn when `resolve_accounts` returns empty. |
| `POST /api/reddit` | Reddit posting via Composio. Actions: `search_subreddits` (`REDDIT_GET_SUBREDDITS_SEARCH` — typeahead, since Composio exposes no `mine/*` listing), `publish_now` (subreddit + title ≤300 + text ≤40000 + optional imageUrl). **Image gap**: `REDDIT_CREATE_REDDIT_POST` doesn't support `kind:image` — when imageUrl is supplied we fall back to `kind:link` with the hosted image URL and surface `imageAsLink:true` so the drawer toasts a warn. The drawer renders subreddit as a free-text input, not a dropdown. |
| `POST /api/klaviyo` | Klaviyo push via Composio. Actions: `create_draft_campaign` (email — template + campaign + assign), `create_draft_sms` (SMS — single campaign with inline message body, ≤160 chars, no template), `list_audiences`. Audience resolution shared (fuzzy name match → fallback to largest list). Writes land in `state.outbound.{emails,sms}` and surface in EmailStudio / SmsCenter `ChatDraftsToKlaviyo*` strips. |
| `GET/POST/PATCH /api/proactive-emails` | Flavor #1 (Proactive) for email. POST reads latest `analytics_insights` for tenant, classifies `recommended_actions` into 5 rules (R1 win-back · R2 replenish · R3 rescue · R4 cart aging · R5 VIP quiet, max 2/run), Claude-generates subject/preheader/body using brand voice, persists to `proactive_emails`. Idempotent by `(tenant, rule, source_insight_id)`. Demo fallback emits 1 seeded draft if no insights row exists. GET hydrates `state.outbound.proactiveEmails`. PATCH updates status/Klaviyo IDs after client push. |
| `POST /api/scheduled-posts` | Platform-agnostic schedule queue. Actions: `create` (writes a `scheduled_posts` row with snapshot payload + UTC fire_at), `list` (returns tenant's open rows + last-7-day published for `PublishingQueue` hydration), `cancel` (flips `pending` → `cancelled`). Frontend writes here from `handleSchedule` in `workspaces3.jsx`. |
| `GET  /api/cron/daily-analytics` | Vercel Cron (06:00 UTC) — calls analytics-ingest for all tenants. |
| `GET  /api/cron/proactive-emails` | Vercel Cron (07:30 UTC) — iterates tenants and POSTs to /api/proactive-emails. |
| `GET  /api/cron/fire-scheduled` | Vercel Cron (`* * * * *` — **requires Pro** for guaranteed 1-min execution; Hobby cron schedules will be rejected at deploy). Calls Supabase RPC `claim_due_scheduled_posts(20)` which atomically picks due `pending` rows via `FOR UPDATE SKIP LOCKED`, transitions them to `publishing`, then POSTs `${origin}/api/<platform>` with the row's snapshot payload. PATCHes the row to `published`/`failed`. Idempotent by construction — same row can never be claimed twice concurrently. |
| `POST /api/google-ads` | Google Ads API v18. Actions: `list_campaigns`, `create_campaign`, `update_budget`, `enable_campaign`, `pause_campaign`, `keyword_ideas`, `campaign_detail`, `generate_copy`. |
| `GET  /api/google-ads-auth?action=connect&tenantId=...` | Returns Google OAuth2 consent URL. |
| `GET  /api/google-ads-auth?code=...&state=tenantId` | OAuth callback — exchanges code, stores tokens in Supabase `google_ads_tokens`. |
| `POST /api/google-ads-auth` | Set active customer ID when user has multiple Google Ads accounts. |

### Auth pattern (every /api/* handler)

All auth helpers live in [api/lib/auth.js](api/lib/auth.js). Each returns either a `Response` (failure — caller `return`s it) or `{ tenantId, claims, ... }` on success. tenantId is **always** the verified JWT sub — never trusted from the request body or query.

```js
import { requireAuth, requireCron, requireAuthOrCron } from "./lib/auth.js";

// User-only endpoint (chat, brand-import, generate, klaviyo, scheduled-posts,
// google-ads, composio, GET on proactive-* endpoints):
const auth = await requireAuth(req);
if (auth instanceof Response) return auth;
const tenantId = auth.tenantId;

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

- `brands` — brand profiles, one per tenant. Primary key: `user_id` (text).
- `channels` — per-tenant connected platform records. `(user_id, platform)` unique. Stores `composio_connection_id`, `account_handle`, `followers_count`, `status`.
- `posts` — per-tenant social-post drafts and history. Written by Organic Social Studio.
- `analytics_snapshots` — raw per-channel metrics. Keys: `tenant_id`, `channel`, `period`.
- `analytics_insights` — Claude-generated summaries. Keys: `tenant_id`, `period`.
- `agent_overrides` — custom system prompts per agent per tenant.
- `google_ads_tokens` — OAuth refresh tokens for Google Ads. Keys: `tenant_id`. Columns: `refresh_token`, `customer_id`, `all_customer_ids` (array).
- `scheduled_posts` — queued posts awaiting cron firing. Columns: `tenant_id` (text), `item_id` (calendar row id), `platform`, `fire_at` (timestamptz UTC), `payload` (jsonb — snapshot of `/api/<platform>` publish_now body, minus `action` and `tenantId`), `status` (`pending`|`publishing`|`published`|`failed`|`cancelled`), `attempts`, `last_error`, `fire_attempted_at`, `published_at`, `result` (jsonb response). Unique partial index on `item_id` where `status in (pending,publishing)` prevents double-queueing. `payload` is a snapshot, not a reference — editing the calendar row after Schedule does NOT change what fires; an explicit reschedule (cancel + new Schedule) is required.
- `proactive_drafts` — weekly social calendar drafts (status `pending`/`archived`). Keys: `tenant_id`, `status`.
- `proactive_emails` — analytics-triggered email drafts. Keys: `tenant_id`, `rule`, `source_insight_id`. Unique index enforces idempotency. Status: `proactive_draft` → `pushed` (via /api/klaviyo) | `dismissed`.

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
SUPABASE_URL             Supabase project URL
SUPABASE_SERVICE_KEY     Supabase service role key (server-side only)
COMPOSIO_API_KEY2        Composio tool execution
CRON_SECRET              Vercel cron auth — REQUIRED (fail-closed; see api/lib/auth.js)
SUPABASE_JWT_SECRET      Verifies user JWTs in requireAuth (Supabase project settings → JWT Secret)
OAUTH_STATE_SECRET       HMAC for google-ads-auth OAuth state — any high-entropy string
RUNWARE_API_KEY          Runware image + video generation
HIGGSFIELD_API_KEY       Higgsfield video (cinematic_studio_3_0, kling3_0)
GOOGLE_ADS_DEVELOPER_TOKEN  Google Ads API Developer Token (from API Center in manager account)
GOOGLE_ADS_CLIENT_ID        Google OAuth2 Client ID (same as existing Google Cloud OAuth app)
GOOGLE_ADS_CLIENT_SECRET    Google OAuth2 Client Secret (same as above)
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

*Keep this file updated when you add new workspace targets, connector IDs, artifact types, or API routes.*
