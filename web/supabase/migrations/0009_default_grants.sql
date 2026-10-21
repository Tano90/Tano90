-- Supabase grants table rights to `authenticated` by default; a plain Postgres does not, so 0008's new table
-- was unreachable there (every invoice save failed with "permission denied"). Grant it, and make it the default
-- for tables created by later migrations. Row level security still decides which rows a user sees.
grant select, insert, update, delete on invoice_lines to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
