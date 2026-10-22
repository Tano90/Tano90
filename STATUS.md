# STATUS – Geräte-Runde GLB AI Suite (Desktop, Tablet, Handy · Oktober 2026)

Stand: 22.10.2026 · Branch `claude/replica-skill-install-vzriug`

## Pakete dieser Runde
| Paket | Inhalt | Stand |
| --- | --- | --- |
| P1 | Detail-Links: Bar → Limonade → Lebenszyklus mit Outlet; Bestellhinweis betriebsweit gekennzeichnet; überfällige Aufgaben nach Outlet; „Zielpreis ansehen“ öffnet den Artikel | erledigt |
| P2 | Zwei Preisziele (Ziel-Warenquote / kalkulatorische Untergrenze), Handy-Karten für die Tabelle | erledigt |
| P4a | „−0,00 €“ → „0,00 €“; Forecast-Kachel „Rohwaren ohne Bestellvorschlag“ zählt, was sie aufschlüsselt | erledigt |
| P3 | Handy: Filterpanel mit Zusammenfassung (bleibt oben), Touch-Ziele ≥ 44 px, `viewport-fit=cover` für Safe Areas, Eingaben ≥ 16 px und über der Tastatur, Wisch-Hinweis bei breiten Tabellen, Inventur-Filter, Aufgaben-Häkchen 44 px, einklappbare Menübereiche; Demo-Fälligkeiten relativ zu heute (Berliner Tag) | erledigt |
| P4b | Rest „KI-Marktcheck“ entfernt (Tab-Beschriftung, Herkunft, Modulname, Startseite); Erste Schritte in Phase 1 (erste Auswertung) und Phase 2 (später: Lager und Bestellung) getrennt | erledigt |
| P5 | Tarife: Karten mit Für wen / Problem / vorgeschlagener Umfang / Start / nicht angebunden; Premium hervorgehoben mit Begründung (+20,99 €); Individuell mit Entwicklungsgebühr zuerst; Nutzer-Rechner (Annahmen genannt); CTAs „Mit eigenen Daten vorführen lassen“ / „Demo ohne Anmeldung öffnen“; Abrechnungsseite zeigt Tarife aus derselben Quelle; `TARIFMATRIX.md` zur Freigabe | erledigt |
| P6 | Abläufe A–D bei 360/390/430/768/1280/1440 (`web/scripts/journeys.mjs`), Tastatur und axe (S23), dabei gefundene Fehler behoben | erledigt (Volltest siehe unten) |

Geänderte Dateien (P1/P2/P4a): `web/public/suite/src/{app.js, core.js, v04core.js, calm.css, v11/core.mjs}`, `web/suite-tests/tests/v13.test.cjs`, `web/e2e/suite-v14.spec.ts`, `web/e2e/suite-v13.spec.ts` (Kachelname).
Tests nach P1/P2/P4a: Unit 160/160; e2e suite-v13 + suite-v14 17/17.
Geänderte Dateien P3: `web/public/suite/{index.html, src/app.js, src/v08ui.js, src/mobile.js, src/mobile.css, src/calm.css, src/v11/ui.mjs, src/v11/demo.mjs}`, `web/e2e/suite-v14.spec.ts` (S21, S22).
Tests nach P3: alle Suite-e2e-Specs 80/80; Unit 160/160.
Geänderte Dateien P5: `web/src/lib/pricing.ts` (+ `pricing.test.ts`), `web/src/components/landing/price-calculator.tsx` (neu), `web/src/app/page.tsx`, `web/src/components/landing/site-chrome.tsx`, `web/src/app/(app)/settings/billing/page.tsx`, `web/e2e/landing.spec.ts` (L02), `TARIFMATRIX.md`.
Tests nach P5: vitest pricing 3/3; Landing/Legal/Lead-Form e2e 21/21; tsc ohne Fehler.
## Geräteprüfung (P6) – was tatsächlich lief
Chromium (Playwright) mit Handy- bzw. Tablet-Emulation: Viewport, Touch, `isMobile` unter 700 px, deutsche Sprache, Zeitzone Berlin. **Kein echtes Gerät, kein Safari/iOS, keine echte Bildschirmtastatur.**

