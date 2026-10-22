# GLB AI Suite v1.1 (Intelligence Center RC1) → Integration in die bestehende Suite

Stand 22.10.2026. Ausgangsstand: Commit `ad9037c` (lokaler Tag `baseline-v11-integration`; Tags lassen sich aus
dieser Umgebung nicht pushen). Arbeitszweig: `claude/replica-skill-install-vzriug` (Vercel-Vorschau je Commit).
Die ZIP liegt unverändert unter `web/suite-v11-original/`. Ihre 26 Tests bestehen dort unverändert (`node --test tests/*.test.mjs`).

## 1. Bestandsaufnahme der ZIP (tatsächliche Implementierung)

| Datei | Inhalt |
| --- | --- |
| `public/core.mjs` | Zahlenparser `numberDE`, CSV-Parser, Monatsimport `rowsFromCSV` (Hash+Zeile), `calculateSales` (Brutto/Netto/DB I/WE-Quote, Star/Renner/Puzzle/Penner per Median, „WE fehlt“), `suggestActions`, `csvExport` |
| `public/intelligence.mjs` | 6 Funnelthemen mit Quiz, `readPosImport` (Bonpositionen), `aggregateFunnel` (Bonquote, Gäste, DB I, Szenario), `compareMarket`, `scoreQuiz` |
| `public/app.js` | Cockpit, Verkauf & Import, Menu Engineering, Inventur & Bestellvorschläge, Team & Aufgaben, Einstellungen (Supabase-Verbindung, Artikel, Outlets, Backup, Demo-Reset) |
| `public/intelligence-ui.mjs` | Tagesfunnel, Training, Marktcheck, Legacy-Brücke; Demo-Bons |
| `public/store.mjs`, `cloud.mjs`, `intelligence-cloud.mjs` | Demo-Speicher, Supabase-REST-Client (Anmeldung, Versions-CAS, Kosten-Nachtrag), v1.1-Tabellen |
| `src/worker.mjs` | Cloudflare Worker: `/api/market/discover` (Overpass), `/api/market/analyze` (OpenAI, Rollenprüfung per RPC), `/api/pos/ingest` (HMAC) |
| `database/000,003,004,005` | Preflight, Tabellen `glb_v1_*` (Outlets, Artikel, Verkäufe, Bestand, Aufgaben, Audit), `glb_v11_*` (POS, Zuordnungen, Ziele, Markt, Training), Prüfabfragen |
| `tests/*` | 26 Node-Tests (Parser, Import, Funnel, Markt, Quiz, HMAC, Worker-Fehler, Rendering) + Python-Smoke (nie ausgeführt) |

Abweichungen Doku ↔ Code, die bei der Prüfung auffielen (alle behoben, siehe Abschnitt 5):
`numberDE("0.001") = 1`; leerer Funnel meldet `guestComplete: true`; Demo-Reset initialisiert die v1.1-Bereiche nicht
(`resetLocal()` ohne `initializeIntelligence`, Tagesfunnel leer bis zum Neuladen); Zuordnung Artikel → Funnelthema in der
Cloud per exakter Schreibweise, in der Demo ohne Groß-/Kleinschreibung; Quiz-Punkte vom Browser gesendet (RLS prüft nur
`correct ↔ points`, nicht die Antwort); Monatsexport ignoriert den Filter; mobile Navigation beschriftet vier Module mit
„Team“; `005` ist nicht wiederholbar (`CREATE POLICY` ohne `DROP … IF EXISTS`); Worker ohne Zeitlimits und ohne Ratenbegrenzung.

## 2. Architekturentscheidung

Die ZIP führt für Artikel, Outlets, Monatsverkäufe, Bestand und Aufgaben eigene Tabellen (`glb_v1_*`) mit UUIDs ein.
Die bestehende Suite hält genau diese Stammdaten bereits im Arbeitsbereich (`glb_snapshots`, Revisionsprüfung,
rollengefilterte RPCs aus `001/002`). Zwei Artikelstämme nebeneinander würden IDs und Verknüpfungen auseinanderlaufen
lassen (Rezepte, Lager, Bestellungen hängen am bestehenden Artikel). Deshalb:

