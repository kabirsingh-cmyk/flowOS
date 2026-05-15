-- 007_core_schema_and_rls — Define the core tables that code references but
-- no migration ships, then enable Row Level Security on every public-schema
-- table with a tenant-scoped policy.
--
-- Pairs with: api/lib/auth.js (requireAuth + requireCron), which forces every
-- /api/* edge handler to identify the tenant from a verified JWT (or, for
-- cron-fired platform handlers, from a server-stamped scheduled_posts row).
-- Together these two changes close the audit findings:
--   1. JWT verification on every /api/* endpoint
--   2. RLS on every public-schema table
--
-- Service-role calls bypass RLS — that's how the cron and server-trusted
-- /api/* writes keep working. Direct REST reads from the frontend now
-- require the user's JWT in Authorization (anon key as `apikey`); without it
-- the read returns zero rows.
--
-- Tenant identifier: legacy tables call it `tenant_id`; the brands/channels/
-- posts/google_ads_tokens tables call it `user_id`. Both are `text` (not
-- `uuid`) because the dev seed bypass mints JWTs with deterministic non-uuid
-- subs ("dev-mveda" etc.). Policies cast `auth.uid()::text` to match.
--
-- auth.uid() is the Supabase function that returns the JWT's sub claim.
-- For the dev mint endpoint we sign uuid-shaped subs so this stays valid;
-- see api/dev/mint-token.js.

-- ─────────────────────────────────────────────────────────────────────────────
-- Part (a) — Define missing tables
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── brands ─────────────────────────────────────────────────────────────────
-- One brand profile per tenant. Primary key is user_id (the tenant
-- identifier). Written by /api/brand-import upsertBrand, read by
-- fetchBrandProfile and several workspaces.
create table if not exists brands (
  user_id                 text primary key,
  name                    text,
  industry                text,
  website                 text,
  palette                 jsonb,             -- legacy palette object
  palette_vars            jsonb,             -- new CSS-vars-shaped palette
  voice                   jsonb,
  values                  jsonb,
  claims                  jsonb,
  prohibited_topics       jsonb,
  target_audience         jsonb,
  recommended_connectors  jsonb,
  competitors             jsonb,
  brand_analysis          jsonb,             -- full Claude analysis blob
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ─── channels ───────────────────────────────────────────────────────────────
-- Per-tenant connected platform records. Used by Connections workspace and
-- the Organic Social Studio. composio_connection_id binds the row to a
-- Composio connected_account.
create table if not exists channels (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 text not null,
  platform                text not null,
  composio_connection_id  text,
  account_handle          text,
  followers_count         bigint,
  status                  text not null default 'connected',
  meta                    jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id, platform)
);

create index if not exists channels_user_status_idx
  on channels (user_id, status);

-- ─── posts ──────────────────────────────────────────────────────────────────
-- Per-tenant social-post drafts and history. Written from
-- OrganicSocialStudio in app/features.jsx.
create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  channel_id    uuid,
  platform      text not null,
  post_type     text,
  caption       text,
  media_urls    text[],
  status        text not null default 'draft',
  scheduled_at  timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists posts_user_created_idx
  on posts (user_id, created_at desc);

-- ─── google_ads_tokens ──────────────────────────────────────────────────────
-- OAuth refresh-token store for Google Ads. One row per tenant.
create table if not exists google_ads_tokens (
  tenant_id          text primary key,
  refresh_token      text not null,
  customer_id        text,
  all_customer_ids   text[],
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ─── proactive_drafts ───────────────────────────────────────────────────────
-- Weekly social-calendar drafts produced by the proactive-drafts cron and
-- the manual "Generate drafts" button in PublishingQueue.
create table if not exists proactive_drafts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text not null,
  platform        text not null,
  content_type    text,
  copy            text,
  image_prompt    text,
  suggested_day   int,
  suggested_time  text,
  status          text not null default 'pending',  -- 'pending' | 'archived'
  source          text default 'claude',            -- 'claude' | 'fallback'
  created_at      timestamptz not null default now()
);

create index if not exists proactive_drafts_tenant_status_idx
  on proactive_drafts (tenant_id, status, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Part (b) — Enable RLS + tenant-scoped policies on every public-schema table
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Pattern: one ALL-actions policy per table, scoped to the requesting
-- tenant. Service-role bypasses RLS automatically — server-side writes via
-- SUPABASE_SERVICE_KEY continue to work without policies for those calls.

-- 001 — generation_jobs
alter table generation_jobs enable row level security;
drop policy if exists "tenant_isolation_select" on generation_jobs;
drop policy if exists "tenant_isolation_modify" on generation_jobs;
create policy "tenant_isolation_select" on generation_jobs
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on generation_jobs
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);

-- 001 — media_uploads
alter table media_uploads enable row level security;
drop policy if exists "tenant_isolation_select" on media_uploads;
drop policy if exists "tenant_isolation_modify" on media_uploads;
create policy "tenant_isolation_select" on media_uploads
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on media_uploads
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);

-- 002 — agent_overrides
alter table agent_overrides enable row level security;
drop policy if exists "tenant_isolation_select" on agent_overrides;
drop policy if exists "tenant_isolation_modify" on agent_overrides;
create policy "tenant_isolation_select" on agent_overrides
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on agent_overrides
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);

-- 003 — analytics_snapshots
alter table analytics_snapshots enable row level security;
drop policy if exists "tenant_isolation_select" on analytics_snapshots;
drop policy if exists "tenant_isolation_modify" on analytics_snapshots;
create policy "tenant_isolation_select" on analytics_snapshots
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on analytics_snapshots
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);

-- 003 — analytics_insights
alter table analytics_insights enable row level security;
drop policy if exists "tenant_isolation_select" on analytics_insights;
drop policy if exists "tenant_isolation_modify" on analytics_insights;
create policy "tenant_isolation_select" on analytics_insights
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on analytics_insights
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);

-- 004 — proactive_emails
alter table proactive_emails enable row level security;
drop policy if exists "tenant_isolation_select" on proactive_emails;
drop policy if exists "tenant_isolation_modify" on proactive_emails;
create policy "tenant_isolation_select" on proactive_emails
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on proactive_emails
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);

-- 005 — scheduled_posts
alter table scheduled_posts enable row level security;
drop policy if exists "tenant_isolation_select" on scheduled_posts;
drop policy if exists "tenant_isolation_modify" on scheduled_posts;
create policy "tenant_isolation_select" on scheduled_posts
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on scheduled_posts
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);

-- New (this migration) — brands. Identifier column is user_id, not tenant_id.
alter table brands enable row level security;
drop policy if exists "tenant_isolation_select" on brands;
drop policy if exists "tenant_isolation_modify" on brands;
create policy "tenant_isolation_select" on brands
  for select using (user_id = auth.uid()::text);
create policy "tenant_isolation_modify" on brands
  for all using (user_id = auth.uid()::text)
        with check (user_id = auth.uid()::text);

-- channels (user_id)
alter table channels enable row level security;
drop policy if exists "tenant_isolation_select" on channels;
drop policy if exists "tenant_isolation_modify" on channels;
create policy "tenant_isolation_select" on channels
  for select using (user_id = auth.uid()::text);
create policy "tenant_isolation_modify" on channels
  for all using (user_id = auth.uid()::text)
        with check (user_id = auth.uid()::text);

-- posts (user_id)
alter table posts enable row level security;
drop policy if exists "tenant_isolation_select" on posts;
drop policy if exists "tenant_isolation_modify" on posts;
create policy "tenant_isolation_select" on posts
  for select using (user_id = auth.uid()::text);
create policy "tenant_isolation_modify" on posts
  for all using (user_id = auth.uid()::text)
        with check (user_id = auth.uid()::text);

-- google_ads_tokens (tenant_id)
alter table google_ads_tokens enable row level security;
drop policy if exists "tenant_isolation_select" on google_ads_tokens;
drop policy if exists "tenant_isolation_modify" on google_ads_tokens;
create policy "tenant_isolation_select" on google_ads_tokens
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on google_ads_tokens
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);

-- proactive_drafts (tenant_id)
alter table proactive_drafts enable row level security;
drop policy if exists "tenant_isolation_select" on proactive_drafts;
drop policy if exists "tenant_isolation_modify" on proactive_drafts;
create policy "tenant_isolation_select" on proactive_drafts
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on proactive_drafts
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);
