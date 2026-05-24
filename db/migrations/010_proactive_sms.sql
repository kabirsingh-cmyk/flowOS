-- 010_proactive_sms — Analytics-triggered SMS drafts queued for human review.
--
-- Same lifecycle as proactive_emails (004) but for the SMS channel.
-- Four rules: S1_winback · S2_replenish · S3_cart · S4_vip
-- Produced by api/cron/proactive-sms.js (08:00 UTC daily).
-- Surfaced in SmsCenter (app/features.jsx) → ProactiveSmsDrafts component.
--
-- Status lifecycle:
--   proactive_draft  → awaiting human review in SmsCenter
--   pushed           → approved + pushed to Klaviyo as draft SMS campaign
--   dismissed        → discarded by user (kept for telemetry)
--
-- Pairs with supabase/migrations/2026-05-23-proactive-sms.sql
-- (same DDL — all statements are idempotent).

create table if not exists public.proactive_sms (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           text        not null,
  rule                text        not null,  -- S1_winback | S2_replenish | S3_cart | S4_vip
  body_text           text        not null,
  audience_hint       text        not null default '',
  reason              text        not null default '',
  source_insight_id   uuid,
  source              text        not null default 'claude',  -- 'claude' | 'fallback'
  status              text        not null default 'proactive_draft',
  klaviyo_campaign_id text,
  klaviyo_message_id  text,
  klaviyo_url         text,
  audience            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Idempotency: one draft per (tenant, rule, insight) per run.
create unique index if not exists proactive_sms_idempotent_idx
  on public.proactive_sms (tenant_id, rule, source_insight_id)
  where source_insight_id is not null;

create index if not exists proactive_sms_tenant_status_idx
  on public.proactive_sms (tenant_id, status, created_at desc);

-- RLS — service-role writes bypass; client reads scoped to own rows.
alter table public.proactive_sms enable row level security;

drop policy if exists "tenant_isolation_select" on public.proactive_sms;
drop policy if exists "tenant_isolation_modify" on public.proactive_sms;
create policy "tenant_isolation_select" on public.proactive_sms
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on public.proactive_sms
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);
