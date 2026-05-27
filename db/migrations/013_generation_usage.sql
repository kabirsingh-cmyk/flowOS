-- generation_usage: per-job cost tracking for AI generation providers
-- Written by /api/generate on every completed generation job.
-- Providers: runware, replicate, heygen, higgsfield, luma, elevenlabs, audiostack

create table if not exists public.generation_usage (
  id            uuid              primary key default gen_random_uuid(),
  tenant_id     text              not null,
  provider      text              not null,   -- runware | replicate | heygen | higgsfield | luma | elevenlabs | audiostack
  model         text,                          -- model id / slug used for this job
  job_type      text,                          -- "image" | "video" | "voice" | "avatar"
  job_id        text,                          -- internal generation_jobs.id or provider job id
  cost_estimate numeric(10, 6),               -- USD estimate based on provider pricing
  status        text              default 'completed', -- completed | failed
  created_at    timestamptz       not null default now()
);

-- Tenant-scoped index for dashboard queries.
create index if not exists generation_usage_tenant_created
  on public.generation_usage (tenant_id, created_at desc);

-- Provider + date index for cost aggregation.
create index if not exists generation_usage_provider_created
  on public.generation_usage (provider, created_at desc);

-- RLS: tenants can read their own rows; server-side writes bypass RLS.
alter table public.generation_usage enable row level security;

create policy "tenant read own generation_usage"
  on public.generation_usage
  for select
  using (tenant_id = auth.uid()::text);
