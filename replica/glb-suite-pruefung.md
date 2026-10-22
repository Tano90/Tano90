# GLB AI Suite: Prüfung und Überarbeitung (ab 22.10.2026)

Ausgangsstand: Commit `533a90d` auf `claude/replica-skill-install-vzriug` (lokaler Tag `baseline-2026-10-22`;
Tags lassen sich aus dieser Umgebung nicht pushen). Code: `web/public/suite` (v0.8 aus der Übergabe, statische App),
eingebunden in die Next.js-Website unter `/suite`. Tests: `npm run test:suite` (80 v0.8-Tests), Playwright
`e2e/suite*.spec.ts`, Layoutprüfung `scripts/suite-audit.mjs`.

## Aufbau (geprüft)

- Laden: `index.html` → `core.js`, `v04core.js`, `v05core.js`, `v06core.js` (Rechenlogik, getestet), `v08roles.js`,
  `v08menu.js`, `app.js` (gesamte Oberfläche, enthält v0.4–v0.6), `v08ui.js`, `cloud.js`, `mobile.js`, `market-plus.js`.
  `v04app.js`, `v05app.js`, `v06app.js` waren Kopien ohne Verwendung → `web/suite-legacy/`.
- Daten: ein JSON-Stand je Betrieb (`S`). Demo: `localStorage` im Browser. Cloud: Supabase-Tabelle
  `glb_snapshots` über RPCs mit Revisionsnummer (`cloud.js`, SQL 001/002 der Übergabe).
- Konfiguration: `/suite/config.js` aus Umgebungsvariablen; ohne Werte läuft die Demo.

## Funktionsbestand (alle 23 Navigationsziele, automatisiert geöffnet, keine Laufzeitfehler)

| Bereich | Ansicht | Kernaktionen |
| --- | --- | --- |
| Mein Arbeitsplatz | myday | Aufgabenkacheln je Rolle |
| Mission Control | operations | Einrichtungsstand, Hinweise, Backup |
| Dashboard | overview | Kennzahlen, Berichtsfilter, Verkauf erfassen |
| Service Funnel | funnel | Tageserfassung, CSV-Vorlage/-Import, Annahmen, Szenario |
| Artikel & Umsätze | products | Artikel anlegen/bearbeiten, Bericht |
| Outlets | outlets | Outlet anlegen, Verkauf erfassen, Bericht |
| Renner-Penner | portfolio | Matrix, Aktionsplan |
| Lebenszyklen | lifecycle | Phasen je Artikel, Monatsabsatz |
| Mein Markt | market | Umkreissuche, Preisvergleiche |
| Speisekartenimport | menuimport | CSV/Text/PDF, Vorschau, Korrektur |
| Rezepte & Rohwaren | recipes | Rezepte, Rohwaren, CSV-Importe, Kostenübernahme |
| Deckungsbeiträge | costs | Monatskosten, Zielpreise |
| Preiskalkulation | calculator | Einzelrezept kalkulieren |
| Oberkategorien | groups | Gruppen anlegen, zuordnen |
| Inventur & Lager | inventory | Zählung, Lager, Bewegung buchen |
| Warenbewegungen | stockledger | Journal, Eingang/Transfer/Schwund |
| Bestell-Forecast | purchasing | Bedarf 7/28 Tage, Bestellentwurf |
| Bestellungen | orders | Status, Wareneingang |
| Report Studio | reports | 4 Reiter, Filter, CSV, Druck, gespeicherte Ansichten |
| GLB Intelligence | insights | regelbasierte Hinweise |
| Datenimport | import | Artikel- und Verkaufs-CSV |
| Einrichtung | setup | Schritte |
| Einstellungen | settings | Betrieb, JSON-Backup/-Wiederherstellung, Demo zurücksetzen |

## Befunde aus dem Browser-Test vom 21.10.2026

Legende: **bestätigt** = am Code bzw. im Test nachgestellt; **behoben** = Ursache geändert und per Test geprüft.

