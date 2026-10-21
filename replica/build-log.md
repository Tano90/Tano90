# Build-Log

Stand: 2026-10-20. Datenschicht: **im Arbeitsspeicher** (`web/src/data/store.ts`), Signaturen wie die spätere
Supabase-Schicht. Ein Neustart des Servers setzt alle Daten auf den Seed zurück. Anmeldung ist ein Demo-Login.

Prüfung pro Screen (`npm run screenshot:screens`): Screenshot 1440 px und 390 px in `replica/clone-screens/`,
axe-core WCAG 2.2 AA ohne Verstoß, keine Konsolenfehler, kein seitliches Scrollen bei 390 px. Abläufe F01, F02
(nur Tastatur), F04, F06–F09 und die Rollenrechte im Browser durchgespielt. Keine Referenz-Screenshots des
Originals vorhanden, daher kein Layoutvergleich.

| ID | Screen | Datum | Stand | Fehlt | Schwerer als gedacht |
| --- | --- | --- | --- | --- | --- |
| S01 | Anmeldung | 2026-10-20 | partial | echte Auth (Passwort, Magic Link, Passwort vergessen) | – |
| S02 | Übersicht | 2026-10-20 | done | – | – |
| S03 | Zutaten | 2026-10-20 | done | Bulk-Aktionen (archivieren, Kategorie setzen) | – |
| S04 | Zutat | 2026-10-20 | done | Gebinde bearbeiten (nur anlegen/löschen), Zutaten zusammenführen | Gebinde-Hierarchie plus Preis pro Pack oder pro kg braucht zwei Dialoge, sonst wird es unverständlich |
| S05 | Rezepte | 2026-10-20 | done | Bulk-Aktionen | – |
| S06 | Rezept | 2026-10-20 | done | – | Live-Kalkulation über Unterrezepte und Einheiten (Stück ↔ g ↔ ml); „Portion“ als Einheit für Unterrezepte |
| S07 | Menüs | 2026-10-20 | done | – | – |
| S08 | Menü | 2026-10-20 | done | Menü-Etikett zum Drucken | Stückliste rekursiv über Unterrezepte: Mengen laufen über Chargenanteile (Menge ÷ Ausbeute), nicht über Portionen |
| S09 | Etikett & Stückliste | 2026-10-20 | done | Etikett-Vorlagen und Formate (heute eine Druckansicht); Menü-Stückliste steckt in S08 | Allergen-Namen lagen in einem Client-Modul und mussten für die Server-Seite in ein gemeinsames Modul |
| S10 | Lieferanten | 2026-10-20 | done | – | Archivieren muss offene Bestellungen ablehnen und die Preise mit archivieren |
| S11 | Lieferant | 2026-10-20 | done | Sortiment direkt hier pflegen (geht über die Zutat) | – |
| S12 | Bestellungen | 2026-10-20 | done | – | – |
| S13 | Neue Bestellung | 2026-10-20 | partial | E-Mail an den Lieferanten (nur Status), Bestell-PDF | seit 5. Durchgang: gewogene Artikel nach Gewicht (kg/l), gespeichert als Bruchteil des Gebindes |
| S14 | Wareneingang | 2026-10-20 | done | Ersatzartikel, Mehrlieferung | **Fehler gefunden und behoben:** nach einer Teillieferung behielt das Formular alte Werte, ein zweites Erfassen hätte doppelt gebucht. Formular setzt sich jetzt zurück, der Server lehnt Überlieferungen ab. |
| S15 | Rechnungsabgleich | – | stub | alles | – |
| S16 | Lager | 2026-10-20 | done | – | Mindest- und Zielbestand pro Zeile im Dialog, in kg/l/Stk. statt Basiseinheit |
| S17 | Inventur | 2026-10-20 | done | Barcode-Scan | Zählen in Gebinden: Aufteilung (jsonb, Migration 0006) separat von der Summe speichern, Server rechnet die Summe nach |
| S18 | Umbuchung | 2026-10-20 | done | – | Empfangendes Outlet durfte das Ereignis nicht lesen (RLS) und den Namen des Senders nicht: Migration 0007 und Namen über den Dienstzugang nur für sichtbare Ereignisse |
| S19 | Schwund | 2026-10-20 | done | – | – |
| S20 | Lagerbericht | 2026-10-20 | done | – | Tagesgrenzen in der Zeitzone des Outlets inkl. Zeitumstellung; „−0,00 €“ kam aus negativer Null |
| S21 | Kassen-Anbindung | 2026-10-20 | done | Excel-Import für Verkäufe | Größer als gedacht: Parser, API mit Schlüsseln, Abbuchung über Stückliste, Nachbuchen beim Verknüpfen, parallele Importe. Eine vor der Hydrierung gewählte Datei ging verloren (FileUpload holt sie jetzt nach) Seit 5. Durchgang: Stornos buchen zum Durchschnittspreis zurück. |
| S22 | Menu Engineering | 2026-10-21 | done | – | Konstanten aus einem Client-Modul (wie beim Etikett) und Diagrammtext, der auf dem Handy auf 7 px schrumpfte: zeichnet jetzt in echter Breite |
| S23 | Produktion | – | stub | alles | – |
| S24 | Einstellungen | 2026-10-20 | done | – | – |
| S25 | Outlets & Team | 2026-10-20 | partial | Outlet archivieren | Rollenregeln: Admin darf den Inhaber nicht ändern, es bleibt immer mind. ein Inhaber, Inhaberschaft wird übertragen statt vergeben |
| S26 | Import | 2026-10-21 | done | Import von Zutaten-Stammdaten ohne Preis, Allergene per Import | Datei wird im Browser gelesen (Excel-Bibliothek nur bei Bedarf geladen) und in Teilen geplant und übernommen; 420 neue Zutaten in etwa 6 s |
| S27 | HACCP | – | stub | alles | – |

