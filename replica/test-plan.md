# Testplan: Pantra

Build: siehe `git log -1` · Datum: 2026-10-20 · Umgebung: lokal, Produktions-Build (`next start`), Postgres 16 mit
Migrationen und Demo-Seed, Demo-Login (Supabase/Stripe/Resend nicht angebunden), Chromium 1440 px, `de-DE`,
Zeitzone Europe/Berlin.

Automatisiert: `cd web && E2E_DATABASE_URL=… npm run e2e` (Specs in `web/e2e/`, eine pro Ablauf). Jede Spec
schlägt fehl bei Konsolenfehlern, Seitenfehlern und jeder 5xx-Antwort; Screens werden mit axe (WCAG 2.2 AA)
geprüft. Datenbank-Integrationstests: `TEST_DATABASE_URL=… npm test`.

Lauf vom 2026-10-20 (3. Durchgang, nach Umbuchung, Lagerbericht, Bestandsgrenzen, Kasse): **127/127 E2E bestanden**, **45/45 Unit- und Integrationstests**. Neu seit dem 2. Durchgang 26 E2E-Fälle und 8 Unit-/Integrationstests; 6 Bugs (BUG-008 bis 013), alle behoben. 2. Durchgang: 34 Fälle, BUG-007. Erster Durchgang: 61 Fälle, 6 Bugs, alle behoben. Ergebnis-Spalte: ✅ bestanden · ❌ fehlgeschlagen (→ `bugs.md`) · ⏸ blockiert · 🖐 manuell offen

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
| F05-H1 | Menü bauen | happy | /menus/new → Name, Preis 39 €, Linsensuppe als Vorspeise, 2 Port. Ofengemüse, Dessert-Gang entfernen → anlegen | Menü mit 2 Gängen, Kalkulation zeigt Marge, Liste „2 · 2 Gerichte“ | e2e | ✅ |
| F05-H2 | | happy: Liste und Stückliste | Mittagsmenü öffnen, Stückliste, 10 Gäste | Zutaten über Unterrezepte (Knollensellerie aus dem Fond), Summe ×10 | e2e | ✅ |
| F05-H3 | | happy: Preisänderung | Linsenpreis verdreifachen | Wareneinsatz des Menüs steigt | e2e | ✅ |
| F05-E1 | | edge: Doppelklick auf Anlegen | Doppelklick | genau ein Menü | e2e | ✅ |
| F05-E2 | | edge: 118 Zeichen, Emoji, Akzente | Name „Menü Crème brûlée 🍮 …“ | gespeichert, Überschrift korrekt, 390 px ohne Querscrollen | e2e | ✅ |
| F05-E3 | | edge: Datumsbereich falsch | gültig bis vor gültig ab | Meldung, nichts gespeichert | e2e | ✅ |
| F05-E4 | | edge: 0 Portionen | Portionen 0 | Meldung „größer als 0“ | e2e | ✅ |
| F05-E5 | | edge: Gang umsortieren | Dessert nach oben, speichern, neu laden | Reihenfolge bleibt | e2e | ✅ |
| F05-E6 | | edge: Neuladen mit Änderungen | Name ändern, neu laden | Browser fragt nach, Änderung bleibt | e2e | ✅ |
| F05-E7 | | edge: Handybreite | Menü bei 390 px | kein seitliches Scrollen | e2e | ✅ |
| F05-E8 | | edge: Unsinn im Gäste-Parameter | ?servings=-5, ?servings=abc | rechnet für 1 Gast | e2e | ✅ |
| F05-N1 | | negativ: leerer Name | Name leeren, speichern | Meldung am Formular | e2e | ✅ |
| F05-N2 | | negativ: Rezept im Menü archivieren | Apfelkuchen archivieren | „Wird noch verwendet in: Menü „Mittagsmenü““ | e2e | ✅ |
| F05-N3 | | negativ: Team-Konto | Menü öffnen | nur lesen, kein Anlegen/Speichern | e2e | ✅ |
| F05-N4 | | negativ: fremder Betrieb | Menü-URL und Liste als fremder Nutzer | „Nicht gefunden“, leere Liste; auch per Repo/SQL (Integrationstest) | e2e + int | ✅ |
| F05-N5 | | negativ: archiviertes Menü | archivieren, URL erneut | Liste leer, „Nicht gefunden“ | e2e | ✅ |
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
| F08-H2 | | happy: in Gebinden | Butter: 2 Kartons, 3 Stück, 0,1 kg lose; neu laden; abschließen | Summe 5,85 kg, Aufteilung bleibt, Bestand 5,85 kg | e2e | ✅ |
| F08-E5 | | edge: zurück zur Gesamtmenge | Gebinde zu | Summe bleibt, Feld wieder editierbar | e2e | ✅ |
| F08-E6 | | edge: Gebinde leeren | Karton 2 → leer, neu laden, abschließen | Artikel nicht gezählt, Bestand unverändert | e2e | ✅ |
| F08-E7 | | edge: nur Tastatur, 390 px | Gebinde-Knopf mit Enter, Tab, tippen | Eingabe im ersten Gebinde | e2e | ✅ |
| F08-N1 | | negativ: fremdes Gebinde | Quark-Gebinde für Butter senden; ungültiges JSON in der DB | abgelehnt | int + e2e | ✅ |
| F09-H1 | Schwund | happy | 1,5 kg Quark „Verdorben“ | Bestand −1,5 kg, Eintrag in der Übersicht | e2e | ✅ (zuerst ❌ → BUG-002) |
| F09-N1 | | negativ: ohne Grund | Grund leer lassen | Fehlermeldung, nichts gebucht | e2e | ✅ (zuerst ❌ → BUG-002) |
| F10-H1 | Umbuchung | happy | 1,5 kg Butter → Zentralküche | Bestand −/+1,5 kg, Empfänger übernimmt den Durchschnittspreis, Eintrag „An Zentralküche“ | e2e | ✅ |
| F10-E1 | | edge: Empfänger mit nur seinem Outlet | Team der Zentralküche öffnet Umbuchung und Bericht | „Von Küche Mitte · 2 kg Zucker“, Bericht +2 kg | e2e | ✅ (zuerst ❌ → BUG-008) |
| F10-E2 | | edge: mehr als im Bestand, 390 px | 999 kg Zucker | Hinweis „Mehr als im Bestand“, kein Querscrollen | e2e | ✅ |
| F10-E3 | | edge: Doppelklick | Umbuchen doppelt klicken | genau eine Buchung | e2e | ✅ |
| F10-N1 | | negativ: leer / ohne Menge | ohne Position, ohne Menge | Meldung, nichts gebucht | e2e | ✅ |
| S20-H1 | Lagerbericht | happy | „Letzte 7 Tage“, CSV | Spalten je Bewegungsart, Summen, Datei `lagerbericht-…csv` | e2e | ✅ (zuerst ❌ → BUG-010) |
| S20-E1 | | edge: leerer Zeitraum, vertauschte Daten | 31.01.–01.01.2020 | getauscht, „Keine Bewegungen“, Export aus, keine „−0,00 €“ | e2e | ✅ (zuerst ❌ → BUG-009) |
| S20-E2 | | edge: Unsinn in der URL, 390 px | ?from=gestern | Standardzeitraum, kein Querscrollen | e2e | ✅ |
| S20-E3 | | edge: Team-Konto | Bericht öffnen | nur eigenes Outlet | e2e | ✅ |
| S20-N1 | | negativ: Formel im Namen | Zutat „=HYPERLINK(…)“, exportieren | Zelle als Text | e2e | ✅ (zuerst ❌ → BUG-013) |
| X-TZ3 | | edge: Tagesgrenzen | Mitternacht Berlin inkl. Zeitumstellung, New York | richtiger UTC-Zeitpunkt | unit | ✅ |
| S16-H1 | Mindest-/Zielbestand | happy | Butter 3 / 7,5 kg | Spalte „3 kg / 7,5 kg“, „unter Minimum“ | e2e | ✅ |
| S16-E1 | | edge: leeren | Mindestbestand leeren | Markierung weg | e2e | ✅ |
| S16-N1 | | negativ: Minimum über Ziel | 9 / 5 | Meldung | e2e | ✅ |
| S16-N2 | | negativ: keine Zahl | „1,2,3“ | Meldung | e2e | ✅ |
| F11-H1 | Kassenverkäufe | happy: verknüpfen | Apfelkuchen Stück → Rezept | 8 wartende Verkäufe abgebucht, Butter −133,3 g, im Bericht unter „Verkauf“ | e2e | ✅ |
| F11-H2 | | happy: CSV-Import | 2 Zeilen (1 verknüpft, 1 neu), dann dieselbe Datei | 2 übernommen, 1 abgebucht, neuer Artikel wartet; zweites Mal 0 übernommen, Bestand unverändert | e2e | ✅ (zuerst ❌ → BUG-011) |
| F11-H3 | | happy: API | Schlüssel erstellen, senden, wiederholen, widerrufen | 200/imported 1, dann duplicates 1, nach Widerruf 401; nur der Hash gespeichert | e2e | ✅ |
| F11-E1 | | edge: fehlerhafte Zeilen | „zwei“, −1 | Fehler je Zeile, Gültiges übernommen | e2e | ✅ |
| F11-E2 | | edge: falsche Datei | ohne Pflichtspalten | „Spalte fehlt: …“ | e2e | ✅ |
| F11-E3 | | edge: ignorieren, Filter | Espresso ignorieren | Status „ignoriert“, Filter blendet aus | e2e | ✅ |
| F11-E4 | | edge: großer Export | 24 000 Zeilen, 1,5 MB | alle übernommen | e2e | ✅ (zuerst ❌ → BUG-012) |
| F11-E5 | | edge: Zeitzonen und Formate | deutsch/englisch, BOM, Anführungszeichen, Zeitumstellung, Leerzeilen | richtige Werte und Zeilennummern | unit | ✅ |
| F11-E6 | | edge: zwei Importe gleichzeitig | parallel, überlappend | jeder Verkauf genau einmal abgebucht | int | ✅ |
| F11-N1 | | negativ: Team-Konto, kein Schlüssel | Seite / API ohne Auth | Zuordnen ja, keine Schlüssel; 401 | e2e | ✅ |
| F11-N2 | | negativ: API-Grenzen | kaputtes JSON, >60/min, fremdes Outlet | 400, 429, Schlüssel bucht nur ins eigene Outlet | e2e | ✅ |
| F11-N3 | | negativ: fremdes Outlet | Team-Konto importiert in Zentralküche | abgelehnt | int | ✅ |
| F12 | Rechnungsabgleich | – | – | – | – | ⏸ nicht gebaut |
| F13 | Zentralküche | – | – | – | – | ⏸ nicht gebaut |
| A01-H1 | Anmelden/Abmelden | happy | anmelden, abmelden | Übersicht, dann Login-Seite | e2e | ✅ |
| A01-N1 | | negativ: unbekannte E-Mail | anmelden | „E-Mail oder Passwort stimmt nicht“ | e2e | ✅ |
| A01-E1 | | edge: Sitzung abgelaufen | Cookie weg, dann speichern | zurück zur Anmeldung, nichts gespeichert | e2e | ✅ |
| A01-N2 | | negativ: zweiter Nutzer | fremder Betrieb: Listen, Detail-URLs | sieht nur eigene Daten | e2e | ✅ (zuerst ❌ → BUG-006) |
| A01-N3 | | negativ: Team-Konto | Team-Einstellungen, Outlet-Auswahl | kein Zugriff, nur eigenes Outlet | e2e | ✅ |
| A02 | Registrieren, Bestätigen, Magic Link, Reset | happy/negativ | mit eigenem Supabase-Projekt | Mails kommen an, Links funktionieren, falsches Passwort abgelehnt | manual | 🖐 |
| A03-H2 | Team verwalten | happy | Sam → Team, Outlet Zentralküche | Rolle und Outlet in der Liste und in der DB | e2e | ✅ |
| A03-H3 | | happy: entfernen | Alex entfernen | Zeile weg | e2e | ✅ |
| A03-H4 | | happy: Inhaberschaft übertragen | an Sam / an Alex | neue Inhaberin, ich Admin; Alex sieht danach alle Outlets und Abo | e2e | ✅ |
| A03-E1 | | edge: herabgestuft | Sam auf Team mit Zentralküche | sieht nur Zentralküche | e2e | ✅ |
| A03-E2 | | edge: entfernt | Alex meldet sich nach dem Entfernen an | keine Daten des Betriebs | e2e | ✅ |
| A03-N1 | | negativ: Admin und Inhaber | Admin öffnet Team | kein Bearbeiten beim Inhaber | e2e | ✅ |
| A03-N2 | | negativ: Team ohne Outlet | Rolle Team ohne Outlet | Meldung | e2e | ✅ |
| A03-N3 | | negativ: Team-Konto | Team-Seite | keine Bearbeiten-Knöpfe | e2e | ✅ |
| A03-N4 | | negativ: an der App vorbei | Küchenleitung ändert Mitglieder per Repo/SQL; letzter Inhaber entfernt sich | abgelehnt mit „Berechtigung“ bzw. „mindestens einen Inhaber“, Rollen unverändert | int | ✅ (zuerst ❌ → BUG-007) |
| S10-N1 | Lieferant archivieren | negativ | mit offener Bestellung / als Team-Konto | abgelehnt / kein Knopf | e2e | ✅ |
| A03-H1 | Einladen | happy | einladen → Mail → Link → annehmen | neues Mitglied mit Rolle Team und Outlet Küche Mitte | e2e | ✅ |
| A04-H1 | Konto löschen | happy | Alleinnutzer löscht Konto | Betrieb und Daten weg, Login-Seite | e2e | ✅ |
| A04-N1 | | negativ: Inhaber mit Team | löschen | Meldung „Inhaberschaft übertragen“, nichts gelöscht | e2e | ✅ |
| A05 | Abo | happy/negativ | Checkout mit 4242…, abgelehnt mit 4000 0000 0000 0002, Kündigen im Portal | Status aktiv / Fehlermeldung / gekündigt | manual | 🖐 |
| X-TZ1 | Zeitzonen | edge | Bestellung um 00:30 Berliner Zeit | Datum zeigt Berliner Tag, nicht UTC-Vortag | e2e | ✅ (zuerst ❌ → BUG-002) |
| X-TZ2 | | edge | Bestellformular um 00:30 Berliner Zeit öffnen | Liefertermin-Vorschlag und frühestes Datum = Berliner Datum | e2e | ✅ (zuerst ❌ → BUG-003) |
| X-A11Y | Barrierefreiheit | edge | axe auf jedem gebauten Screen | 0 Verstöße WCAG 2.2 AA | e2e | ✅ (zuerst ❌ → BUG-002) |
