-- SPEC-01 — Generation Engine: Supabase schema
-- Apply via Supabase dashboard > SQL Editor, or via supabase db push.

-- ─── generation_jobs ────────────────────────────────────────────────────────
-- One row per submitted generation (image or video).
-- Stores the assembled prompt for debug and regression replay.

create table if not exists generation_jobs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text not null,
  provider        text not null,           -- 'higgsfield' | 'runware' | 'falai' | 'heygen'
  provider_job_id text not null,           -- the provider's own job id
  type            text not null,           -- 'image' | 'video'
  intent_kind     text not null,           -- 'feed_hero' | 'story' | 'carousel_1' | 'reel_beat' | ...
  sku_id          text,                    -- nullable — not every job is SKU-specific
  story_id        text,                    -- nullable — only for reel beat jobs (SPEC-04)
  beat            int,                     -- nullable — beat number within a story
  status          text not null default 'pending',
    -- 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed_content_policy' | 'failed'
  raw_url         text,                    -- populated on completed
  thumbnail_url   text,                    -- populated on completed
  prompt_used     text,                    -- final assembled prompt (stored for debug + replay)
  prompt_intent   jsonb not null,          -- structured intent that fed prompt assembly
  credit_cost     numeric,                 -- populated from provider response when available
  created_at      timestamptz default now(),
  completed_at    timestamptz
);

-- Efficient lookup: per-tenant job lists ordered by recency; filter by status
create index if not exists generation_jobs_tenant_status_idx
  on generation_jobs (tenant_id, status, created_at desc);

-- Lookup by provider_job_id (used when polling status updates back from provider)
create index if not exists generation_jobs_provider_job_id_idx
  on generation_jobs (provider_job_id);


-- ─── media_uploads ──────────────────────────────────────────────────────────
-- Tracks reference media uploaded to each provider.
-- Higgsfield uploads expire (typical TTL: 86400s).
-- The engine re-uploads from tenant_assets if a generation references an expired upload.

create table if not exists media_uploads (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null,
  provider      text not null,
  provider_id   text not null,             -- media_id returned by Higgsfield / etc.
  source_path   text,                      -- origin in tenant asset library (or source URL)
  expires_at    timestamptz,               -- null = provider did not give an expiry
  created_at    timestamptz default now()
);

-- Look up non-expired uploads by tenant + provider for reference media reuse
create index if not exists media_uploads_tenant_provider_idx
  on media_uploads (tenant_id, provider, expires_at);

-- ─── Row-level security (optional — enable if using anon/service keys from frontend) ─
-- alter table generation_jobs enable row level security;
-- alter table media_uploads   enable row level security;
--
-- create policy "tenants see own generation jobs"
--   on generation_jobs for select
--   using (tenant_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
