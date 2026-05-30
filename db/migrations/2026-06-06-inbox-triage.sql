-- 2026-06-06-inbox-triage.sql
-- PR K1: Inbox e2e validation — support AI triage + draft lifecycle tracking
--
-- Adds replied_at and archived_at timestamps so the UI can show when an
-- action was taken, and so analytics can measure response latency.

alter table public.inbox_events
  add column if not exists replied_at   timestamptz,
  add column if not exists archived_at  timestamptz;

-- Index for analytics: response-time queries
CREATE INDEX IF NOT EXISTS inbox_events_replied_at_idx
  ON public.inbox_events (tenant_id, replied_at);

CREATE INDEX IF NOT EXISTS inbox_events_archived_at_idx
  ON public.inbox_events (tenant_id, archived_at);