1. **Eine App, ein Stammdatenbestand.** Die ZIP-Module werden als Ansichten in die bestehende Suite (`/suite`) eingebaut
   und arbeiten auf denselben Artikeln, Outlets und Monatsverkäufen. Die Rechenlogik der ZIP (`core.mjs`,
   `intelligence.mjs`) wird als Modul übernommen; Anpassungen sind Fehlerbehebungen (dokumentiert).
2. **Gemeinsame Betriebsdaten der ZIP-Module** (Aufgaben, Mindestbestandsliste, Marktbeobachtungen, Zielquoten,
   Artikel→Funnelthema) liegen im Arbeitsbereich wie alle anderen Module (Revisionskonflikt statt Überschreiben,
   rollengefilterte Lese-/Schreib-RPCs werden um diese Schlüssel erweitert).
3. **Tages-Bonpositionen und Trainingsergebnisse** liegen in eigenen Tabellen mit RLS (groß, per Webhook befüllt bzw.
   personenbezogen) – wie in der ZIP, aber an die bestehenden Outlet-IDs des Arbeitsbereichs gebunden.
   Trainingsantworten werden serverseitig bewertet (RPC mit hinterlegtem Lösungsschlüssel).
4. **Serverfunktionen** des Cloudflare Workers werden als Next.js-Route-Handler auf Vercel umgesetzt
   (`/api/suite/market/discover`, `/api/suite/market/analyze`, `/api/suite/pos/ingest`), mit denselben Prüfungen plus
   Zeitlimits, Ratenbegrenzung und Kostenbudget. Geheimnisse nur als Vercel-Umgebungsvariablen.
5. **SQL**: `003/005` der ZIP bleiben als Referenz im Repo, werden aber für den integrierten Betrieb nicht benötigt.
   Neue additive Migration `006_glb_v11_integrated.sql` (setzt nur `001/002` voraus, wiederholbar, ändert keine
   bestehenden Tabellen; ersetzt die Funktionen `glb_read_workspace` und `glb_save_limited` durch erweiterte Fassungen
   mit unverändertem Verhalten für alle bisherigen Schlüssel).

## 3. Funktionsmatrix

Spalten: ZIP-Funktion · Dateien/Daten in der ZIP · bestehendes Gegenstück · Vorgehen · Nachweis.
Status wird beim Umsetzen in Abschnitt 6 nachgeführt.

### Management Cockpit
| Funktion | ZIP | Bestehend | Vorgehen | Nachweis |
| --- | --- | --- | --- | --- |
| Brutto-/Nettoumsatz, DB I, WE-Quote | `calculateSales`, `cards()` | Dashboard (Netto, DB II, WE-Quote) | eigene Ansicht „Management-Cockpit“ mit ZIP-Logik auf den gemeinsamen Verkäufen | Unit (ZIP-Tests) + E2E |
| Outlet- und Monatsfilter | `filters()` | Berichtsfilter | übernommen | E2E |
| Monatsdiagramm | `chart()` | Diagramme Dashboard | übernommen | E2E |
| Regelbasierte Managementhinweise | `suggestActions` | GLB Intelligence | übernommen, Ziele verlinkt | Unit + E2E |
| Schnellzugriffe | `overview()` | Arbeitsplatz-Kacheln | übernommen | E2E |
| Demo vs. echte Daten | `statsSource()` | Beispieldaten-Hinweis | übernommen | E2E |
| Fehlende Kosten kennzeichnen | `margin === null` | Kostenstände | übernommen („Unvollständig“) | Unit |

