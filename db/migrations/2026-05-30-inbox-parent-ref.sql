-- 2026-05-30-inbox-parent-ref.sql
-- PR K2 — Inbox engagement layer foundation.
--
-- Adds parent_external_id so we can store the post_id a comment belongs to.
-- The Zernio comment-reply contract (POST /v1/inbox/comments/{postId}) needs
-- postId in the URL path, but our previous normalizer only captured the
-- comment_id (in external_id). Without this column, comment replies are
-- structurally impossible — you can't reach the endpoint.
--
-- Also stores Bluesky's parent_cid / root_uri / root_cid in `raw` (existing
-- jsonb column) — no schema change needed for those; we pluck them at reply
-- time.

alter table public.inbox_events
  add column if not exists parent_external_id text;

create index if not exists inbox_events_tenant_parent_idx
  on public.inbox_events (tenant_id, parent_external_id);
