# STATUS – Überarbeitung GLB AI Suite (Kundenablauf, Oktober 2026)

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
- Browser: siehe Abschlussbericht (Gesamtlauf `npx playwright test`).

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
