# Wettbewerb und Lücken (Stand 2026-10-21)

Grundlage: drei Recherchen über Websuche. **Die Anbieterseiten selbst ließen sich aus dieser Umgebung nicht öffnen**;
alles stammt aus Suchergebnissen (Anbieterseiten, Hilfecenter, G2/Capterra-Auszüge, Preisvergleichsseiten). Preise
und „hat das nicht“ sind deshalb unsicher und vor jeder öffentlichen Aussage auf der Anbieterseite zu prüfen.
Nur Funktionen und Preise wurden erfasst, in eigenen Worten; kein Text, Code oder Design übernommen.

## Küche (Rezepte, Wareneinsatz, Lager, Einkauf)

| Anbieter | Für wen | Preis (laut Quelle) | Auffällig |
| --- | --- | --- | --- |
| Apicbase | Gruppen, EU | ab ca. 249 €/Monat, pro Modul ([GetApp](https://www.getapp.com/all-software/a/apicbase-food-management)) | HACCP u. a. als Zusatzmodul; Klagen: langsame Einrichtung, Auswertung über Power BI |
| MarketMan | KMU bis Mittelstand | 249 / 299 / ab 449 $ ([PricingSaaS 2026-W34](https://pricingsaas.com/companies/marketman/diffs/2026W34)) | Rechnung per Foto, KI-Bestellvorschlag, API kostet extra |
| MarginEdge | US-Einzelbetriebe | 330 $/Standort ([Preise](https://www.marginedge.com/pricing/)) | Rechnungen in 24–48 h erfasst, Soll-Ist, Preisalarme |
| meez | Köche | 0–199 $ (widersprüchlich) | Rezeptskalierung, Rechnungsscan; Klage: Import mühsam |
| Supy | Gruppen, Zentralküche | auf Anfrage | KI-Rechnungsscan, Bestellung per WhatsApp |
| Restaurant365 | US-Ketten | 469 / 689 $/Standort ([NerdWallet](https://www.nerdwallet.com/business/software/learn/restaurant365)) | Buchhaltung + Soll-Ist + Personalplanung; Klage: kompliziert |
| FoodNotify (AT) | DACH | ca. 175 €/Standort + Einrichtung ([ki-syndikat](https://www.ki-syndikat.de/tools/foodnotify/)) | GS1-Artikeldaten, LMIV, HACCP, Demo Pflicht |
| gastronovi (DE) | All-in-one | Kalkulation 14 €, Bestellung 9 € ([OMR](https://omr.com/de/reviews/product/gastronovi/pricing)) | DATEV-Partner, aber ohne Belegübergabe |
| Rezeptrechner PRO | Einzelbetriebe | ca. 120–150 €/Jahr | nur Kalkulation |

## Hotel / Housekeeping

| Anbieter | Preis (laut Quelle) | Auffällig |
| --- | --- | --- |
| Flexkeeping (seit 09/2025 bei Mews) | 3 €/Zimmer (<100) ([apaleo store](https://store.apaleo.com/apps/flexkeeping)) | Auto-Zuteilung, Übersetzung, Wechselregeln |
| hotelkit (AT) | auf Anfrage | stark in DACH; Klage: kein Offline-Modus, zu viele Klicks |
| Optii | auf Anfrage | ML-Reinigungszeiten; lohnt laut Quelle erst ab ~80 Zimmern |
| RoomChecking | ab 249 € Minimum ([apaleo store](https://store.apaleo.com/apps/roomchecking)) | Punkte-Zuteilung |
| Mews (eigenes HK) | – | meistgewünscht: „Bitte nicht stören“; kein Wäsche-Rhythmus |
| ALICE (Actabl) | ab ca. 900 $ (Drittquelle) | Minuten pro Zimmer → Personalplanung (zweites Produkt) |

## Was in Deutschland Pflicht ist

- E-Rechnungen (XRechnung/ZUGFeRD) empfangen können: Pflicht seit 01.01.2025 ([tageskarte](https://www.tageskarte.io/zahlen/detail/e-rechnungspflicht-ab-2025-was-gastronomen-und-hoteliers-wissen-sollten.html)).
- DATEV-Export für den Steuerberater (orderbird, ready2order, gastronovi, Vectron haben ihn).
- LMIV-Allergene schriftlich dokumentiert, HACCP digital, Server in DE/EU, AVV.
- Kasse bleibt Kasse: Mirepa liest Verkäufe nur, ändert keine Kassendaten (TSE/KassenSichV).

## Lücken, die niemand gut löst (unsere Chance)

1. Küche **und** Housekeeping in einem Werkzeug, mit Kosten je Kostenstelle.
2. Wäschebedarf und -kosten aus der Belegung (gebaut 2026-10-21).
3. Kleine Hotels unter 50 Zimmern: zu teuer oder zu einfach versorgt.
4. E-Rechnung → Preise → Rezeptkosten → DATEV in einem Fluss.
5. Schnelle Einrichtung (häufigste Klage) und offene, feste Preise ohne Einrichtungsgebühr.

## Was Mirepa fehlte und in welcher Reihenfolge es kommt

1. ✅ E-Rechnung (XRechnung, ZUGFeRD) einlesen → Preise aktualisieren, Preissprünge melden (2026-10-21)
2. ✅ DATEV-Export der Lieferantenrechnungen (2026-10-21)
3. ✅ Housekeeping: „Bitte nicht stören“, VIP/Anreisezeit-Priorität, automatische Zuteilung nach Minuten,
   Schadensmeldungen und Fundsachen mit Foto, Minuten pro Zimmer (2026-10-21)
4. Rezepte aus Excel übernehmen (Einrichtung)
5. Offene API (lesend) für Kunden
6. Rechnung per Foto (braucht einen KI-Zugang des Betreibers)
7. Kassen-Anbindung ready2order (öffentliche API; braucht Zugangsdaten eines Kunden zum Testen)

Nicht ohne Partnerzugang machbar: PMS-Anbindung (apaleo, protel, Mews, Opera), Großhandels-Schnittstellen
(Metro, Transgourmet). Werbeaussagen wie „Marktführer“ oder „bester Anbieter“ sind ohne Beleg abmahnfähig (UWG);
wir werben mit belegbaren Fakten.
