# GLB AI Suite: Supabase-SQL

`001_cloud_pilot.sql` und `002_roles_and_security.sql` aus der Übergabe v0.8, unverändert. Laut Übergabe sind
beide auf dem produktiven Supabase-Projekt bereits ausgeführt: **nicht erneut auf Produktion ausführen.**

`../suite-tests/rls.test.mjs` spielt beide Dateien in eine frische lokale Postgres-Datenbank ein (mit einer
nachgebauten Supabase-Anmeldung `auth.uid()`) und prüft Mandantentrennung und Rollenrechte:

    TEST_DATABASE_URL=postgres://postgres@localhost:54329/kitchen npm run test:suite-sql

## v1.1 Intelligence Center: `006_glb_v11_integrated.sql`

Additiv, setzt nur `001` und `002` voraus, darf mehrfach laufen (getestet: zweimal hintereinander und nach den
RC1-Dateien `003`/`005`). Ändert und löscht keine bestehenden Tabellen, Zeilen oder Richtlinien.

Neu: `glb_pos_lines` (Kassenpositionen, Lesen nur Management, Schreiben nur per RPC), `glb_training_questions`
(Lösungsschlüssel, für niemanden lesbar), `glb_training_results` (nur eigene Zeilen sichtbar, ein Versuch je Thema
und Tag nach deutscher Zeit), `glb_audit_events` (Speicherungen, Kassenpositionen, Training), `glb_api_usage`
(Tageslimit für KI-Aufrufe). RPCs: `glb_pos_insert`, `glb_pos_review`, `glb_pos_summary`, `glb_submit_training`,
`glb_api_take`, `glb_v11_can_manage`, `glb_pos_insert_system` (nur `service_role`, für den signierten Webhook).

Ersetzt `glb_read_workspace` und `glb_save_limited` durch Fassungen, die für alle bisherigen Schlüssel exakt wie in
`002` arbeiten und zusätzlich `tasks` (alle Rollen) und `parStock` (Küchenrollen) ausgeben bzw. annehmen. Dazu zwei
Korrekturen: eingeschränkte Rollen erhalten keine `costHistory` (Kostenstände) und keine Kosten-Snapshots an
Verkäufen (`unitCostNet`); speichern sie Verkäufe, bleiben die Snapshots auf dem Server erhalten.

Reihenfolge in einem **Staging-Projekt** (Kopie der Produktion): Backup → `006` → Tests mit getrennten Konten je
Rolle in zwei Betrieben → erst dann Produktion. `003`/`005` aus dem RC1-Paket (unter `../suite-v11-original/database`)
werden für den integrierten Betrieb nicht benötigt; `005` lässt sich nicht zweimal ausführen (Richtlinien ohne
`drop policy if exists`).

    TEST_DATABASE_URL=postgres://postgres@localhost:54329/kitchen npm run test:suite-sql
    # 001+002 (8 Tests), dieselben 8 Tests nach 006, und suite-tests/rls-v11.test.mjs (7 Tests, zwei Betriebe)