### Verkauf und Monatsimport
| Funktion | ZIP | Bestehend | Vorgehen | Nachweis |
| --- | --- | --- | --- | --- |
| CSV mit Vorschau/Fehlerdiagnose | `rowsFromCSV`, `renderImportPreview` | Verkaufsimport mit Modi | ZIP-Ansicht „Verkauf & Monatsimport“, schreibt in dieselben Verkäufe | Unit + E2E |
| Zuordnung Artikel/Outlet | Namensvergleich | Namensvergleich | gleiche Stammdaten | Unit |
| Steuer- und Kostensnapshot | `unit_cost_net`, `vat_percent` je Zeile | Kostenstände je Monat | Snapshot-Felder an jeder importierten Verkaufszeile (beide Importwege) | Unit + E2E |
| Wiederholungsprüfung Inhalt+Zeile | `source_hash:line_no` | Datei-Fingerabdruck | beide Prüfungen | E2E |
| Vorlagen, CSV-Export | `templateCSV`, `export-sales` | Vorlagen | übernommen + Wahl „Filter“ / „alle“ | E2E |
| WE bewusst nachtragen | `modalCost`, `backfillCost` | – | übernommen: nur fehlende Snapshots, bestehende bleiben | Unit + E2E |

### Menu Engineering
| Funktion | ZIP | Bestehend | Vorgehen | Nachweis |
| --- | --- | --- | --- | --- |
| Star/Renner/Puzzle/Penner nach Absatz × DB I je Einheit | `calculateSales` | Renner-Penner (DB II, Schläfer) | eigene Ansicht, Renner-Penner bleibt; Unterschied wird benannt | Unit + E2E |
| Suche, Outlet-/Monatsfilter, Empfehlungen, „WE fehlt“, Methodik | `menu()` | – | übernommen | E2E |

### Inventur und Bestellvorschläge
| Funktion | ZIP | Bestehend | Vorgehen | Nachweis |
| --- | --- | --- | --- | --- |
| Positionen mit Einheit, Ist/Mindest/Ziel, Lieferant | `glb_v1_inventory` | Inventur (Lager, Zählungen), Forecast | eigene Liste „Mindestbestände“; Forecast und Lager bleiben unverändert | E2E |
| Bestandskorrektur, Vorschlag = Ziel − Ist, Export | `modalStock`, `export-orders` | Bestellentwürfe | übernommen | Unit + E2E |
| Versionskonflikt | `patchOne` mit `version` | Revisionsprüfung | Version je Position + Revisionsprüfung des Arbeitsbereichs | Cloud-E2E |

### Team und Aufgaben
| Funktion | ZIP | Bestehend | Vorgehen | Nachweis |
| --- | --- | --- | --- | --- |
| Aufgaben, Priorität, Fälligkeit, Status | `tasks()` | – (Arbeitsplatz zeigt abgeleitete Aufgaben) | Ansicht „Team & Aufgaben“, im Arbeitsplatz eingeblendet | E2E |
| Rollenabhängige Bearbeitung | `canUpdateTasks` | Rollen | alle Rollen außer „Lesen“ | Rollen-E2E + SQL |
| Schulungsaufgabe aus Funnel | `data-v11-task` | – | übernommen | E2E |

### Daily Sales Funnel
| Funktion | ZIP | Bestehend | Vorgehen | Nachweis |
| --- | --- | --- | --- | --- |
| POS-Bonpositionen importieren | `readPosImport` | Service Funnel (Tageserfassung von Hand) | neue Ansicht „Tagesfunnel (Kassenbons)“; Service Funnel bleibt | Unit + E2E |
| Tages-/Outletfilter, eindeutige Bons, Gäste nur bei vollständiger Basis | `aggregateFunnel` | – | übernommen, Leerzustand korrigiert | Unit |
| Brutto/Netto/DB I, Themenzuordnung, Zielquoten, Szenario | `aggregateFunnel` | Ziele je 100 Gäste (anderes Maß) | übernommen; Kaufquote je Bon ≠ Verkäufe je Gast, beides benannt | Unit + E2E |
| Sechs Themen inkl. After Glow | `STAGES` | 6 Service-Schritte (ohne After Glow) | unverändert übernommen | Unit |

