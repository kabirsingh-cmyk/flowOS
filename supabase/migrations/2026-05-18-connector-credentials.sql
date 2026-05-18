-- 2026-05-18 — connector_credentials
--
-- Per-tenant API-key storage for Direct-API connectors (provider: "direct" in
-- seed.jsx) that don't go through Composio or Pipedream. Used by /api/replicate,
-- /api/higgsfield, /api/luma, and the rest of the 12 Direct connectors listed
-- in docs/composio_marketing_connectors.md.
--
-- Service-role only: edge functions write here with SUPABASE_SERVICE_KEY.
-- No RLS policies are exposed to anon/authenticated; the user's session must
-- never touch this table.

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
-- No policies → service role only.

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