| Breite | A Angebot → Preise → Rechner → Anfrageformular (nicht abgeschickt) | B Demo → Bar → Limonade → Lebenszyklus → Zurück → Zielpreis | C Eigene Daten → Speisekarte importieren → nächster Schritt | D Aufgabe anlegen + abhaken, Inventur buchen |
| --- | --- | --- | --- | --- |
| 360 | ok | ok | ok | ok |
| 390 | ok | ok | ok | ok |
| 430 | ok | ok | ok | ok |
| 768 | ok | ok (nach Fix) | ok | ok (nach Fix) |
| 1280 | ok | ok | ok | ok |
| 1440 | ok | ok | ok | ok |
Jede Station ohne Querscrollen, keine Konsolenfehler.
Gefunden und behoben bei 768 px:
- Demo-Hinweis schob seine Schaltfläche über den Rand.
- Unsichtbare Tabellenbeschriftung (sr-only) vergrößerte die Seitenbreite um 397 px.
- Kontrast der unteren Leiste lag bei 3,9 : 1 und ist jetzt höher.

## Volltest am Ende der Runde (22.10.2026, 22:45–23:00 UTC)
- Playwright, gesamtes Projekt: **313 bestanden, 2 fehlgeschlagen.**
  - Die zwei Fehler liegen außerhalb dieser Runde: F06-H2 (Bestellvorschlag) und H-E2 (HACCP-Vortag). Beide Bereiche wurden nicht geändert.
  - Ursache ist eine Tagesgrenze: Die Testdaten setzen „gestern“ bzw. „letzte Wochen“ nach UTC, die App rechnet nach Berliner Tag. Zwischen 22 und 24 Uhr UTC zeigen beide auf verschiedene Tage.
  - Der Testlauf fiel in genau dieses Fenster. Zu einer anderen Uhrzeit waren alle 301 Tests grün.
  - Offen: Die Seed-Daten auf den Berliner Tag umstellen.
- Unit (`npm run test:suite`): 160/160.
- vitest: 60 bestanden, 34 übersprungen (brauchen DB).
- tsc ohne Fehler.

Gefundener Fehler nebenbei: Demo-Aufgaben hatten feste Fälligkeiten (22.10.2026) → wurden ab Mitternacht Berliner Zeit „überfällig“; Übersicht rechnete „heute“ in UTC, Aufgabenliste in Berliner Zeit. Beides vereinheitlicht.

---

# Vorherige Runde (Kundenablauf)


Stand: 22.10.2026 · Branch `claude/replica-skill-install-vzriug` · Ausgangsstand `2584595`

## Kunden-Durchlauf vor den Änderungen (lokal, Demo im Browser)
Getestet durch Klicken: Startseite → „Live ausprobieren“ → Übersicht, alle Menüpunkte, Filter, Zurück-Taste.
- Start ohne Adresse zeigte das Dashboard, markiert war „Mein Arbeitsplatz“ (Fehler C).
- Dashboard: „Netto-Umsatz · alle Monate“ mit einem Septembervergleich darunter; Hinweise ohne Artikel.
- Report Studio: Kostenbasis „Kostenstand im Verkaufsmonat“, Kachel „Aktuelle Produktkosten“, Tabelle „nicht historisiert“, Fußzeile „aktuelle variable Produktkosten“ (Fehler A; gerechnet wurde richtig, beschriftet falsch).
- Bestell-Forecast: oben „0 ohne Bestand“, Reporting „Rohwaren ohne Bestand 1“ (Fehler B: zwei Definitionen); Mengen wie „12.616,07 g“.
- Mission Control „keine Hinweise“, GLB Intelligence 4, Cockpit 2; Dezimalpunkt in Hinweisen; Einrichtung, Hinweise, Import und Mission Control hängten das ganze Dashboard unten an.
- Demo ohne Fixkosten (Zielpreise nicht berechenbar) und ohne Wettbewerbsbeobachtungen; eigener Betrieb bekam den Demo-Standort Düren.
- Keine Konsolenfehler.