### Funnel Quest Training Center
| Funktion | ZIP | Bestehend | Vorgehen | Nachweis |
| --- | --- | --- | --- | --- |
| 6 Missionen, Fragen, Feedback, 100 XP, Level | `STAGES`, `renderTraining` | – | übernommen | Unit + E2E |
| Begrenzung je Person/Tag/Thema, Schutz eigener Ergebnisse | Unique-Index, RLS | – | RPC bewertet serverseitig, Tabelle nur eigene Zeilen | SQL-Test |
| Verknüpfung mit Schulungspotenzial | `ordered` | – | übernommen | E2E |

### KI-Marktcheck
| Funktion | ZIP | Bestehend | Vorgehen | Nachweis |
| --- | --- | --- | --- | --- |
| Beobachtungen mit Quelle/Prüfdatum, eigenes vs. Konkurrenzprodukt, Abweichung | `compareMarket` | Mein Markt (Preise mit Quelle) | eigene Ansicht, Mein Markt bleibt | Unit + E2E |
| OSM-Umfeldsuche mit Radius 1/2/5 km | Worker `/discover` | Umkreissuche 20 km im Browser | Server-Route + Radiuswahl | Route-Test + E2E |
| Optionale KI-Auswertung serverseitig | Worker `/analyze` | – | Server-Route mit Rollenprüfung, Zeitlimit, Rate-Limit, Budget | Route-Test |
| Kennzeichnung ungeprüfter Eingaben | Hinweise | – | übernommen | E2E |

### Weitere Bestandteile
| Funktion | ZIP | Bestehend | Vorgehen | Nachweis |
| --- | --- | --- | --- | --- |
| Anmeldung, Sitzung | eigenes Formular (URL/Key/Org im Browser) | Supabase-Anmeldung, Konfiguration aus Umgebung | bestehende Anmeldung (kein Schlüssel-Formular im Browser nötig) | SC-Tests |
| Mandantentrennung, Rollen | RLS `glb_v1_has_role` | RLS + RPCs 001/002 | 006 mit denselben Rollenlisten | SQL-Tests, zwei Organisationen |
| Auditprotokolle | Trigger `glb_v1_audit_events` | – | Audit für Arbeitsbereich-Speicherungen, POS und Training | SQL-Test |
| JSON-Datensicherung, Demo-Modus | `export-json`, `reset-demo` | Backup, Demo | gemeinsam, enthält v1.1-Daten | E2E |
| PWA, Offline-Demo | `sw.js`, Manifest | Service Worker, Manifest | gemeinsamer Service Worker | E2E |
| Lesende Legacy-Brücke | `load-legacy` | – | Strukturcheck des Arbeitsbereichs (nur lesen) in Einstellungen | E2E |
| Signierter POS-Webhook | Worker `/pos/ingest` | – | Route mit HMAC, fester Organisation, Positions-IDs, Storno/Korrektur | Route-Tests |
| Tests, Beispieldateien | `tests/`, `sample-*.csv` | – | übernommen | CI-Befehle |

### Bestehende Funktionen (bleiben vollständig)
Mein Arbeitsplatz, Mission Control, Dashboard, Service Funnel, Artikel & Umsätze, Outlets, Renner-Penner,
Lebenszyklen, Mein Markt, Speisekartenimport, Rezepte & Rohwaren, Deckungsbeiträge, Preiskalkulation, Oberkategorien,
Inventur & Lager (mehrere Lager), Warenbewegungen, Bestell-Forecast, Bestellungen (Entwurf → Wareneingang),
Report Studio, GLB Intelligence, Datenimport, Einrichtung, Einstellungen (Backup, Rollen, Einladungen).
Nachweis: bestehende 92 Unit-, 8 SQL- und 53 Browser-Tests laufen weiter.

## 4. Ergebnis je Funktion (Stand nach Integration)

