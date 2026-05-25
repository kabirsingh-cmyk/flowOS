# FlowOS — Agent Instructions

This file is the shared entry point for AI assistants working in the FlowOS repository. Keep it project-specific and safe to publish. Do not put personal machine setup, private network details, credentials, tokens, or local-only workflow notes here.

## Project Overview

**FlowOS** is an AI marketing operating system for brands. It is a multi-tenant single-page application (SPA) that allows one logged-in brand at a time to create, publish, and measure marketing content across dozens of channels.

Production stack:

- **Frontend**: React 18 (UMD via CDN) + Babel standalone (runtime JSX compilation). No bundler. No modules.
- **Backend**: Vercel Edge Functions (Node.js runtime).
- **Database / Auth**: Supabase (PostgreSQL + JWT auth).
- **AI**: Anthropic Claude API.
- **Integrations**: Composio (tool execution), Pipedream (hosted OAuth / API keys), and direct API connectors.
- **Deployment**: Vercel (auto-deploy on push to `main`).

Two seed brands are baked in for local development: **MVEDA** (Ayurvedic skincare, DTC) and **Erickson Refrigeration** (B2B commercial HVAC).

## Read First

Before making changes, read:

1. `CLAUDE.md` — the canonical architecture reference. It replaces the need to re-discover the system by reading source files.
2. `SPRINT.md` — current sprint status and priorities.
3. `BACKLOG.md` — prioritized backlog with status flags.

For connector or integration work, also read:

- `docs/composio_marketing_connectors.md` — canonical 49-connector catalog reference.
- `full-mapping.md` — platform × content type → creation tool mapping.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend framework | React 18 (UMD, no build step) |
| JSX compilation | Babel standalone (browser runtime) |
| Styling | Custom CSS properties (OKLCH), no preprocessor |
| State management | Custom `useReducer` + `useMvedaStore()` (global) |
| Backend | Vercel Edge Functions (`export const config = { runtime: "edge" }`) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT, HS256) |
| AI / LLM | Anthropic Claude API |
| Integrations | Composio, Pipedream, Direct REST APIs |
| Testing | Node.js built-in test runner (unit / integration), Playwright (E2E) |
| Dev server | Python 3 (`server.py`, port 8765) |

## Build and Test Commands

```bash
# Install dependencies (only Playwright + Anthropic SDK)
npm install

# Build — static site, no actual build step
npm run build

# Run unit tests (Node built-in test runner)
npm run test:unit

# Run E2E tests (Playwright, auto-starts python3 server.py)
npm run test:e2e

# Run E2E with UI
npm run test:e2e:ui

# Run E2E headed
npm run test:e2e:headed

# Run all tests
npm test

# Start local dev server
python3 server.py

# Run health check (run before ending a session)
node scripts/health-check.mjs
```

## Code Organization

```
├── app/                    # Frontend React components (JSX, no modules)
│   ├── index.html          # Production entry point — script load order is the dependency graph
│   ├── supabase.jsx        # Supabase client + apiFetch helper
│   ├── seed.jsx            # Seed data, connector catalog, brand presets
│   ├── ui.jsx / ui2.jsx    # UI primitives (Btn, Icon, Chip, Drawer, Input, ...)
│   ├── store.jsx           # Global state (useMvedaStore) + reducer
│   ├── chat-app.jsx        # App shell, layout, routing, chat reducer
│   ├── chat-ui.jsx         # Chat components (Message, ArtifactCard, Composer, ...)
│   ├── chat-data.jsx       # Static chat data (specialists, channels, suggestions)
│   ├── ai.jsx              # sendAIMessage — AI pipeline wrapper
│   ├── workspaces1.jsx     # CommandCenter, BrandMemory
│   ├── workspaces2.jsx     # CampaignPlanner, ContentStudio
│   ├── workspaces3.jsx     # PublishingQueue, InboxEscalation, AutonomySettings
│   ├── workspaces4.jsx     # Connections, BrandImportModal, ConnectorIcon
│   ├── features.jsx        # Feature workspaces (OrganicSocialStudio, SmsCenter, SeoStudio, ...)
│   ├── studio.jsx          # StudioHub, EmailStudio, SearchStudio, SettingsHub
│   ├── login.jsx           # LoginScreen
│   ├── onboarding.jsx      # OnboardingWizard, palette application
│   ├── agents.jsx          # AgentsWorkspace
│   ├── insights.jsx        # InsightsCenter
│   └── channel-strategy.jsx# ChannelStrategyCanvas
├── api/                    # Vercel Edge Functions
│   ├── chat.js             # Anthropic proxy + Composio tool execution
│   ├── brand-import.js     # URL scraping → Claude → Supabase brands table
│   ├── generate.js         # Image/video generation router
│   ├── composio.js         # Composio OAuth + API-key connector flows
│   ├── pipedream.js        # Pipedream Connect flows
│   ├── google-ads.js       # Google Ads via Composio
│   ├── klaviyo.js          # Klaviyo email/SMS push
│   ├── linkedin.js         # LinkedIn organic posting
│   ├── facebook.js         # Facebook Page posting
│   ├── instagram.js        # Instagram Business posting
│   ├── x.js                # X (Twitter) posting
│   ├── reddit.js           # Reddit posting
│   ├── scheduled-posts.js  # Platform-agnostic schedule queue
│   ├── proactive-*.js      # Cron-triggered proactive draft/email/SMS generation
│   ├── cron/               # Vercel Cron handlers
│   ├── dev/                # Dev-only endpoints (token minting)
│   └── lib/                # Shared backend utilities
│       ├── auth.js         # JWT / Cron / OAuth state auth helpers
│       ├── supabase.js     # Supabase service-role client
│       ├── providerRouter.js # Image/video generation provider routing
│       ├── assetPrompts.js # Prompt assembly for asset generation
│       ├── directCredentials.js # Direct-API credential persistence
│       └── composio.js     # Composio API helpers
├── styles/                 # CSS tokens and global styles
├── tests/
│   ├── unit/               # Node.js built-in test runner
│   ├── integration/        # Node.js built-in test runner
│   └── e2e/                # Playwright tests
├── scripts/                # Utilities (health-check, backlog-engine, verify-*.mjs)
├── db/migrations/          # SQL schema migrations
└── supabase/migrations/    # Additional SQL migrations
```

