-- GLB AI Suite: v1.1 Intelligence Center, integrated into the existing workspace model.
-- Requires 001_cloud_pilot.sql and 002_roles_and_security.sql (glb_organizations, glb_memberships, glb_snapshots).
-- Does NOT need 003/005 from the v1.1 RC1 package: articles, outlets, monthly sales, tasks and minimum stock stay in
-- the workspace (glb_snapshots) like all other modules, so IDs and links remain one set.
-- New: tables for POS check lines, training results (personal), audit events and API usage; RPCs that check role and
-- organisation on the server. Replaces glb_read_workspace and glb_save_limited by versions that behave exactly as in
-- 002 for every existing key and additionally hand out / accept the keys "tasks" and "parStock".
-- Safe to run more than once. No existing table, row or policy of 001/002 is changed or dropped.
-- Run in a staging project first (see replica/glb-v11-integration.md, "Migration").
begin;

create schema if not exists private;

-- Role check used by policies and RPCs. Not exposed through the Data API (schema private).
create or replace function private.glb_has_role(p_org uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.glb_memberships m
    where m.organization_id = p_org and m.user_id = (select auth.uid()) and m.role = any(p_roles));
$$;
revoke all on function private.glb_has_role(uuid, text[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.glb_has_role(uuid, text[]) to authenticated;

-- Management check for server routes (KI-Marktcheck, Umfeldsuche). Same name as in v1.1 RC1 (005).
create or replace function public.glb_v11_can_manage(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.glb_has_role(p_org, array['owner','editor','restaurant_manager','general_manager']);
$$;
revoke all on function public.glb_v11_can_manage(uuid) from public, anon;
grant execute on function public.glb_v11_can_manage(uuid) to authenticated;

-- ---------------------------------------------------------------- POS check lines
create table if not exists public.glb_pos_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.glb_organizations(id) on delete cascade,
  service_date date not null,
  check_id text not null check (length(check_id) between 1 and 100),
  outlet_id text not null check (length(outlet_id) between 1 and 100), -- outlet id of the workspace (checked on insert)
  product_id text check (length(product_id) <= 100),
  product_name text not null check (length(product_name) between 1 and 200),
  quantity numeric(16,3) not null check (quantity <> 0 and abs(quantity) <= 10000000),
  unit_price_gross numeric(14,4) not null check (unit_price_gross >= 0 and unit_price_gross <= 1000000),
  unit_cost_net numeric(14,4) check (unit_cost_net >= 0),
  vat_percent numeric(5,2) not null check (vat_percent in (7,19)),
  guests integer check (guests between 1 and 1000),
  stage text not null default 'none' check (stage in ('none','aperitif','water','upgrade','dessert','coffee','afterglow')),
  staff_code text not null default '' check (length(staff_code) <= 80),
  source_system text not null default 'csv' check (source_system ~ '^[a-zA-Z0-9_-]{1,64}$'),
  external_line_id text check (length(external_line_id) between 1 and 200),
  line_type text not null default 'sale' check (line_type in ('sale','void','correction')),
  corrects_external_line_id text check (length(corrects_external_line_id) between 1 and 200),
  review_status text check (review_status = 'pending'),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  line_no integer not null check (line_no >= 1),
  file_name text not null check (length(file_name) between 1 and 250),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check ((line_type = 'sale' and quantity > 0) or (line_type <> 'sale' and corrects_external_line_id is not null)),
  unique (organization_id, source_hash, line_no)
);
create unique index if not exists glb_pos_lines_external on public.glb_pos_lines (organization_id, source_system, external_line_id)
  where external_line_id is not null;
create index if not exists glb_pos_lines_date on public.glb_pos_lines (organization_id, service_date desc, outlet_id);
create index if not exists glb_pos_lines_check on public.glb_pos_lines (organization_id, service_date, outlet_id, check_id);
alter table public.glb_pos_lines enable row level security;
revoke all on public.glb_pos_lines from public, anon, authenticated;
grant select on public.glb_pos_lines to authenticated;
drop policy if exists glb_pos_read on public.glb_pos_lines;
create policy glb_pos_read on public.glb_pos_lines for select to authenticated
  using (private.glb_has_role(organization_id, array['owner','editor','restaurant_manager','general_manager']));
-- No insert/update/delete grants: writes only through glb_pos_insert / glb_pos_review / glb_pos_insert_system.

-- ---------------------------------------------------------------- training (answer key never readable)
create table if not exists public.glb_training_questions (
  stage text primary key check (stage in ('aperitif','water','upgrade','dessert','coffee','afterglow')),
  answer integer not null check (answer between 0 and 9),
  tip text not null
);
alter table public.glb_training_questions enable row level security;
revoke all on public.glb_training_questions from public, anon, authenticated;
-- same key and tips as v1.1 RC1 (public/intelligence.mjs, STAGES)
insert into public.glb_training_questions (stage, answer, tip) values
  ('aperitif', 0, 'Kurzer, konkreter Vorschlag direkt beim Empfang – ohne Druck.'),
  ('water', 1, 'Eine ehrliche Wahl anbieten und Wünsche respektieren.'),
  ('upgrade', 1, 'Zum gewählten Gericht passende, klar bepreiste Erweiterungen anbieten.'),
  ('dessert', 0, 'Zum richtigen Zeitpunkt ein konkretes Dessert nennen.'),
  ('coffee', 1, 'Kaffeeauswahl als natürlichen Abschluss anbieten.'),
  ('afterglow', 0, 'Ein kleines Erlebnis anbieten, transparent und passend zum Gast.')
on conflict (stage) do update set answer = excluded.answer, tip = excluded.tip;

create table if not exists public.glb_training_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.glb_organizations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  stage text not null check (stage in ('aperitif','water','upgrade','dessert','coffee','afterglow')),
  answer integer not null,
  correct boolean not null,
  points integer not null check (points in (0,100)),
  day date not null default ((now() at time zone 'Europe/Berlin')::date),
  created_at timestamptz not null default now(),
  check ((correct and points = 100) or (not correct and points = 0)),
  unique (organization_id, user_id, stage, day)
);
alter table public.glb_training_results enable row level security;
revoke all on public.glb_training_results from public, anon, authenticated;
grant select on public.glb_training_results to authenticated;
drop policy if exists glb_training_own on public.glb_training_results;
-- personal results: every person sees only their own rows; no ranking, management sees no individual results
create policy glb_training_own on public.glb_training_results for select to authenticated
  using (user_id = (select auth.uid()) and private.glb_has_role(organization_id,
    array['owner','editor','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager']));

-- ---------------------------------------------------------------- audit and API usage
create table if not exists public.glb_audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.glb_organizations(id) on delete cascade,
  entity text not null,
  entity_id text,
  operation text not null,
  actor uuid default auth.uid(),
  happened_at timestamptz not null default now(),
  detail jsonb
);
create index if not exists glb_audit_org_date on public.glb_audit_events (organization_id, happened_at desc);
alter table public.glb_audit_events enable row level security;
revoke all on public.glb_audit_events from public, anon, authenticated;
grant select on public.glb_audit_events to authenticated;
drop policy if exists glb_audit_read on public.glb_audit_events;
create policy glb_audit_read on public.glb_audit_events for select to authenticated
  using (private.glb_has_role(organization_id, array['owner','general_manager']));

