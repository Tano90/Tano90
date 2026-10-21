# Parität: Pantra gegen das Original

Stand: 2026-10-21 (nach dem 6. Bau- und Testdurchgang) · Grundlage: `replica/features.csv`, `replica/recon.md`,
`replica/bugs.md`, E2E-Lauf 188/188, Unit- und Integrationstests 61/61.

## Urteil: **nicht auslieferbar – nur wegen des Login-Durchklicks, der bei dir liegt**

- Feature-Score **94,1** (Schwelle 80).
- Must-haves **20 von 21**: Login ist gebaut und mit Demo-Konten getestet; es fehlt der Durchklick mit einem echten Supabase-Projekt (Testplan A02).
- **Alle Should-haves fertig, alle 27 Screens gebaut.** Offen sind nur noch Could-haves.
- Offene S1/S2-Bugs: **keine** (21 gefunden, 21 behoben).

Mit grünem A02 ist der Klon nach den Regeln dieses Skills **auslieferbar** (alle Must-haves, Score 95,6, kein S1/S2).
Live gehen verlangt laut `deploy.md` zusätzlich geprüfte Rechtsseiten, eigene Konten und dein Go.

## Zahlen

| Messung | Wert | Anmerkung |
| --- | --- | --- |
| Feature-Parität | **94,1 / 100** (Verlauf: 62,3 → 72,1 → 80,9 → 86,8 → 90,7 → 94,1) | must ×3, should ×2, could ×1, teilweise = halb; 5 `skip`-Zeilen nicht gewertet |
| Must-haves fertig | **20 / 21** | Login teilweise (nur dein Durchklick fehlt) |
| Should-haves fertig | **alle** | |
| Layout-Parität | **nicht gemessen** | Weiterhin keine Screenshots des Originals in `replica/screens/`. Klon-Screenshots aller 27 Screens in `replica/clone-screens/` (1440 und 390 px). Mit Original-Screenshots: `python3 imgdiff.py replica/screens/S22.png replica/clone-screens/S22.png --out replica/diffs/S22.png` |
| Gesamt | **94,1** | nur aus dem Feature-Score, weil das Layout fehlt |

## Nach Bereich, schwächster zuerst

- integrations                   0.0  (1 features)
- production                    25.0  (2 features)
- auth                          50.0  (1 features)
- allergens                     90.9  (5 features)
- inventory                     94.1  (8 features)
- setup, library, recipes, procurement, menus, pos, analytics, haccp: je 100.0

## Fehlt, in Bau-Reihenfolge

