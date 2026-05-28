-- 2026-06-01 — Analytics extensions for Zernio-backed per-platform + primitive endpoints
-- Track B: Phase 2

-- ─── analytics_snapshots ─────────────────────────────────────────────────────
-- Add endpoint column so the same (tenant, channel, period) can hold multiple
-- payloads (e.g. instagram_account_insights + instagram_follower_history).

alter table analytics_snapshots
  add column if not exists endpoint text not null default 'legacy';

-- Back-fill existing rows so the new unique constraint can be applied.
update analytics_snapshots set endpoint = 'legacy' where endpoint = 'legacy';

-- Drop the old unique constraint and add the composite one.
alter table analytics_snapshots
  drop constraint if exists analytics_snapshots_tenant_id_channel_period_key;

alter table analytics_snapshots
  add constraint analytics_snapshots_tenant_channel_period_endpoint_key
    unique (tenant_id, channel, period, endpoint);

-- ─── analytics_primitives ────────────────────────────────────────────────────
-- Cross-platform primitive results (best_time, content_decay, etc.)
-- One row per (tenant, primitive, platform, period).

create table if not exists analytics_primitives (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  primitive   text not null,       -- 'best_time' | 'content_decay' | 'posting_frequency' | 'post_timeline' | 'daily_metrics'
  platform    text,                -- null = all platforms; otherwise 'instagram' | 'linkedin' | ...
  period      text not null,       -- '7d' | '30d' | '90d'
  payload     jsonb not null,
  captured_at timestamptz not null default now(),

  unique (tenant_id, primitive, platform, period)
);

create index if not exists analytics_primitives_tenant_idx
  on analytics_primitives (tenant_id, captured_at desc);

-- RLS
alter table analytics_primitives enable row level security;

drop policy if exists "tenant_isolation_select" on analytics_primitives;
drop policy if exists "tenant_isolation_modify" on analytics_primitives;

create policy "tenant_isolation_select" on analytics_primitives
  for select using (tenant_id = auth.uid()::text);

create policy "tenant_isolation_modify" on analytics_primitives
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);
