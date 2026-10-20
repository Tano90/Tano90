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
| S04 | Zutat | 2026-10-20 | done | Gebinde bearbeiten (nur anlegen/löschen), Zutaten zusammenführen, Sichtbarkeit/Mindestbestand pro Outlet | Gebinde-Hierarchie plus Preis pro Pack oder pro kg braucht zwei Dialoge, sonst wird es unverständlich |
| S05 | Rezepte | 2026-10-20 | done | Bulk-Aktionen | – |
| S06 | Rezept | 2026-10-20 | done | VK pro Outlet, Nährwerte pro Portion | Live-Kalkulation über Unterrezepte und Einheiten (Stück ↔ g ↔ ml); „Portion“ als Einheit für Unterrezepte |
| S07 | Menüs | – | stub | alles | – |
| S08 | Menü | – | stub | alles | – |
| S09 | Etikett & Stückliste | – | stub | alles | – |
| S10 | Lieferanten | 2026-10-20 | done | archivieren | – |
| S11 | Lieferant | 2026-10-20 | done | Sortiment direkt hier pflegen (geht über die Zutat) | – |
| S12 | Bestellungen | 2026-10-20 | done | – | – |
| S13 | Neue Bestellung | 2026-10-20 | partial | E-Mail an den Lieferanten (nur Status), Bestell-PDF | – |
| S14 | Wareneingang | 2026-10-20 | done | Ersatzartikel, Mehrlieferung | **Fehler gefunden und behoben:** nach einer Teillieferung behielt das Formular alte Werte, ein zweites Erfassen hätte doppelt gebucht. Formular setzt sich jetzt zurück, der Server lehnt Überlieferungen ab. |
| S15 | Rechnungsabgleich | – | stub | alles | – |
| S16 | Lager | 2026-10-20 | done | Export | Absolut positionierte Screenreader-Texte in scrollbaren Tabellen haben die Seite auf dem Handy verbreitert (behoben, betraf alle Tabellen) |
| S17 | Inventur | 2026-10-20 | partial | Zählen in Gebinden, Barcode-Scan | Zwischenstände automatisch speichern, damit ein Funkloch im Kühlhaus nichts kostet |
| S18 | Umbuchung | – | stub | alles | – |
| S19 | Schwund | 2026-10-20 | done | – | – |
| S20 | Lagerbericht | – | stub | alles | – |
| S21 | Kassen-Anbindung | – | stub | alles | – |
| S22 | Menu Engineering | – | stub | alles | – |
| S23 | Produktion | – | stub | alles | – |
| S24 | Einstellungen | 2026-10-20 | done | – | – |
| S25 | Outlets & Team | 2026-10-20 | partial | Einladungs-Mail, Rolle ändern, Mitglied entfernen, Outlet archivieren | – |
| S26 | Import | – | stub | alles | – |
| S27 | HACCP | – | stub | alles | – |

## Außerhalb einzelner Screens

- 2026-10-20: Allergen-Rangfolge in `web/supabase/migrations/0001_schema.sql` korrigiert. `unknown` stand unter `free`, ein Gericht mit einer
  ungeprüften Zutat wäre als „frei“ durchgegangen. Jetzt gilt `free < unknown < may_contain < contains`, mit Unit-Test.
- Unit-Tests der Rechenregeln: `npm test` in `web/` (Einheiten, Kalkulation, Unterrezepte, Allergene, gleitender
  Durchschnittspreis, Bestellvorschlag).