Legende: **übernommen** = Funktion der ZIP in der integrierten App vorhanden und per Test belegt; **verbessert** = zusätzlich
Fehler behoben oder erweitert (Abschnitt 5); **angepasst** = technisch anders umgesetzt, Funktion gleichwertig.

| Bereich | Funktion | Status | Ort in der Suite | Test |
| --- | --- | --- | --- | --- |
| Cockpit | Brutto/Netto, DB I, WE-Quote, Outlet-/Monatsfilter, Monatsdiagramm, Hinweise, Schnellzugriffe, Demo-Kennzeichnung, fehlende Kosten | übernommen | Management-Cockpit | zip-core, SV-2, SC-7 |
| Monatsimport | CSV mit Vorschau/Diagnose, Zuordnung Artikel/Outlet, Monat/Menge/Bruttopreis | übernommen | Verkauf & Monatsimport | zip-core, SV-3 |
| | Steuer- und Kostensnapshot je Zeile | übernommen, auch im bisherigen Datenimport | Verkauf & Monatsimport, Datenimport | SV-3 |
| | Wiederholungsprüfung Dateiinhalt + Zeile | übernommen | Verkauf & Monatsimport | SV-3 |
| | Vorlage, CSV-Export | verbessert: Auswahl oder alles | Verkauf & Monatsimport | SV-3 |
| | WE bewusst nachtragen, Snapshots unverändert | verbessert (Formularfehler RC1) | Menu Engineering | SV-4 |
| Menu Engineering | Star/Renner/Puzzle/Penner, Suche, Filter, Empfehlungen, „WE fehlt“, Methodik | übernommen | Menu Engineering | zip-core, SV-4 |
| Inventur | Positionen, Einheit, Ist/Mindest/Ziel, Lieferant, Korrektur, Vorschlag Ziel − Ist, Export | übernommen | Mindestbestände | SV-7 |
| | Versionskonflikt | angepasst: Version je Position + Revisionsprüfung des Arbeitsbereichs | Mindestbestände | SV-7, SC-2, SQL |
| Team | Aufgaben, Priorität, Fälligkeit, Status, rollenabhängig, Schulung aus Funnel | übernommen | Team & Aufgaben | SV-5, SV-8, SC-7, SQL |
| Tagesfunnel | Bonpositionen, Tag-/Outletfilter, eindeutige Bons, Gäste nur bei vollständiger Basis, Brutto/Netto/DB I, Themenzuordnung, Zielquoten, Potenziale, Szenarien, sechs Themen | übernommen | Tagesfunnel (Kassenbons) | zip-intelligence, fixes, SV-5, SC-6 |
| | Leerzustand, Gästekonflikte, Storno/Korrektur, Überschneidungen zur Prüfung, Zuordnung ohne Groß-/Kleinschreibung | verbessert | Tagesfunnel | fixes, SV-5, SQL |
| | Cloud 90 Tage sichtbar, längere Zeiträume serverseitig | verbessert | Tagesfunnel | SC-6, SQL |
| Funnel Quest | 6 Missionen, Hinweise, Fragen, Antworten, Feedback, 100 XP, Punkte, Stufe, Fortschritt, Tageslimit, Schutz eigener Ergebnisse, Verknüpfung mit Potenzial | übernommen | Funnel Quest | zip-intelligence, SV-6, SC-6, SQL |
| | Bewertung auf dem Server | verbessert | RPC `glb_submit_training` | SQL, SC-6 |
| KI-Marktcheck | Beobachtungen mit Quelle/Prüfdatum, eigenes vs. Konkurrenzprodukt, Abweichung, OSM-Umfeld mit Radius 1/2/5 km, optionale KI, Kennzeichnung ungeprüfter Eingaben | übernommen | KI-Marktcheck | zip-intelligence, SV-9, api |
| | Zeitlimits, Tageslimit, Klartextfehler, fehlender Schlüssel ≠ Ergebnis; Umfeldsuche auch in der Demo | verbessert | Server-Routen | api |
| Weitere | Anmeldung/Sitzung | angepasst: Anmeldung der Suite, Konfiguration aus der Server-Umgebung statt Eingabe im Browser | Konto | SC-1, SC-8 |
| | Mandantentrennung, Rollen | übernommen (006) | SQL | rls, rls-v11 |
| | Audit | angepasst: Speicherungen, Kassenpositionen, Training | `glb_audit_events` | rls-v11 |
| | JSON-Backup, Demo-Modus, Demo-Reset | übernommen, Reset korrigiert | Einstellungen | SV-10 |
| | PWA, Offline-Demo | übernommen (gemeinsamer Service Worker) | – | pwa |
| | Lesende Legacy-Brücke | angepasst: Strukturcheck des Arbeitsbereichs (die alten Module sind in derselben App) | Strukturcheck | SV-11 |
| | Signierter POS-Webhook | verbessert | `/api/suite/pos/ingest` | api, rls-v11 |
| | Tests, Beispieldateien | übernommen | `suite-tests/v11`, `suite-v11-original` | – |