| # | Befund | Status | Ursache / Änderung | Test |
| --- | --- | --- | --- | --- |
| 1 | Service-Bericht zeigt im August Septemberwerte (494 / 610 / 3.384,31 €) | bestätigt, behoben | `V6.funnel` wurde im Report nur mit Outlet, im Modulbericht ganz ohne Filter aufgerufen. Jetzt Monat + Outlet; CSV gleiche Auswahl, Dateiname nennt sie | SN-1, SN-2 |
| 2 | Nicht anwendbare Filter | behoben | Warengruppe beim Funnel, alle Filter bei Lager/Einkauf gesperrt mit Erklärung | SN-2, SN-3 |
| 3 | Modulberichte mit unsichtbarem Filter aus dem Report Studio | bestätigt, behoben | Filterleiste und Auswahl werden in Artikel, Outlets, Oberkategorien, Renner-Penner angezeigt | SN-6 |
| 4 | Dashboard: Summe aller Monate neben „+16,7 % zum Vormonat“ | bestätigt, behoben | Beschriftung nennt Auswahl der Summe und die verglichenen Monate | SN-4 |
| 5 | Deckungsbeiträge: September oben, alle Monate unten | bestätigt, behoben | Bericht im Modul nutzt den Monat des Moduls, Kacheln nennen ihn | SN-5 |
| 6 | Leere Auswahl als 0,00 € | bestätigt, behoben | Leerzustand „Keine Verkaufszeilen in dieser Auswahl“ in Report, Dashboard, Modulberichten | SN-7 |
| 7 | Definitionen DB I/DB II | geprüft, korrekt | DB I = Netto − Warenkosten; DB II = Netto − variable Kosten (Warenkosten enthalten); keine Doppelabzüge; Rundung erst in der Anzeige | – |
| 8 | „Mein Konto“ öffnet in der Demo nichts | bestätigt, behoben | Ursache: der Demo-Zweig in `cloud.js` (Website-Einbindung) beendete vor dem Klick-Handler. Jetzt erklärt ein Fenster: keine Anmeldung ohne Cloud-Projekt, Daten nur im Browser, Backup | SU-S1 |
| 9 | Widersprüchliche Speicheraussagen („Online-Datenspeicherung“ in der Demo) | bestätigt, behoben | Seitenleiste nennt den echten Speicherort (Demo: nur dieser Browser; Cloud: Betrieb · Rolle). Demo meldet „im Browser gespeichert HH:MM“ erst nach erfolgreichem Schreiben, sonst „NICHT gespeichert“ | SU-S1, SU-S2 |
| 10 | Cloud-Status | geprüft, verbessert | „In der Cloud gespeichert“ erschien schon vorher erst nach Serverbestätigung (Revision). Neu: eigener Offline-Zustand („Offline · Änderungen warten“, sendet bei Rückkehr); der konkrete Fehlergrund („Bearbeitungskonflikt“, „Nicht gespeichert“) wurde bisher sofort durch „Synchronisation blockiert“ überschrieben, jetzt bleibt er stehen | SC-1 bis SC-4 |
| 11 | Mandantentrennung und Rollen auf Datenbankebene | geprüft, korrekt | SQL 001/002 in frischer lokaler Postgres-DB mit nachgebauter Supabase-Anmeldung: fremder Betrieb weder lesbar noch schreibbar, ohne Anmeldung nichts, keine direkten Tabellen-Schreibrechte, Service/Küche ohne Einkaufspreise, eingeschränkte Rollen schreiben nur erlaubte Bereiche, Geschäftsführung ohne Zugriff auf Inhaber, Revisionskonflikt statt Überschreiben, Einladung nur mit bestätigter E-Mail | `npm run test:suite-sql` (8/8) |
| 12 | Anmelden, Neuladen, Abmelden, zwei Sitzungen, Offline, Rollen in der Oberfläche | geprüft | Cloud-Modus im Browser gegen einen Test-Server mit denselben Regeln wie SQL 002 | SC-1 bis SC-5 |

