# Recon map: Apicbase (Web, plus Mobile-App zum Zählen/Scannen)

Scope: Kernablauf Back-of-House: Zutaten-Bibliothek mit Lieferanten-Gebinden und Preisen,
Rezepte mit Live-Kalkulation (inkl. Unterrezepte, Allergene, Nährwerte), Menüs,
Einkauf (Bestellung, Wareneingang), Lager (Inventur, Schwund, Transfer) pro Standort.
Erweiterungen (POS-Anbindung, Menu Engineering, Produktion/Zentralküche, HACCP) sind
als should/could erfasst.
For: noch offen. Annahme: eigenes Produkt für Gastronomie-Betriebe (1 bis n Standorte).
Bitte bestätigen oder korrigieren.
Date: 2026-10-20

## Wie diese Recon entstanden ist (wichtig)

- Die Apicbase-Domains (`get.`, `support.`, `developers.apicbase.com`) sind in dieser
  Cloud-Umgebung von der Netzwerk-Richtlinie blockiert. Seiten wurden deshalb **nicht
  direkt gelesen**, sondern über Suchmaschinen-Auszüge der Hilfecenter- und
  Entwicklerseiten sowie über Drittquellen. Details sind entsprechend als
  `confidence: medium` markiert, wo nur Snippets vorlagen.
- **Keine Screenshots** in `replica/screens/` – kein Zugriff auf die Seiten, kein
  eigener Account. Bevor `/replica-design` läuft, sollten Screenshots aus öffentlichen
  Quellen (Marketing-Seite, Hilfecenter, Demo-Videos) oder aus einer eigenen Testphase
  nachgezogen werden.
- **Kein Login, kein Account, keine privaten APIs, kein Code des Originals.**
  Nur öffentlich dokumentierte API-Referenz als Hinweis aufs Datenmodell.
- **AGB nicht geprüft:** Die Nutzungsbedingungen waren nicht erreichbar. Falls ein
  Apicbase-Testaccount genutzt wird, vorher prüfen, ob die AGB den Bau eines
  Konkurrenzprodukts mit dem Account untersagen. Bis dahin: nur öffentliche Quellen.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Marketing-Startseite (vom User geliefert) | https://get.apicbase.com/de/ | "F&B Management System for Multi-site"; blockiert, via Suche |