- [must] auth: Login mit E-Mail und Passwort, partial  (S01; gebaut, ohne eigenes Supabase-Projekt nicht end-to-end getestet)
- [could] allergens: Nutri-Score Berechnung, no  (öffentlicher Algorithmus)
- [could] integrations: Öffentliche REST-API für Kunden, no
- [could] inventory: Zählen per Sprache, no  (Quelle 35)
- [could] production: Chargen-Rückverfolgung, no  (Quelle 34)
- [could] production: Zentralküche, partial  (S23; Fertigware ist kein Lagerartikel im empfangenden Outlet)

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
| S22 Menu Engineering | Matrix pro Kategorie (Recon S22) | Matrix aus Kassenverkäufen verknüpfter Gerichte, Tabelle, Empfehlung je Gruppe, Hinweis auf nicht verknüpfte Verkäufe; **ohne Filter nach Kategorie** | behalten |
| S26 Import | Excel-Import mit Vorlage und Fehlerliste (Recon S26) | Excel oder CSV, Vorlage, **Vorschau je Zeile vor dem Übernehmen** (neu/geändert alt → neu/unverändert/Fehler), Preis-Historie | behalten (Vorteil) |
| Zahlenfelder | – | „2.5“ und „2,5“ ergeben dasselbe; unlesbare Beträge werden abgelehnt (BUG-014/015) | behalten |
| Sichtbarkeit pro Outlet | ja (21) | pro Zutat und Outlet; Ausblenden nur ohne Bestand | behalten |
| F03 Unterrezept | Netto-Gewicht, sonst Summe der Zutaten (5) | gleich, zusätzlich Einheit „Portion“, Zyklen werden abgelehnt | behalten |
| F04 Preisänderung | wirkt auf Rezepte und Menüs (12) | wirkt sofort auf Rezepte und Menüs (beim nächsten Öffnen neu gerechnet, nichts zwischengespeichert) | behalten |
| F05 Menü | Gänge, Zielmarge, Stückliste (13, 14) | gleich; Kalkulation **live beim Tippen**, Stückliste rekursiv über Unterrezepte und auf Gäste hochrechenbar; Menü mit 2 Gerichten anlegen: 2 Eingaben (Name, Preis), 2 Rezept-Auswahlen, 3 Klicks (gezählt nach E2E F05-H1, ohne dessen Extra-Schritte); Klickzahl des Originals unbekannt | behalten (Vorteil) |
| F06 Bestellen | Vorschlag aus Bestand, Verkäufen und Lieferzeit; Par-Level (35) | Vorschlag aus Ziel-/Mindestbestand, Bestand und offenen Bestellungen; 5 Klicks; Mail an Lieferanten genau einmal | Vorschlag behalten; Verkäufe fehlen (POS) |
| F06 Par-Level pflegen | Oberfläche vorhanden (35) | Mindest- und Zielbestand pro Outlet direkt in der Lagertabelle, in kg/l/Stk. | behalten |
| F07 Wareneingang | Teillieferung, Bestellung bleibt offen; Haken gegen doppeltes Buchen nach Inventur (15) | gleich; Mengen vorbelegt (2 Klicks für „alles da“); Überlieferung wird abgelehnt | behalten |
| F07 Gewogene Artikel | Bestellen und Liefern nach Gewicht (10) | Bestellen in kg/l, Vorschlag nach Gewicht (auf 100 g), Gewicht in Mail und Wareneingang | behalten |
| F08 Inventur | „This count“, Teilgebinde per „Part“-Button, nicht Gezähltes bleibt (16) | Zählen in kg/l/Stk. **oder in Gebinden plus losem Rest**, nicht Gezähltes bleibt, **Zwischenstand automatisch, offline-fest** | behalten |
| F08 andere Buchungen während Inventur | Hilfe rät ab (16) | Hinweis auf der Seite, nicht gesperrt | behalten |
| F09 Schwund | Grund pro Position, Übersicht (18) | gleich | behalten |
| F10 Umbuchung | ja, Wert vom Sender (17, 20) | gleich; Empfänger sieht eingehende Umbuchungen, Hinweis bei mehr als im Bestand | behalten |
| Lagerbericht | Bewegungen, Zähldifferenzen, Export (19) | je Zutat Anfang/Eingang/Umbuchung/Verkauf/Schwund/Inventur/Ende/Wert, Summen, CSV für deutsches Excel; Tagesgrenzen in der Zeitzone des Outlets | behalten |
| F11 Kasse | Partner-Integrationen und generische POS-API (29) | eigene API mit Outlet-Schlüssel und CSV-Import (wiederholbar); Abbuchung über alle Unterrezepte, wartende Verkäufe werden beim Verknüpfen nachgebucht; Stornos buchen zum Durchschnittspreis zurück; Partner bewusst `skip` | behalten |
| Team | Rollen, Sichtbarkeit pro Outlet (21) | Einladung per Mail; Rolle und Outlets ändern, entfernen, Inhaberschaft übertragen; mindestens ein Inhaber erzwungen, auch in der Datenbank | behalten |
| Lieferanten | archivieren (11) | archivieren, abgelehnt solange Bestellungen offen sind; Preise werden mit archiviert | behalten |
| F08 Barcode | Barcode-Zählung in der Inventur-App (35) | Handscanner oder Eintippen, Kamera wo der Browser Barcodes erkennt; jeder Scan +1 Gebinde, GTIN-Formen mit führenden Nullen gelten als derselbe Code, eine GTIN zeigt auf genau ein Gebinde (BUG-016/017) | behalten |
| F12 Rechnung | 3-Way-Match Bestellung/Lieferung/Rechnung (35) | Rechnung vorbelegt mit der Lieferung, Abweichung je Zeile (Menge, Preis, €), Freigabe bei Abweichung nur mit Begründung, doppelte Rechnungsnummer je Lieferant abgelehnt; **kein Einlesen von PDF/Scan** (Original laut Recon unbekannt) | behalten, Einlesen später |
| F13 Zentralküche | Outlets bestellen bei der CPU, Produktionsplan, Fertigware geht ins Lager (Recon F13, 34) | Anfordern, Plan nach Liefertag mit Rohwarenbedarf und Fehlmengen, Produzieren bucht Rohware aus und verteilt die Kosten, Geliefert; **Fertigware wird nicht als Lagerartikel des Empfängers gebucht** | Fertigware bauen |
| F14 HACCP | Add-on: Aufgaben, Kontrollpunkte, Audit (Recon S27; nur Marketing-Angaben) | Checklisten mit Grenzwerten, Tageskontrolle pro Outlet, Abweichung nur mit Maßnahme, Protokoll 30 Tage mit CSV; im Grundpreis statt Add-on; **keine Erinnerungen** | behalten |
| E-Mails | Bestellung an Lieferanten (35) | Bestellung, Einladung, täglicher Mindestbestands-Hinweis | behalten |
| Zeit | – | alle Daten in der Zeitzone des Outlets (BUG-002/003 behoben) | behalten |

