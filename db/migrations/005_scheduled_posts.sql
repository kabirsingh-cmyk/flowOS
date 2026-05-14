-- 005_scheduled_posts — Platform-agnostic queue for scheduled social posts.
-- Apply via Supabase dashboard > SQL Editor.
--
-- Wired in:
--   - app/workspaces3.jsx       handleSchedule()  → POST /api/scheduled-posts
--   - api/scheduled-posts.js    server-side write (uses SUPABASE_SERVICE_KEY)
--   - api/cron/fire-scheduled.js  Vercel cron @ * * * * *  → claim_due_scheduled_posts()
--
-- Status lifecycle:
--   pending     → freshly queued, fire_at in the future (or just passed)
--   publishing  → claimed by a cron run; in-flight POST to /api/<platform>
--   published   → success; calendar row already patched to status='sent'
--   failed      → terminal error; last_error populated
--   cancelled   → user cancelled before fire_at (or removed the calendar row)
--
-- payload jsonb stores the full publish_now body for that platform (snapshot,
-- not reference). Edits to the calendar row after Schedule do NOT change what
-- gets posted — a separate explicit reschedule is required.

create table if not exists scheduled_posts (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           text        not null,
  item_id             text        not null,           -- calendar row id (e.g. d_abc123)
  platform            text        not null,           -- 'linkedin' | 'facebook' | 'x' | 'instagram' | 'reddit' | ...
  fire_at             timestamptz not null,           -- always UTC
  payload             jsonb       not null,           -- snapshot of /api/<platform> publish_now body
  status              text        not null default 'pending'
                      check (status in ('pending','publishing','published','failed','cancelled')),
  attempts            int         not null default 0,
  last_error          text,
  fire_attempted_at   timestamptz,
  published_at        timestamptz,
  result              jsonb,                          -- response from /api/<platform>
  created_at          timestamptz not null default now()
);

-- The cron's hot query: due rows, ordered by fire_at.
create index if not exists scheduled_posts_due_idx
  on scheduled_posts (status, fire_at)
  where status = 'pending';

-- Hydration: load tenant's open queue at PublishingQueue mount.
create index if not exists scheduled_posts_tenant_status_idx
  on scheduled_posts (tenant_id, status, fire_at);

-- One open schedule per calendar item — prevents double-queueing if the user
-- clicks Schedule twice. (Doesn't block pending → cancelled → new pending.)
create unique index if not exists scheduled_posts_item_pending_idx
  on scheduled_posts (item_id)
  where status in ('pending','publishing');

-- Atomic claim function — picks up to limit_n due rows, transitions them to
-- 'publishing', returns them. Row-level locking with SKIP LOCKED prevents the
-- same row being claimed by two concurrent cron runs.
create or replace function claim_due_scheduled_posts(limit_n int default 20)
returns setof scheduled_posts
language plpgsql
as $$
begin
  return query
    with claimed as (
      select id
      from scheduled_posts
      where status = 'pending'
        and fire_at <= now()
      order by fire_at
      limit limit_n
      for update skip locked
    )
    update scheduled_posts sp
       set status            = 'publishing',
           attempts          = sp.attempts + 1,
           fire_attempted_at = now()
      from claimed
     where sp.id = claimed.id
    returning sp.*;
end;
$$;