## Development Conventions

### No build step / no modules

JSX is compiled in the browser by Babel standalone. There is no Webpack, Vite, or bundler.

- **Never use `import` / `export`** in frontend `.jsx` files.
- **Never add `type="module"`** to script tags in `index.html`.
- Components communicate via `window` globals.

### Script load order is the dependency graph

`index.html` loads `app/*.jsx` in a strict order. A file can only use globals defined by files loaded **before** it. If you add a new component file, insert it before `chat-app.jsx` in `index.html`.

### IIFE wrapping

Most frontend files wrap their contents in an IIFE and export at the bottom:

```js
(function () {
  // ... components defined here
  Object.assign(window, { MyComponent, anotherThing });
})();
```

`chat-app.jsx` is the exception — it runs at top level and calls `ReactDOM.createRoot`.

### Hook aliases — mandatory per file

Every file aliases React hooks to avoid collisions across the global scope. Always use the alias for the file you are editing. Never use bare `useState` unless you are in `ui.jsx`.

| File | useState | useMemo | useEffect | useRef |
|---|---|---|---|---|
| `ui.jsx` | `useState` | `useMemo` | `useEffect` | `useRef` |
| `store.jsx` | — | — | — | — |
| `workspaces1.jsx` | `useState1` | `useMemo1` | `useEffect1` | `useRef1` |
| `workspaces2.jsx` | `useState2` | `useMemo2` | `useEffect2` | — |
| `workspaces3.jsx` | `useState3` | `useMemo3` | `useEffect3` | `useRef3` |
| `workspaces4.jsx` | `useState4` | `useMemo4` | `useEffect4` | `useRef4` |
| `chat-app.jsx` | `useStateApp` | `useMemoApp` | `useEffectApp` | — |
| `chat-ui.jsx` | `useStateChat` | `useMemoChat` | `useEffectChat` | `useRefChat` |
| `features.jsx` | `useStateF` | `useMemoF` | `useEffectF` | `useRefF` |
| `studio.jsx` | `useStateS` | — | — | — |
| `onboarding.jsx` | `useStateOB` | — | `useEffectOB` | `useRefOB` |
| `agents.jsx` | `useStateA` | — | `useEffectA` | — |
| `channel-strategy.jsx` | `useStateCS` | `useMemoCS` | `useEffectCS` | — |

### State mutations — always touch both places

When adding a new global action:

1. Add a `case "MY_ACTION":` in `mveda_reducer` inside `store.jsx`.
2. Add the method to the `actions` object inside `useMvedaStore()` in `store.jsx`.

### Colors — OKLCH only

All colour values use OKLCH (`oklch(L% C H)`). Never use hex in component styles. Custom properties are set on `:root` via `styles/tokens.css` and `applyPalette()` in `onboarding.jsx`.

### Connector additions — update all of these

When adding a new connector to the catalog:

1. `seed.jsx` — catalog row + `connectorState` default + `brandConnectorStates.erickson`
2. `agents.jsx` — `CONNECTOR_LABELS` display name map
3. `channel-strategy.jsx` — `connectedSet` id→display-name map (if publishing channel)
4. `api/brand-import.js` — `CONNECTOR_IDS` array
5. `store.jsx` — `channelRules` (if publishing channel)
6. For Composio / Pipedream / Direct: the respective API route + verify script

