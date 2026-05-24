# FlowOS — Sprint Board

*Claude: read this at the start of every session. Update it at the end.*

---

## Now (in progress)

| ID | What | Notes |
|----|------|-------|
| b_8cad | Wire remaining social publishers via Composio | Reddit, Instagram, X still need testing end-to-end |

---

## Just shipped

| ID | What | Date |
|----|------|------|
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
| b_ea4e | **BUG: text-only Instagram post fails** | Composio requires imageUrl — crashes silently |
| b_60f8 | **BUG: Composio code 306 hangs Connect modal forever** | User can't connect Shopify/TikTok/X until fixed |
| b_a001 | Switch organic social to Zernio | Replaces Composio social toolkit — strategic change |
| b_a002 | Route paid social ads through Zernio | Meta / LinkedIn / TikTok / Pinterest / X Ads |
| b_43d9 | Reddit native image posts | Composio can't do image kind; need direct API |
| b_b259 | AI drafts for platforms with no publish path | Chat confidently creates content that can't be published |

---

## Known issues (not yet backlog items)

- Cron for `fire-scheduled` requires **Vercel Pro** (1-min schedule). On Hobby plan it won't fire reliably.
- Zernio work (b_a001–a003) is a strategic pivot from Composio for social — needs a plan session before starting.
- `sourceBriefId` on calendar items is wired but no UI reads it yet (backlog: b_2504).

---

## Health check

Run `node scripts/health-check.mjs` after any session. Silent = all clear.
*(Also runs automatically via Claude Code Stop hook — you'll see a red warning if something breaks.)*

---

*Last updated: 2026-05-24*