## Die fünf nächsten Schritte

1. **Login mit deinem Supabase-Projekt durchklicken** (Testplan A02). Kein Code, macht den Klon auslieferbar. → 95,6

Ab hier ist jeder Schritt ein Could-have (je +1,0, Schritt 2 +0,5). Nachbauen lohnt sich kaum noch; die Reihenfolge, falls doch:

2. **Fertigware als Lagerartikel** (S23 fertig machen): produzierte Portionen landen im Bestand des empfangenden Outlets und gehen dort in Inventur und Lagerwert ein. → 96,1
3. **Chargen-Rückverfolgung**: passt zu HACCP und Zentralküche (welche Lieferung steckt in welcher Produktion). → 97,1
4. **Nutri-Score**: öffentlicher Algorithmus, Nährwerte pro Rezept gibt es schon. → 98,1
5. **Öffentliche REST-API**: die Kassen-API mit Schlüsseln ist die Vorlage. → 99,1

Zählen per Sprache bleibt zuletzt: Spracherkennung im Browser ist uneinheitlich, der Nutzen gegenüber Barcode-Scan klein.

## Empfehlung

Die Parität ist erreicht: alle Must- und Should-haves bis auf deinen Login-Durchklick, dazu vier von sieben Could-haves. Ein reiner Nachbau hat aber keinen Grund zu existieren.
Der nächste sinnvolle Schritt ist **nicht** mehr Nachbau, sondern herauszufinden, was Küchen am Original stört, und das besser zu machen.

**„Besser als das Original“** bleibt bisher unbelegt: `/replica-entrepreneur` fand in dieser Umgebung keine öffentlichen Nutzerbewertungen.
Was Pantra heute anders macht (Live-Kalkulation, offline-feste Inventur in Gebinden, „unbekannt“ schlägt „frei“ auch auf dem Etikett,
Vorschau vor jedem Preis-Import, wiederholbare Kassen-Importe mit Stornos, abgefangene Eingabefehler, HACCP im Grundpreis), ist eigene Einschätzung.

## Nächster Skill

1. Du: A02 mit deinem Supabase-Projekt.
2. `/replica-entrepreneur` mit Bewertungen oder Gesprächsnotizen, die du beschaffst (G2, Capterra, App-Stores, eigene Küchen) – daraus der Plan, was Pantra besser machen soll.
3. Erst dann wieder `/replica-build`, für diese Verbesserungen statt für Could-haves.
