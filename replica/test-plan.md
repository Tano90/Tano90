# Testplan: Kitchen Ledger

Build: siehe `git log -1` · Datum: 2026-10-20 · Umgebung: lokal, Produktions-Build (`next start`), Postgres 16 mit
Migrationen und Demo-Seed, Demo-Login (Supabase/Stripe/Resend nicht angebunden), Chromium 1440 px, `de-DE`,
Zeitzone Europe/Berlin.

Automatisiert: `cd web && E2E_DATABASE_URL=… npm run e2e` (Specs in `web/e2e/`, eine pro Ablauf). Jede Spec
schlägt fehl bei Konsolenfehlern, Seitenfehlern und jeder 5xx-Antwort; Screens werden mit axe (WCAG 2.2 AA)
geprüft. Datenbank-Integrationstests: `TEST_DATABASE_URL=… npm test`.

Lauf vom 2026-10-20: **61/61 E2E bestanden** (im ersten Lauf 14 rot: 6 echte Bugs, alle behoben; der Rest Fehler in den Tests selbst), **32/32 Unit- und Integrationstests**. Ergebnis-Spalte: ✅ bestanden · ❌ fehlgeschlagen (→ `bugs.md`) · ⏸ blockiert · 🖐 manuell offen

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | Zutat mit Preis anlegen | happy | /ingredients/new → Name → anlegen → Gebinde 5 kg → Preis 12,50 € | Liste zeigt 2,50 €/kg, Allergene „ungeprüft“ | e2e | ✅ (zuerst ❌ → BUG-001) |
| F01-E1 | | edge: leerer Name | anlegen ohne Name | Fehlermeldung am Feld, nichts gespeichert | e2e | ✅ |
| F01-E2 | | edge: 120 Zeichen, Emoji, Akzente | Name „Crème brûlée … 🍮“ (120 Zeichen) | gespeichert, korrekt angezeigt, kein seitliches Scrollen bei 390 px | e2e | ✅ |
| F01-E3 | | edge: Name doppelt | „Zwiebeln“ noch einmal anlegen | klare Meldung, keine zweite Zutat | e2e | ✅ |
| F01-E4 | | edge: Preis pro kg statt pro Gebinde | Preis 3,20 € pro kg auf Gebinde 5 kg | 3,20 €/kg | e2e | ✅ (zuerst ❌ → BUG-001) |
| F01-E5 | | edge: Doppelklick auf Anlegen | Doppelklick | genau eine Zutat | e2e | ✅ |
| F01-N1 | | negativ: keine Berechtigung | Team-Konto öffnet Zutat | nur lesen, kein Speichern | e2e | ✅ |
| F01-N2 | | negativ: fremde Daten | Nutzer eines anderen Betriebs öffnet Zutat-URL | „Nicht gefunden“, Liste ohne fremde Zutaten | e2e | ✅ (zuerst ❌ → BUG-006) |
| F02-H1 | Rezept kalkulieren | happy | Rezept, 4 Portionen, 500 g Rote Linsen, VK 6,90 € | Kosten/Portion 0,30 €, Wareneinsatz angezeigt, in Liste | e2e | ✅ |
| F02-E1 | | edge: Zutat ohne Preis | Kräuterquark öffnen (Meersalz ohne Preis) | Warnung an der Zeile und in der Kalkulation | e2e | ✅ |
| F02-E2 | | edge: Stück ohne Stückgewicht | 2 Stk. Karotten | Hinweis „Gewicht pro Stück fehlt“, keine 0-€-Kosten | e2e | ✅ |
| F02-E3 | | edge: Doppelklick auf Anlegen | Doppelklick | genau ein Rezept | e2e | ✅ |
| F02-E4 | | edge: nur Tastatur | Name, Zeile, Zutat, Menge, speichern | gespeichert | e2e | ✅ |
| F02-E5 | | edge: Neuladen mit ungespeicherten Änderungen | Name ändern, neu laden | Browser fragt nach, bevor Änderungen verloren gehen | e2e | ✅ (zuerst ❌ → BUG-005) |
| F02-E6 | | edge: Handybreite | Rezept-Editor bei 390 px | bedienbar, kein seitliches Scrollen | e2e | ✅ |
| F02-N1 | | negativ: archiviertes Rezept | URL eines archivierten Rezepts | „Nicht gefunden“ | e2e | ✅ (zuerst ❌ → BUG-006) |
| F02-N2 | | negativ: keine Berechtigung | Team-Konto öffnet Rezept | nur lesen | e2e | ✅ |
| F03-H1 | Unterrezept | happy | Rezept mit „1 Port.“ Linsensuppe | Kosten = Kosten pro Portion der Suppe | e2e | ✅ |
| F03-N1 | | negativ: Zyklus | Gemüsefond enthält Rezept, das Gemüsefond enthält | verständliche Meldung, nichts gespeichert | e2e | ✅ |
| F04-H1 | Preisänderung | happy | Linsenpreis verdoppeln | Kosten der Linsensuppe steigen in der Liste | e2e | ✅ (zuerst ❌ → BUG-001) |
| F05 | Menü | – | – | – | – | ⏸ nicht gebaut |
| F06-H1 | Bestellen | happy | Molkerei, „nach Mindestbestand auffüllen“, senden | Status „Bestellt“, eine Mail an Lieferanten mit Bestellnummer | e2e | ✅ |
| F06-E1 | | edge: Doppelklick auf Senden | Doppelklick im Bestätigungsdialog | genau eine Mail | e2e | ✅ |
| F06-E2 | | edge: zwei Tabs | Entwurf in zwei Tabs senden | zweiter Tab: schon gesendet, keine zweite Mail | e2e | ✅ |
| F06-E3 | | edge: Lieferant ohne Bestell-Adresse | senden | Hinweis „telefonisch bestellen“, als bestellt markiert, keine Mail | e2e | ✅ |
| F06-N1 | | negativ: leere Bestellung | keine Mengen | Speichern/Senden deaktiviert | e2e | ✅ |
| F07-H1 | Ware annehmen | happy | Teillieferung, dann Rest | „Teilweise geliefert“ → „Geliefert“, Bestand stimmt | e2e | ✅ |
| F07-E1 | | edge: Neuladen nach Teillieferung | neu laden | Formular zeigt nur noch die Restmengen | e2e | ✅ |
| F07-E2 | | edge: ohne Lagerbuchung | Haken „ins Lager buchen“ entfernen | Bestellung geliefert, Bestand unverändert | e2e | ✅ |
| F07-N1 | | negativ: Überlieferung | mehr als bestellt eintragen | Fehlermeldung, nichts gebucht | e2e | ✅ |
| F08-H1 | Inventur | happy | starten, Quark 3 kg zählen, abschließen | Quark 3 kg, andere Artikel unverändert | e2e | ✅ |
| F08-E1 | | edge: Neuladen | zählen, neu laden | Zwischenstand noch da | e2e | ✅ |
| F08-E2 | | edge: offline | offline zählen, wieder online | Fehlerstatus, danach gespeichert | e2e | ✅ (zuerst ❌ → BUG-004) |
| F08-E3 | | edge: zwei Tabs | im zweiten Tab Inventur starten | „läuft schon“ | e2e | ✅ |
| F08-E4 | | edge: Handybreite | Zählliste bei 390 px | große Eingabefelder, kein seitliches Scrollen | e2e | ✅ |
| F09-H1 | Schwund | happy | 1,5 kg Quark „Verdorben“ | Bestand −1,5 kg, Eintrag in der Übersicht | e2e | ✅ (zuerst ❌ → BUG-002) |
| F09-N1 | | negativ: ohne Grund | Grund leer lassen | Fehlermeldung, nichts gebucht | e2e | ✅ (zuerst ❌ → BUG-002) |
| F10 | Umbuchung | – | – | – | – | ⏸ nicht gebaut |
| F11 | Kassenverkäufe | – | – | – | – | ⏸ nicht gebaut |
| F12 | Rechnungsabgleich | – | – | – | – | ⏸ nicht gebaut |
| F13 | Zentralküche | – | – | – | – | ⏸ nicht gebaut |
| A01-H1 | Anmelden/Abmelden | happy | anmelden, abmelden | Übersicht, dann Login-Seite | e2e | ✅ |
| A01-N1 | | negativ: unbekannte E-Mail | anmelden | „E-Mail oder Passwort stimmt nicht“ | e2e | ✅ |
| A01-E1 | | edge: Sitzung abgelaufen | Cookie weg, dann speichern | zurück zur Anmeldung, nichts gespeichert | e2e | ✅ |
| A01-N2 | | negativ: zweiter Nutzer | fremder Betrieb: Listen, Detail-URLs | sieht nur eigene Daten | e2e | ✅ (zuerst ❌ → BUG-006) |
| A01-N3 | | negativ: Team-Konto | Team-Einstellungen, Outlet-Auswahl | kein Zugriff, nur eigenes Outlet | e2e | ✅ |
| A02 | Registrieren, Bestätigen, Magic Link, Reset | happy/negativ | mit eigenem Supabase-Projekt | Mails kommen an, Links funktionieren, falsches Passwort abgelehnt | manual | 🖐 |
| A03-H1 | Einladen | happy | einladen → Mail → Link → annehmen | neues Mitglied mit Rolle Team und Outlet Küche Mitte | e2e | ✅ |
| A04-H1 | Konto löschen | happy | Alleinnutzer löscht Konto | Betrieb und Daten weg, Login-Seite | e2e | ✅ |
| A04-N1 | | negativ: Inhaber mit Team | löschen | Meldung „Inhaberschaft übertragen“, nichts gelöscht | e2e | ✅ |
| A05 | Abo | happy/negativ | Checkout mit 4242…, abgelehnt mit 4000 0000 0000 0002, Kündigen im Portal | Status aktiv / Fehlermeldung / gekündigt | manual | 🖐 |
| X-TZ1 | Zeitzonen | edge | Bestellung um 00:30 Berliner Zeit | Datum zeigt Berliner Tag, nicht UTC-Vortag | e2e | ✅ (zuerst ❌ → BUG-002) |
| X-TZ2 | | edge | Bestellformular um 00:30 Berliner Zeit öffnen | Liefertermin-Vorschlag und frühestes Datum = Berliner Datum | e2e | ✅ (zuerst ❌ → BUG-003) |
| X-A11Y | Barrierefreiheit | edge | axe auf jedem gebauten Screen | 0 Verstöße WCAG 2.2 AA | e2e | ✅ (zuerst ❌ → BUG-002) |