Alle bisherigen Module bleiben unverändert verfügbar (Liste in Abschnitt 3). Der verbrauchsbasierte Bestell-Forecast,
Lager, Warenbewegungen, Bestellungen, Renner-Penner (DB II) und Mein Markt (20 km) stehen neben den neuen Modulen;
die neuen Ansichten verlinken jeweils dorthin.

## 5. Behobene Fehler und Verbesserungen

| # | Fehler in RC1 bzw. Lücke | Ursache | Korrektur | Test |
| --- | --- | --- | --- | --- |
| V1 | „Bestand ändern“ und „WE nachtragen“ speichern nie, Meldung „form.id.startsWith is not a function“ (im Browser am Original nachgestellt) | Formularfeld `name="id"` überdeckt `form.id` | Formular-ID per `getAttribute("id")` | SV-4, SV-7 |
| V2 | `numberDE("0.001")` = 1 | Tausender-Muster ohne Prüfung der ersten Gruppe | Gruppe darf nicht mit 0 beginnen; eigener Parser `numberInput` für Zahlenfelder (Punkt), `numberDE` für deutsche Texte/CSV | fixes |
| V3 | Leerer Tagesfunnel: `guestComplete: true`, DB 0 | `every()` auf leerer Liste; `costMissing === 0` | Leerzustand (`empty`, `guestStatus`), DB `null` ohne Daten; echte Null bleibt 0 % | fixes |
| V4 | Demo zurücksetzen lässt Tagesfunnel/Training leer bis zum Neuladen | `resetLocal()` ohne `initializeIntelligence` | Initialisierung bei jedem Laden/Zurücksetzen über den gemeinsamen Ensure-Hook | SV-10 |
| V5 | Zuordnung Artikel→Thema: Demo ohne, Cloud mit Groß-/Kleinschreibung | Cloud patchte per exaktem Namen | eine Funktion `applyStageMappings` für beide Wege; SQL vergleicht `lower(trim())` | fixes, rls-v11 |
| V6 | Quizpunkte vom Browser gesendet | Insert mit `correct/points` aus dem Client | RPC bewertet mit Lösungsschlüssel, keine Insert-Rechte, Schlüssel nicht lesbar | rls-v11, SC-6 |
| V7 | Monatsexport ignoriert Filter | Export auf `state.data.sales` | zwei Schaltflächen: Auswahl / alles, Dateiname nennt die Auswahl | SV-3 |
| V8 | Mobile Navigation: vier Module heißen „Team“ | Fallback-Beschriftung | gemeinsame Navigation der Suite, Beschriftungen eindeutig (Prüfung beim Registrieren) | SV-1, SV-M1 |
| V9 | Widersprüchliche Gästezahlen aus verschiedenen Quellen unbemerkt | nur innerhalb einer Datei geprüft | Konflikt je Bon erkannt, Gäste dann „unbekannt“ | fixes |
| V10 | Überschneidung CSV/Webhook bzw. geänderte Dateien doppelt | Schlüssel nur Datei+Zeile | Positions-ID sicher; gleicher Inhalt aus anderer Quelle → zur Prüfung, zählt bis zur Entscheidung nicht | fixes, SV-5, rls-v11 |
| V11 | Stornos/Korrekturen nicht vorgesehen | negative Mengen abgelehnt | Typ Storno/Korrektur mit Bezug, netto je Thema | fixes, SV-5, api, rls-v11 |
| V12 | Worker ohne Zeitlimits, ohne Ratenbegrenzung, Fehlercodes ohne Erklärung | – | Zeitlimits, Tageslimit je Betrieb, deutsche Meldungen, Feldliste bei Webhook-Fehlern | api |
| V13 | `005` nicht wiederholbar | `create policy` ohne `drop … if exists` | `006` wiederholbar, auch nach 003/005 | rls-v11 + manuell |
| V14 | CSV-Export ohne Formelschutz | – | Text mit `= + - @` am Anfang wird entschärft, Zahlen bleiben Zahlen | fixes |
| V15 | (aus der eigenen früheren Überarbeitung) Kostenstände und Kosten-Snapshots gingen an eingeschränkte Rollen | `glb_read_workspace` kannte `costHistory`/`unitCostNet` nicht | entfernt; beim eingeschränkten Speichern bleiben Snapshots erhalten | rls-v11 |

