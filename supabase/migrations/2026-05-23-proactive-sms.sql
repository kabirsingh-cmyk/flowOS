-- FlowOS — proactive_sms table
-- Analytics-triggered SMS drafts (flavor #1 Proactive for the SMS channel).
-- Mirror of proactive_emails but with a simpler shape — no subject/preheader,
-- just a body_text (≤160 chars). Four rules: S1 win-back, S2 replenish,
-- S3 cart-abandonment, S4 VIP.

create table if not exists public.proactive_sms (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           text        not null,
  rule                text        not null, -- S1_winback | S2_replenish | S3_cart | S4_vip
  body_text           text        not null,
  audience_hint       text        not null default '',
  reason              text        not null default '',
  source_insight_id   uuid,
  source              text        not null default 'claude', -- 'claude' | 'fallback'
  status              text        not null default 'proactive_draft',
    -- proactive_draft → pushed | dismissed
  klaviyo_campaign_id text,
  klaviyo_message_id  text,
  klaviyo_url         text,
  audience            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Idempotency: one draft per (tenant, rule, insight) per run.
-- source_insight_id is null for fallback rows; partial unique index handles both.
create unique index if not exists proactive_sms_idempotent_idx
  on public.proactive_sms (tenant_id, rule, source_insight_id)
  where source_insight_id is not null;

create index if not exists proactive_sms_tenant_status_idx
  on public.proactive_sms (tenant_id, status, created_at desc);

-- RLS
alter table public.proactive_sms enable row level security;

-- Service-role (cron + server writes) bypasses RLS.
-- Client reads are row-filtered by JWT sub.
create policy "tenant read own sms drafts"
  on public.proactive_sms for select
  using (tenant_id = auth.uid()::text);
