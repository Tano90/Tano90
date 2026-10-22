# GLB v0.8 -> v1.0: Übergabe zur Integration in das bestehende Repository

## Stand / Leitplanke

Dieses Paket wurde ohne den kompletten v0.8-Quellcode erstellt. **Nicht** den laufenden Worker oder dessen Datenbank direkt ersetzen. Die bestehende v0.8 verfügt bereits über funktionierende Anmeldung, Rollentrennung, PWA und eigene Module. Das neue Command Center wird ergänzend gebaut.

## Zielarchitektur

1. Altes Repository sichern und mit einer `v0.8`-Version markieren.
2. Dieses Paket auf separaten Branch `feature/v1-command-center` kopieren.
3. Datenbank vor der Migration prüfen: `000_preflight.sql`, dann SQL in Staging ausführen, anschließend `004_verify.sql`.
4. Die neue `public/core.mjs` (pure Analytics), `public/cloud.mjs` (Client), `public/app.js` (UI) nach und nach in die bestehende Navigations- und Auth-Struktur übernehmen. Nicht blind den bestehenden Frontend-Einstieg ersetzen.
5. Stammdatenmigration explizit programmieren: bisherige `glb_snapshots.data.items` / `outlets` auf `glb_v1_products` / `glb_v1_outlets` abbilden; IDs konsistent halten; bei Konflikten nicht raten.
6. Einmaliger Datenabgleich der bisherigen `sales` / `dailySales` mit den neuen, monatlichen Sales-Daten (Brutto, Steuer, tatsächliche Kosten, Outlet, Produkt) unter fachlicher Freigabe. **Keine** stillen Duplikate.
7. End-to-End-/Sicherheitstests mit allen zehn vorhandenen Rollen, zwei Organisationen, Paralleländerungen und Offline/PWA.
8. Produktivfreigabe nur mit Backup, Rollback-Plan und nachvollziehbarem Migrationsprotokoll.

## Warum getrennt?

Die v0.8 verwendet einen großen JSON-Workspace-Snapshot. v1.0 führt strukturierte Tabellen für mehrere gleichzeitig arbeitende Benutzer ein, ohne die bisherigen Module zu zerstören. Erst die tatsächlichen Quellcodemappings ermöglichen eine sichere Vereinigung.

## Release-Definition

Als **v1.0 produktiv** darf diese Version erst gelten, wenn Auth-/RLS-Tests und vollständige Datenmigration durchlaufen wurden und das bisherige Produkt weiter funktioniert. Bis dahin handelt es sich um `v1.0.0-rc.1`.