Berechnungsdefinitionen unverändert: Netto = Brutto ÷ (1 + USt), DB I = Netto − Wareneinsatz, Kaufquote = Bons mit
mindestens einem Artikel des Themas ÷ alle berücksichtigten Bons, Szenario = zusätzliche Bons × beobachteter
Netto-Stückpreis bzw. DB je Einheit, Menu-Engineering-Schwellen = Median.

## 6. Tests (22.10.2026)

| Prüfung | Befehl | Bestanden | Fehlgeschlagen |
| --- | --- | --- | --- |
| ZIP-Original unverändert | `cd web/suite-v11-original && node --test tests/*.test.mjs` | 26 | 0 |
| Rechenlogik bisherige Suite | `npm run test:suite` (Teil `suite-tests/tests`) | 92 | 0 |
| v1.1-Logik: 20 ZIP-Tests portiert, 12 Fehlerbehebungen, 12 Server (5 RC1-Worker-Tests portiert), 2 PWA | `npm run test:suite` (Teil `suite-tests/v11`) | 46 | 0 |
| SQL 001+002 | `npm run test:suite-sql` | 8 | 0 |
| SQL 001+002 nach 006 | dto. | 8 | 0 |
| SQL 006, zwei Betriebe, Konten je Rolle | dto. | 7 | 0 |
| Browser: Suite, Cloud (Test-Server), v1.1-Module, Barrierefreiheit, Website, Rechtstexte | `npx playwright test e2e/suite*.spec.ts e2e/landing.spec.ts e2e/legal.spec.ts` | 68 | 0 |
| Layout | `scripts/suite-audit.mjs` bei 320, 390, 768, 1024 px | 0 Überläufe | – |

Der RC1-Rendering-Test (`tests/render.test.mjs`, simuliertes DOM) ist durch echte Browsertests ersetzt (SV-1: jedes Modul
öffnet sich mit Überschrift, keine Konsolenfehler). Der Python-Smoke-Test der ZIP war nie lauffähig und ist durch die
Playwright-Tests abgedeckt.

**Nicht geprüft (in dieser Umgebung nicht möglich):** echtes Supabase-Projekt (Migration 006 im Staging, Anmeldung,
Sitzungserneuerung, PostgREST-Antworten), echte OpenAI-Antworten und Abrechnung, echte Overpass-Erreichbarkeit
(nachgestellt), echte Kassen-/ETL-Strecke für den Webhook, Service-Worker-Aktualisierung auf HTTPS (Code geprüft, im Test
nur unter http), echte Geräte und Bildschirmleser, die Vercel-Vorschau-URL selbst (vercel.app ist von hier aus nicht
erreichbar; der Build für jeden Commit meldet „Deployment has completed“).