## Außerhalb einzelner Screens

- 2026-10-21 (5. Durchgang): Stornos an der Kasse, Menu Engineering, Bestellen nach Gewicht, Preislisten-Import. E2E 158/158,
  Unit- und Integrationstests 52/52, Demo-Modus geprüft. Seed: gestrige Verkäufe der verknüpften Gerichte mit echter Abbuchung,
  Anfangsbestand für Kreuzkümmel, Petersilie und Salz (sonst negativer Bestand). Neue Abhängigkeit: read-excel-file 9.3.10 (MIT, exakt gepinnt).

- 2026-10-20 (4. Durchgang): Preis pro Outlet, Sichtbarkeit pro Outlet, Nährwerte pro Rezept, Etikett (S09). E2E 137/137,
  Unit- und Integrationstests 48/48, Demo-Modus geprüft. Demo-Nährwerte im Seed sind gerundete Richtwerte, nicht für echte Etiketten.

- 2026-10-20 (3. Durchgang): Schritte 2–5 aus `parity.md`: Lagerbericht, Umbuchung, Mindest-/Zielbestand, Kassen-Anbindung mit
  Lagerabzug. E2E 121/121, Unit- und Integrationstests 45/45, Demo-Modus ohne Datenbank geprüft.

- 2026-10-20 (2. Durchgang): offene Must-haves aus `parity.md` gebaut: Lieferanten archivieren, Team (Rolle, Entfernen, Inhaberschaft),
  Inventur in Gebinden, Menüs mit Stückliste. Parität 62,3 → 72,1, Must-haves 20 von 21. Offen bleibt nur der Login-Durchklick
  mit einem echten Supabase-Projekt (braucht dein Konto). E2E-Setup migriert jetzt selbst, damit die Suite nie gegen ein altes Schema läuft.

- 2026-10-20: Allergen-Rangfolge in `web/supabase/migrations/0001_schema.sql` korrigiert. `unknown` stand unter `free`, ein Gericht mit einer
  ungeprüften Zutat wäre als „frei“ durchgegangen. Jetzt gilt `free < unknown < may_contain < contains`, mit Unit-Test.
- Unit-Tests der Rechenregeln: `npm test` in `web/` (Einheiten, Kalkulation, Unterrezepte, Allergene, gleitender
  Durchschnittspreis, Bestellvorschlag).
