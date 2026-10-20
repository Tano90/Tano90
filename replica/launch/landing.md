# Landingpage

Gebaut: `web/src/app/page.tsx` (Route `/`, statisch). Die App liegt jetzt unter `/app`. Screenshots: `landing-desktop.png`,
`landing-mobile.png`. Geprüft: axe WCAG 2.2 AA ohne Verstoß, Kontrast über die Tokens (31 Paare, 0 Fehler), kein seitliches
Scrollen bei 390 px, FAQ per Tastatur (E2E `landing.spec.ts`).

**Einschränkung:** `fixes.md` hat noch keine belegte Positionierung (0 Bewertungen). Die Seite führt deshalb mit dem, was
Pantra nachweislich kann (durch E2E-Tests belegt), und nicht mit Klagen über das Original. Sobald `feedback.md` existiert:
Problem-Abschnitt und Feature-Reihenfolge neu ordnen.

Regel für jede Aussage auf der Seite: Sie muss im Produkt stimmen und getestet sein. Beim Gegenlesen umgeschrieben:
„rechnet Kartons im Kopf in Kilo um“ (Zählen in Gebinden ist noch nicht gebaut) und „in zehn Minuten“ (nie gemessen).

## 1. Hero
- **Überschrift:** Was jeder Teller kostet. Live.
- **Darunter:** Für Küchen mit einem oder mehreren Standorten: Rezepte, Einkaufspreise, Bestellungen und Inventur in einem Werkzeug – und der Wareneinsatz stimmt, auch wenn sich Preise jede Woche ändern.
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
| Allergene: ungeprüft = „unbekannt“, nie „frei“; fehlender Preis wird an der Zeile genannt | Unit-Test `allergens`, E2E F02-E1/E2 |
| Bestellung genau einmal beim Lieferanten, auch bei Doppelklick und zwei Tabs | E2E F06-E1, F06-E2 |
| Wareneingang vorausgefüllt, Teillieferung, Überlieferung abgefangen | E2E F07-H1, F07-N1 |
| Inventur übersteht ein Funkloch | E2E F08-E2 (BUG-004 behoben) |

## 5. Preise
Aus `pricing.md`, Werte aus einer Quelle (`web/src/lib/pricing.ts`), E2E prüft das Rechenbeispiel.

## 6. FAQ
Import (noch nicht – ehrlich gesagt), Kasse (noch nicht), Haftung Allergene, Datenstandort, Kündigen, App nötig?

## 7. Abschluss
„Leg dein teuerstes Gericht an und sieh, was es wirklich kostet.“ + Button.

## Bewusst weggelassen
Kundenstimmen, Logos, Nutzerzahlen, Sterne – es gibt noch keine Kunden. Kommen echte Beta-Nutzer dazu, nur mit deren
schriftlicher Erlaubnis. Bewertungen des Originals sind Recherche, keine Testimonials. Der Name des Originals erscheint nirgends.

## Vor dem Start prüfen
- „Daten in der EU (Frankfurt)“ stimmt nur, wenn Supabase und Vercel dort eingerichtet sind (`backend.md`).
- „Kündigen mit einem Klick“ setzt voraus, dass im Stripe-Kundenportal Kündigen aktiviert ist.
- Impressum, Datenschutz und Nutzungsbedingungen sind Entwürfe (`/legal/*`).