| 2 | Modulübersicht | https://get.apicbase.com/apicbase-modules/ | Module: Rezepte/Menüs, Inventar, Einkauf, Produktion, Analytics, HACCP-Add-on |
| 3 | Plattform | https://get.apicbase.com/platform/ | Positionierung Back-of-House, Multi-Site |
| 4 | Hilfe: Neues Rezept | https://support.apicbase.com/help/create-a-new-recipe | Portionen, Netto-Menge, Tabs Financial/Production, Preise pro Outlet |
| 5 | Hilfe: Unterrezepte | https://support.apicbase.com/help/how-to-use-sub-recipes | Produkttyp "Semi-finished", Nettogewicht |
| 6 | Hilfe: Food-Cost-Berechnung | https://support.apicbase.com/help/food-cost-calculation | Kosten immer pro Portion; Prime Cost = Food + Personal |
| 7 | Hilfe: Zutaten für Food Cost | https://support.apicbase.com/help/filling-out-ingredients-for-food-cost | Gebinde-Hierarchie (150 g → 30x150 g → Lieferantengebinde), netto ohne MwSt. |
| 8 | Hilfe: Gebindegröße | https://support.apicbase.com/help/q-which-package-size-should-i-use-in-an-ingredient | Einheiten-Umrechnung automatisch |
| 9 | Hilfe: Verpackungs-/Preis-Excel | https://support.apicbase.com/help/how-can-i-fill-in-the-apicbase-packaging-and-pricing-file | Einheiten g, mg, kg, ml, cl, l, piece; Preis pro Pack vs. pro Einheit |
| 10 | Hilfe: Gewogene Artikel | https://support.apicbase.com/help/weighted-articles-and-how-to-set-them-up | "Is Weighted", Bestellung nach Gewicht |
| 11 | Hilfe: Dynamic Pricing | https://support.apicbase.com/help/dynamic-pricing | Preisänderungen |
| 12 | Hilfe: Allergene/Nährwerte | https://support.apicbase.com/help/filling-out-allergens-information | Status enthält / Spuren / frei / unbekannt; Nährwerte pro 100 g |
| 13 | Hilfe: Neues Menü | https://support.apicbase.com/help/create-a-new-menu-2 | Gänge, Rezepte pro Gang, Financial-Tab (Preis, Zielmarge, MwSt.) |
| 14 | Hilfe: BoM für Menü | https://support.apicbase.com/help/generate_bom_menu | Stückliste |
| 15 | Hilfe: Ware empfangen | https://support.apicbase.com/help/receive_order | Teillieferungen, Tab "Delivered" |
| 16 | Hilfe: Inventur | https://support.apicbase.com/help/counting-your-inventory | Spalte "This count", "Part"-Button, nicht gezählt = unverändert |
| 17 | Hilfe: Transfer | https://support.apicbase.com/help/transfer-stock | Outlet → Outlet |
| 18 | Hilfe: Schwund | https://support.apicbase.com/help/register_waste | Grund pro Position, Waste Overview |
| 19 | Hilfe: Inventarberichte | https://support.apicbase.com/help/how-to-make-inventory-reports | Bewegungen: rein, raus, Schwund, Zähldifferenz |
| 20 | Hilfe: Lagerbewertung | https://support.apicbase.com/help/how-does-apicbase-manage-your-inventory | Gleitender Durchschnittspreis (WAC) |
| 21 | Hilfe: Sichtbarkeit Zutaten pro Outlet | https://support.apicbase.com/help/how-can-i-manage-the-ingredients-outlet-users-can-see | nur verknüpfte Zutaten pro Outlet |
| 22 | Hilfe: Neues Outlet | https://support.apicbase.com/help/new-outlet | Standort anlegen |
| 23 | Hilfe: POS-Verknüpfung | https://support.apicbase.com/help/linking-pos-data-to-apicbase-data | PLU → Rezept |
| 24 | Hilfe: POS-Import per Excel | https://support.apicbase.com/help/how-to-import-your-pos-connection-using-excel | Analytics > POS Connection > Import |
| 25 | Hilfe: Onboarding-Plan | https://support.apicbase.com/help/self-on-boarding-plan | Reihenfolge der Einrichtung |
| 26 | API-Doku: Outlets | https://developers.apicbase.com/docs/listing-outlets | Library vs. outlet-gebundene Daten |
| 27 | API-Doku: Rezepte/Zutaten/Menüs | https://developers.apicbase.com/docs/getting-recipes-ingredients-menus | |
| 28 | API-Doku: Daten aktuell halten | https://developers.apicbase.com/docs/keeping-data-updated | Rezept-`modified` ändert sich nicht bei Zutatenänderung |
| 29 | API-Doku: Generic POS | https://developers.apicbase.com/docs/generic-pos-api-guide | POS lädt Artikel und Verkäufe hoch |
| 30 | API-Doku: Sortimentsdateien | https://developers.apicbase.com/docs/assortment-files-1 | price_type_code 0/1 |
| 31 | API-Doku: Schwund | https://developers.apicbase.com/docs/recording-waste-events | |
| 32 | OpenAPI-Spiegel (Drittanbieter) | https://github.com/api-evangelist/apicbase | Feldnamen Ingredient, Recipe, StockItem, PurchaseOrder, Supplier, Outlet; unverifiziert |
| 33 | Pricing (Drittquellen) | https://apis.io/plans/apicbase/apicbase-plans-pricing/ , https://toolradar.com/tools/apicbase/pricing | Sales-led, pro Outlet + Module; ~160 $/Monat Einstieg (unbestätigt) |
| 34 | Review (Drittanbieter) | https://restauranttools.ai/tools/apicbase | Growth-Plan ab 5 Outlets, HACCP-Add-on |
| 35 | Lager/Einkauf-Marketing | https://get.apicbase.com/procurement-management/ , https://get.apicbase.com/stock-taking-app/ | Bestellvorschläge, Par-Level, 3-Way-Match, Barcode/Sprachzählung |
| 36 | Menu Engineering | https://get.apicbase.com/menu-engineering/ | Beliebtheit × Marge Matrix |
| 37 | G2 Reviews | https://g2.com/products/https-get-apicbase-com/reviews | für /replica-entrepreneur |

Nicht gefunden: öffentliches Changelog, App-Store-Listing der Mobile-App, AGB.

## Core loop