## Erledigt
- **Navigation**: fünf Bereiche (Übersicht · Verkauf & Preise · Einkauf & Lager · Service & Team · Einrichtung & Daten), alle Seiten erhalten, klare Namen (Übersicht, Heute zu tun, Monatsabschluss, Berichte & Export, Hinweise, Wettbewerbspreise, Datenqualität, Erste Schritte). Start = Übersicht (Leitung) bzw. Heute zu tun (Mitarbeitende). Adresse, Seitenname oben und aktiver Menüpunkt stimmen immer; Direktlinks (auch auf später geladene Module), Zurück/Vor, unbekannte Adressen. Mobil: untere Leiste beginnt mit „Übersicht“.
- **Übersicht**: „Handlungsbedarf“ direkt unter den Kennzahlen – nur aus Daten und eigenem Ziel: Artikel über der eigenen Ziel-Warenquote (mit Wareneinsatz ÷ Netto-Umsatz), Artikel ohne Wareneinsatz, Absatzrückgang (Regel der Lebenszyklen, mit Monaten), Bestellbedarf, überfällige Aufgaben; je mit Direktlink. Ohne eigenes Ziel keine Gut/Schlecht-Bewertung. Gesamtsumme nennt ihren Zeitraum („Summe April bis September 2026, 6 Monate“), Monatsvergleich nur bei gewähltem Monat. Begriffe DB I, DB II, Warenquote, Kostenbasis, Szenario erklärt.
- **Widersprüche**: Report Studio nennt überall die gewählte Kostenbasis (Kachel, Tabelle, Fußzeile, Export); Artikelseite sagt offen „heutige Produktkosten“. Forecast und Reporting zählen mit einer gemeinsamen Definition (ohne gezählten Bestand, Bestand 0, in keinem Rezept, ohne Tagesabsatz, Einheit nicht umrechenbar, Artikel ohne Rezept), Mengen in kg/l/Stk. Datenqualität listet Daten- und Lagerprobleme, kaufmännische Hinweise stehen in der Übersicht. Deutsches Zahlenformat in Hinweisen. Keine doppelte Dashboard-Kopie mehr unter Einrichtung, Hinweise, Import, Datenqualität.
- **Wettbewerbspreise** (ehem. KI-Marktcheck): „Wettbewerbspreisvergleich mit optionaler KI-Einordnung“; vier Schritte mit automatisch/manuell/optional; KI-Status vom Server (`GET /api/suite/market/status`, nur ja/nein, kein Schlüssel); Kundinnen und Kunden verwalten keine Schlüssel; fiktive Demo-Zeilen gehen nie an die KI.
- **Demo**: Monatsfixkosten (als Beispielwerte markiert) → Zielpreise berechenbar; vier klar fiktive Wettbewerbsbeobachtungen (vergleichbar, nicht vergleichbar, umgerechnet, zu prüfen) ohne echte Quelle. Eigene Daten: kein Demo-Standort, keine Fixkosten, keine Beobachtungen.
- **Erste Schritte**: Betrieb/Outlets → Speisekarte → Verkäufe → Kosten → erste Auswertung, je mit Status aus den Daten, benötigten Angaben, Formaten, Vorlage und Ziel; Lager/Inventur danach.
- **Preise**: Standard 89,00 € / Premium 109,99 € pro Kunde und Monat zzgl. 2,99 € pro Nutzer und Monat; Individuell: Entwicklungsgebühr nach Vereinbarung zzgl. 29,99 € pro Monat – als **vorläufig** veröffentlicht, ohne erfundene Leistungen. § 19-Hinweis entfernt (Steuerstatus offen). AGB § 4 neutral. Online-Abschluss gesperrt bis `PLANS_FINAL=1` (Verwaltung bestehender Abos bleibt möglich); Stripe-Produkte unverändert. Doku, Store-Texte, `.env.example` angepasst.
- **Startseite**: „Kurz beantwortet“ (Entscheidung, Datenimport, laufende Arbeit, Kosten, Test mit eigenen Daten) direkt nach dem Einstieg; vier Abläufe mit Bild statt sechs; Modulliste als kurzer Index der fünf Bereiche; Zahlenleiste entfernt; „Vorführung anfragen“ im Kopf und Einstieg; kein Zeitversprechen; neue Screenshots und Rundgang-Video aus dem aktuellen Stand.

