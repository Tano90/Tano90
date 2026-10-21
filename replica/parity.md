# Parität: Pantra gegen das Original

Stand: 2026-10-21 (nach dem 4. Bau- und Testdurchgang) · Grundlage: `replica/features.csv`, `replica/recon.md`,
`replica/bugs.md`, E2E-Lauf 144/144, Unit- und Integrationstests 48/48.

## Urteil: **nicht auslieferbar – nur wegen des Login-Durchklicks, der bei dir liegt**

- Feature-Score **86,8** (Schwelle 80).
- Must-haves **20 von 21**. Das letzte, **Login**, ist gebaut und mit Demo-Konten getestet; es fehlt der Durchklick mit einem echten Supabase-Projekt (Testplan A02).
- Offene S1/S2-Bugs: **keine** (14 gefunden, 14 behoben).

Mit grünem A02 ist der Klon nach den Regeln dieses Skills **auslieferbar** (alle Must-haves, Score 88,2, kein S1/S2).
Live gehen verlangt laut `deploy.md` zusätzlich geprüfte Rechtsseiten, eigene Konten und dein Go.

## Zahlen

| Messung | Wert | Anmerkung |
| --- | --- | --- |
| Feature-Parität | **86,8 / 100** (Verlauf: 62,3 → 72,1 → 80,9 → 86,8) | must ×3, should ×2, could ×1, teilweise = halb; 5 `skip`-Zeilen nicht gewertet |
| Must-haves fertig | **20 / 21** | Login teilweise (nur dein Durchklick fehlt) |
| Layout-Parität | **nicht gemessen** | Weiterhin keine Screenshots des Originals in `replica/screens/`. Klon-Screenshots aller 22 gebauten Screens in `replica/clone-screens/` (1440 und 390 px). Mit Original-Screenshots: `python3 imgdiff.py replica/screens/S09.png replica/clone-screens/S09.png --out replica/diffs/S09.png` |
| Gesamt | **86,8** | nur aus dem Feature-Score, weil das Layout fehlt |

Alle Must- und Should-Bereiche bis auf Login, Excel-Import und Bestellen nach Gewicht sind voll. Was noch fehlt, sind überwiegend
Could-haves (Produktion, HACCP, Menu Engineering, öffentliche API, Barcode, Sprache, Rechnungsabgleich, Nutri-Score).

## Nach Bereich, schwächster zuerst

- production                     0.0  (2 features)
- haccp                          0.0  (1 features)
- integrations                   0.0  (1 features)
- auth                          50.0  (1 features)
- analytics                     66.7  (2 features)
- procurement                   85.7  (6 features)
- library                       88.2  (6 features)
- inventory                     88.2  (8 features)
- allergens                     90.9  (5 features)
- setup                        100.0  (2 features)
- recipes                      100.0  (7 features)
- menus                        100.0  (2 features)
- pos                          100.0  (2 features)

## Fehlt, in Bau-Reihenfolge