Ein Küchenchef pflegt Zutaten mit echten Lieferantenpreisen, baut daraus Rezepte und
Menüs und sieht sofort Wareneinsatz und Marge pro Portion – und dieselben Daten treiben
Bestellung, Wareneingang und Inventur an jedem Standort.

## Screens

Routen sind geschätzt (Original nicht einsehbar). States: alle Listen brauchen empty,
loading, filled, error; Formulare zusätzlich validation-error und saving.

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Login | /login | Anmeldung | Form, SSO-Button? | default, error |
| S02 | Dashboard | / | Einstieg, KPIs (Food Cost %, offene Bestellungen, Lagerwert) | Stat-Tiles, Listen | empty (neues Konto), filled |
| S03 | Zutatenliste | Library > Ingredients | Bibliothek durchsuchen/filtern | Tabelle, Suche, Filter (Kategorie, Lieferant, Allergen geprüft), Bulk-Aktionen, Import | empty, filled, filtered-empty |
| S04 | Zutat-Detail | S03 > Zeile | Zutat pflegen | Tabs: Allgemein, Gebinde & Preise, Lieferanten, Allergene, Nährwerte, Outlets | new, filled, error |
| S05 | Rezeptliste | Library > Recipes | Rezepte finden | Tabelle mit Kosten/Portion, Food-Cost-%, Kategorie | empty, filled |
| S06 | Rezept-Editor | S05 > Neu / Zeile | Rezept bauen und kalkulieren | Zutatenzeilen (Zutat/Unterrezept, Menge, Einheit), Portionen, Nettomenge, Produkttyp, Tabs: Zubereitung, Financial, Allergene & Nährwerte, Production | new, filled, Zutat ohne Preis (Warnung) |
| S07 | Menüliste | Library > Menus | Menüs verwalten | Tabelle | empty, filled |
| S08 | Menü-Editor | S07 > Neu | Menü aus Gängen bauen | Gänge, Rezept-Autocomplete, Financial-Tab (Preis, Zielmarge, MwSt.) | new, filled, Marge unter Ziel |
| S09 | Labels & BoM | S06/S08 > Aktion | Allergen-/Nährwertlabel, Stückliste drucken | Druckvorschau, Export | default |
| S10 | Lieferantenliste | Procurement > Suppliers | Lieferanten verwalten | Tabelle | empty, filled |
| S11 | Lieferant-Detail | S10 > Zeile | Kontakt, Sortiment, Bestellweg | Formular, Sortimentstabelle (Artikel, Gebinde, Preis, GTIN), Import | new, filled |
| S12 | Bestellungen | Procurement > Orders | Übersicht pro Outlet | Tabs Entwurf / Bestellt / Geliefert, Outlet-Switch | empty, filled |
| S13 | Neue Bestellung | S12 > Neu | Bestellung pro Lieferant | Artikelauswahl, Vorschlag aus Par-Level/Bestand, Mengen, Senden (E-Mail) | draft, sent, error |
| S14 | Wareneingang | S12 > Bestellung > Empfangen | Lieferung erfassen | Positionen mit bestellt/geliefert, Teillieferung, "zu Lager buchen"-Checkbox | partial, complete |
| S15 | Rechnungsabgleich | S12 > Bestellung > Rechnung | 3-Way-Match | Bestellung / Lieferschein / Rechnung nebeneinander, Abweichungen | match, mismatch |
| S16 | Lagerübersicht | Inventory > Stock | Bestand und Wert pro Outlet | Outlet-Switch, Tabelle, Bericht erzeugen | empty, filled |
| S17 | Inventur | Inventory > Count | Zählen | Zählliste, "This count", "Part"-Button, Barcode-Scan (mobil) | open, saved, mobile |
| S18 | Transfer | Inventory > Transfer | Ware zwischen Outlets | Von/Nach-Outlet, Positionen | new, saved |
| S19 | Schwund | Inventory > Waste | Verlust buchen | Positionen, Grund pro Position, Waste Overview | new, overview |
| S20 | Lagerberichte | Inventory > Stock > Report | Bewegungen, Bewertung | Berichtstabelle (rein/raus/Schwund/Zähldifferenz), Export | default |
| S21 | POS-Verknüpfung | Analytics > POS Connection | PLU → Rezept mappen | Tabelle, Import per Excel, "ignorieren" | unmapped, mapped |
| S22 | Menu Engineering | Analytics > Menu Engineering | Beliebtheit × Marge | Matrix-Chart, Tabelle pro Kategorie | no sales, filled |
| S23 | Produktionsplanung | Production | Zentralküche: Aufträge, Plan | Kalender/Liste, Chargen | empty, filled |
| S24 | Einstellungen Bibliothek | Settings | MwSt., Kategorien, Löhne, Einheiten | Formulare | default |
| S25 | Outlets & Benutzer | Settings > Outlets / Users | Standorte, Einladungen, Rollen | Tabellen, Einladungsdialog | empty, filled |
| S26 | Excel-Import | S03/S11 > Import | Gebinde/Preise in Masse | Vorlage-Download, Upload, Fehlerliste | errors, success |
| S27 | HACCP-Checklisten | HACCP (Add-on) | Aufgaben, Kontrollpunkte, Audit | Checkliste, Plan | — (nur Marketing) |