create table if not exists public.glb_api_usage (
  organization_id uuid not null references public.glb_organizations(id) on delete cascade,
  endpoint text not null check (endpoint ~ '^[a-z_]{1,40}$'),
  day date not null,
  calls integer not null default 0,
  primary key (organization_id, endpoint, day)
);
alter table public.glb_api_usage enable row level security;
revoke all on public.glb_api_usage from public, anon, authenticated;

-- Workspace saves: who, when, which revision, which areas changed (counts only, no business values).
create or replace function private.glb_audit_snapshot() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_keys jsonb := '{}'::jsonb; k text;
begin
  for k in select jsonb_object_keys(coalesce(new.data,'{}'::jsonb)) union select jsonb_object_keys(coalesce(old.data,'{}'::jsonb)) loop
    if (old.data -> k) is distinct from (new.data -> k) then
      v_keys := v_keys || jsonb_build_object(k, case when jsonb_typeof(new.data -> k) = 'array' then jsonb_array_length(new.data -> k) else null end);
    end if;
  end loop;
  insert into public.glb_audit_events (organization_id, entity, entity_id, operation, actor, detail)
  values (new.organization_id, 'workspace', new.revision::text, 'SAVE', (select auth.uid()),
          jsonb_build_object('from_revision', old.revision, 'to_revision', new.revision, 'changed', v_keys));
  return new;
