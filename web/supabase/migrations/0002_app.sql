-- What the build showed the first schema was missing, plus the functions that need to act
-- before a user has a membership (sign up, accepting an invitation).

-- ---------------------------------------------------------------- team names

alter table memberships add column display_name text not null default '';
alter table memberships add column email text not null default '';
create index on memberships (lower(email));

-- Members must be able to read their own outlet assignments (0001 only let owners/admins read them,
-- so outlet staff saw no outlet at all after signing in).
create policy membership_outlets_read_own on membership_outlets for select
  using (exists (select 1 from memberships m where m.id = membership_id and m.user_id = auth.uid()));

-- ---------------------------------------------------------------- purchasing

-- Packs received so far per order line; deliveries without stock booking still count.
alter table purchase_order_lines add column received_packs numeric(14,4) not null default 0 check (received_packs >= 0);

-- Next order number per library without races: B-0001, B-0002, ...
create table order_counters (
  library_id uuid primary key references libraries(id) on delete cascade,
  last_number integer not null default 0
);
alter table order_counters enable row level security;

create function next_order_number(lib uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not is_member(lib) then
    raise exception 'not a member of this library' using errcode = 'insufficient_privilege';
  end if;
  insert into order_counters (library_id, last_number) values (lib, 1)
    on conflict (library_id) do update set last_number = order_counters.last_number + 1
    returning last_number into n;
  return 'B-' || lpad(n::text, 4, '0');
end $$;

-- ---------------------------------------------------------------- stock counts

-- Counted quantities while a count is open. Closing the count turns them into movements.
create table stock_count_lines (
  stock_event_id uuid not null references stock_events(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  counted_base numeric(14,4) not null check (counted_base >= 0),
  updated_at timestamptz not null default now(),
  primary key (stock_event_id, ingredient_id)
);
create index on stock_count_lines (ingredient_id);
alter table stock_count_lines enable row level security;
create policy stock_count_lines_outlet on stock_count_lines for all
  using (exists (select 1 from stock_events e where e.id = stock_event_id and e.status = 'open' and can_access_outlet(e.outlet_id)))
  with check (exists (select 1 from stock_events e where e.id = stock_event_id and e.status = 'open' and can_access_outlet(e.outlet_id)));
-- read access also after closing, for history
create policy stock_count_lines_read on stock_count_lines for select
  using (exists (select 1 from stock_events e where e.id = stock_event_id and can_access_outlet(e.outlet_id)));

-- ---------------------------------------------------------------- sign up & invitations

-- Called once after sign up: creates the library, its first outlet and the owner membership.
create function create_library(lib_name text, outlet_name text, owner_name text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lib uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from memberships where user_id = uid) then
    raise exception 'already a member of a library' using errcode = 'unique_violation';
  end if;
  insert into libraries (name) values (lib_name) returning id into lib;
  insert into outlets (library_id, name) values (lib, outlet_name);
  insert into memberships (library_id, user_id, role, all_outlets, display_name, email)
    values (lib, uid, 'owner', true, owner_name, coalesce((select email from auth.users where id = uid), ''));
  insert into categories (library_id, kind, name)
    select lib, k, n from (values
      ('ingredient', 'Gemüse'), ('ingredient', 'Obst'), ('ingredient', 'Trockenware'), ('ingredient', 'Molkereiprodukte'),
      ('ingredient', 'Fleisch & Fisch'), ('ingredient', 'Gewürze & Öle'), ('recipe', 'Grundrezepte'), ('recipe', 'Vorspeisen'),
      ('recipe', 'Hauptgerichte'), ('recipe', 'Desserts')) v(k, n);
  return lib;
end $$;

-- Accept an invitation by its token hash. The signed-in user's email must match the invitation.
create function accept_invitation(hash text, member_name text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  inv invitations%rowtype;
  mem uuid;
  user_email text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  select * into inv from invitations where token_hash = hash for update;
  if not found or inv.accepted_at is not null or inv.expires_at < now() then
    raise exception 'invitation invalid or expired' using errcode = 'no_data_found';
  end if;
  select email into user_email from auth.users where id = uid;
  if lower(user_email) <> lower(inv.email) then
    raise exception 'invitation is for a different email address' using errcode = 'insufficient_privilege';
  end if;
  insert into memberships (library_id, user_id, role, all_outlets, display_name, email)
    values (inv.library_id, uid, inv.role, cardinality(inv.outlet_ids) = 0, member_name, user_email)
    returning id into mem;
  insert into membership_outlets (membership_id, outlet_id)
    select mem, o from unnest(inv.outlet_ids) o
    where exists (select 1 from outlets where id = o and library_id = inv.library_id);
  update invitations set accepted_at = now() where id = inv.id;
  return inv.library_id;
end $$;

-- An invitation may be read by its token without a membership (to show "Join Demo Bistro").
create function invitation_preview(hash text) returns table (library_name text, email text, role member_role, expired boolean)
  language sql stable security definer set search_path = public as $$
  select l.name, i.email, i.role, (i.expires_at < now() or i.accepted_at is not null)
  from invitations i join libraries l on l.id = i.library_id
  where i.token_hash = hash
$$;

-- ---------------------------------------------------------------- rate limits & jobs

-- Sliding-window rate limit for anything that sends email. Returns false when over the limit.
create table rate_limit_events (
  key text not null,
  at timestamptz not null default now()
);
create index on rate_limit_events (key, at desc);
alter table rate_limit_events enable row level security;

create function hit_rate_limit(k text, max_hits integer, window_seconds integer) returns boolean
  language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtext(k));
  select count(*) into n from rate_limit_events where key = k and at > now() - make_interval(secs => window_seconds);
  if n >= max_hits then
    return false;
  end if;
  insert into rate_limit_events (key) values (k);
  return true;
end $$;

-- One row per job run and per failed item, so failures are visible and retried on the next run.
create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  item_key text,
  status text not null check (status in ('ok', 'failed', 'dead')),
  attempts integer not null default 1,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on job_runs (job, status, updated_at desc);
create unique index job_runs_item on job_runs (job, item_key) where item_key is not null;
alter table job_runs enable row level security;

-- Low-stock alerts are sent at most once per item and day.
create table stock_alerts_sent (
  outlet_id uuid not null references outlets(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  day date not null,
  primary key (outlet_id, ingredient_id, day)
);
alter table stock_alerts_sent enable row level security;

-- ---------------------------------------------------------------- grants
-- Supabase grants these by default; a plain Postgres needs them for the authenticated role.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- Tables only the server (service role / owner) touches: no policies, so RLS denies everyone else.
revoke all on order_counters, rate_limit_events, job_runs, stock_alerts_sent, processed_webhooks from authenticated;
