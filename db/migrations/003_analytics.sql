-- 003_analytics — Analytics snapshots + AI-generated insights
-- Apply via Supabase dashboard > SQL Editor.

-- ─── analytics_snapshots ─────────────────────────────────────────────────────
-- One row per (tenant, channel, period). Upserted on each ingest run.
-- Stores raw metrics as returned by each platform's API via Composio.

create table if not exists analytics_snapshots (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  channel     text not null,       -- 'meta_ads' | 'google_ads' | 'klaviyo' | 'ig_organic' | 'ga4' | 'seo' | 'shopify' | 'sms'
  period      text not null,       -- '7d' | '30d' | '90d'
  metrics     jsonb not null,      -- platform-specific metrics object
  source      text default 'live', -- 'live' | 'demo'
  fetched_at  timestamptz not null default now(),

  unique (tenant_id, channel, period)
);

create index if not exists analytics_snapshots_tenant_idx
  on analytics_snapshots (tenant_id, fetched_at desc);

-- ─── analytics_insights ──────────────────────────────────────────────────────
-- One row per (tenant, period) per generation run.
-- Claude reads all snapshots for the tenant and generates this.

create table if not exists analytics_insights (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           text not null,
  period              text not null,
  summary             text,                -- 2-3 sentence AI brief
  insights            jsonb,               -- [{ title, body, channel, severity }]
  recommended_actions jsonb,               -- [{ action, reason, priority, channel, workspace }]
  generated_at        timestamptz not null default now()
);

create index if not exists analytics_insights_tenant_idx
  on analytics_insights (tenant_id, generated_at desc);
