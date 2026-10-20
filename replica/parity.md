# Parität: Kitchen Ledger gegen Apicbase

Stand: 2026-10-20 · Grundlage: `replica/features.csv`, `replica/recon.md`, `replica/bugs.md`, E2E-Lauf 61/61.

## Urteil: **nicht auslieferbar**

- 5 von 21 Must-haves sind nur teilweise da (Liste unten).
- Offene S1/S2-Bugs: keine.
- Feature-Score 62,3 – die Schwelle für „auslieferbar“ ist 80 und alle Must-haves.

## Zahlen

| Messung | Wert | Anmerkung |
| --- | --- | --- |
| Feature-Parität | **62,3 / 100** | must ×3, should ×2, could ×1, teilweise = halb; 5 `skip`-Zeilen nicht gewertet |
| Must-haves fertig | **16 / 21** | 5 teilweise, keins fehlt ganz |
| Layout-Parität | **nicht gemessen** | Keine Screenshots des Originals: Die Apicbase-Seiten sind in dieser Umgebung gesperrt, ein eigener Account wurde nicht genutzt. Klon-Screenshots liegen bereit (`replica/clone-screens/`, 1440 und 390 px). Sobald Original-Screenshots in `replica/screens/` liegen: `python3 imgdiff.py replica/screens/S06.png replica/clone-screens/S06.png --out replica/diffs/S06.png`. |
| Gesamt | **62,3** | nur aus dem Feature-Score, weil das Layout fehlt |

## Nach Bereich, schwächster zuerst
- menus                          0.0  (2 features)
- pos                            0.0  (2 features)
- production                     0.0  (2 features)
- haccp                          0.0  (1 features)
- integrations                   0.0  (1 features)
- auth                          50.0  (1 features)
- inventory                     50.0  (8 features)
- allergens                     63.6  (5 features)
- analytics                     66.7  (2 features)
- procurement                   67.9  (6 features)
- setup                         75.0  (2 features)
- recipes                       81.6  (7 features)
- library                       88.2  (6 features)

## Fehlt, in Bau-Reihenfolge
- [must] auth: Login mit E-Mail und Passwort, partial  (S01; Supabase Auth gebaut (Registrierung mit Bestätigung, Passwort, Magic Link, Reset, überall abmelden, Konto löschen); ohne eigenes Supabase-Projekt nicht end-to-end getestet)
- [must] inventory: Inventur pro Outlet (Packungen und Teilmengen), partial  (S17 F08; S17; Zählen in kg/l/Stk. mit Dezimalstellen, Zählen in Gebinden fehlt)
- [must] procurement: Lieferanten verwalten, partial  (S10 S11; anlegen/bearbeiten ja, archivieren fehlt)
- [must] recipes: Preisänderung aktualisiert alle Rezepte und Menüs, partial  (F04; Rezepte ja (live berechnet, E2E geprüft); Menüs gibt es noch nicht)
- [must] setup: Benutzer einladen und Outlets zuweisen, partial  (S25; Rollenmodell geraten; Einladung per E-Mail mit Token, gegen Postgres getestet; Rolle nachträglich ändern fehlt)
- [should] allergens: Allergen- und Nährwertlabel drucken, no  (S09)
- [should] inventory: Lagerbericht mit Bewegungen und Zähldifferenzen, no  (S20)
- [should] inventory: Transfer zwischen Outlets, no  (S18 F10)
- [should] library: Excel-Import für Gebinde und Preise, no  (S26)
- [should] menus: Menüs mit Gängen und Zielmarge, no  (S08 F05)
- [should] menus: Stückliste (BoM) für Menü, no  (S09; Quelle 14)
- [should] pos: Generischer POS-Import (CSV/API) und PLU-Mapping, no  (S21 F11; eigene Schnittstelle statt Partner-Integrationen)
- [should] pos: Lagerabzug durch Verkäufe bis auf Rohware, no  (F11)
- [should] recipes: Outlet-spezifische Verkaufspreise, no  (S06)
- [should] allergens: Nährwerte pro 100 g und pro Portion berechnet, partial  (S04 S06; Eingabe pro Zutat ja, Berechnung pro Rezept fehlt)
- [should] inventory: Sichtbarkeit von Zutaten pro Outlet, partial  (Quelle 21; wird beim Bestellen und Zählen beachtet, keine Oberfläche zum Ändern)
- [should] procurement: Gewogene Artikel (Bestellung nach Gewicht), partial  (Quelle 10; Kennzeichen und Gewicht beim Wareneingang; Bestellen nach Gewicht fehlt)
- [should] procurement: Par-Level und Bestellvorschlag, partial  (S13; Quelle 35; Vorschlag ja, Mindest-/Zielbestand nur aus Seed, keine Oberfläche)
- [could] allergens: Nutri-Score Berechnung, no  (öffentlicher Algorithmus)
- [could] analytics: Menu Engineering Matrix (Beliebtheit × Marge), no  (S22)
- [could] haccp: HACCP-Checklisten und Aufgaben, no  (S27; Add-on)
- [could] integrations: Öffentliche REST-API für Kunden, no
- [could] inventory: Mobile Inventur mit Barcode-Scan, no  (S17 mobil)
- [could] inventory: Zählen per Sprache, no  (Quelle 35)
- [could] procurement: Rechnungsabgleich 3-Way-Match, no  (S15 F12)
- [could] production: Chargen-Rückverfolgung, no  (Quelle 34)
- [could] production: Zentralküche: Bestellungen der Outlets und Produktionsplan, no  (S23 F13)

