-- 2026-05-28-leads — Cache for Lead Ads leads ingested via Zernio webhooks.
--
-- Wired in:
--   - api/webhooks/zernio.js    receives lead.received, inserts rows
--   - app/ads-workspace.jsx     LeadFormsPane reads from API
--
-- Also appends to inbox_events so leads surface in InboxEscalation
-- without touching Track B code.

-- ─── leads_cache ─────────────────────────────────────────────────────────────
create table if not exists public.leads_cache (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           text not null,
  platform            text not null,
  lead_form_id        text,
  platform_lead_id    text not null,
  payload             jsonb,
  received_at         timestamptz default now(),
  pushed_to_klaviyo   boolean default false,
  klaviyo_profile_id  text
);

-- Deduplication per tenant + platform + platform lead ID.
create unique index if not exists leads_cache_tenant_platform_lead_idx
  on public.leads_cache (tenant_id, platform, platform_lead_id);

-- Common queries: tenant's leads by form, by push status.
create index if not exists leads_cache_tenant_form_idx
  on public.leads_cache (tenant_id, lead_form_id);

create index if not exists leads_cache_tenant_pushed_idx
  on public.leads_cache (tenant_id, pushed_to_klaviyo);

-- Newest leads first.
create index if not exists leads_cache_tenant_received_idx
  on public.leads_cache (tenant_id, received_at desc);

-- RLS — service-role writes bypass; client reads scoped to own rows.
alter table public.leads_cache enable row level security;

drop policy if exists "tenant_isolation_select" on public.leads_cache;
drop policy if exists "tenant_isolation_modify" on public.leads_cache;
create policy "tenant_isolation_select" on public.leads_cache
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on public.leads_cache
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);