- [must] auth: Login mit E-Mail und Passwort, partial  (S01; Supabase Auth gebaut (Registrierung mit Bestätigung, Passwort, Magic Link, Reset, überall abmelden, Konto löschen); ohne eigenes Supabase-Projekt nicht end-to-end getestet)
- [should] library: Excel-Import für Gebinde und Preise, no  (S26)
- [should] procurement: Gewogene Artikel (Bestellung nach Gewicht), partial  (Quelle 10; Kennzeichen und Gewicht beim Wareneingang; Bestellen nach Gewicht fehlt)
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
| F02 VK pro Outlet | ja (4) | eigener Preis pro Outlet mit Wareneinsatz je Outlet; Rezeptliste zeigt den Preis des gewählten Outlets | behalten |
| F02 Preise eingeben | – | ein unlesbarer Betrag wird abgelehnt, nie stillschweigend als „kein Preis“ gespeichert (BUG-014) | behalten |
| S09 Etikett | Allergen- und Nährwertlabel drucken, Export (13, 14) | Druckansicht mit Zutatenliste nach Gewicht, Allergenen und Nährwerten je 100 g und Portion über alle Unterrezepte; ungeprüfte Allergene nie „frei“, fehlende Nährwerte benannt; **keine Etikett-Vorlagen/Formate** | behalten, Vorlagen später |
| Sichtbarkeit pro Outlet | ja (21) | pro Zutat und Outlet; Ausblenden nur ohne Bestand | behalten |
| F03 Unterrezept | Netto-Gewicht, sonst Summe der Zutaten (5) | gleich, zusätzlich Einheit „Portion“, Zyklen werden abgelehnt | behalten |
| F04 Preisänderung | wirkt auf Rezepte und Menüs (12) | wirkt sofort auf Rezepte und Menüs (beim nächsten Öffnen neu gerechnet, nichts zwischengespeichert) | behalten |
| F05 Menü | Gänge, Zielmarge, Stückliste (13, 14) | gleich; Kalkulation **live beim Tippen**, Stückliste rekursiv über Unterrezepte und auf Gäste hochrechenbar; Menü mit 2 Gerichten anlegen: 2 Eingaben (Name, Preis), 2 Rezept-Auswahlen, 3 Klicks (gezählt nach E2E F05-H1, ohne dessen Extra-Schritte); Klickzahl des Originals unbekannt | behalten (Vorteil) |
| F06 Bestellen | Vorschlag aus Bestand, Verkäufen und Lieferzeit; Par-Level (35) | Vorschlag aus Ziel-/Mindestbestand, Bestand und offenen Bestellungen; 5 Klicks; Mail an Lieferanten genau einmal | Vorschlag behalten; Verkäufe fehlen (POS) |
| F06 Par-Level pflegen | Oberfläche vorhanden (35) | Mindest- und Zielbestand pro Outlet direkt in der Lagertabelle, in kg/l/Stk. | behalten |
| F07 Wareneingang | Teillieferung, Bestellung bleibt offen; Haken gegen doppeltes Buchen nach Inventur (15) | gleich; Mengen vorbelegt (2 Klicks für „alles da“); Überlieferung wird abgelehnt | behalten |
| F07 Gewogene Artikel | Bestellen und Liefern nach Gewicht (10) | nur beim Wareneingang | **bauen** (Bestellen nach Gewicht) |
| F08 Inventur | „This count“, Teilgebinde per „Part“-Button, nicht Gezähltes bleibt (16) | Zählen in kg/l/Stk. **oder in Gebinden plus losem Rest**, nicht Gezähltes bleibt, **Zwischenstand automatisch, offline-fest** | behalten |
| F08 andere Buchungen während Inventur | Hilfe rät ab (16) | Hinweis auf der Seite, nicht gesperrt | behalten |
| F09 Schwund | Grund pro Position, Übersicht (18) | gleich | behalten |
| F10 Umbuchung | ja, Wert vom Sender (17, 20) | gleich; Empfänger sieht eingehende Umbuchungen, Hinweis bei mehr als im Bestand | behalten |
| Lagerbericht | Bewegungen, Zähldifferenzen, Export (19) | je Zutat Anfang/Eingang/Umbuchung/Verkauf/Schwund/Inventur/Ende/Wert, Summen, CSV für deutsches Excel; Tagesgrenzen in der Zeitzone des Outlets | behalten |
| F11 Kasse | Partner-Integrationen und generische POS-API (29) | eigene API mit Outlet-Schlüssel und CSV-Import (wiederholbar); Abbuchung über alle Unterrezepte, wartende Verkäufe werden beim Verknüpfen nachgebucht; **Stornos fehlen**; Partner bewusst `skip` | behalten, Stornos **bauen** |
| Team | Rollen, Sichtbarkeit pro Outlet (21) | Einladung per Mail; Rolle und Outlets ändern, entfernen, Inhaberschaft übertragen; mindestens ein Inhaber erzwungen, auch in der Datenbank | behalten |
| Lieferanten | archivieren (11) | archivieren, abgelehnt solange Bestellungen offen sind; Preise werden mit archiviert | behalten |
| E-Mails | Bestellung an Lieferanten (35) | Bestellung, Einladung, täglicher Mindestbestands-Hinweis | behalten |
| Zeit | – | alle Daten in der Zeitzone des Outlets (BUG-002/003 behoben) | behalten |

## Die fünf nächsten Schritte

Nachgerechnet mit `parity.py` (Zuwachs einzeln, kumuliert in Klammern):

1. **Login mit deinem Supabase-Projekt durchklicken** (Testplan A02). Kein Code, macht den Klon auslieferbar. +1,5 (→ 88,2)
2. **Excel-Import für Gebinde und Preise (S26):** Lieferanten-Preislisten einlesen statt abtippen; Upload-Baustein und Fehlerliste je Zeile gibt es schon (Kasse). +2,0 (→ 90,2)
3. **Bestellen nach Gewicht** für gewogene Artikel (Fleisch, Käse): Kennzeichen und Wareneingang nach Gewicht gibt es schon. +1,0 (→ 91,2)
4. **Menu Engineering (S22):** Beliebtheit × Marge pro Gericht; die Verkäufe aus der Kasse und die Kosten pro Portion liegen bereits vor. +1,0 (→ 92,2)
5. **Stornos an der Kasse** (nicht gewertet): negative Mengen buchen zurück ins Lager. Viele Kassen exportieren Stornos als eigene Zeilen; ohne das bricht dort der Import mit Fehlerzeilen ab.

Ab hier bringt weiteres Nachbauen wenig: Die Lücken sind Could-haves. Der größere Hebel ist jetzt, **besser** zu werden als das Original,
nicht gleich.

**„Besser als das Original“** bleibt unbelegt: `/replica-entrepreneur` fand in dieser Umgebung keine öffentlichen Nutzerbewertungen.
Was Pantra heute anders macht (Live-Kalkulation für Rezepte und Menüs, offline-feste Inventur in Gebinden, „unbekannt“ schlägt „frei“ bei
Allergenen auch auf dem Etikett, wiederholbare Kassen-Importe, Preis-Tippfehler werden abgefangen), ist eigene Einschätzung.

## Nächster Skill

Schritt 1 machst du. Danach empfehle ich `/replica-entrepreneur` mit Bewertungen, die du beschaffst (G2, Capterra, App-Stores, eigene
Kundengespräche): Die Parität ist da, jetzt entscheidet, was Nutzer am Original stört. Alternativ `/replica-build` für die Schritte 2–5.