## Flows

```
F01 Zutat mit Lieferantenpreis anlegen
    S03 -> S04 (Allgemein -> Gebinde -> Lieferantengebinde mit Preis) -> speichern
    happy path clicks: ~9
    edge: verschachtelte Gebinde (30x150 g), Preis pro Einheit statt pro Pack,
          gewogener Artikel, Einheit "Stück" ohne Gewicht, Duplikat-Zutat (Merge)

F02 Rezept anlegen und Wareneinsatz sehen
    S05 -> S06 (Name, Portionen, Zutatenzeilen, Financial: VK-Preis) -> speichern
    happy path clicks: ~6 + 2 pro Zutat
    edge: Zutat ohne Preis, inkompatible Einheit (Stück vs. g), VK mit/ohne MwSt.,
          Outlet-spezifischer Preis

F03 Unterrezept verwenden
    S06 (Produkttyp Semi-finished, Nettomenge) -> anderes Rezept in S06 -> Unterrezept als Zeile
    edge: Nettomenge fehlt (Summe der Zutaten wird genommen), Zyklus A->B->A

F04 Preisänderung schlägt durch
    S04 Preis ändern -> S05/S06/S08 zeigen neue Kosten/Marge
    edge: mehrere Ebenen Unterrezepte, Menüs unter Zielmarge

F05 Menü bauen und Marge prüfen
    S07 -> S08 (Gänge, Rezepte, Financial) -> S09 Label drucken
    happy path clicks: ~8

F06 Bestellen
    S12 -> S13 (Lieferant, Vorschlag aus Par-Level, Mengen anpassen) -> senden
    happy path clicks: ~5
    edge: kein E-Mail beim Lieferanten, Mindestbestellwert, Zutat nicht im Outlet sichtbar

F07 Ware empfangen
    S12 -> Bestellung -> S14 (gelieferte Mengen) -> abschließen
    edge: Teillieferung (Bestellung bleibt offen), Ersatzartikel, Inventur dazwischen
          (Checkbox: nicht doppelt buchen), gewogene Menge

F08 Inventur
    S16 -> S17 (zählen, Teilgebinde, speichern, abschließen)
    edge: nicht gezählt = unverändert, parallele Ereignisse während offener Zählung,
          POS-Verkäufe während Zählung, mobil per Barcode

F09 Schwund buchen          S19 -> Positionen + Grund -> speichern
F10 Transfer zwischen Outlets  S18 -> Von/Nach -> Positionen -> speichern  (Wert = WAC des Senders)
F11 POS-Verkäufe verknüpfen   S21 -> PLU -> Rezept -> Verkäufe ziehen Lager ab -> S22
F12 Rechnung abgleichen       S12 -> S15 -> Abweichungen klären
F13 Zentralküche              Outlet bestellt bei CPU -> S23 Plan -> Produktion bucht Rohware ab, Fertigware zu
```

