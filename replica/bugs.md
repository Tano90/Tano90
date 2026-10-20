# Bugs

Gefunden mit `/replica-test` am 2026-10-20 (zwei Durchgänge) · Korrekturen: Commits in der Tabelle ·
Chromium 1440 px, de-DE, Europe/Berlin · Produktions-Build auf Postgres 16 mit Demo-Seed.

Nur Reproduziertes. Jede Korrektur hat einen Test, der vorher fehlschlug und jetzt besteht.

| ID | Schwere | Titel | Status |
| --- | --- | --- | --- |
| BUG-001 | S1 | Lieferantenpreis lässt sich auf der Datenbank nicht speichern | behoben in 9789570 |
| BUG-002 | S3 | Datumsangaben in UTC statt Ortszeit; Hydrationsfehler auf der Schwund-Seite | behoben in 4f183b7 |
| BUG-003 | S3 | Frühester Liefertermin nach Mitternacht ist „gestern“ | behoben in 4f183b7 |
| BUG-004 | S3 | Inventur offline: Fehlschlag wird nicht angezeigt, nicht wiederholt | behoben in 98af54f |
| BUG-005 | S3 | Rezept: Neuladen/Schließen verwirft Änderungen ohne Nachfrage | behoben in 733fbb6 |
| BUG-006 | S4 | „Nicht gefunden“ ohne Überschrift und ohne App-Rahmen | behoben in 7287375 |
| BUG-007 | S4 | Team ändern ohne Recht meldet „nicht gefunden“ statt „keine Berechtigung“ | behoben in dcfc8dd |

Offen: keine. S1 offen: keine.

---

### BUG-001: Lieferantenpreis lässt sich auf der Datenbank nicht speichern

- Severity: S1 (Kernablauf F01 blockiert: ohne Preis keine Kalkulation)
- Flow / case: F01 / F01-E4 (auch F01-H1, F04-H1)
- Screen: S04
- Build: vor 9789570 · Chromium 1440 px

Steps
1. Als Inhaber anmelden, Zutat anlegen, Gebinde 5 kg hinzufügen.
2. „Preis“ → 3,20 € pro kg → Speichern.

Expected: Preis gespeichert, Liste zeigt 3,20 €/kg.
Actual: Meldung „Dafür fehlt dir die Berechtigung.“; nichts gespeichert. Betrifft jeden Preis, auch pro Gebinde und beim Ändern.
Evidence: e2e `F01-E4 Preis pro kg auf einem 5-kg-Gebinde` (Screenshot des Dialogs mit der Meldung); Integrationstest `BUG-001: an editor can save and change a supplier price` schlug fehl.
Suspected cause: Beim Speichern wird auch `stock_item_price_history` beschrieben; Migration 0001 gab der Tabelle nur eine Lese-Policy. Der Speicher-Modus hatte das Problem nicht, die bisherigen Integrationstests haben keinen Preis gespeichert.
Status: fixed in 9789570 (Migration `0005_price_history_insert.sql`)

### BUG-002: Datumsangaben in UTC statt Ortszeit; Hydrationsfehler auf der Schwund-Seite

- Severity: S3 (sichtbar falsch, Arbeit möglich)
- Flow / case: X-TZ1, F09-H1, F09-N1, X-A11Y S19
- Screen: S14, S12, S17, S19
- Build: vor 4f183b7

Steps
1. Bestellung, die um 00:30 Berliner Zeit (22:30 UTC) bestellt wurde, öffnen.
2. Die Schwund-Seite öffnen.

Expected: „Bestellt am 21.10.2026“; Schwund-Seite ohne Fehler.
Actual: „20.10.2026“. Auf der Schwund-Seite React-Fehler #418 (Hydration): Server (UTC) und Browser (Berlin) formatierten die Uhrzeit verschieden, die Seite wurde im Browser neu aufgebaut.
Evidence: e2e `X-TZ1` (erwartet „21.10.2026“, erhalten „20.10.2026“), `F09-H1` mit `pageerror: Minified React error #418`.
Suspected cause: `Intl.DateTimeFormat` ohne `timeZone` an sieben Stellen.
Status: fixed in 4f183b7 (`src/lib/dates.ts`, Formatierung immer in der Zeitzone des Outlets, reine Kalendertage unverschoben; Unit-Tests inkl. Zeitumstellung)

### BUG-003: Frühester Liefertermin nach Mitternacht ist „gestern“

- Severity: S3
- Flow / case: F06 / X-TZ2
- Screen: S13
- Build: vor 4f183b7

Steps
1. Zwischen 00:00 und 02:00 Berliner Zeit „Neue Bestellung“ öffnen.

Expected: Frühestes Datum = heute (Berlin), Vorschlag = heute + Lieferzeit.
Actual: Frühestes Datum = gestern, Vorschlag einen Tag zu früh (Berechnung über `toISOString()`, also UTC).
Evidence: e2e `X-TZ2` mit gestellter Uhr: `min="2026-10-20"` statt `2026-10-21`.
Status: fixed in 4f183b7 (Server berechnet „heute“ in der Zeitzone des Outlets; Unit-Test `knows today and tomorrow in Berlin`)