**Nicht prüfbar in dieser Umgebung:** echtes Supabase-Projekt (Netzwerk gesperrt, keine Zugangsdaten), E-Mail-Bestätigung und Passwort-Zurücksetzen über Supabase, Verhalten der produktiven Datenbank. Die SQL-Dateien sind unverändert die aus der Übergabe.

### Forecast, Datenqualität, Einkauf

| # | Befund | Status | Ursache / Änderung | Test |
| --- | --- | --- | --- | --- |
| 13 | Kaffeebohnen ohne Rezept: 0 g, „Bedarf gedeckt“ | bestätigt, behoben | Rohwaren ohne Rezeptverwendung bekamen Verbrauch 0. Jetzt Grundlage je Rohware: berechnet / kein Absatz im Zeitraum (echte Null) / nicht ermittelbar (in keinem Rezept, Einheit nicht umrechenbar, keine Tagesabsätze) mit Grund; nicht ermittelbare Positionen ohne Bestellmenge, alle anderen werden weiter berechnet | v09.test, SF-1 |
| 14 | „Gute Datenabdeckung“ nur aus Tagen | bestätigt, behoben | Bewertung aus Tagen, Rezeptanteil der verkauften Einheiten, gezähltem Bestand der benötigten Rohwaren, umrechenbaren Einheiten; Gründe werden genannt. Fehlende Tage vs. Tage mit 0 Verkäufen getrennt ausgewiesen | v09.test |
| 15 | Mission Control „6/6 erledigt“ bei 4 von 12 Rezepten | bestätigt, behoben | Einrichtung (Schritt einmal erledigt) und Datenvollständigkeit getrennt: kalkulierbare Artikel (Rezept oder direkter Einkaufspreis für Direktverkauf), unvollständige Rezepte, Rohwaren ohne Preis | v09.test |
| 16 | Veralteter Hinweis „berücksichtigt keine Wareneingänge“ | bestätigt, behoben | Text nennt jetzt, was eingeht (Inventur + Bewegungen + offene Bestellungen) und was nicht (Entwürfe, MHD, Mindestmengen) | SF-1 |
| 17 | Doppelte Bestellung desselben Bedarfs | teilweise bestätigt, behoben | „Bestellt“ wurde schon abgezogen; Entwürfe nicht. Neuer Entwurf für Rohwaren mit offenem Entwurf fragt nach; Spalte „Bereits bestellt“ | SF-1 |
| 18 | Doppelter Wareneingang | geprüft, abgesichert | Status verhinderte die zweite Buchung bereits; zusätzlich Sperre, wenn für die Bestellung schon Eingangsbewegungen existieren (z. B. nach Wiederherstellung) | SF-1 |
| 19 | „Daten nur lokal“ in Mission Control auch im Cloud-Betrieb | bestätigt, behoben | Text nach tatsächlichem Speicherort | – |
| 20 | Einkaufsablauf | geprüft, funktioniert | Forecast 641,20 € → Entwurf → bestellt (nur Status, kein Versand) → Wareneingang → Bewegung → Bestand 22 + 4 × 20 = 102 Stk → Forecast 0 € | SF-1 |

### Kalkulation, Kostenstände, Analysen, Importe, Backup