end $$;
revoke all on function private.glb_audit_snapshot() from public, anon, authenticated;
drop trigger if exists glb_snapshot_audit on public.glb_snapshots;
create trigger glb_snapshot_audit after update on public.glb_snapshots
  for each row when (old.data is distinct from new.data) execute function private.glb_audit_snapshot();

create or replace function private.glb_audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  insert into public.glb_audit_events (organization_id, entity, entity_id, operation, actor, detail)
  values (r.organization_id, tg_table_name, r.id::text, tg_op, (select auth.uid()),
          case when tg_table_name = 'glb_training_results' then null -- personal: only that a result was stored
               else jsonb_build_object('old', case when tg_op <> 'INSERT' then to_jsonb(old) end, 'new', case when tg_op <> 'DELETE' then to_jsonb(new) end) end);
  return null;
end $$;
revoke all on function private.glb_audit_row() from public, anon, authenticated;
drop trigger if exists glb_pos_audit on public.glb_pos_lines;
create trigger glb_pos_audit after insert or update or delete on public.glb_pos_lines for each row execute function private.glb_audit_row();
drop trigger if exists glb_training_audit on public.glb_training_results;
create trigger glb_training_audit after insert on public.glb_training_results for each row execute function private.glb_audit_row();

-- ---------------------------------------------------------------- POS writes
-- Shared core: validates every line, the outlet against the workspace, skips certain duplicates (same file line or
-- same external position id) and handles possible overlaps (same day, outlet, check, article, quantity, price from
-- another file or source) by p_overlap: 'review' (stored as pending, not counted), 'skip' or 'accept'.
create or replace function private.glb_pos_insert_core(p_org uuid, p_lines jsonb, p_overlap text, p_source text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l jsonb; v_outlets jsonb; v_ins int := 0; v_dup int := 0; v_rev int := 0; v_overlap boolean; v_status text; v_src text; n int := 0;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 1000 then raise exception 'INVALID_LINES'; end if;
  if p_overlap not in ('review','skip','accept') then raise exception 'INVALID_OVERLAP_DECISION'; end if;
  select data -> 'outlets' into v_outlets from public.glb_snapshots where organization_id = p_org;
  for l in select * from jsonb_array_elements(p_lines) loop
    n := n + 1;
    v_src := coalesce(p_source, nullif(l ->> 'source_system', ''), 'csv');
    if not exists (select 1 from jsonb_array_elements(coalesce(v_outlets,'[]'::jsonb)) o where o ->> 'id' = l ->> 'outlet_id') then
      raise exception 'UNKNOWN_OUTLET line %', n; end if;
    if exists (select 1 from public.glb_pos_lines p where p.organization_id = p_org
        and ((p.source_hash = l ->> 'source_hash' and p.line_no = (l ->> 'line_no')::int)
          or (l ->> 'external_line_id' is not null and p.source_system = v_src and p.external_line_id = l ->> 'external_line_id'))) then
      v_dup := v_dup + 1; continue;
    end if;
    v_overlap := exists (select 1 from public.glb_pos_lines p where p.organization_id = p_org
      and p.service_date = (l ->> 'service_date')::date and p.outlet_id = l ->> 'outlet_id' and p.check_id = l ->> 'check_id'
      and lower(trim(p.product_name)) = lower(trim(l ->> 'product_name')) and p.quantity = (l ->> 'quantity')::numeric
      and p.unit_price_gross = (l ->> 'unit_price_gross')::numeric
      and (p.source_hash <> l ->> 'source_hash' or p.source_system <> v_src));
    v_status := null;
    if v_overlap and p_overlap = 'skip' then v_dup := v_dup + 1; continue; end if;
    if v_overlap and p_overlap = 'review' then v_status := 'pending'; v_rev := v_rev + 1; end if;
    insert into public.glb_pos_lines (organization_id, service_date, check_id, outlet_id, product_id, product_name, quantity,
      unit_price_gross, unit_cost_net, vat_percent, guests, stage, staff_code, source_system, external_line_id, line_type,
      corrects_external_line_id, review_status, source_hash, line_no, file_name)
    values (p_org, (l ->> 'service_date')::date, l ->> 'check_id', l ->> 'outlet_id', nullif(l ->> 'product_id',''), l ->> 'product_name',
      (l ->> 'quantity')::numeric, (l ->> 'unit_price_gross')::numeric, (l ->> 'unit_cost_net')::numeric, (l ->> 'vat_percent')::numeric,
      (l ->> 'guests')::int, coalesce(nullif(l ->> 'stage',''),'none'), left(coalesce(l ->> 'staff_code',''),80), v_src,
      nullif(l ->> 'external_line_id',''), coalesce(nullif(l ->> 'line_type',''),'sale'), nullif(l ->> 'corrects_external_line_id',''),
      v_status, l ->> 'source_hash', (l ->> 'line_no')::int, coalesce(nullif(l ->> 'file_name',''),'import.csv'))
    on conflict do nothing;
    if found then v_ins := v_ins + 1; else v_dup := v_dup + 1; end if;
  end loop;
  return jsonb_build_object('inserted', v_ins, 'duplicates', v_dup, 'review', v_rev, 'received', n);
end $$;
revoke all on function private.glb_pos_insert_core(uuid, jsonb, text, text) from public, anon, authenticated;

create or replace function public.glb_pos_insert(p_org uuid, p_lines jsonb, p_overlap text default 'review')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.glb_has_role(p_org, array['owner','editor','restaurant_manager','general_manager']) then raise exception 'ROLE_NOT_PERMITTED'; end if;
  return private.glb_pos_insert_core(p_org, p_lines, p_overlap, null);
end $$;
revoke all on function public.glb_pos_insert(uuid, jsonb, text) from public, anon;
grant execute on function public.glb_pos_insert(uuid, jsonb, text) to authenticated;

-- Signed webhook (server route with the service key): the organisation comes from the server configuration.
create or replace function public.glb_pos_insert_system(p_org uuid, p_source text, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_source !~ '^[a-zA-Z0-9_-]{1,64}$' or p_source = 'csv' then raise exception 'INVALID_SOURCE'; end if;
  return private.glb_pos_insert_core(p_org, p_lines, 'review', p_source);
end $$;
revoke all on function public.glb_pos_insert_system(uuid, text, jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.glb_pos_insert_system(uuid, text, jsonb) to service_role;
  end if;
end $$;

create or replace function public.glb_pos_review(p_org uuid, p_ids uuid[], p_decision text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.glb_has_role(p_org, array['owner','editor','restaurant_manager','general_manager']) then raise exception 'ROLE_NOT_PERMITTED'; end if;
  if p_decision = 'accept' then
    update public.glb_pos_lines set review_status = null where organization_id = p_org and id = any(p_ids) and review_status = 'pending';
  elsif p_decision = 'reject' then
    delete from public.glb_pos_lines where organization_id = p_org and id = any(p_ids) and review_status = 'pending';
  else raise exception 'INVALID_DECISION'; end if;
  get diagnostics v = row_count;
  return v;
end $$;
revoke all on function public.glb_pos_review(uuid, uuid[], text) from public, anon;
grant execute on function public.glb_pos_review(uuid, uuid[], text) to authenticated;

-- Aggregation for long periods (no single lines leave the database). Same definitions as aggregateFunnel:
-- a check counts for a topic when its net quantity of that topic is above 0; pending lines are excluded;
-- guests only when every check has a consistent number.
create or replace function public.glb_pos_summary(p_org uuid, p_from date, p_to date, p_outlet text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tags jsonb; r jsonb;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.glb_has_role(p_org, array['owner','editor','restaurant_manager','general_manager']) then raise exception 'ROLE_NOT_PERMITTED'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 731 then raise exception 'INVALID_PERIOD'; end if;
  select coalesce(data -> 'intelligence' -> 'tags', '[]'::jsonb) into v_tags from public.glb_snapshots where organization_id = p_org;
  with tags as (
    select lower(trim(t ->> 'product_name')) as name, t ->> 'stage' as stage from jsonb_array_elements(v_tags) t
  ), lines as (
    select p.service_date, p.outlet_id, p.check_id, p.guests, p.quantity,
           case when p.stage <> 'none' then p.stage else coalesce((select stage from tags where name = lower(trim(p.product_name)) limit 1), 'none') end as stage
    from public.glb_pos_lines p
    where p.organization_id = p_org and p.service_date between p_from and p_to and p.review_status is null
      and (p_outlet is null or p.outlet_id = p_outlet)
  ), checks as (
    select service_date, outlet_id, check_id, min(guests) as g_min, max(guests) as g_max, count(guests) as g_n, count(*) as n
    from lines group by 1,2,3
  ), topics as (
    select stage, count(*) as checks from (
      select service_date, outlet_id, check_id, stage from lines where stage <> 'none' group by 1,2,3,4 having sum(quantity) > 0
    ) x group by stage
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'lines', (select count(*) from lines),
    'checks', (select count(*) from checks),
    'guests_complete', (select count(*) > 0 and bool_and(g_n > 0 and g_min = g_max) from checks),
    'covers', (select case when count(*) > 0 and bool_and(g_n > 0 and g_min = g_max) then sum(g_min) end from checks),
    'stages', coalesce((select jsonb_object_agg(stage, checks) from topics), '{}'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.glb_pos_summary(uuid, date, date, text) from public, anon;
grant execute on function public.glb_pos_summary(uuid, date, date, text) to authenticated;

-- ---------------------------------------------------------------- training answer, scored here
create or replace function public.glb_submit_training(p_org uuid, p_stage text, p_answer integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q record; v_ok boolean;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.glb_has_role(p_org, array['owner','editor','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager'])
    then raise exception 'ROLE_NOT_PERMITTED'; end if;
  select * into q from public.glb_training_questions where stage = p_stage;
  if q is null then raise exception 'UNKNOWN_STAGE'; end if;
  if p_answer is null or p_answer < 0 or p_answer > 9 then raise exception 'INVALID_ANSWER'; end if;
  v_ok := p_answer = q.answer;
  begin
    insert into public.glb_training_results (organization_id, user_id, stage, answer, correct, points)
    values (p_org, (select auth.uid()), p_stage, p_answer, v_ok, case when v_ok then 100 else 0 end);
  exception when unique_violation then
    raise exception 'TRAINING_ALREADY_TODAY';
  end;
  return jsonb_build_object('correct', v_ok, 'points', case when v_ok then 100 else 0 end, 'tip', q.tip);
end $$;
revoke all on function public.glb_submit_training(uuid, text, integer) from public, anon;
grant execute on function public.glb_submit_training(uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------- rate limit for server routes
create or replace function public.glb_api_take(p_org uuid, p_endpoint text, p_daily_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.glb_has_role(p_org, array['owner','editor','restaurant_manager','general_manager']) then raise exception 'ROLE_NOT_PERMITTED'; end if;
  insert into public.glb_api_usage (organization_id, endpoint, day, calls) values (p_org, p_endpoint, (now() at time zone 'Europe/Berlin')::date, 1)
  on conflict (organization_id, endpoint, day) do update set calls = public.glb_api_usage.calls + 1
  returning calls into v;
  return v <= greatest(p_daily_limit, 0);
end $$;
revoke all on function public.glb_api_take(uuid, text, integer) from public, anon;
grant execute on function public.glb_api_take(uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------- workspace read/write: 002 + tasks/parStock
create or replace function public.glb_read_workspace(p_org uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; d jsonb; rev bigint; base jsonb; clean_items jsonb; clean_ing jsonb;
begin
 select role into r from public.glb_memberships
  where organization_id=p_org and user_id=(select auth.uid());
 if r is null then raise exception 'ACCESS_DENIED'; end if;
 select data,revision into d,rev from public.glb_snapshots where organization_id=p_org;
 if d is null then raise exception 'WORKSPACE_MISSING'; end if;
 if r in ('owner','editor','restaurant_manager','general_manager') then
   return jsonb_build_object('data',d,'revision',rev,'role',r);
 end if;
 select coalesce(jsonb_agg((e.value - 'costNet' - 'costDetail' - 'purchaseCost' - 'margin' - 'db' - 'costHistory')
                   || jsonb_build_object('costNet',0)), '[]'::jsonb)
   into clean_items from jsonb_array_elements(case when jsonb_typeof(d->'items')='array' then d->'items' else '[]'::jsonb end) AS e(value);
 select coalesce(jsonb_agg((e.value - 'packCostNet' - 'supplierPriceNet' - 'costNet') || jsonb_build_object('packCostNet',0)), '[]'::jsonb)
   into clean_ing from jsonb_array_elements(case when jsonb_typeof(d->'ingredients')='array' then d->'ingredients' else '[]'::jsonb end) AS e(value);
 base:=jsonb_build_object('version',4,'mode','own','business',coalesce(d->'business','"Betrieb"'::jsonb),
   'targetPct',30,'items',clean_items,'recipe','{}'::jsonb,'outlets',coalesce(d->'outlets','[]'::jsonb),
   'sales','[]'::jsonb,'market','[]'::jsonb,
   -- v1.1: tasks are for every role (RC1: glb_v1_tasks readable by all roles)
   'tasks',coalesce(d->'tasks','[]'::jsonb));
 if r in ('service_staff','service_lead','sales') then
   base:=base||jsonb_build_object('funnel',coalesce(d->'funnel','[]'::jsonb),
     'funnelGoals',coalesce(d->'funnelGoals','{}'::jsonb),
     'funnelProjectedDays',coalesce(d->'funnelProjectedDays','30'::jsonb));
 end if;
 if r in ('service_lead','sales') then
   -- v1.1: the cost snapshot of each sale line stays on the server for these roles
   base:=base||jsonb_build_object('sales',(select coalesce(jsonb_agg(e.value - 'unitCostNet'),'[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(d->'sales')='array' then d->'sales' else '[]'::jsonb end) e(value)),
    'dailySales',coalesce(d->'dailySales','[]'::jsonb));
 end if;
 if r='sales' then
   base:=base||jsonb_build_object('market',coalesce(d->'market','[]'::jsonb),
    'marketDiscovered',coalesce(d->'marketDiscovered','[]'::jsonb),
    'marketLastScan',coalesce(d->'marketLastScan','""'::jsonb));
 end if;
 if r in ('kitchen_staff','kitchen_lead') then
   base:=base||jsonb_build_object('ingredients',case when r='kitchen_lead' then coalesce(d->'ingredients','[]'::jsonb) else clean_ing end,
   'recipes',coalesce(d->'recipes','[]'::jsonb),
   'warehouses',coalesce(d->'warehouses','[]'::jsonb),
   'inventoryCounts',coalesce(d->'inventoryCounts','[]'::jsonb),
   'ingredientWarehouses',coalesce(d->'ingredientWarehouses','{}'::jsonb),
   'stockMovements',coalesce(d->'stockMovements','[]'::jsonb),
   -- v1.1: minimum stock list for kitchen roles (RC1: glb_v1_inventory readable by kitchen roles)
   'parStock',coalesce(d->'parStock','[]'::jsonb));
 end if;
 if r='kitchen_lead' then
   base:=base||jsonb_build_object('items',coalesce(d->'items','[]'::jsonb),
   'dailySales',coalesce(d->'dailySales','[]'::jsonb),
   'purchaseOrders',coalesce(d->'purchaseOrders','[]'::jsonb),
   'v04Forecast',coalesce(d->'v04Forecast','{}'::jsonb));
 end if;
 return jsonb_build_object('data',base,'revision',rev,'role',r);
end $$;
revoke all on function public.glb_read_workspace(uuid) from public,anon;
grant execute on function public.glb_read_workspace(uuid) to authenticated;

create or replace function public.glb_save_limited(p_org uuid,p_expected_revision bigint,p_data jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare r text; allowed text[]; k text; patch jsonb:='{}'::jsonb; v_revision bigint;
begin
 select role into r from public.glb_memberships where organization_id=p_org and user_id=(select auth.uid());
 if r is null then raise exception 'ACCESS_DENIED'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>4000000 then raise exception 'INVALID_PAYLOAD'; end if;
 allowed:=case r
  when 'service_staff' then array['funnel','tasks']
  when 'service_lead' then array['funnel','sales','dailySales','tasks']
  when 'sales' then array['funnel','sales','dailySales','market','marketDiscovered','marketLastScan','tasks']
  when 'kitchen_staff' then array['inventoryCounts','tasks']
  when 'kitchen_lead' then array['items','ingredients','recipes','warehouses','inventoryCounts','stockMovements','ingredientWarehouses','purchaseOrders','dailySales','v04Forecast','tasks','parStock']
  else array[]::text[] end;
 if array_length(allowed,1) is null then raise exception 'WRITE_NOT_ALLOWED'; end if;
 foreach k in array allowed loop
   if p_data ? k then patch:=patch||jsonb_build_object(k,p_data->k); end if;
 end loop;
 if patch='{}'::jsonb then raise exception 'NO_PERMITTED_CHANGES'; end if;
 -- Roles that received sales without cost snapshots must not erase them: keep the stored unitCostNet per line id.
 if r in ('service_lead','sales') and patch ? 'sales' and jsonb_typeof(patch->'sales')='array' then
   patch:=patch||jsonb_build_object('sales',(
     select coalesce(jsonb_agg(case when ex.value ? 'unitCostNet' then (e.value - 'unitCostNet') || jsonb_build_object('unitCostNet', ex.value->'unitCostNet')
                                    else e.value - 'unitCostNet' end order by e.ord), '[]'::jsonb)
     from jsonb_array_elements(patch->'sales') with ordinality e(value, ord)
     left join lateral (select x.value from public.glb_snapshots s2, jsonb_array_elements(case when jsonb_typeof(s2.data->'sales')='array' then s2.data->'sales' else '[]'::jsonb end) x(value)
                        where s2.organization_id=p_org and x.value->>'id' = e.value->>'id' limit 1) ex on true));
 end if;
 update public.glb_snapshots set data=data||patch,revision=revision+1,updated_at=now(),updated_by=(select auth.uid())
  where organization_id=p_org and revision=p_expected_revision returning revision into v_revision;
 if v_revision is null then raise exception 'REVISION_CONFLICT'; end if;
 return v_revision;
end $$;
revoke all on function public.glb_save_limited(uuid,bigint,jsonb) from public,anon;
grant execute on function public.glb_save_limited(uuid,bigint,jsonb) to authenticated;

commit;
