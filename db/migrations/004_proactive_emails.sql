-- 004_proactive_emails — Analytics-triggered email drafts queued for human review.
-- Apply via Supabase dashboard > SQL Editor.

-- Distinct from proactive_drafts (which is the weekly social calendar generator).
-- These rows are produced by the proactive-emails cron when analytics_insights
-- surface email-actionable signals (lapsed cohort, replenishment window,
-- underperforming campaign, abandoned cart aging, VIP no-purchase).
-- Status lifecycle:
--   proactive_draft  → fresh, awaiting human review in EmailStudio
--   approved         → user clicked Approve & push (transient, then becomes pushed)
--   pushed           → live in Klaviyo (klaviyo_campaign_id + klaviyo_url set)
--   dismissed        → user discarded; kept for telemetry

create table if not exists proactive_emails (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          text not null,
  rule               text not null,                -- 'R1_winback' | 'R2_replenish' | 'R3_rescue' | 'R4_cart_aging' | 'R5_vip_quiet'
  subject            text not null,
  preheader          text,
  body_text          text not null,
  audience_hint      text,
  reason             text,                         -- the analytics signal that triggered this draft
  source_insight_id  uuid,                         -- FK to analytics_insights (nullable: demo fallback has none)
  source             text default 'claude',        -- 'claude' | 'fallback'
  status             text not null default 'proactive_draft',
  klaviyo_template_id text,
  klaviyo_campaign_id text,
  klaviyo_message_id  text,
  klaviyo_url        text,
  audience           jsonb,                        -- resolved Klaviyo audience { id, name, kind, fallback }
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Idempotency: re-running the cron for the same insight + rule must not duplicate.
-- Two tenants × same rule × same insight → one row.
-- NB: source_insight_id is nullable for the demo fallback path, so we partial-index
-- the unique constraint to only enforce when source_insight_id is present.
create unique index if not exists proactive_emails_idempotency_idx
  on proactive_emails (tenant_id, rule, source_insight_id)
  where source_insight_id is not null;

-- For the fallback path (no insight), prevent duplicating a fallback per tenant per rule per day.
create unique index if not exists proactive_emails_fallback_daily_idx
  on proactive_emails (tenant_id, rule, (date_trunc('day', created_at)))
  where source_insight_id is null;

create index if not exists proactive_emails_tenant_status_idx
  on proactive_emails (tenant_id, status, created_at desc);
