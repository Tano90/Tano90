# GLB AI Suite – Command Center v1.0 RC1

**Stand: 21.10.2026** · Erweiterungs-/Pilotpaket für die bisherige Cloudflare-/Supabase-Plattform · Eigenständige PWA, **kein Update der produktiven v0.8**.

## Was in diesem Paket funktioniert

- Responsives Dashboard mit Brutto-/Nettoumsatz, Deckungsbeitrag I, Wareneinsatzquote, Monatschart und Outlet-/Monatsfilter.
- CSV-Import im Format `Produkt;Outlet;Monat;Menge;Bruttopreis` (UTF-8; Semikolon; deutsche Dezimalzahlen) mit Vorschau und Fehlerdiagnose.
- Exakte Artikel-/Outlet-Zuordnung. Es werden **keine** fehlenden Artikel automatisch erzeugt. Die Quelle wird per SHA-256 der Datei und Zeilennummer idempotent aufgenommen; derselbe Dateiinhalt wird bei erneutem Import übersprungen.
- Menu Engineering mit Star, Renner, Puzzle, Penner anhand Absatz und Deckungsbeitrag **pro Einheit**. Fehlende Kostendaten bleiben sichtbar und können bewusst nachgetragen werden.
- Inventory & Orders: Mindest-/Zielbestände, Bestellmengen und CSV-Export; Ist-Bestand nachtragen.
- Teamaufgaben: Priorität, Fälligkeit, Status.
- Regelbasierte Hinweise **ohne externe KI** und ohne OpenAI-API-Kosten.
- Optionaler Supabase-Betrieb mit bestehendem v0.8-Login und Mandanten-/Rollenkonzept, separaten strukturierten Tabellen, RLS, Audits und optimistischer Versionsprüfung für Team- und Bestandsänderungen.
- Installierbare PWA und Offline-Demo mit lokalem Browserzustand.

**Wichtig:** Das ist ein getesteter Funktionskern und ein Release Candidate, keine vollständig geprüfte kommerzielle SaaS. Echte Berechtigungstests gegen mehrere angemeldete Supabase-Benutzer, Penetrationstest, Backup-/Restore-Probe und Abgleich mit dem v0.8-Quellcode müssen vor Produktivbetrieb erfolgen.

## Sofort lokal testen (ohne Supabase)

Voraussetzung: Python 3 oder ein beliebiger statischer Webserver.

```bash
cd glb-ai-suite-v1
python3 -m http.server 8080 -d public
```

Im Browser `http://localhost:8080` öffnen. Die demohaft hinterlegten Umsätze sind **erfunden, nicht reale GLB-/Dorint-Daten**. Alle Änderungen liegen im `localStorage` des jeweiligen Browsers. Demo unter `Einstellungen > Demo zurücksetzen` wiederherstellen.

**Hinweis:** Nicht `index.html` direkt über `file://` öffnen, da ES-Module und Service Worker einen Webserver brauchen.

## Cloudflare als separate Staging-App deployen

1. In einem **eigenen** Cloudflare Worker für das neue Command Center arbeiten; kein Überschreiben des laufenden v0.8-Workers.
2. Im Paketroot: `npx wrangler login`, danach `npx wrangler deploy`.
3. In der neuen URL erst den Demo-Modus prüfen.
4. In Supabase **Staging-Projekt** `database/000_preflight.sql` lesen und `database/003_glb_v1_structured.sql` ausführen.
5. Unter `Einstellungen`: Supabase Project URL, **Publishable/Anon-Key** und die bestehende `organization_id` eintragen, dann mit Supabase Auth anmelden.
6. Als Owner/Manager Outlet und Artikelstamm zunächst aufbauen, danach CSV importieren und die neuen Funktionen prüfen.
7. Rollen auf Server-Ebene durch unabhängige Testaccounts prüfen, siehe `docs/QA_CHECKLIST.md`.

Cloudflare Static Assets- und SPA-Routing-Konfiguration sind in `wrangler.jsonc` enthalten. Keine Backend-Secrets im Browser hinterlegen.

## CSV-Vertrag

```csv
Produkt;Outlet;Monat;Menge;Bruttopreis
Cheeseburger;Restaurant;2026-10;30;19,50
Signature Cocktail;Bar;2026-10;16;9,50
```