### BUG-004: Inventur offline: Fehlschlag wird nicht angezeigt, nicht wiederholt

- Severity: S3 (Werte bleiben im Feld; ohne Hinweis glaubt man, sie seien gespeichert)
- Flow / case: F08 / F08-E2
- Screen: S17
- Build: vor 98af54f

Steps
1. Inventur starten, Netzwerk trennen (Kühlhaus).
2. Menge eintragen.
3. Netzwerk wieder verbinden.

Expected: Status „Speichern fehlgeschlagen, wird erneut versucht“, nach Wiederverbindung automatisch gespeichert.
Actual: Status blieb auf „speichert …“, der Aufruf warf eine unbehandelte Ausnahme; gespeichert wurde erst bei der nächsten Eingabe.
Evidence: e2e `F08-E2` (Status-Text nie erschienen).
Status: fixed in 98af54f (Netzwerkfehler als Fehlschlag behandelt; Wiederholung alle 5 s und beim `online`-Ereignis)

### BUG-005: Rezept: Neuladen/Schließen verwirft Änderungen ohne Nachfrage

- Severity: S3
- Flow / case: F02 / F02-E5
- Screen: S06
- Build: vor 733fbb6

Steps
1. Rezept öffnen, Namen ändern („Ungespeicherte Änderungen“ erscheint).
2. Seite neu laden.

Expected: Browser fragt, ob die Seite verlassen werden soll.
Actual: Seite lädt neu, Änderung ist weg.
Evidence: e2e `F02-E5` (kein `beforeunload`-Dialog).
Status: fixed in 733fbb6. Hinweis: Wechsel über die App-Navigation fragt weiterhin nicht nach (Next.js bietet dafür keinen Haken); siehe „Zu prüfen“.

### BUG-006: „Nicht gefunden“ ohne Überschrift und ohne App-Rahmen

- Severity: S4
- Flow / case: A01-N2, F01-N2, F02-N1
- Screen: alle Detailseiten
- Build: vor 7287375

Steps
1. URL eines Rezepts eines anderen Betriebs oder eines archivierten Rezepts öffnen.

Expected: Seite mit Überschrift „Nicht gefunden“ innerhalb der App (Navigation bleibt).
Actual: Text ohne Überschrift (Screenreader finden keinen Seitentitel), Navigation verschwindet.
Evidence: e2e `A01-N2`, `F01-N2`, `F02-N1` (keine Überschrift gefunden).
Status: fixed in 7287375

### BUG-007: Team ändern ohne Recht meldet „nicht gefunden“ statt „keine Berechtigung“

- Severity: S4 (die Änderung wird korrekt abgelehnt, nur die Meldung führt in die Irre; die Oberfläche zeigt Nicht-Admins keine Knöpfe)
- Flow / case: A03 / A03-N4
- Screen: S25 (Server-Aktion)
- Build: vor dcfc8dd · Postgres 16

Steps
1. Als Küchenleitung (`chef`) die Server-Aktion `updateMember` für ein anderes Mitglied aufrufen.

Expected: „Dafür fehlt dir die Berechtigung.“
Actual: „Teammitglied nicht gefunden.“
Evidence: Integrationstest `team rules hold in the repo and in the database` schlug fehl.
Suspected cause: Die Mitglieder werden mit `for update` gelesen; Postgres blendet dabei Zeilen aus, die die Update-Policy nicht erlaubt. Die Rollenprüfung kam erst danach.
Status: fixed in dcfc8dd (Rolle wird vor dem Nachschlagen geprüft, in beiden Backends)

---

## Zu prüfen (nicht reproduziert oder nicht automatisierbar)

- Ungespeicherte Änderungen beim Wechsel über die Seitennavigation (nicht nur Neuladen) gehen ohne Nachfrage verloren. Gilt auch für Zutaten- und Bestellformulare.
- Supabase-Mails (Bestätigung, Magic Link, Reset) und Stripe (Checkout, abgelehnte Karte 4000 0000 0000 0002, Kündigung im Portal): nur mit deinen Konten prüfbar, Checkliste im Testplan (A02, A05).
- Inventur in Gebinden: wird ein Gebinde gelöscht, während eine Inventur mit genau diesem Gebinde offen ist, lehnt der Server den Zwischenstand ab und das Zählblatt versucht es alle 5 Sekunden erneut („Speichern fehlgeschlagen“), bis neu geladen wird. Nicht reproduziert (dafür müsste jemand parallel ein Gebinde löschen).
- Zwei Personen bearbeiten gleichzeitig dasselbe Menü oder Rezept: der letzte Speichervorgang gewinnt ohne Hinweis. Nicht getestet, vermutlich zu erwarten.
