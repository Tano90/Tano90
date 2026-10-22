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
Original ein Zusatzmodul; bei GLB AI Suite ist es wie die Zentralküche in jedem Tarif enthalten. Die Preise sind neu gefasst (vorläufig, siehe „Offene Punkte“ unten): STANDARD 89,00 € pro Kunde und Monat zzgl. 2,99 € pro Nutzer und Monat; PREMIUM 109,99 € pro Kunde und Monat zzgl. 2,99 € pro Nutzer und Monat; Individuelle Lösungen: individuell vereinbarte Entwicklungsgebühr zzgl. 29,99 € pro Monat.

## Was Nutzer zu Preis und Abrechnung sagen

Keine Daten: 0 Bewertungen gesammelt (siehe `fixes.md`). Diese Spalte wird ergänzt, sobald `feedback.md` existiert.

## Modell

- **14 Tage kostenlos, ohne Kreditkarte.** Kein Gratis-Tarif: Lager und Bestellungen verursachen echte Kosten (E-Mail, Datenbank).
- **Pro Kunde plus Gebühr pro Nutzer (vorläufig).** Basispreis pro Kunde und Monat, zzgl. 2,99 € pro Nutzer und Monat. Ob ein Nutzer im Basispreis enthalten ist, ist offen.
- **Leistungsunterschied Standard/Premium: offen.** Bis zur Entscheidung macht die App keine Aussage, welche Funktion in welchem Tarif liegt. Keine Küchen-Module, kein „Preis auf Anfrage“ für Küchenfunktionen.
- **Zwei Add-ons für Hotels (Entscheidung 2026-10-21, für Zusatzumsatz):** Housekeeping und F&B-Controlling, einzeln
  buchbar, je **29 € im Monat bzw. 290 € im Jahr pro Betrieb** (nicht pro Standort). In der Testphase enthalten;
  danach ist ein nicht gebuchtes Add-on gesperrt, die Daten bleiben gespeichert und im Export. Das Versprechen
  „keine Zusatzmodule“ gilt weiter für alles, was eine Küche braucht.
- **Jahrespreise: offen.** Noch nicht festgelegt; keine Jahresrabatte oder Jahrespreise angeben.

| Tarif | Preis | Status |
| --- | --- | --- |
| STANDARD | 89,00 € pro Kunde und Monat zzgl. 2,99 € pro Nutzer und Monat | vorläufig |
| PREMIUM | 109,99 € pro Kunde und Monat zzgl. 2,99 € pro Nutzer und Monat | vorläufig |
| INDIVIDUELLE LÖSUNGEN | individuell vereinbarte Entwicklungsgebühr zzgl. 29,99 € pro Monat | vorläufig |

**Umsatzsteuer: offen.** Der Umsatzsteuerstatus des Anbieters wird geklärt. Er wird nicht aus dem Kleinunternehmerstatus von Mattias Segato Consulting abgeleitet.

**Offene Punkte (vor Stripe-Anlage und Veröffentlichung klären):**
1. Leistungsunterschied Standard/Premium.
2. Ob ein Nutzer im Basispreis enthalten ist.
3. Ob „Kunde“ Unternehmen, Betrieb oder Standort meint.
4. Was die 29,99 € der Individuellen Lösungen abdecken.
5. Wann und wie die Entwicklungsgebühr berechnet wird.
6. Umsatzsteuerstatus des Anbieters.

Zur Einordnung: unter dem, was Drittquellen für das Original
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
| Rechnungen mit USt. | offen (Umsatzsteuerstatus klären); `STRIPE_AUTOMATIC_TAX` erst danach entscheiden, Firmendaten in Stripe |

## Stripe anlegen (du, im Testmodus)

**Erst anlegen, wenn die offenen Punkte entschieden sind.** Bis dahin keine neuen Stripe-Preise anlegen und keine bestehenden Stripe-Produkte ändern (nur mit Freigabe).

1. Produkt „GLB AI Suite“ (falls noch nicht vorhanden).
2. Neue Preise nach dem dann gültigen Tarifmodell: Basispreis pro Kunde und Monat plus Menge pro Nutzer (Menge, zzgl. 2,99 € pro Nutzer und Monat). Die IDs müssen zum endgültigen Modell passen: monatlich → `STRIPE_PRICE_ID`.
3. Jahrespreis: offen. Erst festlegen, dann `STRIPE_PRICE_ID_YEARLY` setzen.
4. Steuer: offen. `STRIPE_AUTOMATIC_TAX` und Stripe Tax erst nach Klärung des Umsatzsteuerstatus entscheiden. Rechnungs-Fußzeile: offen (siehe `setup.md`). Unter Einstellungen → Unternehmen Name und Anschrift (Mattias Segato Consulting, Hohenzollernstraße 12, 52351 Düren) hinterlegen; beides gehört auf jede Rechnung.
5. Online-Abschluss bleibt gesperrt, bis die Tarifdetails final sind. `PLANS_FINAL=1` (Umgebungsvariable) schaltet ihn frei, erst setzen, nachdem die passenden Stripe-Preise angelegt sind.
5. Kundenportal: Kündigen erlauben (zum Periodenende), Zahlungsart ändern, Rechnungen zeigen, Wechsel monatlich ↔ jährlich erlauben.

## Add-ons in Stripe anlegen

Je Add-on ein Produkt mit zwei Preisen (monatlich 29 €, jährlich 290 €, Menge 1), dann in Vercel:

| Variable | Preis |
| --- | --- |
| `STRIPE_PRICE_ADDON_HOUSEKEEPING` | Housekeeping monatlich |
| `STRIPE_PRICE_ADDON_HOUSEKEEPING_YEARLY` | Housekeeping jährlich |
| `STRIPE_PRICE_ADDON_CONTROLLING` | F&B-Controlling monatlich |
| `STRIPE_PRICE_ADDON_CONTROLLING_YEARLY` | F&B-Controlling jährlich |

Ohne diese Variablen lässt sich das Add-on nicht buchen (die Schaltflächen sind dann aus). Gebucht wird beim
Abschluss (Häkchen) oder später unter Einstellungen → Abo („Dazubuchen“, anteilig berechnet). Welche Add-ons ein
Betrieb hat, übernimmt der Webhook aus den Positionen des Abos.
