# Architektur: Arbeitstitel „Kitchen Ledger“ (Nachbau der Kernfunktionen von Apicbase)

Grundlage: `replica/recon.md` und `replica/features.csv` (2026-10-20).
Offene Annahme aus der Recon: Web-App für Gastronomie-Betriebe mit 1 bis n Outlets.
Der Name ist ein Platzhalter bis `/replica-brand`.

## Stack

Kein bestehender Stack vorgegeben, daher die Standardwahl: alles gemanagt, gut dokumentiert,
günstig bei null Nutzern. Eine Datenbank, ein Deployment, keine Microservices.

| layer | choice | why |
| --- | --- | --- |
| web | Next.js (App Router) + TypeScript | Server Actions für Formulare, Route Handlers für die POS-API, ein Repo |
| styling | Tailwind + Tokens aus `/replica-design` | schnelle, konsistente Tabellen- und Formular-UI |
| tables/forms | TanStack Table, React Hook Form + Zod | das Produkt besteht zu 80 % aus Tabellen und Mengenzeilen; Zod-Schemas gelten auch serverseitig |
| mobile | zuerst PWA (Inventur-Ansicht mobil, Barcode via `BarcodeDetector` mit ZXing-Fallback), Expo erst wenn nötig | Zählen ist der einzige mobile Ablauf; eine zweite Codebasis lohnt sich anfangs nicht |
| database | Postgres auf Supabase | RLS für Mandanten/Outlets, Trigger für das Lager-Ledger, rekursive CTEs für Unterrezepte |
| DB-Zugriff | postgres.js (geändert, war Drizzle) | Migrationen sind SQL; jede Anfrage läuft als Rolle `authenticated`, damit RLS greift. Siehe `replica/backend.md` |
| auth | Supabase Auth (E-Mail + Passwort, Magic Link, optional Google) | gleiche `auth.uid()` wie in den RLS-Policies |
| payments | Stripe Billing, Preis pro Outlet (Mengenabo) | Original rechnet pro Outlet + Modul ab; Mengen = aktive Outlets |
| email | Resend (Bestellungen an Lieferanten, Einladungen) + eigene Absender-Domain mit SPF/DKIM | Bestell-Mails müssen zuverlässig ankommen |
| jobs | Vercel Cron (geändert, war Inngest) | nur zwei tägliche Jobs; Kosten werden live berechnet, Neuberechnungs-Jobs entfallen. Retries über `job_runs` |
| files | Supabase Storage | Excel-Importe, Rechnungs-PDFs, Label-PDFs |
| excel | SheetJS (`xlsx`) serverseitig | Import/Export der Preis- und POS-Vorlagen |
| pdf/labels | React-PDF | Allergen-/Nährwertlabel, Bestell-PDF |
| hosting | Vercel (Region `fra1`) + Supabase EU (Frankfurt) | Kunden in DE/EU, DSGVO; Daten bleiben in der EU |
| monitoring | Sentry + Supabase Logs | Fehler in Importen und Jobs sichtbar machen |

## Schema

Tables: 33 (siehe `web/supabase/migrations/0001_schema.sql`, Migration 0001). Access rules: **Postgres RLS** (Supabase).
Geprüft gegen Postgres 16 mit Testdaten (`web/supabase/schema.smoke.sql`): Zyklus-Sperre,
gleitender Durchschnittspreis (WAC), Ledger nur anhängend, Idempotenz, eine offene
Inventur pro Outlet, Outlet-Abgleich und RLS-Isolation zwischen Mandanten und Outlets.

Gruppen:

| Bereich | Tabellen |
| --- | --- |
| Mandant & Zugriff | libraries, outlets, memberships, membership_outlets, invitations, api_keys |
| Bibliothek | categories, ingredients, packages, suppliers, stock_items, stock_item_price_history, ingredient_allergens, ingredient_nutrition |
| Rezepte & Menüs | recipes, recipe_lines, recipe_outlet_prices, recipe_extra_allergens, recipe_costs (Cache), menus, menu_courses, menu_items |
| Outlet-Betrieb | outlet_ingredients, purchase_orders, purchase_order_lines, invoices, stock_events, stock_movements, stock_levels |
| POS | pos_items, sales |
| Technik | imports, processed_webhooks |

Entscheidungen, die vom Skill-Standard abweichen oder ihn konkretisieren:

- **Besitzerspalte heißt `library_id`** (= org). Die Bibliothek ist der Mandant. Rezepte, Zutaten
  und Menüs gehören der Bibliothek, Lagerdaten dem Outlet – genau wie im Original (Recon, Quelle 26).
