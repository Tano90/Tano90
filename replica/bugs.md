# Bugs

Gefunden mit `/replica-test` am 2026-10-20 (drei Durchgänge; BUG-008 bis 011 schon beim Bauen von S18/S20/S21 reproduziert und mit Test behoben) · Korrekturen: Commits in der Tabelle ·
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
| BUG-008 | S2 | Empfangendes Outlet sieht eingegangene Umbuchungen nicht (Liste und Lagerbericht) | behoben in 161c3b1 |
| BUG-009 | S4 | Kennzahlen zeigen „−0,00 €“ | behoben in 161c3b1 |
| BUG-010 | S4 | CSV-Export heißt „download“ statt „lagerbericht-…csv“ | behoben in 161c3b1 |
| BUG-011 | S3 | Datei, die vor dem fertigen Laden gewählt wird, wird still verworfen | behoben in b987727 |
| BUG-012 | S3 | Kassen-CSV über 1 MB scheitert, obwohl 5 MB angeboten werden | behoben in 6d2a0f3 |
| BUG-013 | S3 | CSV-Export führt Zutatennamen mit `=` in Excel als Formel aus (CSV-Injektion) | behoben in 6d2a0f3 |

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

### BUG-008: Empfangendes Outlet sieht eingegangene Umbuchungen nicht

- Severity: S2 (Umbuchung beim Empfänger unsichtbar, Lagerbericht des Empfängers ohne Zugang; keine Umgehung für Team-Konten)
- Flow / case: F10 / F10-E1
- Screen: S18, S20
- Build: vor 161c3b1 · Postgres 16

Steps
1. Als Inhaber 2 kg Zucker von Küche Mitte in die Zentralküche umbuchen.
2. Als Team-Konto, das nur der Zentralküche zugeordnet ist, /stock/transfer und /stock/report öffnen.

Expected: „Von Küche Mitte · 2 kg Zucker“, im Bericht +2 kg in „Umbuchung“.
Actual: „Noch nichts umgebucht“; im Bericht fehlt der Zugang.
Evidence: e2e `F10-E1` schlug fehl.
Suspected cause: Das Ereignis gehört dem sendenden Outlet, die RLS-Regel ließ nur dessen Team lesen; zusätzlich durfte das Team den Namen des sendenden Outlets nicht lesen.
Status: fixed in 161c3b1 (Migration `0007_transfer_counterpart_read.sql`, Outlet-Namen über den Dienstzugang nur für sichtbare Ereignisse)

### BUG-009: „−0,00 €“ in Kennzahlen

- Severity: S4 · Flow / case: S20-E1 · Screen: S20 (betraf jede Betragsanzeige)
Steps: Lagerbericht für Januar 2020 (keine Bewegungen) öffnen.
Expected: 0,00 €. Actual: „-0,00 €“ bei Verkauf und Schwund.
Evidence: Screenshot im ersten Lauf von `S20-E1`, Test prüft jetzt auf „-0,00“.
Status: fixed in 161c3b1 (`formatCents` normalisiert −0)

### BUG-010: CSV-Export ohne Dateinamen

- Severity: S4 · Flow / case: S20-H1 · Screen: S20
Steps: „Als CSV exportieren“.
Expected: `lagerbericht-kueche-mitte-2026-10-14-2026-10-20.csv`. Actual: `download`.
Evidence: e2e `S20-H1` (`suggestedFilename`).
Status: fixed in 161c3b1 (Link vor dem Klick ins Dokument hängen, Umlaute im Namen ersetzen)

### BUG-011: Vor dem Laden gewählte Datei wird verworfen

