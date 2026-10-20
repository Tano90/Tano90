-- Local development only: the parts of Supabase's auth schema that the migrations use.
-- Never applied on Supabase (scripts/migrate.ts skips it when the auth schema already exists).
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null;
end $$;
grant usage on schema auth to authenticated;
grant select on auth.users to authenticated;
