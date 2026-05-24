-- 008_connector_credentials — Per-tenant API-key storage for Direct-API connectors.
--
-- Connectors with provider: "direct" in seed.jsx (Replicate, Higgsfield, Luma,
-- Optimizely, AudioStack, WordPress) store their plaintext keys here.
-- Service-role only: edge functions write with SUPABASE_SERVICE_KEY.
-- No RLS policies → no client reads. The user's anon/authenticated role
-- has zero access to this table.
--
-- user_id is uuid (not text) — references auth.users and enforces referential
-- integrity at the DB level. directCredentials.js receives a UUID-shaped JWT
-- sub from requireAuth() and passes it here directly.
--
-- Also pairs with supabase/migrations/2026-05-18-connector-credentials.sql
-- (same DDL — both use `if not exists` / `or replace` so re-applying is safe).

create table if not exists public.connector_credentials (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  platform     text        not null,
  secret_kind  text        not null default 'api_key',
  secret_value text        not null,
  validated_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, platform)
);

alter table public.connector_credentials enable row level security;
-- No policies — service-role only (intentional).

create or replace function public.touch_connector_credentials_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_connector_credentials on public.connector_credentials;
create trigger trg_touch_connector_credentials
  before update on public.connector_credentials
  for each row execute function public.touch_connector_credentials_updated_at();