- `Produkt` und `Outlet` müssen im gewählten Mandanten **vorher** mit demselben Namen existieren. Groß-/Kleinschreibung wird normalisiert.
- `Monat` im Format `YYYY-MM`.
- `Menge >= 0`, `Bruttopreis >= 0` sind Pflicht; negative Stornos werden in RC1 nicht importiert. Retouren/Stornos müssen vorab kassenseitig bereinigt werden.
- Der Artikelstamm enthält `vat_percent` (7 oder 19) und optional den tatsächlichen Wareneinsatz netto. Beim Import werden diese Werte als Snapshot hinterlegt. Steuer- und Kostenannahmen prüfen!
- Kein künstlich errechneter Gewinn bei fehlendem Wareneinsatz. Nachtragen fehlender Stückkosten erfolgt **explizit und protokolliert**.
- Ein identischer Dateiinhalt mit identischen Zeilen ist wiederholbar ohne Duplikate. **Verschieden formatierte Dateien mit überschneidenden Verkäufen** werden nicht als Duplikate erkannt – bis ein eindeutiger Kassenbeleg- oder Buchungs-ID-Import folgt. Deshalb Monatsdateien zeitlich trennen.
- Die bereits früher verwendete Exportdatei `GLB_Verkaufsimport_2026_Jan-Sep.csv` besitzt nicht die für diese Ansicht erforderlichen `Outlet`- und `Monat`-Spalten; sie ist **nicht direkt kompatibel**, ohne eine belastbare Zuordnung.

## Zugriffsrechte

| Rolle | Finanzdaten | Inventur | Aufgaben |
|---|---|---|---|
| Owner, Editor, Restaurantleiter, Geschäftsführer | Lesen/Import/Kosten nachtragen | Lesen/Schreiben | Lesen/Schreiben |
| Küchenleitung | Nein | Lesen/Schreiben | Lesen/Schreiben |
| Mitarbeiter Küche | Nein | Lesen | Lesen/Schreiben |
| Mitarbeiter Service, Sales, Serviceleitung | Nein | Nein | Lesen/Schreiben |
| Viewer | Nein | Nein | Nur lesen |

Wichtig: Die Zugriffsrechte werden **in Supabase per RLS** durchgesetzt, nicht nur durch ausgeblendete Navigation. Erst nach mehrstufigem Staging-Test kommerziell nutzen.

## Datenmodell und Grenzen

`glb_v1_outlets`, `glb_v1_products`, `glb_v1_sales`, `glb_v1_inventory`, `glb_v1_tasks`, `glb_v1_audit_events` sind neue, mandantengebundene Tabellen. **Keine** der alten JSON-Snapshots wird verändert, gelöscht oder automatisch übernommen. Die beiden Welten laufen nebeneinander, bis die alten Daten sauber abgebildet und migriert werden.

Cloud-Anmeldung erfolgt über Supabase Auth E-Mail/Passwort; Sitzungstoken liegen im `sessionStorage` (werden bei Browser-Tab-/Sitzungsende entfernt), die öffentlichen Konfigurationsdaten (Supabase-URL, Publishable Key, Organisations-ID) im `localStorage`. Für eine ausgereifte SaaS sollten Auth-Flow, Account-Recovery, Session-Handling und Security Reviews noch einmal gesondert gehärtet werden.

Die neue Webapp ist kein Ersatz für die bereits vorhandenen v0.8-Speisekarten-, Service- und PWA-Funktionen, sondern ein zusätzlicher Managementbereich. In einem späteren Integrationsschritt wird sie in das bestehende Menü überführt.

## Keine echte AI / fertige externe Integrationen in diesem Paket

Die Managementhinweise sind nachvollziehbare Regeln. Es gibt **noch keinen OpenAI-Assistenten, keinen Live-POS-Connector, keine automatische Lieferantenbestellung und keine aktive Shopify-Abrechnung**. APIs und Zahlungsprozesse erfordern eigene autorisierte Server-Endpunkte, Freigaben, Datenschutzprüfung und offene API-Abrechnungsfragen.

## Tests

```bash
npm test
```

Das Testpaket überprüft CSV, Zahlenformate, Kostenermittlung, fehlende Daten, Warnungen und Export. Browserbasierte End-to-End-Tests und Staging-Datenbanktests sind vor Liveschaltung noch auszuführen.