Klickzahlen sind geschätzt, nicht gemessen.

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, hover, focus, disabled, loading | alle |
| Datentabelle | sortierbar, auswählbar (Bulk), editierbare Zellen | loading, empty, filtered-empty, error | S03, S05, S07, S10–S22 |
| Suche + Filterleiste | Chips, Dropdowns | aktiv, leer | Listen |
| Tabs | horizontal | aktiv, mit Warnbadge | S04, S06, S08 |
| Zeilen-Editor (Mengenzeilen) | Zutat/Unterrezept, Menge, Einheit | ungültige Einheit, fehlender Preis | S06, S08, S13, S14, S17–S19 |
| Autocomplete / Combobox | Zutat, Rezept, Lieferant | lädt, keine Treffer, "neu anlegen" | S06, S08, S13 |
| Einheiten-Eingabe | Zahl + Einheit (g, kg, ml, cl, l, Stück) | invalid | überall |
| Geld-/Prozentfeld | netto/brutto, % | invalid | S04, S06, S08 |
| Allergen-Matrix | 14 EU-Allergene × Status (enthält/Spuren/frei/unbekannt) | geerbt, manuell | S04, S06, S09 |
| Nährwerttabelle | pro 100 g / pro Portion | berechnet | S04, S06, S09 |
| Outlet-Switch | Dropdown im Header | ein/mehrere Outlets | S12–S22 |
| Stat-Tile | Wert, Delta | — | S02, S06, S08 |
| Statusbadge | Entwurf, bestellt, teilweise, geliefert | — | S12, S14 |
| Modal / Bestätigungsdialog | info, danger | — | Löschen, Abschließen |
| Toast | success, error | — | alle |
| Datei-Upload + Fehlerliste | Excel | uploading, errors | S26, S21 |
| Druck-/Labelansicht | Label, BoM | — | S09 |
| Chart | Matrix (Scatter in 4 Quadranten) | keine Daten | S22 |
| App-Shell | Sidebar-Navigation, Header mit Outlet-Switch, Usermenü | collapsed, mobil | alle |

## Inferred data model

```
Library        id, name, currency, default_vat, wage_per_hour
               evidence: Quelle 26 ("recipes, ingredients, menus belong to the library"), 4 (Löhne in Library-Settings)
               confidence: high

Outlet         id, library_id, name, custom_fields(json)
               evidence: 26, OpenAPI Outlet
               confidence: high

User / Membership  user_id, library_id, role, outlet_ids[]
               evidence: Sichtbarkeit pro Outlet (21); Rollen nicht gefunden
               confidence: guess

Ingredient     id, library_id, name, short_name, internal_uid, category, subcategory,
               allergen_verified, conversion_ratio, shelf_life, approved, in_use,
               created_at, modified_at
               evidence: OpenAPI Ingredient (32), S04
               confidence: high (Felder), medium (Bedeutung conversion_ratio: wohl Stück→Gewicht)

Package        id, ingredient_id, quantity, unit (g|mg|kg|ml|cl|l|piece), parent_package_id, count
               evidence: 7 (150 g → 30x150 g), 9
               confidence: medium

StockItem      id, ingredient_id, supplier_id, package_id, name, price, price_type (per_pack|per_unit),
               price_unit, gtin, stockable, weighted, modified_at
               (= Lieferantenartikel / Bestelleinheit)
               evidence: OpenAPI StockItem, 10, 30
               confidence: medium

IngredientAllergen  ingredient_id, allergen, status (contains|may_contain|free|unknown)
               evidence: 12
               confidence: high

Nutrition      owner (ingredient), per_100g: energy_kcal, fat, sat_fat, carbs, sugar, protein, salt, fibre, ...
               evidence: 12
               confidence: high (pro 100 g), guess (Feldliste = EU-LMIV-Pflichtangaben)

Recipe         id, library_id, uid, name, category, product_type (finished|semi_finished),
               portions, net_quantity, net_unit, sell_price, sell_price_incl_vat(bool), vat_rate,
               prep_time_minutes, instructions, extra_allergens, created_at
               evidence: OpenAPI Recipe, 4, 5, 6
               confidence: high

RecipeLine     id, recipe_id, ingredient_id | sub_recipe_id, quantity, unit, position
               evidence: 4, 5
               confidence: high

RecipeOutletPrice  recipe_id, outlet_id, sell_price
               evidence: 4 ("per-outlet prices")
               confidence: medium

Menu           id, library_id, name, price, target_margin, vat_rate
MenuCourse     id, menu_id, name, position
MenuItem       course_id, recipe_id
               evidence: 13
               confidence: high

OutletIngredient  outlet_id, ingredient_id (Sichtbarkeit), par_level, min_level
               evidence: 21, 35 (Par-Level, Mindestbestand)
               confidence: medium

Supplier       id, library_id, company_name, email, vat_number, order_method, lead_time_days
               evidence: OpenAPI Supplier; lead time aus 35
               confidence: medium

PurchaseOrder  id, order_number, supplier_id, outlet_id, status (draft|ordered|partially_delivered|delivered),
               ordered_on, expected_delivery_date, discount
POLine         id, po_id, stock_item_id, quantity, unit_price
               evidence: OpenAPI PurchaseOrder, 15
               confidence: high (Kopf), medium (Status-Werte)

Delivery       id, po_id, received_at, add_to_stock(bool)
DeliveryLine   delivery_id, po_line_id, quantity_received, weight
               evidence: 15
               confidence: medium

Invoice        id, po_id, supplier_id, number, total, file, match_status
               evidence: 35 (3-Way-Match)
               confidence: guess

StockEvent     id, outlet_id, type (count|waste|transfer_in|transfer_out|delivery|sale|production),
               occurred_at, reason, related_outlet_id, status (open|closed)
StockMovement  event_id, stock_item_id, quantity, unit_cost
StockLevel     outlet_id, stock_item_id, quantity, avg_cost (WAC)
               evidence: 16–20, API "stock events such as waste, production, sales, transfers, and counts"
               confidence: high (Typen), medium (Struktur)

PosItem        id, outlet_id, plu, name, recipe_id | null, ignored(bool)
Sale           id, outlet_id, pos_item_id, quantity, revenue, sold_at
               evidence: 23, 24, 29
               confidence: high

ProductionOrder  id, cpu_outlet_id, requesting_outlet_id, recipe_id, quantity, planned_for, batch_no
               evidence: Drittquelle 34
               confidence: guess
```