| # | Befund | Status | Ursache / Änderung | Test |
| --- | --- | --- | --- | --- |
| 21 | Historische Monate wurden mit heutigen Kosten bewertet | bestätigt, behoben | Artikel hatten nur einen Kostenwert. Neu: Kostenstände mit „gültig ab“, Quelle und Zeitpunkt (`costHistory`); Bestandswerte werden beim ersten Laden als undatierter Stand übernommen (Migration, nichts geht verloren). Berichte rechnen standardmäßig mit dem Stand des Verkaufsmonats, „heutige Kosten“ ist als Szenario wählbar und so beschriftet | v09.test, SN-5 |
| 22 | Rezeptkosten und Artikelkosten liefen unbemerkt auseinander | bestätigt, behoben | Rezeptansicht zeigt Abweichung zum Artikel und Datum der letzten Übernahme; Übernahme wird als Kostenstand protokolliert | SA-3 |
| 23 | Gleiche Verkaufs- oder Tagesdatei zweimal importiert = doppelte Mengen | bestätigt, behoben | Import ohne Abgleich. Neu: Vorschau mit gültigen, fehlerhaften (mit Zeilennummer) und vorhandenen Zeilen, Modus Ergänzen / Aktualisieren / Ersetzen mit Wirkung, Wiedererkennung derselben Datei (Fingerabdruck), Importprotokoll | SI-1, SI-2 |
| 24 | Artikelimport hängte Dubletten an | bestätigt, behoben | „Aktualisieren“ behält ID, Rezept- und Verkaufsverknüpfung, protokolliert den Kostenstand | SI-3 |
| 25 | Korrektur- und Retourenzeilen (negative Menge) abgelehnt bzw. auf 0 gesetzt | bestätigt, behoben | Negative ganze Mengen erlaubt und verrechnet; negative Preise und Kosten weiter abgelehnt | SI-1, v09.test |
| 26 | Backup und Wiederherstellung | geprüft, funktioniert | In getrennter Browsersitzung wiederhergestellt: alle Datenbereiche gleich, Verknüpfungen (Verkauf→Artikel, Rezept→Rohware) vollständig | SI-4 |
| 27 | Renner-Penner verglich alles mit allem über alle Monate | bestätigt, behoben | Vergleichsgruppe (Sortiment, Warengruppe, Oberkategorie), Zeitraum, Outlet wählbar; Schwellen (Median) und Gruppengröße sichtbar, Warnung bei kleinen Gruppen; Prioritäten nach Gesamt-DB II mit Begründung, Änderung, Erfolgskontrolle | SA-1, v09.test |
| 28 | Lebenszyklus: Monat ohne Verkauf nicht von fehlenden Daten unterscheidbar | bestätigt, behoben | Nach dem ersten Verkauf zählen erfasste Monate ohne Absatz als echte Null („nicht verkauft“); Methode, Zeitraum und fehlende Monate werden genannt | SA-2, v09.test |
| 29 | Speisekarte: USt fest 19 % für alles | bestätigt, behoben | Voreinstellung Speisen/Getränke in den Einstellungen (7 / 19 %), Getränke über Überschrift oder Warengruppe erkannt, Satz aus der Datei hat Vorrang; Herkunft je Position sichtbar und änderbar | SM-1, v09.test |
| 30 | Speisekarte: unsichere Erkennung nicht erkennbar, stille Kürzung auf 180 Zeilen | bestätigt, behoben | Positionen mit Prüfgrund markiert (zwei Zeilen, Preis < 1 € oder > 200 €, Großbuchstaben, Ziffern im Namen), Filter „nur zu prüfende“, Rückfrage vor dem Speichern; alle Zeilen werden angezeigt | SM-1 |
| 31 | Fotos nicht auswählbar, Scan-PDF mit Fachbegriff „OCR“ abgewiesen | bestätigt, behoben | Fotos und Scans werden angenommen und mit konkretem Ausweg abgelehnt (Text am Handy kopieren, CSV-Vorlage); keine vorgetäuschte Texterkennung | SM-2 |
| 32 | Exporte ohne Angabe von Auswahl, Einheiten, Grundlage | bestätigt, ergänzt | CSV unverändert (Format erhalten, Dateiname nennt Auswahl). Neu optional Excel (.xlsx) für Report Studio und Bestell-Forecast: Blatt „Bericht“ mit Zeitraum, Outlet, Warengruppe, Kostenbasis, Formeln, Einheiten, Rundung, Beispiel-/Echtdaten; Blatt „Daten“ mit Zahlen als Zahlen | SN-8, v09.test, LibreOffice |

### Bedienung, Mobil, Barrierefreiheit, Design, Website