## Bewusst ausgelassen (nicht gewertet)
- Fertige Integrationen mit POS-Partnern (Lightspeed Deliverect HubRise …): Partnernetzwerk und Verträge; nur über offizielle APIs später einzeln
- Lieferanten-Kataloge/EDI-Anbindungen: Partnerdeals des Originals
- Integrierte Allergen-Datenbanken von Drittanbietern: lizenzierte Daten
- Hilfecenter-Inhalte und Vorlagen des Originals: urheberrechtlich geschützt; eigene Doku schreiben
- Kundendaten und Rezeptbibliotheken: gehören dem Original und seinen Kunden

## Verhalten im Vergleich

Original-Angaben aus Hilfecenter-Auszügen (Recon-Quellen in Klammern); Klickzahlen des Originals sind Schätzungen aus der
Recon, die des Klons sind gezählt (E2E-Specs). Bewertung: **behalten** = gleichwertig oder besser, **bauen** = Lücke.

| Ablauf | Original | Klon | Entscheidung |
| --- | --- | --- | --- |
| F01 Zutat mit Preis | ~9 Klicks (geschätzt); Gebinde-Hierarchie, Preis pro Pack oder pro Einheit (7, 9) | 6 Klicks + 3 Eingaben; gleiche Hierarchie und Preisarten | behalten |
| F02 Rezept | Kosten nach dem Speichern sichtbar, Personalkosten über Lohn in den Einstellungen (4, 6) | Kosten **live beim Tippen**, Warnung pro Zeile bei fehlendem Preis oder fehlender Umrechnung; Personalkosten gleich | behalten (Vorteil) |
| F02 Allergene | Status enthält/Spuren/frei/unbekannt, vom Zutat geerbt (12) | gleich; „unbekannt“ schlägt „frei“, ein Gericht mit ungeprüfter Zutat ist nie „frei“ | behalten (sicherer) |
| F02 VK pro Outlet | ja (4) | nein | **bauen** |
| F03 Unterrezept | Netto-Gewicht, sonst Summe der Zutaten (5) | gleich, zusätzlich Einheit „Portion“, Zyklen werden abgelehnt | behalten |
| F04 Preisänderung | wirkt auf Rezepte und Menüs (12) | wirkt sofort auf Rezepte; Menüs fehlen | **bauen** (Menüs) |
| F06 Bestellen | Vorschlag aus Bestand, Verkäufen und Lieferzeit; Par-Level (35) | Vorschlag aus Ziel-/Mindestbestand, Bestand und offenen Bestellungen; 5 Klicks; Mail an Lieferanten genau einmal | Vorschlag behalten; Verkäufe fehlen (POS) |
| F06 Par-Level pflegen | Oberfläche vorhanden (35) | nur aus Seed, keine Oberfläche | **bauen** |
| F07 Wareneingang | Teillieferung, Bestellung bleibt offen; Haken gegen doppeltes Buchen nach Inventur (15) | gleich; Mengen vorbelegt (2 Klicks für „alles da“); Überlieferung wird abgelehnt | behalten |
| F07 Gewogene Artikel | Bestellen und Liefern nach Gewicht (10) | nur beim Wareneingang | **bauen** (Bestellen nach Gewicht) |
| F08 Inventur | „This count“, Teilgebinde per „Part“-Button, nicht Gezähltes bleibt (16) | Zählen in kg/l/Stk., nicht Gezähltes bleibt, **Zwischenstand automatisch, offline-fest** | **bauen**: Zählen in Gebinden |
| F08 andere Buchungen während Inventur | Hilfe rät ab (16) | Hinweis auf der Seite, nicht gesperrt | behalten |
| F09 Schwund | Grund pro Position, Übersicht (18) | gleich | behalten |
| F10 Umbuchung | ja, Wert vom Sender (17, 20) | fehlt (Datenmodell und Trigger fertig) | **bauen** |
| Lagerbericht | Bewegungen, Zähldifferenzen (19) | fehlt | **bauen** |
| F11 Kasse | Partner-Integrationen und generische POS-API (29) | fehlt; Partner bewusst `skip` | **bauen** (eigene API) |
| Team | Rollen, Sichtbarkeit pro Outlet (21) | Einladung per Mail; Rolle ändern, Mitglied entfernen, Inhaberschaft übertragen fehlen | **bauen** |
| E-Mails | Bestellung an Lieferanten (35) | Bestellung, Einladung, täglicher Mindestbestands-Hinweis | behalten |
| Zeit | – | alle Daten in der Zeitzone des Outlets (BUG-002/003 behoben) | behalten |

