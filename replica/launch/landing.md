# Landingpage

Gebaut: `web/src/app/page.tsx` (Route `/`, statisch). Die App liegt jetzt unter `/app`. Screenshots: `landing-desktop.png`,
`landing-mobile.png`. Geprüft: axe WCAG 2.2 AA ohne Verstoß, Kontrast über die Tokens (31 Paare, 0 Fehler), kein seitliches
Scrollen bei 390 px, FAQ per Tastatur (E2E `landing.spec.ts`).

**Stand 2026-10-21:** Positionierung aus `brand.md` (Winkel 1, ohne Bewertungen auf deinen Wunsch): Live-Kalkulation plus
Lager und Zentralküche. FAQ korrigiert: Import und Kassen-Anbindung standen dort noch als „noch nicht“, sind aber seit dem
3. und 5. Durchgang gebaut. Vier neue Funktionen auf der Seite (Zentralküche, Barcode-Inventur, Rechnungsabgleich, HACCP).

**Einschränkung:** `fixes.md` hat noch keine belegte Positionierung (0 Bewertungen). Die Seite führt deshalb mit dem, was
GLB AI Suite nachweislich kann (durch E2E-Tests belegt), und nicht mit Klagen über das Original. Sobald `feedback.md` existiert:
Problem-Abschnitt und Feature-Reihenfolge neu ordnen.

Regel für jede Aussage auf der Seite: Sie muss im Produkt stimmen und getestet sein. Beim Gegenlesen umgeschrieben:
„rechnet Kartons im Kopf in Kilo um“ (Zählen in Gebinden ist noch nicht gebaut) und „in zehn Minuten“ (nie gemessen).

## 1. Hero
- **Überschrift:** Was jeder Teller kostet. Live.
- **Darunter:** Für Küchen mit einem oder mehreren Standorten: Rezepte, Einkauf, Lager und Zentralküche in einem Werkzeug – und der Wareneinsatz stimmt, auch wenn sich Preise jede Woche ändern.
- **Button:** 14 Tage kostenlos testen → `/signup` · zweiter Link: Preise
- **Bild:** echter Screenshot des Rezept-Editors (Seed-Daten, keine echten Kunden)

## 2. Problem
Allgemeine Aufgaben aus dem Küchenalltag, keine Aussagen über Nutzer des Originals: Kalkulation veraltet bei jeder
Preisänderung; Einkauf, Lager und Rezepte in getrennten Listen.

## 3. So funktioniert es
Einkauf erfassen → Rezepte bauen → Bestellen und zählen (der Kernablauf F01 → F02 → F06–F08).

## 4. Funktionen (jeweils mit Beleg)
| Funktion | Beleg |
| --- | --- |
| Wareneinsatz beim Tippen, rechnet bei Preisänderung über Grundrezepte mit | E2E F02-H1, F03-H1, F04-H1 |
| Zentralküche: Anforderung, Plan je Liefertag mit Rohware und Fehlmengen, Produzieren bucht aus und verteilt Kosten | E2E F13-H1/H2, Integrationstest |
| Inventur in Gebinden oder per Barcode-Scanner, übersteht ein Funkloch | E2E F08-E2, F08-B1/B3 (BUG-004, BUG-016 behoben) |
| Rechnung gegen Bestellung und Lieferung, Freigabe bei Abweichung nur mit Begründung | E2E F12-H1, F12-E1 |
| HACCP im Grundpreis: Checklisten, Grenzwerte, Maßnahme Pflicht, CSV-Protokoll | E2E F14-H1, F14-E1 |
| Fehler abfangen: Punkt/Komma, Bestellung genau einmal, ungeprüfte Allergene nie „frei“ | E2E X-DEC, F06-E1/E2, Unit-Test `allergens` |

Nicht auf der Seite: Kamera-Scan per Handy (nur von Hand prüfbar, F08-B5 offen) und „Fertigware im Lager“ (nicht gebaut).

## 5. Preise
Aus `pricing.md`, Werte aus einer Quelle (`web/src/lib/pricing.ts`), E2E prüft das Rechenbeispiel.

## 6. FAQ
Import (ja: Excel/CSV mit Vorschau), Kasse (CSV oder API; keine fertigen Hersteller-Anbindungen), Zusatzmodule (keine),
Haftung Allergene, Datenstandort, Kündigen, App nötig?

## 7. Abschluss
„Leg dein teuerstes Gericht an und sieh, was es wirklich kostet.“ + Button.

## Bewusst weggelassen
Kundenstimmen, Logos, Nutzerzahlen, Sterne – es gibt noch keine Kunden. Kommen echte Beta-Nutzer dazu, nur mit deren
schriftlicher Erlaubnis. Bewertungen des Originals sind Recherche, keine Testimonials. Der Name des Originals erscheint nirgends.

## Vor dem Start prüfen
- **Name:** GLB AI Suite (statt Pantra, 2026-10-21). Nur per Websuche geprüft; Register und Domain stehen in `brand.md` noch aus.

## Neugestaltung (2026-10-21)
Dunkle Bühne mit Logo, Überschrift und einem **Live-Rechner** (Linsensuppe aus den Demodaten, Regler für Linsenpreis und
Verkaufspreis, Wareneinsatz und Anteil rechnen sofort mit, Zielstrich 30 %); laufendes Band mit Stichworten; Funktionen
als Mosaik; Preiskarten hell und dunkel; Anfrage als Karte; dunkler Abschluss und Fußzeile. Bewegung nur, wenn das
System keine reduzierte Bewegung wünscht. axe ohne Verstoß, kein seitliches Scrollen bei 390 px.
- „Daten in der EU (Frankfurt)“ stimmt nur, wenn Supabase und Vercel dort eingerichtet sind (`backend.md`).
- „Kündigen mit einem Klick“ setzt voraus, dass im Stripe-Kundenportal Kündigen aktiviert ist.
- Impressum, Datenschutz und Nutzungsbedingungen sind Entwürfe (`/legal/*`).

## Zweite Neugestaltung (2026-10-21), auf Wunsch „schöner, wärmer“

Vorbild waren Ideen, nicht die Seite des Originals: hell und warm statt dunkel; eine **eigene Illustration** (Schneidbrett
mit gewürfeltem Mirepoix, Messer in Markenfarbe) mit vier schwebenden Karten aus echten Funktionen (Wareneinsatz,
Bestellung, Inventur, HACCP); Band in Aubergine; Live-Rechner als eigener dunkler Abschnitt „Probier es aus“;
„Alles drin“ mit 12 Symbol-Kacheln (jede ist ein vorhandener Teil der App); „Fair und sicher“ mit sechs Fakten statt
Kundenlogos oder Nutzerzahlen. Bewusst **nicht** übernommen: Gelb-Serif-Look, „4.000 Unternehmen vertrauen uns“,
Partner-Logos, Zertifikate, die wir nicht haben, Stockfotos ohne Lizenz.

