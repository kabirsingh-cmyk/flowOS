-- 2026-06-05-campaign-plans — Persistent campaign briefs / plans.
--
-- Wired in:
--   api/campaign-plans.js     CRUD edge route (list/get/create/update/
--                             activate/pause/archive/delete)
--   app/store.jsx             TRACK CLAUDE block — hydrates state.campaignPlans
--                             on boot; createCampaignPlan dual-writes when the
--                             campaign_planner specialist emits a brief
--   app/workspaces2.jsx       CampaignPlanner sidebar + history view
--
-- Before this table, `state.activePlan` was ephemeral — refreshing the page
-- lost every chat-authored campaign brief. This persists each brief with a
-- lifecycle (draft → active → paused → archived).

create table if not exists public.campaign_plans (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             text not null,
  title                 text not null,
  status                text not null default 'draft'
                        check (status in ('draft','active','paused','archived')),
  summary               text,
  goal                  text,
  audience              text,
  timeline              text,
  budget                text,
  channels              jsonb default '[]'::jsonb,
  brief                 text,                    -- full markdown body
  source_chat_thread_id text,                    -- which chat thread spawned it
  source_specialist     text,                    -- e.g. 'campaign_planner'
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  activated_at          timestamptz,
  archived_at           timestamptz
);

create index if not exists campaign_plans_tenant_status_idx
  on public.campaign_plans (tenant_id, status, updated_at desc);

create index if not exists campaign_plans_tenant_updated_idx
  on public.campaign_plans (tenant_id, updated_at desc);

alter table public.campaign_plans enable row level security;

drop policy if exists "tenant_isolation_select" on public.campaign_plans;
drop policy if exists "tenant_isolation_modify" on public.campaign_plans;
create policy "tenant_isolation_select" on public.campaign_plans
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on public.campaign_plans
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);
