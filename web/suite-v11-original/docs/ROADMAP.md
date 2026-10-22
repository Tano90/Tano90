# GLB AI Suite – Versionenplan ab v0.8

## v1.0 RC1 (dieses Paket)
Management Cockpit, CSV-Sales-Import mit Idempotenz, Menu Engineering, Inventory/Bestellvorschläge, Team Tasks, additive Supabase-Tabellen mit Rollen, PWA, Basis-Alerts, Audit-Trail.

## v1.0 Production (nach Validierung)
Bestandsmigration v0.8 -> v1.0 mit Mapping und Rollback, verifizierte Mehrbenutzertests, mobile Regressionstests, Restore-Test, Import von Warenbewegungen, Beleg-ID-basiertes Kassenmapping, authentische Steuersatz-/Storno- und Kostenregeln. Erst dann produktiv und verkaufbar bezeichnen.

## v1.1
Tagesabschluss-/Wochenreporting, Forecast nach Outlet, Wareneinsatz Soll/Ist, Lieferanten und Bestellrhythmus, definierte Freigabestufen für Bestellungen, allgemeines CSV-Mapping per Importprofil.

## v1.2
KI-Assistenz über einen separaten sicheren Cloudflare Worker (OpenAI-API-Schlüssel niemals im Client), Managementreports mit Quellen und Zahlenherkunft, Alerts/Benachrichtigungen mit Freigabe.

## v1.3 / kommerzielle SaaS
Shopify-Abonnements oder externe Billing-Plattform mit Webhook-Validierung, Multi-Tenant-Onboarding, Tarife/Add-ons, Datenschutz/DSGVO-Vereinbarungen, rollenabhängige Reports, automatische Backup- und Betriebsüberwachung.

**Leitlinie:** Erst ein belastbarer Datenfluss (Kasse -> Datenbank -> Analyse -> Entscheidung -> Aufgabe), danach größere KI-Funktionen. Kein gleichzeitiger Komplettumbau aller Module aus v0.8.