| # | Befund | Status | Ursache / Änderung | Test |
| --- | --- | --- | --- | --- |
| 33 | Suche fand „Report Studio“ nicht über „Report“, kannte nur 17 von 23 Zielen | bestätigt, behoben | Feste Liste ersetzt: Suche baut sich aus der Navigation der aktuellen Rolle auf, mit Suchbegriffen je Modul (z. B. Excel, Wareneingang, USt); Pfeiltasten, Enter. Fenster blieb nach der Auswahl offen – behoben | SB-1 |
| 34 | Mein Arbeitsplatz, Mission Control und Dashboard kaum unterscheidbar, große Begrüßungsflächen | bestätigt, behoben | Arbeitsplatz zeigt Aufgaben aus den Daten (Wareneingang, Entwürfe, Forecast, fehlende Zählung, Artikel ohne Kosten) mit Begründung; Mission Control = Einrichtung und Datenqualität; Dashboard = Kennzahlen. Kopfbereiche auf normale Seitenköpfe verkleinert, Kopfzeile heißt wie die Navigation („Dashboard“ statt „Übersicht“) | SB-2 |
| 35 | Zu blasse Texte, unbeschriftete Felder und Symbol-Buttons | bestätigt, behoben | axe-Scan über alle 23 Module: 69 Textfarben im selben Farbton abgedunkelt (WCAG AA), Bearbeiten/Löschen nennen ihr Ziel, Felder erhalten die sichtbare Beschriftung als Namen (`a11y.js`), Tabellen-Scrollbereiche per Tastatur erreichbar, sichtbarer Fokus | SX-1 (0 schwere Befunde) |
| 36 | Inventur: „Lose Menge (Gebinde-Einheit)“, gerechnet wurde aber in g/ml/Stk | bestätigt, behoben | Einheit am Feld je Rohware („Volle Gebinde je 5 kg“, „Lose Menge in g“), Summe vor dem Buchen | SB-3 |
| 37 | Warenbewegung: alle Felder für alle Vorgänge | bestätigt, behoben | Felder je Vorgang, Schwund mit Grund (in der Bemerkung, Datenmodell unverändert), Klartext der Buchung vor dem Speichern | SB-4 |
| 38 | Mein Markt: technische Fehlermeldungen | bestätigt, behoben | Zeitüberschreitung, Überlastung, HTTP-Fehler, offline in Worten; „Erneut versuchen“ | SU-MK3 |
| 39 | Lange Ansichten (Outlets 7.000 px, 144 Einzelzeilen) | bestätigt, behoben | Detailtabellen einklappbar mit Anzahl in der Zusammenfassung, Zustand bleibt beim Filtern; Kürzung auf 150 Zeilen wird genannt | SB-5 |
| 40 | Beispieldaten erzeugten eine Ersatzbasis-Warnung bei Kosten | bestätigt, behoben | Beispielkosten gelten ab dem ersten Beispielmonat; eigene Daten behalten den ehrlichen undatierten Stand | SB-5 |
| 41 | Tablet: Kopfzeile rechts abgeschnitten | bestätigt, behoben | 768–1279 px kompakte Kopfzeile | SB-6, Layoutprüfung |
| 42 | „App installieren“ immer sichtbar, auch ohne Installationsmöglichkeit | bestätigt, behoben | Nur bei Angebot des Browsers, auf iPhone/iPad mit Anleitung | SB-7 |
| 43 | Bilderkennung in der Inventur auf der Website: JSON-Fehlermeldung | bestätigt, behoben | Klar als Zusatz der lokalen Installation benannt, auf der Website verständliche Meldung; Funktion bleibt erhalten | – (manuell) |
| 44 | Generischer Look: dunkle Verläufe, Leuchten, englische Fachwörter | umgesetzt | `calm.css`: flache neutrale Flächen, Grün für Aktionen und Positives; „Payroll“ → Personalkosten; Liste „Was die Suite kann – und was nicht“ ehrlich (kein Lieferantenversand, keine Kasse, keine Texterkennung, nicht GoBD-revisionssicher, Hinweise regelbasiert) | Sichtprüfung |
| 45 | Website zeigte alten Stand der App | behoben | Screenshots und Rundgang-Video neu aus der aktuellen Suite, Texte zu Excel-Export, Kostenständen, Speisekartenimport, Vergleichsgruppen, Dubletten-Erkennung | landing.spec |

