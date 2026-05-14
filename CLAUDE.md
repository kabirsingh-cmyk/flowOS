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
  { id, platform, kind, title, body, imagePrompt, status, scheduledAt, day, channel, tone, campaign, fromChat, createdAt }
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
| `drafts` | Simple list preview → "Open all in canvas" |
| `metric` | Big number card |
| `strategy` | Channel mix bar chart |
| `campaign-plan` | Campaign summary → opens planner |
| `email` | Email preview → expand |
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
| `POST /api/social` | Post to social platforms via Composio. |
| `GET  /api/cron/daily-analytics` | Vercel Cron (06:00 UTC) — calls analytics-ingest for all tenants. |
| `POST /api/google-ads` | Google Ads API v18. Actions: `list_campaigns`, `create_campaign`, `update_budget`, `enable_campaign`, `pause_campaign`, `keyword_ideas`, `campaign_detail`, `generate_copy`. |
| `GET  /api/google-ads-auth?action=connect&tenantId=...` | Returns Google OAuth2 consent URL. |
| `GET  /api/google-ads-auth?code=...&state=tenantId` | OAuth callback — exchanges code, stores tokens in Supabase `google_ads_tokens`. |
| `POST /api/google-ads-auth` | Set active customer ID when user has multiple Google Ads accounts. |

### Auth pattern for cron:
```js
const cronSecret = process.env.CRON_SECRET;
if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
  return new Response("Unauthorized", { status: 401 });
}
```

### Supabase tables:
- `brands` — brand profiles, one per tenant. Primary key: `user_id`.
- `analytics_snapshots` — raw per-channel metrics. Keys: `tenant_id`, `channel`, `period`.
- `analytics_insights` — Claude-generated summaries. Keys: `tenant_id`, `period`.
- `agent_overrides` — custom system prompts per agent per tenant.
- `google_ads_tokens` — OAuth refresh tokens for Google Ads. Keys: `tenant_id`. Columns: `refresh_token`, `customer_id`, `all_customer_ids` (array).

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
| **#1 Proactive** | Scheduled / trend-triggered | Drafts auto-land in queue | ⬜ not built |

### Platform × content type → creation tool mapping:
See `full-mapping.md` in project root for the full 100+ row table.

Quick reference:
- **Text/copy** → Claude (`api/chat.js`)
- **Static images** → Runware (`api/generate.js`)
- **UGC/avatar video** → HeyGen (`api/generate.js`)
- **Cinematic video** → Runway or Luma (`api/generate.js`)
- **Voice-over** → ElevenLabs (`api/generate.js`)

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
CRON_SECRET              Vercel cron auth (optional on Hobby plan)
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