## Die fünf nächsten Schritte

1. **Menüs mit Gängen, Zielmarge und Stückliste (S07, S08, S09-BoM).** Schließt das Must-have „Preisänderung … Menüs“ und zwei Should-haves. Größter Einzelgewinn: +5,3 Punkte (62,3 → 67,6).
2. **Team fertig machen: Rolle ändern, Mitglied entfernen, Inhaberschaft übertragen (S25).** Schließt ein Must-have und macht „Konto löschen“ für Teams erst möglich.
3. **Inventur in Gebinden und Teilgebinden (S17)** – „3 Kartons + 2 Flaschen“ statt Umrechnen im Kopf. Schließt ein Must-have.
4. **Lieferanten archivieren (S10/S11)** – klein, schließt ein Must-have.
5. **Supabase Auth mit deinem Projekt end-to-end prüfen** (Checkliste A02 im Testplan) – kein Code, aber erst dann ist „Login“ wirklich fertig. Danach stehen alle 21 Must-haves.

Danach in dieser Reihenfolge: Ziel-/Mindestbestand pflegen, Umbuchung (F10), Lagerbericht, eigene POS-API mit Lagerabzug, VK pro Outlet.
Nachgerechnet: Schritte 1–5 bringen den Score auf 73,5; mit Umbuchung, Lagerbericht, Par-Level-Oberfläche und POS-API (Import und Lagerabzug) auf 82,4 – dann wäre der Klon auslieferbar.

## Nächster Skill

`/replica-build` für die fünf Schritte oben. `/replica-entrepreneur` erst danach – oder parallel, wenn du jetzt schon wissen willst,
welche Lücken die Nutzer des Originals am meisten stören; das kann die Reihenfolge oben noch ändern.
