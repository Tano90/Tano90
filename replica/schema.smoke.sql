-- Smoke tests for schema.sql. Run against a scratch database after a Supabase auth stub:
--   create schema auth; create table auth.users (id uuid primary key);
--   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
--   create role authenticated;
-- Each 'must fail' step is expected to print an ERROR.
\set ON_ERROR_STOP 0
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-00000000000c');
insert into libraries (id, name) values ('10000000-0000-0000-0000-000000000001', 'Lib A'), ('10000000-0000-0000-0000-000000000002', 'Lib B');
insert into outlets (id, library_id, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Mitte'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Nord'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Fremd');
insert into memberships (id, library_id, user_id, role) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'outlet_staff'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'owner');
insert into membership_outlets values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002');
insert into ingredients (id, library_id, name) values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Spinat');
insert into recipes (id, library_id, name) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'B');

\echo '--- 1. cycle A->B->A must fail'
insert into recipe_lines (recipe_id, sub_recipe_id, quantity, unit) values ('50000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 100, 'g');
insert into recipe_lines (recipe_id, sub_recipe_id, quantity, unit) values ('50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 100, 'g');

\echo '--- 2. WAC: 1000 g @ 0.5 ct + 1000 g @ 1.0 ct = avg 0.75; waste 500 g at 0.75'
insert into stock_events (id, library_id, outlet_id, type) values ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'delivery');
insert into stock_movements (stock_event_id, outlet_id, ingredient_id, delta_base, unit_cost_cents) values
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 1000, 0.5),
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 1000, 1.0);
insert into stock_events (id, library_id, outlet_id, type) values ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'waste');
insert into stock_movements (stock_event_id, outlet_id, ingredient_id, delta_base, reason) values
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', -500, 'verdorben');
select quantity_base, round(avg_cost_cents, 4) avg from stock_levels;
select delta_base, round(unit_cost_cents, 4) from stock_movements where stock_event_id = '60000000-0000-0000-0000-000000000002';

\echo '--- 3. ledger is append-only (must fail)'
update stock_movements set delta_base = 0;

\echo '--- 4. duplicate POS sale event (must fail)'
insert into stock_events (library_id, outlet_id, type, idempotency_key) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'sale', 'rcpt-1');
insert into stock_events (library_id, outlet_id, type, idempotency_key) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'sale', 'rcpt-1');

\echo '--- 5. second open count on same outlet (must fail)'
insert into stock_events (library_id, outlet_id, type, status) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'count', 'open');
insert into stock_events (library_id, outlet_id, type, status) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'count', 'open');

\echo '--- 6. RLS'
grant usage on schema public, auth to authenticated;
grant all on all tables in schema public to authenticated;
grant select on auth.users to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
\echo 'staff of Nord: outlets visible (expect Nord), stock levels (expect 0), ingredients (expect 1)'
select name from outlets;
select count(*) from stock_levels;
select count(*) from ingredients;
\echo 'staff writes recipe (must fail)'
insert into recipes (library_id, name) values ('10000000-0000-0000-0000-000000000001', 'X');
\echo 'staff records waste in Nord (ok, trigger writes stock_levels despite RLS)'
insert into stock_events (id, library_id, outlet_id, type) values ('60000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'waste');
insert into stock_movements (stock_event_id, outlet_id, ingredient_id, delta_base) values ('60000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', -10);
select quantity_base from stock_levels;
\echo 'staff writes to Mitte (must fail)'
insert into stock_events (library_id, outlet_id, type) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'waste');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
\echo 'owner of Lib B sees Lib A ingredients (expect 0)'
select count(*) from ingredients;
\echo '--- 7. movement on wrong outlet (must fail)'
insert into stock_movements (stock_event_id, outlet_id, ingredient_id, delta_base) values ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 5);
