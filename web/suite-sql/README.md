# GLB AI Suite: Supabase-SQL

`001_cloud_pilot.sql` und `002_roles_and_security.sql` aus der Übergabe v0.8, unverändert. Laut Übergabe sind
beide auf dem produktiven Supabase-Projekt bereits ausgeführt: **nicht erneut auf Produktion ausführen.**

`../suite-tests/rls.test.mjs` spielt beide Dateien in eine frische lokale Postgres-Datenbank ein (mit einer
nachgebauten Supabase-Anmeldung `auth.uid()`) und prüft Mandantentrennung und Rollenrechte:

    TEST_DATABASE_URL=postgres://postgres@localhost:54329/kitchen npm run test:suite-sql