- **Geld:** Was ein Mensch eintippt (Packungspreis, VK, Rechnung), ist `integer` Cent. Abgeleitete
  Kosten pro Gramm/ml (WAC, Kosten pro Basiseinheit) sind `numeric` Cent, weil 0,3 ct/g nicht als
  Integer darstellbar ist. Gerundet wird erst bei der Anzeige. Währung pro Bibliothek.
- **Mengen** liegen immer in der Basiseinheit der Zutat (`g`, `ml`, `piece`). Umrechnung Stück↔g über
  `grams_per_piece`, g↔ml über `ml_per_gram`. Rezeptzeilen speichern die Einheit, die der Nutzer gewählt hat.
- **MwSt. und Zielwerte** als Basispunkte (`700` = 7 %), damit keine Float-Prozente.
- **Lager = Ledger:** `stock_events` (Kopf) + `stock_movements` (append-only) → `stock_levels`
  wird im selben Statement vom Trigger gepflegt (Zeilensperre, WAC). Korrekturen sind neue Ereignisse.
- **Negativer Bestand ist erlaubt** (Verkäufe vor der Lieferung erfasst); Berichte markieren ihn.
- **`recipe_costs` ist ein Cache**, nie die Quelle der Wahrheit. Die Wahrheit wird bei jedem Öffnen
  eines Rezepts live berechnet; der Cache dient Listen und Menu Engineering.
- **Rollen:** owner, admin, chef (Bibliothek bearbeiten), outlet_staff (nur zugewiesene Outlets:
  bestellen, empfangen, zählen, Schwund). Das Rollenmodell des Originals war nicht belegbar (Recon: guess).
- **Löschen:** Bibliotheksdaten werden archiviert (`archived_at`), nicht gelöscht, weil Bestellungen
  und Lagerbewegungen darauf zeigen (`on delete restrict`). Löschen eines Mandanten kaskadiert komplett.

Nicht in Migration 0001 (could-Features, eigene Migrationen später): Produktionsaufträge/Chargen der
Zentralküche, HACCP-Checklisten, Nutri-Score-Cache.

## API

Server Actions für alles aus der UI (Auth über die Supabase-Session, RLS greift). Route Handlers
nur für Dateien, öffentliche API und Webhooks. „Wer“: owner/admin = A, chef = C, outlet_staff = S
(nur eigene Outlets), API-Key = K. Jede Action validiert die Eingabe mit Zod.

### Onboarding & Zugriff (S01, S24, S25)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `signUp` | Konto + erste Bibliothek + erstes Outlet + owner-Membership | anon | email, password, library name, outlet name | session | — |
| action `updateLibrarySettings` | Währung, MwSt.-Standard, Stundenlohn | A | Zod `LibrarySettings` | library | — |
| action `createOutlet` / `archiveOutlet` | Outlet anlegen/archivieren, Stripe-Menge anpassen | A | name, timezone | outlet | — |
| action `inviteUser` | Einladung (Token-Hash), Mail via Resend | A | email, role, outlet_ids | invitation | — |
| GET `/invite/[token]` | Einladung annehmen → Membership | anon/eingeloggt | token | redirect | — |
| action `updateMembership` / `removeMember` | Rolle, Outlets | A | membership_id, role, outlet_ids | membership | — |

### Bibliothek: Zutaten, Gebinde, Lieferanten (S03, S04, S10, S11, S26) – F01

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| RSC `/ingredients` | Liste, Suche (tsvector), Filter Kategorie/Lieferant/Allergen geprüft, Paginierung | alle | q, filters, cursor | rows | F01 |
| action `createIngredient` / `updateIngredient` | Stammdaten, Basiseinheit, Umrechnungen | A, C | Zod `Ingredient` | ingredient | F01 |
| action `upsertPackage` / `deletePackage` | Gebinde-Hierarchie (150 g → 30x150 g) | A, C | ingredient_id, parent, count, quantity | package | F01 |
| action `upsertStockItem` | Lieferantenartikel mit Preis (pro Pack/pro Einheit), GTIN, bevorzugt; schreibt Preis-Historie; sendet Event `price.changed` | A, C | Zod `StockItem` | stock_item | F01, F04 |
| action `setAllergens` | 14 Allergene × Status | A, C | ingredient_id, map | ok + Event `allergen.changed` | F01 |
| action `setNutrition` | Nährwerte pro 100 g | A, C | ingredient_id, values | ok | — |
| action `mergeIngredients` | Duplikate zusammenführen (Zeilen umhängen, Quelle archivieren) | A, C | keep_id, merge_ids | ingredient | F01 edge |
| action `setOutletVisibility` | Zutat in Outlets sichtbar, Par-/Mindestbestand | A, C | ingredient_id, outlet settings | ok | F06 |
| RSC `/suppliers`, action `upsertSupplier` | Lieferanten | A, C | Zod `Supplier` | supplier | F06 |
| GET `/api/templates/prices.xlsx` | Leere Importvorlage | alle | — | xlsx | — |
| POST `/api/imports` | Excel hochladen → `imports` + Event `import.requested` | A, C | multipart file, kind | import id | — |
| RSC `/imports/[id]` | Fortschritt, Fehler pro Zeile | A, C | id | import | — |

