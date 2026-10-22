-- Run this read-only check in Supabase SQL Editor BEFORE the v1.0 migration.
SELECT current_database() AS database_name,
       to_regclass('public.glb_organizations') AS organizations_table,
       to_regclass('public.glb_memberships') AS memberships_table,
       to_regclass('public.glb_snapshots') AS legacy_snapshots_table;
-- All three expected tables must return their table name (not NULL).
SELECT role, count(*) AS memberships FROM public.glb_memberships GROUP BY role ORDER BY role;
-- Optional current schema overview (no personal data returned):
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'glb_%' ORDER BY table_name;
