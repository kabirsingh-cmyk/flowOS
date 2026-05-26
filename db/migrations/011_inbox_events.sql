-- 011_inbox_events — Ingestion table for Zernio webhook events.
--
-- Wired in:
--   - api/webhooks/zernio.js    receives webhooks, inserts rows
--   - app/workspaces3.jsx       InboxEscalation reads from state.inbox (seeded
--                               fake data today; will hydrate from this table)
--
-- Status lifecycle:
--   open     → newly arrived, awaiting triage / reply
--   replied  → human or AI replied
--   archived → dismissed / no action needed
--
-- Pairs with: Phase 2 autonomy reply flow (AI drafts + triage notes).

-- Also add external_id to scheduled_posts so Zernio webhooks can correlate
-- post.published / post.failed events back to queued rows.
-- Wrapped in a DO block so it silently skips if 005_scheduled_posts.sql
-- hasn't been applied yet (idempotent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scheduled_posts'
  ) THEN
    ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS external_id text;
    CREATE INDEX IF NOT EXISTS scheduled_posts_external_id_idx
      ON scheduled_posts (tenant_id, external_id);
  END IF;
END $$;

-- ─── inbox_events ────────────────────────────────────────────────────────────
create table if not exists public.inbox_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text not null,
  event_type      text not null,  -- 'comment', 'dm', 'reaction', 'review'
  platform        text not null,  -- 'instagram', 'facebook', 'x', etc.
  external_id     text,           -- Zernio's message/comment ID (for dedup)
  author_name     text,
  author_handle   text,
  text            text,
  risk            text default 'low' check (risk in ('low', 'medium', 'high')),
  status          text default 'open' check (status in ('open', 'replied', 'archived')),
  ai_draft        text,           -- AI-generated reply draft (populated later)
  ai_triage_note  text,           -- AI triage reasoning (populated later)
  source_url      text,           -- link to the original post/thread if available
  raw             jsonb,          -- full Zernio webhook payload
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Prevent duplicate ingestion of the same Zernio event per tenant.
create unique index if not exists inbox_events_tenant_external_idx
  on public.inbox_events (tenant_id, external_id);

-- Common query: tenant's open inbox, newest first.
create index if not exists inbox_events_tenant_status_created_idx
  on public.inbox_events (tenant_id, status, created_at desc);

-- RLS — service-role writes bypass; client reads scoped to own rows.
alter table public.inbox_events enable row level security;

drop policy if exists "tenant_isolation_select" on public.inbox_events;
drop policy if exists "tenant_isolation_modify" on public.inbox_events;
create policy "tenant_isolation_select" on public.inbox_events
  for select using (tenant_id = auth.uid()::text);
create policy "tenant_isolation_modify" on public.inbox_events
  for all using (tenant_id = auth.uid()::text)
        with check (tenant_id = auth.uid()::text);

-- Updated-at trigger (set_updated_at defined in 000_helpers.sql).
create or replace trigger inbox_events_updated_at
  before update on inbox_events
  for each row execute procedure set_updated_at();
