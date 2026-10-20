# Parität: Pantra gegen das Original

Stand: 2026-10-20 (nach dem 2. Bau- und Testdurchgang) · Grundlage: `replica/features.csv`, `replica/recon.md`,
`replica/bugs.md`, E2E-Lauf 101/101, Unit- und Integrationstests 37/37.

## Urteil: **nicht auslieferbar**

- 20 von 21 Must-haves fertig. Das letzte, **Login**, ist gebaut, aber ohne dein Supabase-Projekt nicht durchgeklickt (Testplan A02).
- Offene S1/S2-Bugs: keine (7 gefunden, 7 behoben).
- Feature-Score **72,1** – die Schwelle für „auslieferbar“ ist 80 und alle Must-haves.

## Zahlen

| Messung | Wert | Anmerkung |
| --- | --- | --- |
| Feature-Parität | **72,1 / 100** (vorher 62,3) | must ×3, should ×2, could ×1, teilweise = halb; 5 `skip`-Zeilen nicht gewertet |
| Must-haves fertig | **20 / 21** (vorher 16) | Login teilweise |
| Layout-Parität | **nicht gemessen** | Weiterhin keine Screenshots des Originals in `replica/screens/` (Seiten des Originals in dieser Umgebung gesperrt, kein eigener Account). Klon-Screenshots aller gebauten Screens liegen in `replica/clone-screens/` (1440 und 390 px). Mit Original-Screenshots: `python3 imgdiff.py replica/screens/S08.png replica/clone-screens/S08.png --out replica/diffs/S08.png` |
| Gesamt | **72,1** | nur aus dem Feature-Score, weil das Layout fehlt |

## Nach Bereich, schwächster zuerst

- pos                            0.0  (2 features)
- production                     0.0  (2 features)
- haccp                          0.0  (1 features)
- integrations                   0.0  (1 features)
- auth                          50.0  (1 features)
- inventory                     58.8  (8 features)
- allergens                     63.6  (5 features)
- analytics                     66.7  (2 features)
- procurement                   78.6  (6 features)
- library                       88.2  (6 features)
- recipes                       89.5  (7 features)
- setup                        100.0  (2 features)
- menus                        100.0  (2 features)

## Fehlt, in Bau-Reihenfolge

