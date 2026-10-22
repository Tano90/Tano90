# GLB AI Suite v1.0 – Qualitätssicherung vor Livebetrieb

## Automatisiert überprüft

- [x] Import / Export: Dezimalzeichen, UTF-8/BOM, quoted fields, Zeilenumbrüche
- [x] Ungültige Artikel- und Outletnamen werden erkannt, keine stille Anlage
- [x] Monat und negative Mengen validiert
- [x] Deckungsbeitrag bei fehlendem Wareneinsatz nicht angezeigt
- [x] 7/19-%-Steuersatz in der Auswertung berücksichtigt
- [x] Regelbasierte Bestandswarnungen
- [x] Test aller fünf Modulseiten per simuliertem DOM-Rendering
- [x] JavaScript Syntaxprüfung (`node --check`)
- [ ] Browser-End-to-End: In dieser Ausführungsumgebung verhindert eine Browser-Sperre jede Navigation, selbst lokal. Das Playwright-Skript ist als Ausgangsbasis im Paket enthalten, aber **nicht erfolgreich ausgeführt**.
- [ ] SQL-Migration im realen Supabase-Stagingprojekt ausgeführt und geprüft

## Unbedingt manuell prüfen

- [ ] Supabase Tabellen aus `000_preflight.sql` existieren (insbesondere `glb_organizations`, `glb_memberships`, `glb_snapshots`).
- [ ] Staging SQL in frischem Testprojekt ohne Fehler ausführbar, erneute Ausführung idempotent.
- [ ] Snapshot-/Backup der bestehenden v0.8-Daten verfügbar; Restore tatsächlich getestet.
- [ ] Owner sieht eigene Organisationsdaten, niemals fremde Mandanten.
- [ ] Restaurantleitung kann importieren; Service-Mitarbeiter und Viewer können keine Einkaufspreise abfragen.
- [ ] Küchenleitung darf Bestand editieren, Küchen-Mitarbeiter nur lesen.
- [ ] Berechtigungen mit direkten REST-Aufrufen testen, nicht nur mit Navigation im Frontend.
- [ ] Vorhandene CSV zweimal importieren: zweiter Lauf erzeugt 0 neue Zeilen.
- [ ] Zweite Datei mit identischen Summen, aber geänderter Formatierung gesondert warnen: Idempotenz nur innerhalb identischer Quelle.
- [ ] Umsatzsteuer/Kosten/Kassenstornos mit originalen Kassenzahlen abgleichen.
- [ ] Kosten-Nachtragung erlaubt nur `NULL -> bestätigter Wert`, keine Änderung bestehender Mengen/Umsätze.
- [ ] Gleichzeitige Inventuränderung auf zwei Geräten löst Versionskonflikt aus.
- [ ] Audit Events enthalten die erwartete Benutzer-ID, alte und neue Werte.
- [ ] 1.000+ Verkäufe über Seitengrenzen werden vollständig geladen.
- [ ] Mobile Navigation in iOS Safari/Android Chrome; PWA Installation/Offline-Demo.
- [ ] Datenschutz, Auftragsverarbeitungsvertrag, Zugriffs-/Löschkonzept vor Kundenrollout.
- [ ] Nur Publishable/Anon Key im Browser; **nie service_role, OpenAI Key oder Cloudflare Secret**.
