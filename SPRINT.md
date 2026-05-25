# FlowOS — Sprint Board

*Claude: read this at the start of every session. Update it at the end.*

---

## Now (in progress)

Nothing actively in progress.

---

## Just shipped

| ID | What | Date |
|----|------|------|
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

## Up next (top of backlog)

| ID | What | Why it matters |
|----|------|----------------|
| b_60f8 | **BUG: Composio code 306 hangs Connect modal forever** | Now only affects Shopify (all ads + social on Zernio); modal hangs indefinitely on 409 response |
| b_43d9 | Reddit native image posts | Zernio may support natively; needs verification |
| b_b259 | Chat AI drafts for platforms with no publish path | Drafter should flag non-publishable drafts rather than silently produce them |
| b_317a | Strip or preview-tag platform pickers without backends | 10 Zernio platforms now have backends in cron; remaining 5 (whatsapp/telegram/snap/discord/gbusiness) have connection flows but no cron route |

---

## Known issues (not yet backlog items)

- Cron for `fire-scheduled` requires **Vercel Pro** (1-min schedule). On Hobby plan it won't fire reliably.
- **b_60f8 scope (2026-05-24)**: Composio code 306 now only affects non-social connectors — Shopify and the four paid social ad connectors (metaads, liads, ttads, xads) that remain on Composio. X and TikTok organic use Zernio and are unaffected.
- `sourceBriefId` on calendar items is wired but no UI reads it yet (backlog: b_2504).

---

## Health check

Run `node scripts/health-check.mjs` after any session. Silent = all clear.
*(Also runs automatically via Claude Code Stop hook — you'll see a red warning if something breaks.)*

---

*Last updated: 2026-05-24 — Zernio migration complete (b_a001, b_a003, b_8cad done)*