### Rezepte & Menüs (S05–S09) – F02–F05

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| RSC `/recipes` | Liste mit Kosten/Portion, Food-Cost-% (aus `recipe_costs`) | alle | q, filters | rows | F02 |
| action `saveRecipe` | Kopf + alle Zeilen in einer Transaktion (Zyklus-Trigger), danach Neuberechnung dieses Rezepts synchron, Eltern asynchron | A, C | Zod `Recipe` mit lines[] | recipe + cost | F02, F03 |
| action `previewRecipeCost` | Kosten live während der Eingabe, ohne Speichern | A, C | lines[], portions, net | cost breakdown, Warnungen (fehlender Preis, Einheit unvereinbar) | F02 |
| action `setOutletPrice` | VK pro Outlet | A, C | recipe_id, outlet_id, price | ok | F02 |
| action `cloneRecipe` / `archiveRecipe` | | A, C | id | recipe | — |
| RSC `/recipes/[id]/allergens` | abgeleitete Allergene + Nährwerte pro Portion | alle | id | matrix | F02 |
| RSC `/menus`, action `saveMenu` | Menü mit Gängen und Rezepten, Zielmarge | A, C | Zod `Menu` | menu + Marge | F05 |
| GET `/api/recipes/[id]/label.pdf` | Allergen-/Nährwertlabel | alle | id, outlet? | pdf | F05 |
| GET `/api/menus/[id]/bom.xlsx` | Stückliste (Zutaten summiert über alle Ebenen) | alle | id, portions | xlsx | F05 |

### Einkauf (S12–S15) – F06, F07, F12

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| RSC `/outlets/[o]/orders` | Tabs Entwurf/Bestellt/Geliefert | S | outlet, status | rows | F06 |
| action `suggestOrder` | Vorschlag: max(0, Par − Bestand − offene Bestellmengen), in Packs aufgerundet, gruppiert nach bevorzugtem Lieferanten | S | outlet_id, supplier_id? | draft lines | F06 |
| action `saveOrderDraft` | Entwurf mit Zeilen; Preise werden eingefroren | S | Zod `PurchaseOrder` | po | F06 |
| action `sendOrder` | Status → ordered, Bestellnummer, PDF, Mail an `order_email` via Resend (Idempotenz-Key = po.id) | S | po_id | po | F06 |
| action `receiveDelivery` | Liefermengen (Teil-/Komplett), optional ohne Lagerbuchung, gewogene Mengen; erzeugt `delivery`-Event mit Bewegungen zu Packungspreis/Basismenge; Status → partially_delivered/delivered | S | po_id, lines[], add_to_stock | po + event | F07 |
| action `uploadInvoice` / `matchInvoice` | Rechnung (PDF) anhängen, Summen gegen Bestellung und Lieferung prüfen | A, C | file, po_id, number, total | invoice + Abweichungen | F12 (could) |

### Lager (S16–S20) – F08–F10

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| RSC `/outlets/[o]/stock` | Bestand + Wert (quantity × WAC), negative Bestände markiert | S | outlet | rows | F08 |
| action `startCount` | offenes Count-Event (eindeutiger Index verhindert ein zweites) + Zählliste aus sichtbaren Zutaten | S | outlet_id, list? | event | F08 |
| action `saveCountLines` | Zwischenstand speichern (Packs + Teilmengen → Basiseinheit), mehrfach aufrufbar, auch mobil | S | event_id, lines[] | ok | F08 |
| action `closeCount` | pro gezählter Zutat Bewegung `delta = gezählt − Bestand`; nicht gezählte bleiben unverändert | S | event_id | event + Differenzen | F08 |
| action `recordWaste` | Schwund-Event mit Grund pro Position | S | outlet_id, lines[] | event | F09 |
| action `recordTransfer` | Ein Event, zwei Bewegungen: Sender −x zum Sender-WAC, Empfänger +x mit demselben Kostensatz | S (beide Outlets) | from, to, lines[] | event | F10 |
| GET `/api/outlets/[o]/stock-report.xlsx` | Bewegungen pro Zeitraum: rein, raus, Schwund, Zähldifferenz, Anfangs-/Endwert | S | from, to | xlsx | F08 |