## Abschluss

### Testläufe (22.10.2026, Stand Commit am Ende dieses Abschnitts)

| Prüfung | Befehl | Ergebnis |
| --- | --- | --- |
| Rechenlogik (Unit) | `npm run test:suite` | 92 / 92 bestanden (80 aus v0.8, 12 neu) |
| Mandantentrennung und Rollen in Postgres | `TEST_DATABASE_URL=… npm run test:suite-sql` | 8 / 8 bestanden |
| Browser: Suite und Website | `npx playwright test e2e/suite*.spec.ts e2e/landing.spec.ts e2e/legal.spec.ts` | 53 / 53 bestanden |
| Barrierefreiheit | SX-1 (axe, WCAG 2 A/AA, alle 23 Module) | 0 schwere Befunde |
| Layout Handy/Tablet/Desktop | `scripts/suite-audit.mjs` bei 320, 360, 390, 768, 1024, 1280 px | 0 Überläufe |
| Excel-Datei | Öffnen in LibreOffice (headless) | öffnet, Zahlenformate korrekt, Formeltext bleibt Text |
| Typprüfung, Build | `npx tsc --noEmit`, `npm run build` | ohne Fehler |

### Offen bzw. hier nicht prüfbar

- Echtes Supabase-Projekt, E-Mail-Bestätigung, Passwort-Zurücksetzen: keine Zugangsdaten und kein Netz zu Supabase in dieser Umgebung. Geprüft ist das Verhalten gegen einen Testserver mit denselben Regeln und die SQL-Dateien in lokalem Postgres.
- Echte Geräte (iPhone, Android, iPad): geprüft mit Browser-Emulation in Chromium, nicht auf Hardware. Safari selbst wurde nicht ausgeführt.
- Bildschirmleser: automatische Prüfung (axe) bestanden, kein Test mit VoiceOver/TalkBack.
- Microsoft Excel: Datei in LibreOffice geprüft; Excel selbst nicht verfügbar.
- Overpass/Nominatim im Live-Betrieb: Verhalten mit nachgestellten Antworten getestet (Erfolg, 429, Ausfall).
- Bilderkennung (lokaler GLB-Server mit Ollama): nicht Teil der Website, nicht getestet.
- Steuersätze: Voreinstellung 7 % Speisen / 19 % Getränke ist änderbar; der richtige Satz je Betrieb ist mit der Steuerberatung zu klären.
- Offene Entscheidungen beim Betreiber: Preise, Zahlungsweg, Supabase-Region, Impressumsdaten; Vercel-Variablen `GLB_SUPABASE_URL` und `GLB_SUPABASE_PUBLISHABLE_KEY` sowie die Redirect-URL in Supabase.

### So prüfst du das Ergebnis

1. Website öffnen (Vercel-Vorschau dieses Branches) und auf „Demo öffnen“ bzw. `/suite` gehen. Ohne Cloud-Variablen läuft die Suite als Demo mit markierten Beispieldaten nur im Browser.
2. Strg + K drücken, „Report“ tippen, Enter → Report Studio. Dort Monat wählen, „Excel“ laden: Blatt „Bericht“ nennt Zeitraum, Outlet, Kostenbasis, Einheiten.
3. Mein Arbeitsplatz: Aufgaben aus den Beispieldaten; Klick führt zur passenden Stelle.
4. Speisekartenimport: Beispieltext einfügen, „Text erkennen“ → markierte Positionen; ein Foto auswählen → verständliche Ablehnung.
5. Datenimport: dieselbe Verkaufs-CSV zweimal laden → „bereits importiert“, nichts doppelt.
6. Inventur & Lager: Rohware wählen → Einheit am Feld, Summe vor dem Buchen.
7. Auf dem Handy: Menü unten, „⋯“ oben rechts für Konto, Suche, Backup.

Lokal: `cd web && npm run build && ALLOW_DEMO=1 npx next start -p 3300`, dann `http://localhost:3300/suite`.