## 7. Migration und Konfiguration (vom Betreiber auszuführen)

1. **Staging**: Supabase-Projekt als Kopie der Produktion (oder neues Projekt mit 001 + 002), Backup.
2. `web/suite-sql/006_glb_v11_integrated.sql` im SQL-Editor ausführen. Wiederholbar.
3. Mit zwei Testbetrieben und je einem Konto pro Rolle prüfen (Ablauf wie `suite-tests/rls-v11.test.mjs`).
4. Vercel-Umgebungsvariablen (Production und Preview):
   - Pflicht für die Cloud: `GLB_SUPABASE_URL`, `GLB_SUPABASE_PUBLISHABLE_KEY` (bereits vorgesehen).
   - Optional KI-Marktcheck: `OPENAI_API_KEY` (kostenpflichtig bei OpenAI, nur nach deiner Entscheidung),
     `OPENAI_MODEL` (Standard `gpt-4.1-mini`), `GLB_AI_DAILY_LIMIT` (Standard 20 je Betrieb und Tag),
     `GLB_AI_MAX_OUTPUT_TOKENS` (Standard 1000), `GLB_DISCOVER_DAILY_LIMIT` (Standard 60).
   - Optional Kassen-Webhook: `POS_INGEST_SECRET` (mind. 32 Zeichen), `POS_INGEST_ORG` (UUID des Betriebs),
     `GLB_SUPABASE_SERVICE_ROLE_KEY` (nur Server). Endpunkt `POST /api/suite/pos/ingest`, Vertrag wie
     `suite-v11-original/docs/WEBHOOK.md`, zusätzlich `line_type` (`sale`/`void`/`correction`) und
     `corrects_external_line_id`; `outlet_id` ist die Outlet-ID der Suite (z. B. `restaurant`).
5. Ohne diese Variablen läuft die Suite als Demo im Browser; KI und Webhook melden dann „nicht eingerichtet“.
6. Erst nach erfolgreichem Staging-Test 006 auf Produktion ausführen.

## 8. Öffnen und prüfen

- Vorschau: der Vercel-Build dieses Branches (Vercel → Deployments → neuester Eintrag für
  `claude/replica-skill-install-vzriug` → Visit), Pfad `/suite`.
- Lokal: `cd web && npm install && npm run build && ALLOW_DEMO=1 npx next start -p 3300` → `http://localhost:3300/suite`.
- Neue Module in der Navigation: Management-Cockpit, Team & Aufgaben, Funnel Quest (Arbeitsplatz), Verkauf &
  Monatsimport, Menu Engineering, Tagesfunnel (Kassenbons), KI-Marktcheck (Verkauf & Analyse), Mindestbestände
  (Warenwirtschaft), Strukturcheck (Management). Beispieldatei für den Tagesfunnel: Vorlage-Knopf im Modul.

## 9. Quellpaket und Rückweg

- Quellpaket: `git archive` des Commits am Ende dieser Arbeit (dem Nutzer als ZIP übergeben); enthält die ZIP unverändert
  unter `web/suite-v11-original/`.
- Rückweg: Ausgangsstand ist Commit `ad9037c` (lokaler Tag `baseline-v11-integration`). Zurück mit
  `git revert --no-edit ad9037c..HEAD` auf einem eigenen Branch (behält die Historie) oder Deployment des Commits
  `ad9037c` in Vercel („Promote to Production“). Die Datenbank bleibt kompatibel: 006 ist additiv; die ersetzten Funktionen
  `glb_read_workspace`/`glb_save_limited` lassen sich durch erneutes Ausführen der Funktionsteile aus `002` zurücksetzen.
