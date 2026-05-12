-- 002_agent_overrides — Per-tenant agent customisations
-- Apply via Supabase dashboard > SQL Editor.

-- ─── agent_overrides ────────────────────────────────────────────────────────
-- One row per (tenant, agent) pair. NULL fields mean "use the system default."
-- Rows are created the first time a tenant saves an override; never pre-seeded.

create table if not exists agent_overrides (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null,
  agent_id      text not null,          -- matches AGENTS[].id in agents.jsx
  custom_name   text,                   -- null = use default display name
  system_prompt text,                   -- null = use default compiled prompt
  enabled       boolean not null default true,
  updated_at    timestamptz not null default now(),

  unique (tenant_id, agent_id)
);

-- Efficient per-tenant lookup (the common read path)
create index if not exists agent_overrides_tenant_idx
  on agent_overrides (tenant_id);

-- ─── Updated-at trigger ────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger agent_overrides_updated_at
  before update on agent_overrides
  for each row execute procedure set_updated_at();

-- ─── Row-level security (optional) ──────────────────────────────────────────
-- Uncomment if you're calling Supabase from the frontend with the anon key.
--
-- alter table agent_overrides enable row level security;
--
-- create policy "tenants see own overrides"
--   on agent_overrides for select
--   using (tenant_id = auth.uid()::text);
--
-- create policy "tenants insert own overrides"
--   on agent_overrides for insert
--   with check (tenant_id = auth.uid()::text);
--
-- create policy "tenants update own overrides"
--   on agent_overrides for update
--   using (tenant_id = auth.uid()::text);