### POS & Analytics (S02, S21, S22) – F11

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| POST `/api/v1/pos/items` | POS lädt Artikel (PLU) hoch, Upsert | K (Outlet-Key) | [{plu, name}] | counts | F11 |
| POST `/api/v1/pos/sales` | Verkaufszeilen, idempotent über `(outlet_id, external_id)`; Event `sales.received` | K | [{external_id, plu, qty, revenue_net, sold_at}] | accepted/duplicates | F11 |
| POST `/api/imports` (kind `sales`/`pos_links`) | dasselbe per CSV/Excel | A, C | file | import id | F11 |
| action `linkPosItem` / `ignorePosItem` | PLU → Rezept | A, C | pos_item_id, recipe_id | ok | F11 |
| RSC `/analytics/menu-engineering` | Beliebtheit × Marge pro Kategorie, Zeitraum | A, C | outlet?, from, to | matrix | F11 (could) |
| RSC `/` (Dashboard) | Food-Cost-%, Lagerwert, offene Bestellungen, ungemappte PLUs | alle | outlet? | tiles | — |

### Öffentliche REST-API (could)

`/api/v1/ingredients`, `/recipes`, `/stock-levels` (GET, Key-Auth, Cursor-Paginierung). Erst nach den should-Features.

### Webhooks & Jobs

Webhooks in:
- `POST /api/webhooks/stripe` – `customer.subscription.*`, `invoice.payment_failed` → `libraries.plan`. Signatur prüfen, `processed_webhooks` gegen Doppelzustellung.
- `POST /api/webhooks/resend` – Bounce/Complaint → Lieferanten-Mail als ungültig markieren, Bestellung als „nicht zugestellt“ zeigen.

Webhooks out: keine in v1 (später: `stock.below_min`, `order.sent` für Kunden-Integrationen).

Jobs (Inngest):

| name | trigger | does |
| --- | --- | --- |
| `recost-dependents` | Event `price.changed`, `recipe.saved`, `allergen.changed` | alle Rezepte finden, die (rekursiv) die Zutat/das Rezept enthalten, `recipe_costs` neu schreiben; entprellt pro Bibliothek (5 s) |
| `process-import` | Event `import.requested` | Excel zeilenweise validieren, in Batches schreiben, Fehler je Zeile in `imports.errors` |
| `deplete-sales` | Event `sales.received` + Cron alle 15 min | Verkäufe ohne `depleted_event_id` pro Outlet und Stunde bündeln, Rezept-BoM (rekursiv bis Rohware) abziehen, ein `sale`-Event mit Idempotenz-Key `outlet:hour` |
| `min-stock-alert` | Cron täglich 06:00 Outlet-Zeit | Zutaten unter Mindestbestand → E-Mail an Outlet-Staff |
| `expire-invitations` | Cron täglich | abgelaufene Einladungen löschen |
| `stripe-sync-quantity` | Event `outlet.changed` | Abo-Menge = aktive Outlets |

## The parts that bite

