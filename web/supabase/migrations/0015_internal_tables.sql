-- schema_migrations is created by scripts/migrate.ts and picked up the default grants of 0009, so every signed-in user
-- could read, change or empty the migration log, for instance through Supabase's REST API. Emptying it would make the
-- next deploy re-run 0001 and fail. Only the owner connection (the migration script) needs it.
alter table schema_migrations enable row level security;
revoke all on schema_migrations from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema_migrations from authenticated'; end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema_migrations from anon'; end if;
end $$;
