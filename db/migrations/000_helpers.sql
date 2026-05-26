-- FlowOS — shared helper functions
-- Must run before all other migrations.
-- Safe to re-run (all statements are idempotent).

-- ─── set_updated_at ──────────────────────────────────────────────────────────
-- Trigger function used by every table that has an updated_at column.
-- Create a trigger on any table with:
--   create or replace trigger <table>_updated_at
--     before update on <table>
--     for each row execute procedure set_updated_at();

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
