# GLB AI Suite v1.1 – Intelligence Center (RC1)

**21.10.2026 · Eigenständiges, testbares Cloudflare/Supabase-Pilotpaket. Keine Live-Installation.**

Die GLB v1.1 baut auf dem funktionierenden v1.0-Quellpaket auf. Alle v1.0-Module sind enthalten: Cockpit, Monats-Sales-Import, Menu Engineering, Inventur/Bestellliste, Aufgaben, Stammdaten, Rollenprüfung und PWA. Neue Bereiche: **Daily Sales Funnel**, **Funnel Quest Training Center**, **KI-Marktcheck**, **v0.8 Legacy-Brücke** und **POS-Eingangsschnittstelle**.

## Direkt lokal testen

```bash
cd GLB_AI_Suite_v1.1
python3 -m http.server 8080 -d public
# http://localhost:8080
```

**Demo = ausschließlich Beispieldaten**, inklusive POS-Bons 20./21.10.2026; KI-API und Live-Recherche sind im lokalen Modus deaktiviert. Echte Kundendaten nur in einer gesicherten, geprüften Cloud-Installation verwenden.

## Installation als SEPARATE STAGING-APP

1. v0.8 und v1.0 **nicht überschreiben**. Vorher Backups/Snapshots erstellen. Paket auf einen eigenen Branch bzw. eine zweite Cloudflare Worker-App legen.
2. Voraussetzung: bestehendes Supabase-Schema aus `001_cloud_pilot.sql` und `002_roles_and_security.sql`. Staging: `database/003_glb_v1_structured.sql` aus dem Paket ausführen, danach `database/005_glb_v11_intelligence.sql` (nicht mehrfach beliebige ältere Schemaversionen anwenden).
3. `npx wrangler login` und `npx wrangler deploy`. Wrangler-Konfiguration liefert Static Assets **plus** API Worker für `/api/*`. Alternativ lokal nur die Demo mit Python testen; Python kann die KI-API nicht ausführen.
4. Cloudflare Secrets setzen, kein Key im Browser:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put POS_INGEST_SECRET
npx wrangler secret put POS_INGEST_ORG
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Optional: OPENAI_MODEL als Worker-Variable, Standard gpt-4.1-mini
```

`SUPABASE_SERVICE_ROLE_KEY` ist **nur** für den signierten POS-Eingang notwendig. Wenn Webhook nicht genutzt wird, diese drei POS-Secrets nicht setzen. API-Abrechnung bei OpenAI muss aktiv sein, sonst KI-Check nicht nutzbar. Für öffentlichen SaaS-Betrieb **vorher** per-Organisation-Rate-Limit, Monatsbudget, Logging ohne personenbezogene Rohbons sowie Abuse-Prevention einrichten.

5. App öffnen → Einstellungen → Supabase URL, **Publishable/Anon Key** und `organization_id` speichern → mit Supabase Auth anmelden.
6. Mit einem Management-Account `glb_v1_outlets` und `glb_v1_products` pflegen. POS-Import enthält Outletnamen, welche auf den Stamm passen müssen.
7. SQL-Policies vor Freigabe mit Accounts unterschiedlicher Rollen und unterschiedlicher Mandanten testen. Die zusätzlichen Endpunkte prüfen die Managementrolle serverseitig über `glb_v11_can_manage`.

## 1. Daily Sales Funnel

Die bisherigen **Monatsumsatz-Zeilen aus v1.0** besitzen keine Tages-, Bon- oder Positions-IDs. Diese erlauben keine seriöse tägliche Conversion. Der neue Daily-Funnel benötigt Bonpositionen als einzelne Zeilen.

**Muster:** `sample-daily-pos.csv`

```csv
Datum;BonID;Outlet;Produkt;Menge;Bruttopreis;Gaeste;Mitarbeiter;FunnelStufe;USt;WareneinsatzNetto
2026-10-21;B-001;Restaurant;Cheeseburger;2;19,50;2;;none;7;4,60
2026-10-21;B-001;Restaurant;Signature Cocktail;1;9,50;2;;aperitif;19;2,70
```

- Pflicht: Datum `YYYY-MM-DD`, BonID, Outlet, Produkt, Menge, Bruttopreis. MwSt: explizit `USt` oder aus bekanntem Produktstamm, kein blinder Standard.
- `FunnelStufe`: `none`, `aperitif`, `water`, `upgrade`, `dessert`, `coffee`, `afterglow`. Lässt sich auch später per Artikelmapping für unklassifizierte Verkäufe pflegen.
- Eine Kaufquote ist `Bons mit >=1 Artikel der Stufe / alle Bons`. Die 6 Stufen sind **keine strikt sequentiellen Funnel-Schritte**. Ein Bon kann alle, einige oder keine Stufen enthalten.
- Angebotshäufigkeit (ob Service etwas aktiv vorgeschlagen hat) und echte Angebotskonversion sind **nicht aus reinen POS-Bons** ableitbar. Dafür ist separate Service-Erfassung nötig.
- Gästezahl nur, wenn alle Bons Angaben enthalten, sonst als unbekannt markiert. Tagesumsatz wird aus den Positionen gerechnet, Wareneinsatz nur mit echten Nettokosten.
- Szenario: `max(0, gerundete Differenz zwischen Ziel- und beobachteten Bons) * beobachteter Netto-Einheitspreis / DB pro Einheit`. Eine zusätzliche Einheit pro zusätzlich gewonnenem Bon. **Kein garantierter Profit**, keine Vollkosten (Personal/Miete) und keine Kausalität nachgewiesen.
- Cloud-Ansicht lädt die letzten **90 Tage**, max. 50.000 Positionen für Pilot. Vor großem SaaS-Launch: serverseitige Aggregation und paginierte Detailansichten einbauen.
- CSV-Re-Import identischer Dateiinhalt/Zeilennummer wird übersprungen. **Neu exportierte Dateien mit überlappenden Bons können doppelte Werte enthalten**, falls sich der Dateiinhalt geändert hat. Für dauerhafte automatische Übertragung stabile externe Positions-IDs verwenden (Webhook).

## 2. Funnel Quest

Sechs Themen: Aperitif, Wasser, Upgrade, Dessert, Kaffee, After Glow. Jedes mit Verkaufsargument, Microtraining, Wissensfrage, Feedback und 100 XP bei richtiger Lösung. In der Cloud kann pro Account/Tag/Thema ein gespeicherter Versuch abgegeben werden. Ergebnisse sind durch RLS nur für die **jeweilige Person** sichtbar. Kein Mitarbeiterranking oder automatische Mitarbeiterbewertung. Management hat getrennt davon aus POS-Daten ermittelte **Team-Schulungspotenziale**, keine Personalleistungsdaten.

## 3. KI-Marktcheck

- **Entdecken:** OpenStreetMap/Overpass liefert vorhandene Gastronomiebetriebe im gewählten 1–5-km-Radius; **keine Menüpreise**.
- **Beobachten:** Eigene, manuell geprüfte Quelle als HTTPS-Link, Stichtag, Wettbewerber, vergleichbares Produkt und Preis hinterlegen. Werte bleiben mit Beleg nachvollziehbar. Die Anwendung ruft die Quell-URL nicht automatisch zum Verifizieren auf.
- **Analysieren:** KI-Button ruft den eigenen Cloudflare Worker auf. Auth wird **serverseitig** via Supabase-Mitgliedschafts-RPC geprüft, OpenAI-Key bleibt als Server-Secret. KI erhält ausschließlich dokumentierte, eingegebene Vergleichswerte und deren URLs. Es handelt sich nicht um vollautomatisches Scraping und nicht um eine verifizierte Marktpreis-Datenbank. Vor Preisänderungen Plausibilität prüfen.
- Rate-Limiting und Abrechnungskontrollen müssen vor unbeschränkter Nutzung ergänzt werden.

## 4. POS-Webhooks für echten automatisierten Zufluss

Endpoint: `POST https://<worker-domain>/api/pos/ingest` mit HMAC-SHA256 über **exakt die Rohbytes** des JSON Bodys. Header: `x-glb-signature: sha256=<64 hex>`. Secret `POS_INGEST_SECRET` (>31 Zeichen) liegt serverseitig. `POS_INGEST_ORG` fixiert die erlaubte Organisation, nicht frei aus dem Request wählbar. `SUPABASE_SERVICE_ROLE_KEY` verbleibt allein im Worker. Lieferquelle muss stabile `external_line_id` je POS-Position liefern; dadurch idempotentes Einspielen auch bei geändertem Export.