## Betroffene Dateien
`web/public/suite/src/{app.js, v08ui.js, v08roles.js, mobile.js, core.js, v04core.js, calm.css, v11.css}`, `web/public/suite/src/v11/{ui.mjs, demo.mjs, market.mjs}`, `web/src/lib/{pricing.ts, suite-api.mjs}`, `web/src/app/{page.tsx, actions.ts, legal/terms/page.tsx, (app)/settings/billing/*}`, `web/src/app/api/suite/market/status/route.ts`, `web/scripts/suite-shots.mjs`, `web/public/landing/*`, Tests in `web/e2e`, `web/suite-tests`, Doku in `replica/`.

## Tests (22.10.2026)
- Logik/Server `npm run test:suite`: 156/156 · Original-ZIP 26/26 · SQL 8+8+8+7+5 · vitest 57 bestanden, 34 übersprungen (brauchen DB) · tsc und Lint ohne Fehler.
- Browser, gesamtes Projekt (`npx playwright test`): 301/301 bestanden (13,3 min), darunter neu S15–S18 (Navigation, Handlungsbedarf, Kostenbasis, Forecast-Definitionen, Erste Schritte, eigene Daten, Wettbewerbspreise) und S14-0 (fiktive Demo-Beobachtungen).
- Handybreite 390 px ohne horizontales Scrollen: Übersicht, Erste Schritte, Wettbewerbspreise, Bestell-Forecast, Berichte, Startseite.
- Nicht geprüft: echte Vorschau-URL (vercel.app von hier gesperrt), echtes Supabase/Stripe, echte KI-Antwort, echte OpenStreetMap-Antworten (in Tests nachgebildet), echte Geräte.

## Offen / Entscheidungen (Tarife)
1. Welche Leistungen unterscheiden Standard und Premium?
2. Ist ein Nutzer im Grundpreis enthalten oder wird jeder Nutzer berechnet?
3. „Kunde“ = Unternehmen, Betrieb oder Standort?
4. Welche laufenden Leistungen decken die 29,99 € bei individuellen Lösungen?
5. Wann und nach welchem Zahlungsplan wird die Entwicklungsgebühr berechnet?
6. Umsatzsteuerstatus des Anbieters von GLB (nicht aus Mattias Segato Consulting abgeleitet) – davon hängen Preisanzeige (netto/brutto), Impressum-Angabe und Rechnungen ab.
Danach: Stripe-Preise anlegen (Basis + Menge Nutzer), Checkout-Menge im Code von Outlets auf Nutzer umstellen, `PLANS_FINAL=1` setzen, AGB § 4 ergänzen.

Weitere offene Punkte: `replica/launch/listing.json` beschreibt noch alte Funktionen (Zentralküche, Barcode, HACCP) – vor einer Store-Veröffentlichung neu schreiben. Impressum nennt weiterhin „Kleinunternehmer nach § 19 UStG“ für Mattias Segato Consulting – prüfen, ob das der Anbieter von GLB ist.

## Nächster Schritt
Antworten zu den Tarifpunkten 1–6 einholen; dann Checkout-Logik und AGB final machen.