- Severity: S3 (Import passiert nicht und nichts sagt es; erneut wählen hilft)
- Flow / case: F11 / F11-H2, F11-E1, F11-E2 · Screen: S21
Steps
1. /analytics/pos öffnen und sofort eine CSV-Datei wählen (langsame Verbindung oder Skript).
Expected: Import läuft. Actual: nichts passiert, keine Meldung, kein Verkauf gespeichert.
Evidence: e2e F11-H2/E1/E2 rot und zeitabhängig; Datenbank ohne die Belegpositionen.
Suspected cause: Das `change`-Ereignis kam vor der Hydrierung, React hörte noch nicht zu.
Status: fixed in b987727 (`FileUpload` übernimmt beim Einhängen eine schon gewählte Datei)

### BUG-012: Kassen-CSV über 1 MB scheitert

- Severity: S3 (Umgehung: Datei teilen)
- Flow / case: F11 / F11-E4 · Screen: S21
Steps: Eine CSV mit 24 000 Verkäufen (1,5 MB) hochladen.
Expected: alle übernommen (Seite nennt max. 5 MB). Actual: Server „Body exceeded 1 MB limit“, keine Verkäufe übernommen.
Evidence: e2e `F11-E4`, Serverlog.
Suspected cause: Server-Aktionen nehmen höchstens 1 MB; Vercel begrenzt Anfragen außerdem auf 4,5 MB, ein höheres Limit allein hätte dort nicht geholfen.
Status: fixed in 6d2a0f3 (Browser sendet die Datei in Teilen von etwa 700 KB mit Kopfzeile; Zeilennummern in Fehlern bleiben die der Datei)

### BUG-013: CSV-Injektion im Lagerbericht-Export

- Severity: S3 (Sicherheit: ein Teammitglied mit Rezeptrechten kann über einen Zutatennamen eine Formel in die Excel-Datei des Inhabers schleusen)
- Flow / case: S20 / S20-N1 · Screen: S20
Steps
1. Zutat umbenennen in `=HYPERLINK("http://example.com","x")`.
2. Lagerbericht als CSV exportieren und in Excel öffnen.
Expected: Name als Text. Actual: Zelle beginnt mit `=`, Excel führt sie als Formel aus.
Evidence: e2e `S20-N1`.
Status: fixed in 6d2a0f3 (Textzellen, die mit `= + - @` beginnen, bekommen ein `'` vorangestellt)

---

## Zu prüfen (nicht reproduziert oder nicht automatisierbar)

- Ungespeicherte Änderungen beim Wechsel über die Seitennavigation (nicht nur Neuladen) gehen ohne Nachfrage verloren. Gilt auch für Zutaten- und Bestellformulare.
- Supabase-Mails (Bestätigung, Magic Link, Reset) und Stripe (Checkout, abgelehnte Karte 4000 0000 0000 0002, Kündigung im Portal): nur mit deinen Konten prüfbar, Checkliste im Testplan (A02, A05).
- Kasse: Stornos (negative Mengen) werden als Fehlerzeile abgelehnt, nicht verarbeitet. Bewusst noch nicht gebaut; Kassen, die Stornos als eigene Zeilen exportieren, brauchen das.
- Umbuchung aus einem Outlet mit negativem Bestand: der Durchschnittspreis ist dann 0, der Empfänger bekommt die Ware ohne Wert. Nicht reproduziert im Seed.
- Kassen-API: Ratenlimit greift pro Schlüssel (60/min, geprüft); ein Angreifer ohne Schlüssel bekommt 401, aber auch dafür zählt das Limit nur pro vermutetem Schlüssel. Ein IP-basiertes Limit fehlt.
- Inventur in Gebinden: wird ein Gebinde gelöscht, während eine Inventur mit genau diesem Gebinde offen ist, lehnt der Server den Zwischenstand ab und das Zählblatt versucht es alle 5 Sekunden erneut („Speichern fehlgeschlagen“), bis neu geladen wird. Nicht reproduziert (dafür müsste jemand parallel ein Gebinde löschen).
- Zwei Personen bearbeiten gleichzeitig dasselbe Menü oder Rezept: der letzte Speichervorgang gewinnt ohne Hinweis. Nicht getestet, vermutlich zu erwarten.