Schema siehe `docs/WEBHOOK.md`. Es besteht **noch keine native Anbindung** an ein konkretes Kassensystem. Diese erfolgt mit dokumentiertem Export/API oder einem zugelassenen ETL-Automationsdienst. Der Management-Funnel berechnet die neuen Daten ohne separate nächtliche Batchverarbeitung beim Laden der Seite neu.

## 5. Alte Funktionen erhalten

Alle Komponenten des *vorliegenden* v1.0-Quellpakets sind weiterhin vorhanden. Zusätzlich bietet "Alte Module" einen **nur lesenden** Strukturcheck über die v0.8-RPC `glb_read_workspace` und einen Link zur bisherigen laufenden Installation. Eine vollständige Migration früherer v0.8-Module (Dienstplanung, Kalkulation, Inventur-Workflows, Rezepturen etc.) ist **noch nicht erfolgt**, da das komplette v0.8-Quellpaket nicht zur Verfügung stand. Die Produktiv-v0.8 wird weder überschrieben noch verändert.

## Tests und Grenzen

```bash
npm test
```

Tests: Parser, CSV-Re-Import-Konzept, Kassenbon-Zählung, Kostenlücken, Szenarien, Quizzes, HMAC, Auth-Fehler und Rendering. **Nicht geprüft**: Live-Supabase-Migration, echte POS-API, OpenAI-API-Abrechnung/Antwort, OSM-Erreichbarkeit, realer Browser-End-to-End-Test. Diese Punkte vor Liveschaltung nachholen. SQL und Worker im Staging verwenden.

**Wichtig zur Übergangsphase:** Dieselben Bons nicht sowohl über den CSV-Tagesimport als auch über den signierten Webhook einspielen. Die beiden technischen Importwege haben unterschiedliche Identitätsschlüssel; solche überlappenden Daten müssten vor einem Produktivstart abgeglichen werden.
