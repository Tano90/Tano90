# GLB AI Suite – Änderungen Oktober 2026 (v1.2)

Ausgangsstand: Commit `cda9e1b` (lokales Tag `baseline-v12-start`). Branch `claude/replica-skill-install-vzriug`.
Keine Funktion entfernt; bestehende Module wurden ergänzt, keine Ersatzmodule angelegt.

## 1. Produktlebenszyklus als interaktiver Graph (Modul „Lebenszyklen“)

- **Graph:** Neues Panel „Absatzverlauf“ oben auf der bestehenden Seite.
  - X-Achse sind die Monate, Y-Achse die verkaufte Menge. Die Einheit steht ausdrücklich da (Einheit des Artikels, z. B. „Portion“).
  - Jeder Punkt ist ein erfasster Monat. Es gibt keine geglättete oder idealisierte Kurve.
- **Filter:**
  - Produktsuche: Beim Tippen wird zum ersten Treffer gewechselt.
  - Auswahlfelder für Produkt, Outlet und Zeitraum (von/bis).
  - „Filter zurücksetzen“.
  - Outlet und Zeitraum gelten für die ganze Seite. Mit „alle“ ist alles wie vorher.
- **Tooltip** bei Maus, Antippen oder Tastatur (Pfeiltasten). Er zeigt:
  - Monat und Absatz
  - Veränderung zum Vormonat
  - Netto-Umsatz und Ø Bruttopreis
  - DB I mit dem Kostenstand des Monats; ohne Wareneinsatz steht dort „nicht ermittelbar“
  - Anzahl der Verkaufszeilen und Outlets
- **Lücken und echte Nullen:**
  - Ein Monat ohne Daten ist eine Lücke: graue Fläche mit „keine Daten“, die Linie ist unterbrochen.
  - Eine echte Null (der Betrieb hat verkauft, dieser Artikel nicht) ist ein hohler Punkt.
- **Einordnung:**
  - Das Vergleichsfenster der bestehenden Einordnung und die beiden Durchschnitte (Ø Monat 1–2 / Ø Monat 3–4) sind eingezeichnet.
  - Eine Erklärung nennt die echten Zahlen und die Regel (±20 %).
  - Bei zu wenigen Monaten oder einer Lücke wird begründet, warum es keine Einordnung gibt.
- **Bestehendes:** Monatsliste, Phasen & Handlung, die Sortimentstabelle und die Berechnung `lifecycle()` sind unverändert.
  - Die alte, einfache Linien-Ergänzung unter der Seite ist durch den neuen Graphen ersetzt; er zeigt dieselben Werte.
- **Mobil:** Der Graph wird in der echten Breite gezeichnet, die Beschriftungen sind ausgedünnt. Der Tooltip steht unter dem Graphen, statt die Kurve zu verdecken.

Dateien: `public/suite/src/core.js` (`lifecycleSeries`), `public/suite/src/app.js`, `public/suite/src/calm.css`.

## 2. KI-Marktcheck in zwei Ansichten

### Tab A · Speisen- und Getränkevergleich

- **Filter:** Speisen / Getränke / Nicht zugeordnet, darunter die Warengruppen des Produktstamms.
- **Zuordnung zu Speisen/Getränken:**
  - Sie kommt aus der eigenen Oberkategorie (Küche → Speisen, Getränke → Getränke) oder aus einer manuellen Wahl.
  - Nichts wird über den Namen geraten. Offene Warengruppen stehen unter „Zur manuellen Prüfung“.
- **Formular:**
  - Der eigene Artikel kommt aus dem Produktstamm.
  - Weitere Felder: Menge eigen/fremd, Leistungsumfang (vergleichbar / unterschiedlich / unklar), Preise, https-Quelle, Prüfdatum.
- **Abweichung** absolut und in %, nur bei vergleichbarem Paar:
  - gleiche Menge und bestätigte Leistung, oder
  - umgerechnet je 100 g bzw. 100 ml.
  - Sonst werden beide Preise gezeigt, mit „Nicht vergleichbar“ oder „Zu prüfen“ und dem Grund.
- **Bestehende Daten:**
  - Ältere Beobachtungen ohne Mengen bleiben unverändert und landen in der Prüfliste. „Prüfen“ ergänzt Artikel, Mengen und Leistung; Preise und Quelle bleiben.
  - Preisbeobachtungen aus „Mein Markt“ erscheinen mit („aus Mein Markt“), bearbeitet werden sie weiter dort.
