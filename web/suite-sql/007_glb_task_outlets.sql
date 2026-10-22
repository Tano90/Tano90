-- GLB AI Suite: team tasks by outlet (Oct 2026).
-- Requires 001, 002 and 006. Tasks stay in the workspace (glb_snapshots.data->'tasks'); a task may now carry
-- "outlet_id": null (= "Betriebsübergreifend / Allgemein") or the id of an outlet of the SAME workspace
-- (glb_snapshots.data->'outlets'). Existing tasks without outlet_id are neither changed nor assigned.
-- The check runs as a trigger on every write to glb_snapshots, so it covers glb_save_snapshot, glb_save_limited and
-- any other path, independent of the browser: an outlet id of another organisation (or any made-up id) is refused.
-- A task whose outlet was removed later keeps its old id as long as that id itself is not changed (no data loss).
-- Safe to run more than once. Run in a staging project first.
begin;

create schema if not exists private;

create or replace function private.glb_check_task_outlets() returns trigger
language plpgsql set search_path = '' as $$
declare
  t jsonb;
  v_outlets text[];
  v_old text;
  v_had_old boolean;
begin
  if jsonb_typeof(new.data -> 'tasks') is distinct from 'array' then return new; end if;
  select coalesce(array_agg(o ->> 'id'), '{}')
    into v_outlets
    from jsonb_array_elements(case when jsonb_typeof(new.data -> 'outlets') = 'array' then new.data -> 'outlets' else '[]'::jsonb end) o;
  for t in select value from jsonb_array_elements(new.data -> 'tasks') loop
    if jsonb_typeof(t) is distinct from 'object' then continue; end if;
    if not (t ? 'outlet_id') or jsonb_typeof(t -> 'outlet_id') = 'null' then continue; end if;
    if jsonb_typeof(t -> 'outlet_id') is distinct from 'string' or length(t ->> 'outlet_id') = 0 or length(t ->> 'outlet_id') > 200 then
      raise exception 'TASK_OUTLET_INVALID';
    end if;
    if (t ->> 'outlet_id') = any (v_outlets) then continue; end if;
    -- unknown id: allowed only if the same task already had exactly this id before (outlet removed in the meantime)
    v_had_old := false;
    if tg_op = 'UPDATE' and jsonb_typeof(old.data -> 'tasks') = 'array' then
      select x.value ->> 'outlet_id', true into v_old, v_had_old
        from jsonb_array_elements(old.data -> 'tasks') x(value)
       where jsonb_typeof(x.value) = 'object' and x.value ->> 'id' = t ->> 'id'
       limit 1;
    end if;
    if not coalesce(v_had_old, false) or v_old is distinct from (t ->> 'outlet_id') then
      raise exception 'TASK_OUTLET_INVALID';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.glb_check_task_outlets() from public, anon, authenticated;

drop trigger if exists glb_snapshots_task_outlets on public.glb_snapshots;
create trigger glb_snapshots_task_outlets
  before insert or update of data on public.glb_snapshots
  for each row execute function private.glb_check_task_outlets();

commit;
