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