- **KI-Einordnung:** Sie bekommt nur die aktuelle Auswahl mit https-Quelle, inklusive Menge und Vergleichbarkeit.
  - Der Server-Prompt verlangt, nicht vergleichbare Paare nicht für Abweichungen zu nutzen und Unsicherheit und Datenlage zu nennen.
  - Ohne Schlüssel gibt es eine Fehlermeldung und kein Ergebnis.
- **Kein automatischer Speisekartenabruf.** Das steht offen auf der Seite. Es werden keine Preise erfunden.

### Tab B · Restaurants und Locations in der Nähe

- **Standort:** Standort des Betriebs (aus Mein Markt), Adresssuche (OpenStreetMap Nominatim), Gerätestandort oder Koordinaten von Hand.
  - „Als Standort des Betriebs speichern“ übernimmt einen anderen Standort.
- **Suche:** Radius 500 m bis 5 km. Kategorien: Restaurant, Café, Bar, Kneipe, Biergarten, Imbiss, Veranstaltungsort.
- **Liste:** Name, Kategorie, Adresse, Entfernung als **Luftlinie** (so wird sie auch berechnet), Website und OSM-Link. Fehlende Angaben sind gekennzeichnet.
- **Sortierung** nach Entfernung, Kategorie oder Name; Kategorien lassen sich nachträglich ausblenden.
- **Lage:** Schematische Lageansicht mit Ringen und Nummern. Sie ist ausdrücklich keine Straßenkarte, denn es wurde kein zusätzlicher Kartendienst eingebunden.
- **„In Preisvergleich übernehmen“** übernimmt Name und OSM-Link nach Tab A. Der Preis bleibt leer.
- **Zustände:** Laden, keine Treffer und Fehler werden verständlich angezeigt (z. B. „OpenStreetMap ist gerade überlastet“). Tab A funktioniert unabhängig davon.
- **Server** `/api/suite/market/discover`:
  - nimmt Kategorien aus einer festen Liste an
  - gibt Position, Kategorie, Website (nur http/https) und Entfernung in Metern zurück
  - sortiert die nächsten zuerst, liefert höchstens 60 Einträge
  - nach wie vor ohne Kosten (OpenStreetMap)

Dateien: `public/suite/src/v11/market.mjs` (neu), `v11/ui.mjs`, `v11.css`, `src/lib/suite-api.mjs`.

## 3. Team & Aufgaben nach Outlet

- **Neue Aufgabe:** Pflichtauswahl des Outlets, zusätzlich „Betriebsübergreifend / Allgemein“. Das Outlet wird als `outlet_id` gespeichert.
- **Übersicht:** Je Outlet stehen offene und überfällige Aufgaben. Ein Klick auf ein Outlet filtert die Liste.
- **Filter und Sortierung:**
  - Filter nach Outlet (Alle / Allgemein / einzelnes Outlet), Status (offen, überfällig, erledigt) und Priorität.
  - Sortierung nach Fälligkeit, Priorität, Status oder Outlet.
  - „Nach Outlet gruppieren“.
- An jeder Aufgabe steht das Outlet. „Outlet ändern“ prüft auf parallele Änderungen (Versionsnummer).
- **Bestehende Aufgaben** ohne Zuordnung bleiben unverändert und stehen unter „Allgemein“. Nichts wird geraten.
  - Ein später gelöschtes Outlet bleibt als „Outlet nicht mehr vorhanden“ sichtbar.
- **Schulungsaufgaben aus dem Tagesfunnel** übernehmen das dort gewählte Outlet. Bei „Alle Outlets“ wird die Aufgabe „Allgemein“; der Hinweis sagt das.
- **Mandantentrennung:** Migration `web/suite-sql/007_glb_task_outlets.sql`.
  - Ein Trigger auf `glb_snapshots` prüft bei jedem Speichern (`glb_save_snapshot`, `glb_save_limited`, jeder andere Weg), ob die `outlet_id` zu den Outlets desselben Betriebs gehört. Sonst: `TASK_OUTLET_INVALID`, nichts wird gespeichert.
  - Die App zeigt dazu eine deutsche Meldung.

