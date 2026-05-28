-- 2026-06-02 — Analytics cohorts table for demographic breakdowns
-- Track B: Phase 4 PR B.3

-- Normalized demographic / cohort data extracted from platform analytics
-- (instagram_demographics, youtube_demographics, and future ad breakdowns).
-- One row per (tenant, channel, cohort_type, period).

create table if not exists analytics_cohorts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  channel     text not null,       -- 'ig_organic' | 'yt_organic' | 'gmb' | ...
  cohort_type text not null,       -- 'age' | 'gender' | 'country' | 'city' | 'device' | ...
  period      text not null,       -- '7d' | '30d' | '90d'
  breakdowns  jsonb not null,      -- [{ label, value, pct? }, ...]
  meta        jsonb,               -- extra context: { metric, timeframe, dateRange, note }
  fetched_at  timestamptz not null default now(),

  unique (tenant_id, channel, cohort_type, period)
);

create index if not exists analytics_cohorts_tenant_idx
  on analytics_cohorts (tenant_id, fetched_at desc);

create index if not exists analytics_cohorts_channel_idx
  on analytics_cohorts (tenant_id, channel, cohort_type);

-- RLS
alter table analytics_cohorts enable row level security;

drop policy if exists "tenant_isolation_select" on analytics_cohorts;
drop policy if exists "tenant_isolation_modify" on analytics_cohorts;

create policy "tenant_isolation_select" on analytics_cohorts
  for select using (tenant_id = auth.uid()::text);

create policy "tenant_isolation_modify" on analytics_cohorts
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);