## Testing Instructions

### Unit / Integration

Uses Node.js built-in `node --test` runner (no Jest, no Vitest).

```bash
node --test tests/unit/*.test.js
node --test tests/integration/*.test.js
```

### E2E

Playwright tests run against the Python dev server on `http://127.0.0.1:8765`.

- `playwright.config.js` auto-starts `python3 server.py` if not already running.
- Tests use `?seed=mveda` to bypass Supabase auth — no real credentials needed.
- Use `index.html` (production entry point), not `app.html`.
- Babel compiles at runtime — allow ~1s for React to mount.

```bash
npx playwright test          # headless
npx playwright test --ui     # with UI
npx playwright test --headed # headed browser
```

### Health check

Run before ending a session:

```bash
node scripts/health-check.mjs
```

## Deployment

- **Git remote**: `github.com/kabirsingh-cmyk/flowOS` — `main` branch.
- **Vercel**: auto-deploys on push to `main`.
- `vercel.json` sets `outputDirectory: "."` because there is no build step.
- **Cron jobs** defined in `vercel.json` require Vercel Pro for guaranteed execution (especially the 1-minute `fire-scheduled` cron).

## Environment Variables

Required for local development and production:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API — required for live AI |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only) |
| `SUPABASE_JWT_SECRET` | Verifies user JWTs in `requireAuth` |
| `COMPOSIO_API_KEY2` | Composio tool execution |
| `CRON_SECRET` | Vercel cron auth — **required** (fails closed) |
| `OAUTH_STATE_SECRET` | HMAC for OAuth state signing |
| `ZERNIO_API_KEY` | Zernio social publishing — all 15 platforms |
| `ZERNIO_WEBHOOK_SECRET` | Zernio webhook HMAC verification |
| `RUNWARE_API_KEY` | Runware image + video generation |
| `HIGGSFIELD_API_KEY` | Higgsfield video generation |
| `PIPEDREAM_PROJECT_ID` | Pipedream Connect project ID |
| `PIPEDREAM_CLIENT_ID` | Pipedream OAuth client ID |
| `PIPEDREAM_CLIENT_SECRET` | Pipedream OAuth client secret |
| `PIPEDREAM_ENVIRONMENT` | `production` or `development` |

The Supabase anon key is baked into `app/supabase.jsx` (public — safe).

## Security Considerations

- **Auth helpers fail closed**: `requireCron` rejects every request if `CRON_SECRET` is unset. `requireAuth` rejects if `SUPABASE_JWT_SECRET` is unset or the JWT is invalid.
- **Dual auth**: Platform endpoints (`/api/linkedin`, `/api/facebook`, etc.) accept either a valid user JWT **or** a cron secret. When called by cron, the `tenantId` in the body was stamped server-side at queue time — never trust a client-supplied `tenantId`.
- **OAuth state**: HMAC-signed with `OAUTH_STATE_SECRET`, 10-minute TTL. Callback verifies the HMAC and reads `tenantId` from the signed payload, never from the raw URL.
- **RLS**: All public-schema Supabase tables have Row Level Security enabled. Service-role writes bypass RLS; anon-key + user-JWT paths are filtered by `tenant_id = auth.uid()::text`.
- **Dev seed bypass**: `?seed=mveda` / `?seed=erickson` hits `/api/dev/mint-token`, which 404s in production (`VERCEL_ENV !== "production"`). Tokens are short-lived (1h) and signed with `SUPABASE_JWT_SECRET`.
- **Never** log or write API keys, OAuth tokens, or credential values to plaintext files.

## Session Protocol

### Start of session

1. Read `DAILY_BRIEF.md` first (if it exists). If not, read `SPRINT.md`.
2. Surface the brief's top recommendations before asking what to work on.

### End of every session

1. Update `SPRINT.md` — move completed items to "Just shipped", update "Now".
2. Update `BACKLOG.md` — flip `in-progress` → `done`, mark new bugs.
3. Run `node scripts/health-check.mjs` and fix issues.
4. Update `CLAUDE.md` only if you added new workspace targets, connector IDs, artifact types, API routes, or hook aliases.

## Key Anti-Patterns

- Don't use bare `useState` in workspace files — use the aliased version for that file.
- Don't `import` anything in frontend `.jsx` files — no modules, globals only.
- Don't add `type="module"` to script tags in `index.html`.
- Don't write new components in `chat-app.jsx` — it's the shell only.
- Don't use hex colours in component styles — use OKLCH or CSS custom properties.
- Don't forget the second tenant (Erickson) when updating seed connector state.
- Don't call `actions.addDraft` from a new file without confirming `useMvedaStore` is loaded before it in `index.html`.