Dateien: `public/suite/src/v11/tasks.mjs` (neu), `v11/ui.mjs`, `v11/demo.mjs`, `cloud.js`, `v11.css`, `suite-sql/007_glb_task_outlets.sql`.

## 4. Startseite in Beige

- **Farben:**
  - Beige/Creme-Flächen, dunkle warme Schrift, Grün als Akzent.
  - Die Farben gelten nur innerhalb von `.landing-beige`. App, Suite-Dashboard und Rechtsseiten behalten ihr Design.
- **Schrift:** Überschriften in Fraunces (freie Schrift, lokal eingebunden, kein externer Dienst).
- **Weggefallen:** Farbverläufe, Leuchteffekte und das Laufband. Die Modulnamen stehen jetzt als ruhige Zeile da. Die Modulübersicht ist eine Liste statt eines Kartenrasters.
- **Neu:** Abschnitt „Vier Fragen, die jede Woche kommen“ mit echten Ansichten (Cockpit, Lebenszyklus-Graph, Marktcheck, Aufgaben je Outlet).
- **Erhalten:** alle Inhalte, Links, Preise, das Anfrageformular, FAQ und Rechtslinks. Es gibt keine erfundenen Kunden, Bewertungen oder Zahlen.
- **Kontrast (WCAG):**

  | Farbe | Kontrast | Erfüllt |
  | --- | --- | --- |
  | Text | 15,1:1 | AA |
  | Nebentext | 7,5:1 | AA |
  | Grün | 5,8:1 | AA |
  | Eingaberahmen | 3,9:1 | AA (≥ 3:1) |

## Tests (tatsächliche Läufe, 22.10.2026)

| Prüfung | Ergebnis |
| --- | --- |
| Logik/Server (`npm run test:suite`) | 155/155 bestanden (vorher 138; neu: Aufgaben 6, Markt 5, Graph 5, Umfeld-API 1) |
| Original-ZIP-Tests | 26/26 |
| SQL (`test:suite-sql`) | 8 + 8 + 8 (mit 006 + 007) + 7 + 5 neue (007: Migration, eigenes/fremdes Outlet, manipulierte eingeschränkte Speicherung, gelöschtes Outlet) – alle bestanden |
| App-Tests (`npm test`, vitest) | 57 bestanden, 34 übersprungen (brauchen Datenbank). Die node:test-Dateien der Suite werden nicht mehr fälschlich mit vitest gestartet. |
| Browser, gesamtes Projekt (`npx playwright test`) | 288/288 bestanden, darunter 12 neue (S12–S14) und eine erweiterte Startseitenprüfung |
| Typprüfung (`tsc`), Lint | ohne Fehler |
| Mobil 390 px | kein horizontales Scrollen auf Lebenszyklus, Marktcheck (beide Tabs), Aufgaben, Startseite |

**Angepasste bestehende Tests:**
- SV-8 füllt die Felder jetzt innerhalb des Formulars aus. „Priorität“ gibt es nun auch als Listenfilter.
- SV-9 nutzt das neue Formular: Artikel aus dem Produktstamm, Menge, Leistung. Alle bisherigen Prüfungen bleiben: https-Pflicht, +11,9 %, KI ohne Cloud gesperrt, Umgebungssuche.

**Nicht geprüft:**
- echte Supabase-Instanz (007 dort ausführen)
- echte OpenStreetMap- und Nominatim-Antworten (in den Tests nachgebildet)
- echte KI-Antwort
- echte Geräte

## Migration und Konfiguration

1. In Staging `web/suite-sql/007_glb_task_outlets.sql` ausführen. Sie braucht 001, 002 und 006, lässt sich wiederholen und ändert keine Daten. Danach in Produktion.
2. Keine neuen Umgebungsvariablen. Die KI-Einordnung braucht wie bisher `OPENAI_API_KEY` (kostenpflichtig, optional).

## Rückweg

- Code: Ausgangsstand ist `cda9e1b`. Diesen Commit in Vercel erneut bereitstellen oder die Commits dieses Pakets mit `git revert` zurücknehmen.
- 007: `drop trigger if exists glb_snapshots_task_outlets on public.glb_snapshots; drop function if exists private.glb_check_task_outlets();`. Das `outlet_id`-Feld an Aufgaben stört ältere Versionen nicht.
