-- READ ONLY checks AFTER migration. For actual role checks use JWTs for test users.
SELECT tablename,rowsecurity FROM pg_tables
WHERE schemaname='public' AND tablename LIKE 'glb_v1_%' ORDER BY tablename;
SELECT tablename,policyname,cmd,roles,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename LIKE 'glb_v1_%' ORDER BY tablename,cmd;
SELECT table_name,column_name,privilege_type FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name LIKE 'glb_v1_%'
AND grantee='authenticated' AND privilege_type IN ('INSERT','UPDATE')
ORDER BY table_name,column_name,privilege_type;