- **Einheiten & Rundung:** Alle Rechnungen in Basiseinheit mit `numeric`, gerundet nur bei der Anzeige. Stück-Zutaten ohne `grams_per_piece` in g-Rezepten sind ein Fehler, der sichtbar gemacht wird, kein stilles 0 €.
- **Unterrezepte:** Kosten pro Basiseinheit eines Unterrezepts = Gesamtkosten / `net_quantity_base` (Fallback: Summe der Zeilen, wie im Original). Zyklen verhindert der Trigger; Tiefe begrenzen (z. B. 10 Ebenen).
- **Neuberechnung bei Preisänderung:** Ein Preis kann hunderte Rezepte über mehrere Ebenen betreffen → Job, entprellt; die Detailansicht rechnet immer live, damit nie ein veralteter Cache angezeigt wird.
- **Races im Lager:** `stock_levels` wird per Zeilensperre im Trigger aktualisiert; eine offene Inventur pro Outlet erzwingt der eindeutige Index. Bewegungen während offener Inventur werden in der UI gewarnt (Original empfiehlt dasselbe); beim Abschluss zählt der Bestand zum Abschlusszeitpunkt.
- **Idempotenz:** POS-Verkäufe über `(outlet_id, external_id)`, Abzugs-Events über `idempotency_key`, Stripe/Resend über `processed_webhooks`, Bestell-Mails über den Resend-Idempotenz-Key. Doppelklick auf „Bestellung senden“ ändert den Status nur von `draft`.
- **Zeitzonen:** alles in UTC; Outlet hat `timezone` für Tagesgrenzen (Berichte, Verkäufe pro Tag, Cron 06:00). Sommerzeitwechsel: Tagesgrenzen über `AT TIME ZONE` berechnen, nie +1h rechnen.
- **Mandantentrennung:** RLS auf jeder Tabelle, Hilfsfunktionen `is_member`, `has_role`, `can_access_outlet`. Service-Role nur in Jobs und Webhooks, nie im Browser. Jede neue Tabelle braucht eine Policy (CI-Check: keine Tabelle ohne RLS).
- **RLS-Performance:** Policies rufen `security definer`-Funktionen auf; Indizes auf `memberships(user_id)`, `membership_outlets(outlet_id)` sind gesetzt. Große Listen trotzdem mit `explain analyze` prüfen.
- **Allergene sind haftungsrelevant (LMIV):** Status `unknown` ist ansteckend und wird überall rot angezeigt; Labels tragen einen Hinweis, dass der Betrieb die Angaben verantwortet.
- **Excel-Importe:** Dateigröße begrenzen (10 MB), Zeilen in Batches, Lieferantenname muss exakt passen (wie im Original), Fehlerliste statt Abbruch.
- **Suche:** `tsvector` mit Konfiguration `simple` (Zutatennamen sind mehrsprachig); später `pg_trgm` für Tippfehler.
- **E-Mail-Zustellbarkeit:** Bestellungen gehen an Lieferanten-Postfächer → eigene Absender-Domain, SPF/DKIM/DMARC, Reply-To = Outlet.
- **DSGVO:** Daten in der EU (Supabase Frankfurt, Vercel fra1). Löschen eines Nutzers entfernt Membership; `created_by` wird `null`. Löschen eines Mandanten kaskadiert. AV-Vertrag als Vorlage für Kunden.
- **Offline:** v1 nicht offline. Inventur speichert Zwischenstände häufig (`saveCountLines`), damit ein Funkloch im Kühlhaus nur Sekunden kostet; Offline-Queue erst mit Expo.
- **Rate Limits:** POS-API pro Key begrenzen (z. B. 60 Anfragen/min, Batches bis 1000 Zeilen).

## Build order

1. **Vertical Slice** (Kernablauf, hässlich erlaubt): Registrieren → Bibliothek + Outlet → Zutat mit
   Gebinde und Lieferantenpreis → Rezept mit Zeilen → Kosten pro Portion und Food-Cost-% sehen.
   - Screens: S01, S03, S04 (Allgemein, Gebinde & Preise), S05, S06 (ohne Tabs außer Financial)
   - Tabellen: libraries, outlets, memberships, ingredients, packages, suppliers, stock_items, recipes, recipe_lines, recipe_costs
   - Routes: `signUp`, `createIngredient`, `upsertPackage`, `upsertStockItem`, `upsertSupplier`, `saveRecipe`, `previewRecipeCost`
2. **Must-haves** nach Bereich:
   - Bibliothek/Rezepte vollständig: Unterrezepte, Preisänderung → `recost-dependents`, VK mit/ohne MwSt. (S04, S06)
   - Allergene: `ingredient_allergens`, `recipe_extra_allergens`, Ableitung (S04, S06)
   - Zugriff: Einladungen, Rollen, Outlets (S24, S25)
   - Einkauf: Lieferanten, Bestellung, Mail, Wareneingang (S10–S14; purchase_orders, purchase_order_lines, stock_events, stock_movements, stock_levels)
   - Lager: Bestand + WAC, Inventur, Schwund (S16, S17, S19)
3. **Should-haves:** Menüs + BoM + Labels (S07–S09), Nährwerte, Outlet-Preise, Zubereitung/Personalkosten,
   Sichtbarkeit pro Outlet, Transfer (S18), Par-Level + `suggestOrder`, gewogene Artikel, Lagerbericht (S20),
   Excel-Import (S26), POS-API + PLU-Mapping + `deplete-sales` (S21), Dashboard (S02).
   Danach could: Menu Engineering (S22), Rechnungsabgleich (S15), mobile Barcode-Inventur, Zentralküche (S23),
   HACCP (S27), Nutri-Score, öffentliche REST-API.
4. **Fixes aus `/replica-entrepreneur`:** noch offen – nach dem Lauf hier eintragen und vor den could-Features einplanen.
