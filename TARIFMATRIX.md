# Tarifmatrix GLB AI Suite – zur Freigabe

Stand: 22.10.2026. Dies ist ein **Vorschlag**. Bitte jede Zeile bestätigen oder ändern.

## Wichtig vorab
- **In der Suite gibt es heute keine Tarifsperre.** Alle Kundinnen und Kunden sehen alle Module. Mit dieser Runde wurde nichts abgeschaltet. Eine Sperre würde erst nach Freigabe und mit einer eigenen Umstellung gebaut.
- **Export und Datenzugriff bleiben in jedem Tarif frei:** CSV-, Excel- und PDF-Export sowie Backup.
- **Die Preise kommen aus einer einzigen Quelle,** `web/src/lib/pricing.ts`. Startseite, Rechner, AGB und Abrechnungsseite nutzen sie gemeinsam; Tests vergleichen sie.
- **Kein Online-Abschluss vor `PLANS_FINAL=1`:** Bis dahin kann niemand online ein Abo abschließen. Bestehende Stripe-Produkte und Abos sind unverändert.

## Preise (verbindlich vorgegeben)
| Tarif | Grundpreis | Nutzer |
| --- | --- | --- |
| Standard | 89,00 € pro Kunde und Monat | + 2,99 € pro Nutzer und Monat |
| Premium | 109,99 € pro Kunde und Monat | + 2,99 € pro Nutzer und Monat |
| Individuell | Entwicklungsgebühr nach vereinbartem Umfang | + 29,99 € pro Monat |

Beispiel für 5 Nutzer:
- Standard: 89,00 € + 14,95 € = 103,95 €
- Premium: 109,99 € + 14,95 € = 124,94 €
- Unterschied: 20,99 €, nur beim Grundpreis.

## Module nach Tarif (Abgleich mit der echten Suite)
| Modul in der Suite (Menüname) | existiert | Vorschlag | Bemerkung |
| --- | --- | --- | --- |
| Artikel & Umsätze | ja | Standard | |
| Rezepturen | ja | Standard | |
| Rohwaren / Einkaufspreise (Bestell-Forecast, Rohwarenliste) | ja | Standard | |
| Inventur & Lager, Lagerbuch, Lagerbestand | ja | Standard | |
| Bestellungen, Bestell-Forecast | ja | Standard | Bestellungen werden nicht an Lieferanten gesendet |
| Berichte & Export (Report Studio) | ja | Standard | „Basisberichte“ = Report Studio mit Export |
| Lebenszyklen | ja | Premium | braucht ≥ 4 Monate Verkäufe |
| Renner-Penner, Menu Engineering | ja | Premium | |
| Service Funnel, Tagesfunnel, Funnel Quest (Szenarien) | ja | Premium | |
| Wettbewerbspreise | ja | Premium | Preise werden nicht automatisch abgerufen; KI-Einordnung nur, wenn der Betreiber sie einrichtet |
| „Tiefere Berichte“ | **nicht definiert** | – | Es gibt keine Berichte, die über das Report Studio hinausgehen. Erst festlegen, dann veröffentlichen. Deshalb steht es nicht auf der Website. |
| Übersicht mit Handlungsbedarf | ja | **offen** | Vorschlag: beide Tarife |
| Heute zu tun, Team & Aufgaben, Training | ja | **offen** | Vorschlag: beide Tarife |
| Deckungsbeiträge & Zielpreise, Preiskalkulation | ja | **offen** | Vorschlag: beide; Zielpreise nutzen die Rezeptkosten aus Standard |
| Monatsabschluss | ja | **offen** | |
| Mein Markt (20 km) | ja | **offen** | Vorschlag: Premium, zusammen mit Wettbewerbspreisen |
| Hinweise, Datenqualität, Erste Schritte, Importe, Warengruppen, Einstellungen | ja | beide | Grundfunktionen; Export und Backup nie sperren |

## Auf der Website veröffentlicht (als „Vorgeschlagener Umfang“)
- **Standard:** Artikel und Rezepte, Rohwaren und Einkaufspreise, Inventur und Bestand, Bestellungen mit Bestell-Forecast, Basisberichte mit CSV- und Excel-Export.
- **Premium:** alles aus Standard, dazu Lebenszyklen, Menu Engineering, Szenarien im Service Funnel und Wettbewerbspreise.
- **Hinweis „Empfehlung für aktive Betriebssteuerung“:** Er ist begründet, weil alle vier Premium-Module existieren und der Steuerung von Sortiment, Preisen und Service dienen. Es gibt keinen Hinweis wie „Am beliebtesten“.

## Offene Entscheidungen
1. **Leistungsumfang:** Bitte die Zeilen oben bestätigen, vor allem die als **offen** markierten.
2. **Nutzer:**
   - Wird jeder Nutzer berechnet, oder ist einer im Grundpreis enthalten? Der Rechner nimmt bis zur Bestätigung an, dass jeder Nutzer berechnet wird, und sagt das.
   - Zählen Nur-Lese-Rollen (z. B. Steuerberatung) als Nutzer?
3. **„Pro Kunde“:** Heißt das pro Unternehmen, pro Betrieb oder pro Standort? Heute rechnet die Abrechnung nach Outlets ab („Outlets (abgerechnet)“). Das muss auf die neue Einheit umgestellt werden.
4. **Umsatzsteuer:**
   - Welchen Steuerstatus hat der Anbieter von GLB? Er wird **nicht** aus dem Kleinunternehmer-Status von Mattias Segato Consulting abgeleitet.
   - Davon hängt ab, ob die Preise netto oder brutto ausgewiesen werden.
   - Bis zur Klärung steht auf der Website: „Ob und wie Umsatzsteuer ausgewiesen wird, ist noch nicht festgelegt.“
5. **Individuell, die 29,99 €:**
   - Was ist enthalten (z. B. Betrieb, Updates, ein bestimmtes Kontingent)?
   - Wo liegen die Grenzen? Auf der Website steht: „Eine unbegrenzte Weiterentwicklung ist nicht enthalten.“
6. **Individuell, die Entwicklungsgebühr:** Wann und nach welchem Zahlungsplan wird sie berechnet?
7. **Testphase:** `PRICING.trialDays = 14` steht noch im Code. Gilt sie für die neuen Tarife? Auf der Website wird sie zurzeit nicht beworben.

## Nach der Freigabe (technisch)
- Stripe-Preise anlegen: Grundpreis plus Menge „Nutzer“. Erst dann `PLANS_FINAL=1` setzen.
- Die Menge im Checkout von Outlets auf Nutzer umstellen. Die Abrechnungsseite zeigt dann Nutzer statt Outlets.
- AGB § 4 mit Leistungsumfang, Abrechnungseinheit und Steuer-Ausweis ergänzen.
- Eine Tarifsperre in der Suite nur auf ausdrücklichen Wunsch bauen. Bestehende Kundinnen und Kunden vorher informieren.