- [must] auth: Login mit E-Mail und Passwort, partial  (S01; Supabase Auth gebaut (Registrierung mit Bestätigung, Passwort, Magic Link, Reset, überall abmelden, Konto löschen); ohne eigenes Supabase-Projekt nicht end-to-end getestet)
- [should] allergens: Allergen- und Nährwertlabel drucken, no  (S09)
- [should] inventory: Lagerbericht mit Bewegungen und Zähldifferenzen, no  (S20)
- [should] inventory: Transfer zwischen Outlets, no  (S18 F10)
- [should] library: Excel-Import für Gebinde und Preise, no  (S26)
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
| F04 Preisänderung | wirkt auf Rezepte und Menüs (12) | wirkt sofort auf Rezepte und Menüs (beim nächsten Öffnen neu gerechnet, nichts zwischengespeichert) | behalten |
| F05 Menü | Gänge, Zielmarge, Stückliste (13, 14) | gleich; Kalkulation **live beim Tippen**, Stückliste rekursiv über Unterrezepte und auf Gäste hochrechenbar; Menü anlegen mit 2 Gerichten: 8 Klicks + 3 Eingaben (gezählt, E2E F05-H1) | behalten (Vorteil) |
| F06 Bestellen | Vorschlag aus Bestand, Verkäufen und Lieferzeit; Par-Level (35) | Vorschlag aus Ziel-/Mindestbestand, Bestand und offenen Bestellungen; 5 Klicks; Mail an Lieferanten genau einmal | Vorschlag behalten; Verkäufe fehlen (POS) |
| F06 Par-Level pflegen | Oberfläche vorhanden (35) | nur aus Seed, keine Oberfläche | **bauen** |
| F07 Wareneingang | Teillieferung, Bestellung bleibt offen; Haken gegen doppeltes Buchen nach Inventur (15) | gleich; Mengen vorbelegt (2 Klicks für „alles da“); Überlieferung wird abgelehnt | behalten |
| F07 Gewogene Artikel | Bestellen und Liefern nach Gewicht (10) | nur beim Wareneingang | **bauen** (Bestellen nach Gewicht) |
| F08 Inventur | „This count“, Teilgebinde per „Part“-Button, nicht Gezähltes bleibt (16) | Zählen in kg/l/Stk. **oder in Gebinden plus losem Rest**, nicht Gezähltes bleibt, **Zwischenstand automatisch, offline-fest** | behalten |
| F08 andere Buchungen während Inventur | Hilfe rät ab (16) | Hinweis auf der Seite, nicht gesperrt | behalten |
| F09 Schwund | Grund pro Position, Übersicht (18) | gleich | behalten |
| F10 Umbuchung | ja, Wert vom Sender (17, 20) | fehlt (Datenmodell und Trigger fertig) | **bauen** |
| Lagerbericht | Bewegungen, Zähldifferenzen (19) | fehlt | **bauen** |
| F11 Kasse | Partner-Integrationen und generische POS-API (29) | fehlt; Partner bewusst `skip` | **bauen** (eigene API) |
| Team | Rollen, Sichtbarkeit pro Outlet (21) | Einladung per Mail; Rolle und Outlets ändern, entfernen, Inhaberschaft übertragen; mindestens ein Inhaber erzwungen, auch in der Datenbank | behalten |
| Lieferanten | archivieren (11) | archivieren, abgelehnt solange Bestellungen offen sind; Preise werden mit archiviert | behalten |
| E-Mails | Bestellung an Lieferanten (35) | Bestellung, Einladung, täglicher Mindestbestands-Hinweis | behalten |
| Zeit | – | alle Daten in der Zeitzone des Outlets (BUG-002/003 behoben) | behalten |

## Die fünf nächsten Schritte

Nachgerechnet mit `parity.py` (jeder Schritt einzeln, kumuliert in Klammern):

1. **Login mit deinem Supabase-Projekt durchklicken** (Testplan A02). Kein Code, schließt das letzte Must-have. +1,5 (→ 73,5)
2. **Lagerbericht (S20):** Bewegungen und Zähldifferenzen pro Zeitraum. Die Daten liegen schon in `stock_movements`, es fehlt nur die Ansicht. +2,0 (→ 75,5)
3. **Umbuchung zwischen Outlets (S18, F10):** Datenmodell und Trigger sind fertig, gebraucht wird für Zentralküche und Filialen. +2,0 (→ 77,5)
4. **Ziel- und Mindestbestand pflegen (S13/S16):** Der Bestellvorschlag rechnet schon damit, es fehlt die Oberfläche. Klein. +1,0 (→ 78,4)
5. **Eigene POS-Schnittstelle (S21, F11):** CSV-Import und API für Verkäufe mit PLU-Zuordnung. +2,0 (→ 80,4), das ist die Schwelle. Mit Lagerabzug durch Verkäufe bis auf die Rohware kommen nochmal +2,0 (→ 82,4).

Nach Schritt 5 ist der Klon **auslieferbar**, wenn bis dahin kein S1/S2 offen ist. Danach kommen VK pro Outlet (+2,0) und Sichtbarkeit pro Outlet (+1,0).

**„Besser als das Original“** ist noch nicht erreichbar: `/replica-entrepreneur` fand in dieser Umgebung keine öffentlichen Nutzerbewertungen
(`fixes.md`: 0 Bewertungen). Was der Klon heute besser macht (Live-Kalkulation, offline-feste Inventur, „unbekannt“ schlägt „frei“
bei Allergenen, Zeitzonen pro Outlet), ist eigene Einschätzung und nicht durch Nutzerstimmen belegt.

## Nächster Skill

`/replica-build` für die Schritte 2–5. Schritt 1 machst du, sobald dein Supabase-Projekt steht.