Relationships: Library 1-n Outlet, Library 1-n Ingredient/Recipe/Menu/Supplier,
Ingredient 1-n Package 1-n StockItem n-1 Supplier, Recipe 1-n RecipeLine
(→ Ingredient oder Recipe), Menu 1-n Course n-n Recipe, Outlet n-n Ingredient (Sichtbarkeit),
Outlet 1-n PurchaseOrder 1-n POLine, PurchaseOrder 1-n Delivery, Outlet 1-n StockEvent 1-n StockMovement,
Outlet 1-n PosItem n-1 Recipe, PosItem 1-n Sale.

Kernregeln, die das Modell tragen muss:
- Kosten einer Rezeptzeile = Menge (umgerechnet) × günstigster/bevorzugter Preis pro Basiseinheit;
  Unterrezepte rekursiv über `net_quantity`; Anzeige immer pro Portion.
- Allergene = Vereinigung der Zutaten (stärkster Status gewinnt) + extra_allergens.
- Lagerwert = WAC; Transfer übernimmt Kosten des Senders; nicht gezählte Positionen bleiben.

## Feature matrix

See `features.csv`. Must: 21, should: 15, could: 9, skip: 5.

## Out of scope (cannot or should not be cloned)

- Marke, Logo, Texte, Hilfecenter-Inhalte und Screenshots von Apicbase.
- Partnernetzwerk: fertige POS-Integrationen (Lightspeed, Deliverect, HubRise, …) und
  Lieferanten-Kataloge/EDI-Anbindungen. Selbst nachbaubar ist nur ein eigener generischer
  POS-Import (CSV/API) und später Integrationen über offizielle APIs der jeweiligen Anbieter.
- Lizenzierte Allergen-/Nährwertdatenbanken der Lieferanten (Stammdaten bleiben Kundendaten).
- Die Kundendaten und Rezeptbibliotheken der Apicbase-Kunden.
- Rechtliche Zusagen zur Allergenkennzeichnung (LMIV): die Software rechnet, die Haftung
  bleibt beim Betrieb – muss im Produkt klar kommuniziert werden.

## Size

Screens 27, flows 13, entities ~22. Hard parts:
1. Einheiten-/Gebinde-Umrechnung und rekursive Kostenberechnung über Unterrezepte,
   inkl. Neuberechnung bei Preisänderungen.
2. Lager als Ereignis-Ledger pro Outlet mit WAC, Teillieferungen, offenen Zählungen und
   POS-Abzug bis auf Rohware.
3. POS-Anbindung und Menu Engineering (Datenimport, PLU-Mapping, Zeitreihen).
Weitere: Allergen-/Nährwert-Ableitung korrekt nach EU-Regeln, Excel-Massenimport,
Mobile-Zählen mit Barcode, Mandanten-/Rollenmodell.

Size: **L** (ein Quartal) für must + should. Nur die must-Zeilen (Bibliothek, Kalkulation,
Einkauf, Inventur, 1 Mandant mit mehreren Outlets): **M** (einige Wochen).
