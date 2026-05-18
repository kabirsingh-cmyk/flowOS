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

### Connector catalog (`seed.jsx` is the source of truth)

The canonical 49-connector list lives in `SEED.connectorCatalog` in [seed.jsx](app/seed.jsx) and is based on [docs/composio_marketing_connectors.md](docs/composio_marketing_connectors.md) (WooCommerce dropped post-verification — not in Pipedream's catalog and out of product scope). Every entry has:

```js
{
  id,         // FlowOS-stable slug, used as the key everywhere
  name,       // display name
  category,   // canonical category (Paid Search / Paid Audio / Paid Social / Organic Social / Email Marketing / SMS Marketing / Email Verification / SEO & Search / E-commerce / A/B Testing / AI Video / Image / AI Audio / Voice / Analytics / CRM & Marketing Ops)
  group,      // pill-filter bucket: "Social" | "Ads" | "Email & SMS" | "Commerce" | "Analytics & Ops" | "Creative AI"
  desc,       // short description — tooltip + setup modal
  auth,       // "OAuth" | "API key" — drives Connect-modal fork (paragraph vs. input)
  provider,   // "composio" | "pipedream" | "direct" — drives the initiate path (provider-agnostic surface)
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
   - **API key (direct)** → local `setTimeout` simulation for now (real per-provider validation routes are a follow-up).
3. OAuth popup behaviour: closes immediately on flow start; tile shows amber "Connecting…". Popup blocked → falls back to `window.location.href` + legacy `?composio_connected=` URL-param hydration.
4. Polling: every 1.5s the host posts `connection_status` to verify. On success → write to Supabase `channels`, dispatch `setConnector`, tile flips green. 3-minute timeout; popup-closed → short grace then cancel.
5. The OAuth popup lands on [oauth-callback.html](oauth-callback.html) (static, served at site root) which `postMessage`s `{ type: "flowos_oauth_connected", app }` to the opener as a fast-path then self-closes after 1.5s. Polling is the redundant fallback.
6. Click a Connected tile → `ManageConnectorModal` (status + Read/Write/Admin permission toggles + Re-sync + Disconnect). Permissions live on `state.connectors[id].permissions = { read, write, admin }` (default `{true,true,false}`); persisted to client state only — server-side enforcement is a follow-up.

### Composio integration state (verified against live backend.composio.dev)

[api/composio.js](api/composio.js) handles both OAuth and API-key flows. Field naming is inconsistent in Composio's API — `authScheme` is camelCase, everything else is snake_case.

| Mode | Composio shape | Works for |
|---|---|---|
| **OAuth** | `auth_config: { type: "use_composio_managed_auth" }` + connected_account with `callback_url` | 13 toolkits with Composio managed credentials: googleads, ga4, gsc, hubspot, salesforce, mailchimp, reddit, youtube, fb (+ metaads), ig, li (+ liads) |
| **API key** | `auth_config: { type: "use_custom_auth", authScheme: "API_KEY" }` + connected_account with `connection.data.apiKey` | 10 toolkits without managed credentials but supporting API-key auth: klaviyo (+ klaviyo_sms), ahrefs, moz, neuronwriter, neverbounce, kickbox, listclean, elevenlabs, heygen |
| **OAuth — needs custom app** | Same OAuth shape, but Composio has no default managed credentials → returns error code 306 | 5 toolkits where you must register your own OAuth app in the Composio dashboard: shopify, tiktok (tt + ttads), twitter (x + xads) |

Surface treatment of code 306: `/api/composio` returns a 409 with an actionable message — "configure a Composio auth_config for `<slug>` in the dashboard, or switch to direct provider."

`/api/composio` debug actions: `list_toolkits` (1041 slugs available), `verify_app` (per-id check). Use [scripts/verify-composio.mjs](scripts/verify-composio.mjs) to regression-check the full APP_MAP against live Composio:

```bash
COMPOSIO_API_KEY2=<key> node scripts/verify-composio.mjs
```

### Pipedream integration state (verified against live api.pipedream.com)

[api/pipedream.js](api/pipedream.js) handles Pipedream Connect — Pipedream's hosted OAuth + API-key product, equivalent to Composio's managed flow. Server-to-server auth uses the OAuth client_credentials grant for a 1-hour Bearer; per-user auth mints a short-lived **Connect Token** that the frontend opens in a popup at the `connect_link_url`.

Pipedream's API has one important quirk: the **`x-pd-environment` header** (values: `production` | `development`) is required on every `/connect/{project_id}/*` call. Body fields don't satisfy it.

| FlowOS id | Pipedream slug | Auth type | State |
|---|---|---|---|
| `pn`, `pinads` | `pinterest` | oauth | ✓ Connect token mints, popup opens Pipedream's hosted flow |
| `sendgrid` | `sendgrid` | keys | ✓ |
| `twilio` | `twilio` | keys | ✓ |
| `runware` | `runware` | keys | ✓ |

Env vars (all required):
```
PIPEDREAM_PROJECT_ID     proj_XXXXXX  (Project → Connect → Configuration → Project ID)
PIPEDREAM_CLIENT_ID      Account settings → API → OAuth client
PIPEDREAM_CLIENT_SECRET  (rotate-only)
PIPEDREAM_ENVIRONMENT    "production" (default) | "development"
```

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
| `luma`       | `/api/luma`       | `GET /dream-machine/v1/generations?limit=1` | ✓ |
| `optimizely` | `/api/optimizely` | `GET /v2/projects` (Bearer PAT)             | ✓ |
| `audiostack` | `/api/audiostack` | `GET /organisation` (`x-api-key`; falls back to `/script?limit=1`) | ✓ |
| `wordpress`  | `/api/wordpress`  | `GET <siteUrl>/wp-json/wp/v2/users/me?context=edit` (Basic Auth — Application Password). 3-input credential: `{siteUrl, username, appPassword}` stored as a JSON blob in `secret_value`. | ✓ |
| `spotifyads` | — | — | **Skipped, latent consumer** — Spotify Ad Studio has no public OAuth flow today (partner-gated). Tile stays in catalog as an important channel; OAuth scaffolding (`saveOAuthCredential`, `signOAuthState`, `DIRECT_OAUTH_ROUTES`, `oauth-callback.html ?direct_connected=`) is retained so wiring is a one-route add when/if Spotify opens up. |

**Dropped from catalog 2026-05-18**: VWO, AB Tasty, Loops.so (scope cut — Optimizely covers A/B Testing alone). MailerLite, Moosend, ActiveCampaign, Hunter (scope cut — Klaviyo + Mailchimp + SendGrid cover email; lifecycle email use case is satisfied). Attentive (scope cut — Klaviyo SMS is sufficient for now; Twilio retained for transactional/dev-side messaging only). Microsoft Ads (scope cut — not a priority channel; Bing/Audience Network spend not material for the brands in scope). To restore any of these: row in `seed.jsx connectorCatalog` + default `connectorState` + `brandConnectorStates.erickson`, entry in `agents.jsx CONNECTOR_LABELS`, id in `api/brand-import.js CONNECTOR_IDS`, slug in `api/composio.js` or `api/pipedream.js` APP_MAP (+ matching verify script), and (for direct ones) `/api/<id>.js` + a row in `DIRECT_API_ROUTES` (+ `DIRECT_OAUTH_ROUTES` for OAuth + `/api/<id>-auth.js`). Microsoft Ads also had an agent block in `agents.jsx`, a channel definition in `channel-strategy.jsx`, a channelRules row in `store.jsx`, and a section in `full-mapping.md` — all removed.

All API-key routes follow the same shape: `action=initiate_connection` validates the supplied credential against the provider's REST API, persists into `connector_credentials`, and upserts a `channels` row with `status=connected`. `action=disconnect` deletes the credential and flips the channels row. Downstream API routes (e.g. `/api/generate`) can read the per-tenant key with `loadCredential({ tenantId, platform })` and fall back to the global env-var key if absent.

**Direct OAuth scaffolding** (latent — no live consumer as of 2026-05-18; retained for Spotify Ads if/when their partner program opens up). The pattern: `/api/<id>-auth.js` hosts a single GET endpoint with three modes — `?init=1&tenantId=…` mints the authorize URL, `?code=…&state=…` is the provider's callback (exchanges + persists, then 302-redirects to `/oauth-callback.html?direct_connected=<id>`), `?status=1&tenantId=…` is the polling check. State is HMAC-signed with `OAUTH_STATE_SECRET` (falls back to a SHA-256 of `SUPABASE_SERVICE_KEY` if unset) and expires after 10 minutes. Tokens are persisted with `secret_kind = "oauth_tokens"` as a JSON blob via `saveOAuthCredential`; downstream callers go through `loadOAuthCredential({ tenantId, platform, refresh })` which auto-refreshes when expiry is within 60s. `/api/<id>.js` carries the post-connection actions (`disconnect`, `refresh`). Frontend route maps: `DIRECT_OAUTH_ROUTES` (init/status URL — empty today) and `DIRECT_API_ROUTES` (disconnect URL — same connectors should appear in both when wiring a new Direct OAuth connector).

WordPress is the one connector whose credential isn't a single string — `secret_value` is a JSON blob `{ siteUrl, username, appPassword }`; downstream callers must `JSON.parse(secret)` and base64-encode `${username}:${appPassword}` for the `Authorization: Basic …` header. Surfaced in the Connect modal via the `DIRECT_EXTRA_FIELDS` map in [workspaces4.jsx](app/workspaces4.jsx) — any future multi-input direct connector can add an entry there instead of forking the modal.

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
| `POST /api/google-ads` | Composio-backed Google Ads wrapper. Actions: `list_customer_ids` (new — returns accessible MCC child accounts via `GOOGLEADS_LIST_ACCESSIBLE_CUSTOMERS`), `list_campaigns`, `create_campaign`, `update_budget`, `enable_campaign`, `pause_campaign`, `keyword_ideas`, `campaign_detail`, `generate_copy`. Frontend contract unchanged (`{ ok, data }`). Composio toolkit slug names live in the `TOOLS` constant at the top of the file. Pass `customerId` in params; if omitted, the user must pick one via `list_customer_ids` first. |
| `POST /api/replicate` `POST /api/higgsfield` `POST /api/luma` | Direct-API connector routes (provider: "direct" in seed.jsx). Actions: `initiate_connection` (validates apiKey against the provider's REST API, persists to `connector_credentials`, flips `channels` to connected), `disconnect`. Shared persistence helper in [api/lib/directCredentials.js](api/lib/directCredentials.js). |
| `GET/POST /api/google-ads-auth` | **REMOVED — 410 Gone tombstone.** Returns `{ error: "Google Ads OAuth has moved to Composio…", code: "GONE_USE_COMPOSIO" }`. Connect flow now goes through `/api/composio` like every other OAuth connector. The old `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` env vars are no longer read at runtime. |

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
- `google_ads_tokens` — **DEPRECATED** (2026-05-17 Composio cutover). No longer read or written by runtime. Safe to drop once any reconnecting tenant has completed the new Composio flow. Original schema: `tenant_id` (pk), `refresh_token`, `customer_id`, `all_customer_ids` (array).
- `scheduled_posts` — queued posts awaiting cron firing. Columns: `tenant_id` (text), `item_id` (calendar row id), `platform`, `fire_at` (timestamptz UTC), `payload` (jsonb — snapshot of `/api/<platform>` publish_now body, minus `action` and `tenantId`), `status` (`pending`|`publishing`|`published`|`failed`|`cancelled`), `attempts`, `last_error`, `fire_attempted_at`, `published_at`, `result` (jsonb response). Unique partial index on `item_id` where `status in (pending,publishing)` prevents double-queueing. `payload` is a snapshot, not a reference — editing the calendar row after Schedule does NOT change what fires; an explicit reschedule (cancel + new Schedule) is required.
- `connector_credentials` — per-tenant API keys for Direct-API connectors (Replicate, Higgsfield, Luma today; the other 9 Direct connectors as they're wired). Primary key `(user_id, platform)`. Columns: `secret_kind` (default `api_key`), `secret_value`, `validated_at`, `updated_at`. Service-role only (RLS enabled, no policies). Migration: [supabase/migrations/2026-05-18-connector-credentials.sql](supabase/migrations/2026-05-18-connector-credentials.sql).
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
OAUTH_STATE_SECRET       Optional HMAC secret for Direct OAuth state params (falls back to SHA-256 of SUPABASE_SERVICE_KEY if unset). Latent — no Direct OAuth connector currently consumes it.
GOOGLE_ADS_DEVELOPER_TOKEN  DEPRECATED — no longer read (Composio cutover 2026-05-17)
GOOGLE_ADS_CLIENT_ID        DEPRECATED — no longer read (Composio cutover 2026-05-17)
GOOGLE_ADS_CLIENT_SECRET    DEPRECATED — no longer read (Composio cutover 2026-05-17)
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
