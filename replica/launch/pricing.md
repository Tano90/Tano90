# Preise

## Markt (gelesen am 2026-10-20)

Keine dieser Seiten war hier direkt erreichbar. Die Zahlen stammen aus Suchergebnissen, die die Seiten zusammenfassen,
und widersprechen sich teils. Vor jeder Entscheidung die Preisseiten selbst öffnen.

| Produkt | Modell | Preis (wie gefunden) | Quelle | Verlässlichkeit |
| --- | --- | --- | --- | --- |
| Apicbase (Original) | pro Outlet + Module, „Preis auf Anfrage“ | Einstieg Einzel-Outlet ca. 160 $/Monat, Module ab ca. 249 $/Monat; Tarife Growth / Professional / Enterprise „Talk to our team“; Testphase, kein Gratis-Tarif | apis.io/plans/apicbase, toolradar.com/tools/apicbase/pricing, softwaresuggest.com | Drittquellen, laut apis.io selbst „nicht abgeglichen“ |
| MarginEdge | pro Standort | 330–350 $/Standort/Monat; mit Bar-Inventur 480–500 $; Einrichtungsgebühr; jährlich −10 % | marginedge.com/pricing (Suchauszug), pricingsaas.com, xpay.sh | Suchauszug der offiziellen Seite + Drittquellen, uneinheitlich |
| meez | Tarif pro Monat | Starter 24 $ (19 $ jährlich), Starter Plus 89 $ (79 $), Scale 199 $ (179 $) mit Inventur für mehrere Standorte | getmeez.com/pricing (Suchauszug) | Suchauszug der offiziellen Seite |
| Rezeptrechner PRO (DACH) | Jahresabo | ca. 120–140 €/Jahr, nur Kalkulation/Nährwerte/Etiketten | digistore24.com (Produktseiten), capterra | Händlerseiten, Tarifzuordnung unklar |

Stand der Tabelle: 2026-10-20, am 2026-10-21 nicht erneut gelesen (Quellen weiter gesperrt). Laut Recon ist HACCP beim
Original ein Zusatzmodul; bei Mirepa ist es wie die Zentralküche in jedem Tarif enthalten. Die Preise bleiben unverändert:
49 € + 39 € je weiterem Standort.

## Was Nutzer zu Preis und Abrechnung sagen

Keine Daten: 0 Bewertungen gesammelt (siehe `fixes.md`). Diese Spalte wird ergänzt, sobald `feedback.md` existiert.

## Modell

- **14 Tage kostenlos, ohne Kreditkarte.** Kein Gratis-Tarif: Lager und Bestellungen verursachen echte Kosten (E-Mail, Datenbank).
- **Pro Standort, nicht pro Nutzer.** Eine Küche hat wechselndes Personal; Nutzer-Preise bestrafen genau das. Unbegrenzte Nutzer.
- **Alle Funktionen in jedem Tarif.** Keine Module, kein „Preis auf Anfrage“.
- **Monatlich oder jährlich**, jährlich = 2 Monate geschenkt.

| Tarif | Für wen | Monatlich | Jährlich |
| --- | --- | --- | --- |
| Eine Küche | Restaurant, Café, Imbiss | 49 € | 490 € |
| Mehrere Küchen | Gruppen, Filialen, Zentralküchen | + 39 € je weiterem Standort | + 390 € je weiterem Standort |

Als Kleinunternehmer nach § 19 UStG ohne Umsatzsteuer, die Preise sind Endpreise (Schalter `SMALL_BUSINESS` in `web/src/lib/legal.ts`). Beispiel: drei Standorte = 127 €/Monat. Zur Einordnung: unter dem, was Drittquellen für das Original
und MarginEdge nennen, über reinen Kalkulationstools ohne Lager und Einkauf. Die Zahlen sind ein Vorschlag, kein Test:
Mit den ersten Betrieben über die Zahlungsbereitschaft sprechen (siehe `launch-plan.md`).

## Abrechnung, die nicht ärgert (im Produkt)

| Regel | Stand |
| --- | --- |
| Kündigen mit einem Klick (Stripe-Kundenportal) | gebaut; im Portal „Kündigen“ aktivieren |
| Keine Sprünge: Menge = angelegte Standorte, automatisch angepasst, anteilig berechnet | gebaut (`syncOutletQuantity`) |
| Klare Erinnerung vor Verlängerung des Jahresabos | **in Stripe einschalten:** Einstellungen → Billing → Abonnements und E-Mails → „Upcoming renewal“ |
| Mail vor Ende der Testphase | **noch nicht gebaut** (Testphase läuft in der App, nicht in Stripe) – Job ergänzen |
| Zahlung fehlgeschlagen: Hinweis statt sofortiger Sperre | gebaut (Status „Zahlung offen“ mit Hinweis) |
| Rechnungen mit USt. | Stripe Tax aktivieren (`STRIPE_AUTOMATIC_TAX=1`), Firmendaten in Stripe |

## Stripe anlegen (du, im Testmodus)

1. Produkt „Mirepa“.
2. Preis monatlich, **gestaffelt (graduated)**, pro Einheit: Stufe 1 (1 Einheit) 49,00 €, Stufe 2 (ab 2) 39,00 €; Abrechnung pro Monat → ID in `STRIPE_PRICE_ID`.
3. Preis jährlich, gestaffelt: 490,00 € / 390,00 €; pro Jahr → `STRIPE_PRICE_ID_YEARLY`.
4. Steuer: keine. Als Kleinunternehmer Stripe Tax nicht aktivieren (die App schaltet es bei `SMALL_BUSINESS` ohnehin ab). In Stripe → Einstellungen → Rechnungen als Standard-Fußzeile eintragen: „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“ Unter Einstellungen → Unternehmen Name und Anschrift (Mattias Segato Consulting, Hohenzollernstraße 12, 52351 Düren) hinterlegen; beides gehört auf jede Rechnung.
5. Kundenportal: Kündigen erlauben (zum Periodenende), Zahlungsart ändern, Rechnungen zeigen, Wechsel monatlich ↔ jährlich erlauben.
