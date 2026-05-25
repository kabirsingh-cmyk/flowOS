# FlowOS — Sprint Board

*Claude: read this at the start of every session. Update it at the end.*

---

## Now (in progress)

Nothing actively in progress.

---

## Just shipped

| ID | What | Date |
|----|------|------|
| b_c002 | Social ads action layer (all 5 paid platforms) | `api/social-ads.js` — `list_campaigns`, `create_campaign`, `boost_post`, `get_analytics`, `create_audience` via Zernio; covers metaads/liads/ttads/xads/pinads | 2026-05-24 |
| b_c001 | Wire 5 remaining organic platforms to publish cron | `api/whatsapp.js`, `api/telegram.js`, `api/snapchat.js`, `api/discord.js`, `api/googlebusiness.js` (thin Zernio proxies); `PLATFORM_ROUTES` in `api/cron/fire-scheduled.js` extended | 2026-05-24 |
| b_a004 | Migrate googleads from Composio to Zernio | `api/google-ads.js` rewritten against Zernio `/v1/ads/*`; `ADS_TO_ORGANIC` routing added to `api/zernio.js`; `seed.jsx` provider flipped; Composio `APP_MAP` cleaned | 2026-05-24 |
| b_a001 | Adopt Zernio for all organic social publishing | `api/zernio.js` unified publisher; all 10 cron-routed platforms wired; individual platform files are thin proxies; all organic social `seed.jsx` entries flipped to `provider: "zernio"` | 2026-05-24 |
| b_a003 | Scope Composio strictly to non-social | Social toolkits removed from Composio path; Composio now covers only: GA4, GSC, HubSpot, Salesforce, Mailchimp, ElevenLabs, HeyGen | 2026-05-24 |
| b_8cad | Wire social platform publishers via Zernio | All 10 platforms in `fire-scheduled` PLATFORM_ROUTES wired end-to-end; retitled from "via Composio" | 2026-05-24 |
| b_ea4e | IG text-only post fix | Schedule + Publish Now disabled when no image; pink callout with "Generate image" button; auto-unblocks on completion | 2026-05-24 |
| b_cc01 | DB migrations complete | 008 connector_credentials · 009 brand_voice_fields · 010 proactive_sms added to db/migrations/ — now a full sequential source of truth | 2026-05-24 |
| b_3037 | Proactive SMS cron | api/proactive-sms.js + cron/proactive-sms.js + vercel.json + store (3 cases/actions) + ProactiveSmsDrafts UI in SmsCenter + DB migration | 2026-05-24 |
| b_6c61 | Verify Composio connection_status after JWT auth | 2026-05-23 |
| b_d25a | Verify brand-import tenant scoping after JWT auth | 2026-05-23 |
| b_0c94 | JWT verification on every /api/* endpoint | 2026-05-22 |
| b_9d59 | Row Level Security on all Supabase tables | 2026-05-22 |
| b_8698 | Scheduled posting via Vercel Cron + Supabase queue | 2026-05-22 |
| b_e061 | InsightsCenter undefined globals + duplicate stub fix | 2026-05-22 |

---

## Up next — one chat each, in priority order

| ID | Chat scope | What it touches | Effort |
|----|-----------|-----------------|--------|
| b_c003 | **Fix unverified inbox endpoints in zernio.js** | `get_dms`, `reply_dm`, `get_comments`, `reply_comment`, `get_analytics` — currently marked ENDPOINT_UNVERIFIED / ENDPOINT_PARTIAL. Resolve against Zernio docs. Affects InboxEscalation workspace. | Small |
| b_60f8 | **BUG: Shopify 306 hangs Connect modal** | Frontend only — `workspaces4.jsx` doesn't handle 409 from Composio; modal spins forever. Show error message + link to Composio dashboard. | Small |

---

## Known issues

- Cron `fire-scheduled` requires **Vercel Pro** for guaranteed 1-min execution; Hobby plan won't fire reliably.
- `sourceBriefId` on calendar items is wired but no UI reads it yet (b_2504).

---

## Health check

Run `node scripts/health-check.mjs` after any session. Silent = all clear.
*(Also runs automatically via Claude Code Stop hook.)*

---

*Last updated: 2026-05-24 — googleads migrated to Zernio; backlog restructured with one-chat scopes*
