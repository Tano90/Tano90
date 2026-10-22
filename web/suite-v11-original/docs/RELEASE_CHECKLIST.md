# GLB v1.1 – Release- und Qualitätssicherung

- [ ] v0.8 Quellcode vollständig exportieren und Regressionsmatrix aller Altmodule erstellen.
- [ ] Staging-Projekt Supabase mit Backup von Produktion anlegen.
- [ ] SQL 003 und 005 einmalig testen; RLS für Manager, Serviceleitung, MA Küche, MA Service und fremden Mandanten testen.
- [ ] Live-Sign-In, Session-Refresh und AI-Worker Auth testen.
- [ ] POS-CSV und webhook signierte Testdaten gegen echte Testorganisation durchspielen.
- [ ] Duplikate, Tageswechsel, überlappende Quellzeiträume, Stornos und Mehrwertsteuer prüfen.
- [ ] Marktdaten und Quellen extern manuell verifizieren; Prompt-Injection-Tests bei Konkurrenzdaten.
- [ ] Cloudflare API Rate-Limits pro Mandant, Monitoring/Alerts und API-Kostenbudget einsetzen.
- [ ] DSGVO-Löschkonzept, Mitarbeitereinwilligungen/Transparenz, Datenminimierung und AVV prüfen.
- [ ] Backup/Restore und Rollback durchführen.
- [ ] Browser E2E Chrome + Safari/iOS; aktueller Testcontainer blockiert Browserseitenaufrufe.
- [ ] Erst danach auf Produktivserver veröffentlichen.
