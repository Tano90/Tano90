# STATUS – Premium-Produktseite (Startseite, 23.10.2026)

## Entscheidung
- Rückmeldung: Die Restaurant-Kamerafahrt (Blender) wirkte „KI-mäßig und kindisch“ und hatte nichts mit dem Referenzvideo zu tun. Gewählte Richtung: **Premium-Produktseite**.
- Umgesetzt:
  - Dunkle, ruhige Bühne mit großer Typografie (Fraunces, Markenschrift) und Petrol-Akzent.
  - Einziges Objekt ist die **echte Übersicht der Suite** (Demo-Beispieldaten), als Bildschirm in 3D.
- Ablauf beim Scrollen:
  1. Der Bildschirm kippt aus der Schräge in die Fläche.
  2. Zoom auf die vier Kennzahlen (der Rest wird abgedunkelt).
  3. Die Seite scrollt im Bildschirm zum Handlungsbedarf.
  4. Das Handy mit „Team & Aufgaben“ steigt auf.
  5. Zoom auf „Umsatz nach Outlet“; danach kommen die drei Outlet-Ansichten (Restaurant, Bar, Bankett & Events) nacheinander nach vorn.
  6. Am Ende steht die ganze Übersicht mit den beiden Aktionen.
- Technik:
  - Nur CSS-3D-Transformationen; kein WebGL, kein Canvas, keine neuen Pakete.
  - Eine Fortschrittszahl aus der Scrollposition; läuft vorwärts und rückwärts.
  - Kein Scroll-Hijacking, keine Automatik.
  - Weiche Ausblendung zwischen Text und Bühne.
- Barrierefreiheit:
  - „Animation überspringen“ führt hinter die Geschichte.
  - Bei reduzierter Bewegung oder `?story=static` gibt es eine Standversion mit denselben Texten und Ausschnitten. Dort lässt sich die Animation über „Animation trotzdem abspielen“ starten.
- Kopfzeile der Startseite ist jetzt dunkel und schließt an die Bühne an; ab „Kurz beantwortet“ bleibt die Seite beige.

## Assets
- `web/public/story/screen-overview.webp` (2880×3848, 357 KB) und `screen-overview.json` mit den Boxen der Bereiche (aus dem DOM gemessen).
- `outlet-*.jpg`, `screen-mobile.jpg`: echte Demo-Bildschirme.
- Alle erzeugt mit `node scripts/story-assets.mjs` gegen den lokalen Demo-Server. Keine erfundenen Zahlen; alle Werte sind Beispieldaten der Demo.
- Entfernt aus `public`: Blender-Bildsequenz (`story/seq`, ca. 9,5 MB), Standbilder und `screen-dashboard.jpg`.
- Die Blender-Skripte (`web/scripts/story-blender`) und `story-production/` bleiben nur als Archiv und werden nicht ausgeliefert.

## Geänderte Dateien
- `web/src/components/landing/story/story.tsx` (neu geschrieben)
- `web/src/app/globals.css` (`.story-*`)
- `web/src/app/page.tsx` (dunkle Kopfzeile)
- `web/scripts/story-assets.mjs`
- `web/e2e/landing.spec.ts` (L03-2 und L03-4 auf die neue Bühne umgestellt; alle anderen Prüfungen unverändert)

## Prüfung
- Landing-E2E: 14/14 grün.
- Chromium-Emulation bei 1440×900, 768×1024 und 390×844:
  - keine Konsolenfehler
  - kein horizontales Scrollen
  - alle Stationen per Screenshot geprüft
- Videos aufgenommen.
- Noch nicht auf echten Geräten geprüft. Offen: iPhone Safari (Mask-Image, 3D) und Android Chrome.

## Offen / Nächster Schritt
- Prüfung auf echten Geräten.
- Higgsfield bleibt ungenutzt (API-Guthaben 0).

---

# Archiv: Fotorealistische Scrollgeschichte (ersetzt)


## Befund zur gemeldeten Browserprüfung
- **Was angezeigt wurde:** Text und Bild nebeneinander, Servicestation, separate Handy-Abbildung. Das war die **statische Rückfallansicht** der vorigen Version (`StaticStory`), nicht die Animation.
- **Was die Rückfallansicht damals auslöste:**
  - die Systemeinstellung „reduzierte Bewegung“,
  - fehlendes WebGL,
  - ein Fehler beim Start der 3D-Szene,
  - mehr als 12 s bis zum ersten 3D-Bild (Three.js-Paket mit ca. 560 KB plus Texturen).
- **Welcher Auslöser es im Prüfbrowser war, lässt sich von hier aus nicht feststellen.** In dieser Umgebung lieferte Chromium headless in allen getesteten Varianten WebGL 1 und 2.
- **Neue Lösung:**
  - Keine Echtzeit-3D-Szene mehr. Stattdessen läuft eine **in Blender (Cycles) vorgerenderte Kamerafahrt** als scrollgesteuerte Bildfolge auf einem 2D-Canvas.
  - Sie braucht kein WebGL. Die Rückfallansicht erscheint nur noch bei „reduzierter Bewegung“ oder mit `?story=static`; dort gibt es einen Link „Animation trotzdem abspielen“.
  - Das Attribut `data-story-mode` zeigt im Browser, welche Variante läuft.

## Werkzeuge und Assets (geprüft)
- **Blender 5.2.3** über PyPI (`bpy`), Renderer Cycles auf der CPU (4 Kerne, keine GPU), Entrauschen mit OpenImageDenoise. EEVEE ist ohne GPU/EGL nicht verfügbar.
- **Gesperrt** durch die Netzwerkrichtlinie dieser Umgebung: Poly Haven, ambientCG, Kenney und blender.org.
- **Möbelmodelle aus Khronos glTF-Sample-Assets** (raw.githubusercontent.com):

| Modell | Lizenz | Urheber |
| --- | --- | --- |
| SheenChair | CC0-1.0 | Eric Chadwick |
| GlassVaseFlowers | CC0-1.0 | Eric Chadwick, Rico Cilliers |
| DiffuseTransmissionTeacup | CC0-1.0 | Polyhaven.com, Eric Chadwick |
| WaterBottle | CC0-1.0 | Microsoft (nicht verwendet) |
| SheenWoodLeatherSofa | CC-BY-4.0 / CC0 | Eric Chadwick / Fran Calvente |
| DiffuseTransmissionPlant | CC-BY-4.0 / CC0 | Eric Chadwick / Rico Cilliers |
| GlassHurricaneCandleHolder | CC-BY-4.0 | Eric Chadwick |
| CommercialRefrigerator | CC-BY-4.0 | Eric Chadwick, Sean Thomas |
| AnisotropyBarnLamp | CC-BY-4.0 | Eric Chadwick (nicht mehr verwendet) |

  Für die CC-BY-Modelle ist eine Namensnennung nötig; sie steht in der Fußzeile bzw. auf der Seite „Bildnachweise“, siehe offene Punkte.
- **Alles andere ist selbst modelliert** (`web/scripts/story-blender/scene.py`): Gebäude, Fassade, Straße und Gegenüberbebauung, Laptop, Handy, Tische, Stühle, Theke, Flaschen und Gläser. Alle Materialien (Holz, Ziegel, Stein, Glas, Leder, Stoff) sind prozedural.
- **Licht:** Blenders physikalischer Himmel mit Sonne. Es werden keine externen HDRIs gerendert.
- **Bildschirme:** echte Aufnahmen der Demo (`public/story/screen-*.jpg`). Auf der Website werden sie zusätzlich als gestochen scharfe Bilder perspektivisch auf die exportierten Bildschirmecken jedes Bilds gelegt.

## Szenen
Das ist eine Kamerafahrt in einem einzigen Modell; jede Einstellung beginnt an der Endposition der vorigen.
| Einstellung | Bilder | Inhalt |
| --- | --- | --- |
| office | 60 | Dashboard füllt das Bild → Laptop auf dem Schreibtisch → Büro → rückwärts durch den offenen Fensterflügel hinaus |
| aerial | 40 | Aufstieg zur Drohnenansicht: Fassade, Terrasse, Straße, Nachbarhäuser |
| enter | 45 | Abstieg durch den offenen Eingang in den Gastraum zur Servicestation |
| phone | 24 | Das Handy-Display übernimmt die Fläche (Team & Aufgaben) |
| outlets | 60 | Restaurant → Bar → durch die Glastür → Bankett, jeweils mit den echten Outlet-Kennzahlen |
| return | 40 | Durch Durchgang und Bürotür zurück zum Laptop → Dashboard, Abschluss mit beiden Aktionen |

- Desktop-Variante: 1152×648. Handy-Variante: eigene Hochformat-Bilder mit 486×864 und weiter entfernten Totalen.
- Rendern über die Warteschlange `scratchpad/queue.sh`; bereits vorhandene Bilder werden übersprungen. Verpacken mit `web/scripts/story-blender/pack.py` (WebP plus Manifest mit den Bildschirmecken).

## Geänderte Dateien
- `web/src/components/landing/story/story.tsx`: Bildfolgen-Player, Bildschirm-Overlays, Texte und Rückfallansicht.
- Entfernt: `engine.ts`, `world.ts`, `scripts/story-stills.mjs`, Abhängigkeit `three`.
- Neu: `web/scripts/story-blender/{scene.py, pack.py}`, `web/public/story/seq/*`.

## Stand 23.10.2026, 13:35 (Commit f423efa)
- Die komplette Fahrt ist auf der Website: 269 Desktop-Bilder, 9,5 MB WebP. Sie werden schrittweise nachgeladen, das erste Bild ist nach ca. 1 s da.
- Geprüft in Chromium (Desktop-Browser, keine echten Geräte):
  - 1440×900, 768×1024 und 390×844: Animation aktiv (`data-story-mode=anim`), vorwärts und rückwärts ohne Fehler, kein seitlicher Überlauf.
  - Videos mit echtem Mausrad-Scrollen aufgenommen.
- e2e-Tests der Startseite: 14/14, darunter „Animation für normale Besucher“ und „reduzierte Bewegung → Standbilder“.
- Die Namensnennung für die CC-BY-Modelle steht unter der Geschichte.

## Offen / Nächster Schritt
- Hochformat-Bilder (486×864) für alle Einstellungen werden noch gerendert. Bis dahin bekommen Handys die Desktop-Folge im Bildausschnitt. Danach mit `pack.py` neu verpacken.
- Echte Gerätetests (iPhone/Safari, Android) stehen aus.

---

# STATUS – Scrollgesteuerte Produktgeschichte (Startseite, 23.10.2026)

Verlauf: Tool → Laptop im Restaurantbüro → Restaurant von oben → Gastraum/Servicestation → Handy-App → Restaurant, Bar, Bankett → gemeinsames Dashboard.

## Szenenstatus
Werte sind Anteile am Fortschritt der Geschichte.
| Szene | Fortschritt | Stand |
| --- | --- | --- |
| 1 Im Tool | 0–0,10 | Echtes Dashboard füllt den Laptop-Bildschirm; H1 und beide Aktionen sofort als HTML. |
| 2 Aus dem Bildschirm | 0,10–0,29 | Rückfahrt über die berechnete Bildschirmposition: Laptop auf dem Schreibtisch, dann das Büro. |
| 3 Der Betrieb | 0,29–0,47 | Aufstieg zur Drohnenansicht; Büro, Restaurant, Bar und Bankett mit Beschriftungen. |
| 4 Wieder ins Restaurant | 0,47–0,62 | Abstieg vor den Gastraum zur Servicestation mit dem Handy auf einem Ständer. Keine Figur, siehe Einschränkungen. |
| 5 In die App | 0,62–0,75 | Das Handy-Display füllt die Ansicht: Team & Aufgaben je Outlet, echte Handy-Ansicht der Demo. |
| 6 Die Outlets | 0,75–0,93 | Restaurant, Bar und Bankett nacheinander, je mit der echten Übersicht und Outlet-Filter (Beispieldaten). |
| 7 Eine Übersicht | 0,93–1 | Gesamtansicht, dann zurück in den Laptop-Bildschirm; Abschluss mit beiden Aktionen. |

## Technik
- **Three.js 0.186 (MIT)**, die einzige neue Abhängigkeit, dazu `@types/three` als Dev-Abhängigkeit.
  - Wird erst nach dem Laden der Startseite per dynamischem Import nachgeladen (ein Chunk, ca. 560 KB unkomprimiert).
  - Die Suite lädt kein 3D (Test L03-3).
- **Steuerung durch Scrollen:**
  - Die Scrollposition ergibt einen Fortschritt von 0 bis 1.
  - Kamera, Texte, Karten und Beschriftungen werden daraus abgeleitet, vorwärts wie rückwärts.
  - Es gibt eine zeitbasierte Glättung von etwa 0,1 s ohne Vorauslaufen und ohne Abfangen von Scrollgesten.
- **Rendering:**
  - Gezeichnet wird nur bei einer Änderung. Außerhalb des sichtbaren Bereichs pausiert es.
  - Die Schattenkarte wird einmal berechnet.
  - Die Pixeldichte ist begrenzt: 1,6 am Desktop, 1,25 im vereinfachten Modus.
- **Vereinfachter Modus:** greift bei Breite unter 768 px oder schwachen Geräten. Dann gibt es weniger Möbel, keine Schatten und kein Antialiasing. Wide-Shots sind im Hochformat weiter entfernt.
- **Rückfallversion:** bei reduzierter Bewegung, fehlendem WebGL, einem Fehler beim Start oder mehr als 12 s Ladezeit, sowie mit `?story=static`. Sie zeigt dieselbe Geschichte als Standbilder aus derselben Szene, mit allen Texten und Aktionen.
- **„Animation überspringen“** ist immer sichtbar und führt hinter die Geschichte (zu Preisen, Demo und Kontakt).

## Assets und Lizenzen
- 3D-Modell: vollständig selbst aus Three.js-Grundformen gebaut (`world.ts`): Gebäude, Möbel, Laptop, Handy, Pflanzen. Holz- und Steinstrukturen werden im Browser per Canvas erzeugt.
  - Es gibt keine externen Modelle, Texturen oder HDRIs, also keine Namensnennung nötig.
  - Die Beleuchtung nutzt das in Three.js enthaltene `RoomEnvironment` (MIT).
- Bildschirminhalte: echte Aufnahmen der aktuellen Demo mit ihren Beispieldaten.
  - Erzeugt mit `web/scripts/story-assets.mjs`: `public/story/screen-dashboard.jpg`, `screen-mobile.jpg`, `outlet-*.jpg`.
- Standbilder für die Rückfallversion: gerendert aus derselben Szene mit `web/scripts/story-stills.mjs` (`public/story/still-*.jpg`).
- Schriften und Farben: vorhanden (Fraunces, Inter; Beige und Petrol).

## Geänderte Dateien
- Neu: `web/src/components/landing/story/{world.ts, engine.ts, story.tsx}`
- Neu: `web/scripts/{story-assets.mjs, story-stills.mjs}`
- Neu: `web/public/story/*`
- Geändert: `web/src/app/page.tsx` (alter Hero-Block durch die Geschichte ersetzt), `web/package.json` und `package-lock.json` (three)
- Tests: `web/e2e/landing.spec.ts` (L03, angepasste Hero-Prüfungen)
- Die Suite selbst ist unverändert.

## Tests
Alle Tests liefen in Chromium headless mit Software-WebGL (SwiftShader). **Keine echten Geräte und keine echte GPU.**
- Breiten 390, 768 und 1440: Bilder an 11 Stellen der Fahrt, kein Querscrollen, keine Konsolenfehler.
- Erstes 3D-Bild nach dem Laden: 1,3–2,3 s mit Software-Rendering. Das ist nicht repräsentativ für echte Geräte; eine Bildrate wird nicht zugesagt.
- Reduzierte Bewegung (390 px): Standbilder statt Canvas, alle Aussagen vorhanden.
- „Animation überspringen“ springt hinter die Geschichte.
- e2e: Landing, Legal und Suite-v13 32/32 inklusive axe-Prüfung der Startseite. Neu sind L03-1 bis L03-3.

## Offen
- Echte Geräte prüfen (iPhone/Safari, Android, schwache Laptops) und Bildrate messen.
- Optional: eine stilisierte Servicekraft. Bewusst weggelassen, weil eine glaubwürdige Figur ohne externes Modell nicht hochwertig gelingt.
- Optional: externe CC0-Möbelmodelle, zum Beispiel aus Poly Haven oder Kenney, wenn mehr Detail gewünscht ist. Im Moment ist alles selbst gebaut.

## Nächster Schritt
Sichtprüfung auf echten Geräten; danach Kamerazeiten und Texte nach Rückmeldung feinjustieren.

---

# STATUS – Visuelle Überarbeitung (23.10.2026)

Nur Darstellung. Nicht geändert: Funktionen, Berechnungen, Daten, Rollen, Preise, Filterlogik, URLs.

## Umgesetzt
- **Gestaltungsschicht `polish.css`** (wird als letzte geladen), mit einheitlichen Variablen:
  - Farben: App-Hintergrund #F4F7F6, Text #203438, Linien #DFE7E3, Petrol #116C63, Bernstein für Prüfhinweise.
  - Ecken 10–12 px, kaum Schatten.
  - Verschachtelte Karten verlieren ihren eigenen Rahmen.
- **Dashboard-Kopf ohne eigene Karte:**
  - Kompakter Titel, Mini-Diagramm als schmale Spalte daneben.
  - Filter in einer Zeile.
  - Ergebnis: Bei 1280×800 sind Filter, Kennzahlen und der erste Handlungshinweis ohne Scrollen sichtbar.
- **Kennzahlen:**
  - Die Zahl steht zuerst (30 px), darunter Bedeutung und Grundlage.
  - Gleich breite Ziffern.
  - Die DB-II-Karte ist nur noch mit einem Strich hervorgehoben, nicht mehr grün eingefärbt.
- **Handlungshinweise:**
  - Artikel als Überschrift, die Kennzahlenzeile darunter, die Grundlage gedämpft.
  - Aktion rechts, auf dem Handy in voller Breite darunter.
  - Gleiche Wörter und Werte wie vorher.
- **Tabellen:** gleichmäßige Zeilen, feine Linien, lesbare Spaltenköpfe (nicht in Großbuchstaben), rechtsbündige Zahlen, dezenter Hover- und Fokuszustand.
- **Seitenköpfe:** eine Größe für alle Module.
- **Preiskalkulation:** Das Ergebnis steht hell mit Petrol-Kante statt im dunklen Block.
- **Bewegung:** Übergänge 0,12 s. Bei der Systemeinstellung „reduzierte Bewegung“ entfallen sie.
- **Handy:**
  - Kurzer Kopf, Kennzahlen in zwei Spalten.
  - Hinweise in voller Breite, Demo-Hinweis ohne Lücke.
- **Website:**
  - Hintergrund #F5F0E6.
  - Neuer Abschnitt „Im Detail“ mit drei echten, lesbaren Ausschnitten aus der Demo: Artikelhinweis, Rezeptkalkulation, Bestellvorschlag. Erzeugt mit `web/scripts/suite-details.mjs`.
  - Die vorhandenen Produktbilder und das Video sind aus dem neuen Stand neu aufgenommen.

## Dateien
- `web/public/suite/src/polish.css` (neu)
- `web/public/suite/index.html`, `web/public/suite/sw.js` (Datei und Cache-Name)
- `web/public/suite/src/app.js` (nur das Markup der Hinweise: Überschrift und Zeile)
- `web/src/app/page.tsx`, `web/src/app/globals.css`
- `web/public/landing/*` (Bilder)
- `web/scripts/suite-details.mjs`
- Tests: `web/e2e/suite-v13.spec.ts` (Selektor für das neue Hinweis-Markup), `web/e2e/landing.spec.ts` (Hintergrundfarbe)

## Prüfungen
- Breiten 360, 390, 768, 1280 und 1440 px im Chromium-Browser, Handy mit Touch-Emulation. Seiten: Startseite und Preise, Übersicht, Berichte, Deckungsbeiträge & Zielpreise, Bestell-Forecast, Erste Schritte, Aufgaben.
  - Ergebnis: kein Querscrollen, keine Konsolenfehler.
- axe-Prüfung in S23. Dabei gefunden und behoben: Kontrast des grauen Kleintexts in der markierten Zeile.
- Tests:
  - Unit 160/160.
  - vitest 60 bestanden, 34 übersprungen.
  - tsc ohne Fehler.
  - Suite- und Startseiten-e2e 99/99, nach den letzten Korrekturen 32/32.
  - Volltest (23:15–23:30 UTC): 312 bestanden, 3 fehlgeschlagen. Keiner der drei betrifft geänderte Teile:
    - F02-E4 (Rezept per Tastatur) ist unter Last gekippt und besteht im Einzellauf 12/12.
    - F06-H2 und H-E2 sind die bekannten Tagesgrenzen-Fälle (Lauf zwischen 22 und 24 Uhr UTC).
- Preise und Rechenlogik: `pricing.ts`, `core.js` und `v04core.js` sind unverändert. Die Preis-Tests sind grün.
- Kein echtes Gerät, keine Prüfung mit Textvergrößerung über Systemeinstellungen.

## Offen
- Textvergrößerung (200 %) und Safari/iOS auf echten Geräten prüfen.
- Ältere Module mit eigenen Styles (v4/v5) folgen den Variablen nur teilweise. Die Unterschiede sind klein.

## Nächster Schritt
Volltest abwarten, dann Sichtprüfung durch die Fachseite.

---

# STATUS – Geräte-Runde GLB AI Suite (Desktop, Tablet, Handy · Oktober 2026)

Stand: 22.10.2026 · Branch `claude/replica-skill-install-vzriug`

## Pakete dieser Runde
| Paket | Inhalt | Stand |
| --- | --- | --- |
| P1 | Detail-Links: Bar → Limonade → Lebenszyklus mit Outlet; Bestellhinweis betriebsweit gekennzeichnet; überfällige Aufgaben nach Outlet; „Zielpreis ansehen“ öffnet den Artikel | erledigt |
| P2 | Zwei Preisziele (Ziel-Warenquote / kalkulatorische Untergrenze), Handy-Karten für die Tabelle | erledigt |
| P4a | „−0,00 €“ → „0,00 €“; Forecast-Kachel „Rohwaren ohne Bestellvorschlag“ zählt, was sie aufschlüsselt | erledigt |
| P3 | Handy: Filterpanel mit Zusammenfassung (bleibt oben), Touch-Ziele ≥ 44 px, `viewport-fit=cover` für Safe Areas, Eingaben ≥ 16 px und über der Tastatur, Wisch-Hinweis bei breiten Tabellen, Inventur-Filter, Aufgaben-Häkchen 44 px, einklappbare Menübereiche; Demo-Fälligkeiten relativ zu heute (Berliner Tag) | erledigt |
| P4b | Rest „KI-Marktcheck“ entfernt (Tab-Beschriftung, Herkunft, Modulname, Startseite); Erste Schritte in Phase 1 (erste Auswertung) und Phase 2 (später: Lager und Bestellung) getrennt | erledigt |
| P5 | Tarife: Karten mit Für wen / Problem / vorgeschlagener Umfang / Start / nicht angebunden; Premium hervorgehoben mit Begründung (+20,99 €); Individuell mit Entwicklungsgebühr zuerst; Nutzer-Rechner (Annahmen genannt); CTAs „Mit eigenen Daten vorführen lassen“ / „Demo ohne Anmeldung öffnen“; Abrechnungsseite zeigt Tarife aus derselben Quelle; `TARIFMATRIX.md` zur Freigabe | erledigt |
| P6 | Abläufe A–D bei 360/390/430/768/1280/1440 (`web/scripts/journeys.mjs`), Tastatur und axe (S23), dabei gefundene Fehler behoben | erledigt (Volltest siehe unten) |

Geänderte Dateien (P1/P2/P4a): `web/public/suite/src/{app.js, core.js, v04core.js, calm.css, v11/core.mjs}`, `web/suite-tests/tests/v13.test.cjs`, `web/e2e/suite-v14.spec.ts`, `web/e2e/suite-v13.spec.ts` (Kachelname).
Tests nach P1/P2/P4a: Unit 160/160; e2e suite-v13 + suite-v14 17/17.
Geänderte Dateien P3: `web/public/suite/{index.html, src/app.js, src/v08ui.js, src/mobile.js, src/mobile.css, src/calm.css, src/v11/ui.mjs, src/v11/demo.mjs}`, `web/e2e/suite-v14.spec.ts` (S21, S22).
Tests nach P3: alle Suite-e2e-Specs 80/80; Unit 160/160.
Geänderte Dateien P5: `web/src/lib/pricing.ts` (+ `pricing.test.ts`), `web/src/components/landing/price-calculator.tsx` (neu), `web/src/app/page.tsx`, `web/src/components/landing/site-chrome.tsx`, `web/src/app/(app)/settings/billing/page.tsx`, `web/e2e/landing.spec.ts` (L02), `TARIFMATRIX.md`.
Tests nach P5: vitest pricing 3/3; Landing/Legal/Lead-Form e2e 21/21; tsc ohne Fehler.
## Geräteprüfung (P6) – was tatsächlich lief
Chromium (Playwright) mit Handy- bzw. Tablet-Emulation: Viewport, Touch, `isMobile` unter 700 px, deutsche Sprache, Zeitzone Berlin. **Kein echtes Gerät, kein Safari/iOS, keine echte Bildschirmtastatur.**

| Breite | A Angebot → Preise → Rechner → Anfrageformular (nicht abgeschickt) | B Demo → Bar → Limonade → Lebenszyklus → Zurück → Zielpreis | C Eigene Daten → Speisekarte importieren → nächster Schritt | D Aufgabe anlegen + abhaken, Inventur buchen |
| --- | --- | --- | --- | --- |
| 360 | ok | ok | ok | ok |
| 390 | ok | ok | ok | ok |
| 430 | ok | ok | ok | ok |
| 768 | ok | ok (nach Fix) | ok | ok (nach Fix) |
| 1280 | ok | ok | ok | ok |
| 1440 | ok | ok | ok | ok |
Jede Station ohne Querscrollen, keine Konsolenfehler.
Gefunden und behoben bei 768 px:
- Demo-Hinweis schob seine Schaltfläche über den Rand.
- Unsichtbare Tabellenbeschriftung (sr-only) vergrößerte die Seitenbreite um 397 px.
- Kontrast der unteren Leiste lag bei 3,9 : 1 und ist jetzt höher.

## Volltest am Ende der Runde (22.10.2026, 22:45–23:00 UTC)
- Playwright, gesamtes Projekt: **313 bestanden, 2 fehlgeschlagen.**
  - Die zwei Fehler liegen außerhalb dieser Runde: F06-H2 (Bestellvorschlag) und H-E2 (HACCP-Vortag). Beide Bereiche wurden nicht geändert.
  - Ursache ist eine Tagesgrenze: Die Testdaten setzen „gestern“ bzw. „letzte Wochen“ nach UTC, die App rechnet nach Berliner Tag. Zwischen 22 und 24 Uhr UTC zeigen beide auf verschiedene Tage.
  - Der Testlauf fiel in genau dieses Fenster. Zu einer anderen Uhrzeit waren alle 301 Tests grün.
  - Offen: Die Seed-Daten auf den Berliner Tag umstellen.
- Unit (`npm run test:suite`): 160/160.
- vitest: 60 bestanden, 34 übersprungen (brauchen DB).
- tsc ohne Fehler.

Gefundener Fehler nebenbei: Demo-Aufgaben hatten feste Fälligkeiten (22.10.2026) → wurden ab Mitternacht Berliner Zeit „überfällig“; Übersicht rechnete „heute“ in UTC, Aufgabenliste in Berliner Zeit. Beides vereinheitlicht.

---

# Vorherige Runde (Kundenablauf)


Stand: 22.10.2026 · Branch `claude/replica-skill-install-vzriug` · Ausgangsstand `2584595`

## Kunden-Durchlauf vor den Änderungen (lokal, Demo im Browser)
Getestet durch Klicken: Startseite → „Live ausprobieren“ → Übersicht, alle Menüpunkte, Filter, Zurück-Taste.
- Start ohne Adresse zeigte das Dashboard, markiert war „Mein Arbeitsplatz“ (Fehler C).
- Dashboard: „Netto-Umsatz · alle Monate“ mit einem Septembervergleich darunter; Hinweise ohne Artikel.
- Report Studio: Kostenbasis „Kostenstand im Verkaufsmonat“, Kachel „Aktuelle Produktkosten“, Tabelle „nicht historisiert“, Fußzeile „aktuelle variable Produktkosten“ (Fehler A; gerechnet wurde richtig, beschriftet falsch).
- Bestell-Forecast: oben „0 ohne Bestand“, Reporting „Rohwaren ohne Bestand 1“ (Fehler B: zwei Definitionen); Mengen wie „12.616,07 g“.
- Mission Control „keine Hinweise“, GLB Intelligence 4, Cockpit 2; Dezimalpunkt in Hinweisen; Einrichtung, Hinweise, Import und Mission Control hängten das ganze Dashboard unten an.
- Demo ohne Fixkosten (Zielpreise nicht berechenbar) und ohne Wettbewerbsbeobachtungen; eigener Betrieb bekam den Demo-Standort Düren.
- Keine Konsolenfehler.

## Erledigt
- **Navigation**: fünf Bereiche (Übersicht · Verkauf & Preise · Einkauf & Lager · Service & Team · Einrichtung & Daten), alle Seiten erhalten, klare Namen (Übersicht, Heute zu tun, Monatsabschluss, Berichte & Export, Hinweise, Wettbewerbspreise, Datenqualität, Erste Schritte). Start = Übersicht (Leitung) bzw. Heute zu tun (Mitarbeitende). Adresse, Seitenname oben und aktiver Menüpunkt stimmen immer; Direktlinks (auch auf später geladene Module), Zurück/Vor, unbekannte Adressen. Mobil: untere Leiste beginnt mit „Übersicht“.
- **Übersicht**: „Handlungsbedarf“ direkt unter den Kennzahlen – nur aus Daten und eigenem Ziel: Artikel über der eigenen Ziel-Warenquote (mit Wareneinsatz ÷ Netto-Umsatz), Artikel ohne Wareneinsatz, Absatzrückgang (Regel der Lebenszyklen, mit Monaten), Bestellbedarf, überfällige Aufgaben; je mit Direktlink. Ohne eigenes Ziel keine Gut/Schlecht-Bewertung. Gesamtsumme nennt ihren Zeitraum („Summe April bis September 2026, 6 Monate“), Monatsvergleich nur bei gewähltem Monat. Begriffe DB I, DB II, Warenquote, Kostenbasis, Szenario erklärt.
- **Widersprüche**: Report Studio nennt überall die gewählte Kostenbasis (Kachel, Tabelle, Fußzeile, Export); Artikelseite sagt offen „heutige Produktkosten“. Forecast und Reporting zählen mit einer gemeinsamen Definition (ohne gezählten Bestand, Bestand 0, in keinem Rezept, ohne Tagesabsatz, Einheit nicht umrechenbar, Artikel ohne Rezept), Mengen in kg/l/Stk. Datenqualität listet Daten- und Lagerprobleme, kaufmännische Hinweise stehen in der Übersicht. Deutsches Zahlenformat in Hinweisen. Keine doppelte Dashboard-Kopie mehr unter Einrichtung, Hinweise, Import, Datenqualität.
- **Wettbewerbspreise** (ehem. KI-Marktcheck): „Wettbewerbspreisvergleich mit optionaler KI-Einordnung“; vier Schritte mit automatisch/manuell/optional; KI-Status vom Server (`GET /api/suite/market/status`, nur ja/nein, kein Schlüssel); Kundinnen und Kunden verwalten keine Schlüssel; fiktive Demo-Zeilen gehen nie an die KI.
- **Demo**: Monatsfixkosten (als Beispielwerte markiert) → Zielpreise berechenbar; vier klar fiktive Wettbewerbsbeobachtungen (vergleichbar, nicht vergleichbar, umgerechnet, zu prüfen) ohne echte Quelle. Eigene Daten: kein Demo-Standort, keine Fixkosten, keine Beobachtungen.
- **Erste Schritte**: Betrieb/Outlets → Speisekarte → Verkäufe → Kosten → erste Auswertung, je mit Status aus den Daten, benötigten Angaben, Formaten, Vorlage und Ziel; Lager/Inventur danach.
- **Preise**: Standard 89,00 € / Premium 109,99 € pro Kunde und Monat zzgl. 2,99 € pro Nutzer und Monat; Individuell: Entwicklungsgebühr nach Vereinbarung zzgl. 29,99 € pro Monat – als **vorläufig** veröffentlicht, ohne erfundene Leistungen. § 19-Hinweis entfernt (Steuerstatus offen). AGB § 4 neutral. Online-Abschluss gesperrt bis `PLANS_FINAL=1` (Verwaltung bestehender Abos bleibt möglich); Stripe-Produkte unverändert. Doku, Store-Texte, `.env.example` angepasst.
- **Startseite**: „Kurz beantwortet“ (Entscheidung, Datenimport, laufende Arbeit, Kosten, Test mit eigenen Daten) direkt nach dem Einstieg; vier Abläufe mit Bild statt sechs; Modulliste als kurzer Index der fünf Bereiche; Zahlenleiste entfernt; „Vorführung anfragen“ im Kopf und Einstieg; kein Zeitversprechen; neue Screenshots und Rundgang-Video aus dem aktuellen Stand.

## Betroffene Dateien
`web/public/suite/src/{app.js, v08ui.js, v08roles.js, mobile.js, core.js, v04core.js, calm.css, v11.css}`, `web/public/suite/src/v11/{ui.mjs, demo.mjs, market.mjs}`, `web/src/lib/{pricing.ts, suite-api.mjs}`, `web/src/app/{page.tsx, actions.ts, legal/terms/page.tsx, (app)/settings/billing/*}`, `web/src/app/api/suite/market/status/route.ts`, `web/scripts/suite-shots.mjs`, `web/public/landing/*`, Tests in `web/e2e`, `web/suite-tests`, Doku in `replica/`.

## Tests (22.10.2026)
- Logik/Server `npm run test:suite`: 156/156 · Original-ZIP 26/26 · SQL 8+8+8+7+5 · vitest 57 bestanden, 34 übersprungen (brauchen DB) · tsc und Lint ohne Fehler.
- Browser, gesamtes Projekt (`npx playwright test`): 301/301 bestanden (13,3 min), darunter neu S15–S18 (Navigation, Handlungsbedarf, Kostenbasis, Forecast-Definitionen, Erste Schritte, eigene Daten, Wettbewerbspreise) und S14-0 (fiktive Demo-Beobachtungen).
- Handybreite 390 px ohne horizontales Scrollen: Übersicht, Erste Schritte, Wettbewerbspreise, Bestell-Forecast, Berichte, Startseite.
- Nicht geprüft: echte Vorschau-URL (vercel.app von hier gesperrt), echtes Supabase/Stripe, echte KI-Antwort, echte OpenStreetMap-Antworten (in Tests nachgebildet), echte Geräte.

## Offen / Entscheidungen (Tarife)
1. Welche Leistungen unterscheiden Standard und Premium?
2. Ist ein Nutzer im Grundpreis enthalten oder wird jeder Nutzer berechnet?
3. „Kunde“ = Unternehmen, Betrieb oder Standort?
4. Welche laufenden Leistungen decken die 29,99 € bei individuellen Lösungen?
5. Wann und nach welchem Zahlungsplan wird die Entwicklungsgebühr berechnet?
6. Umsatzsteuerstatus des Anbieters von GLB (nicht aus Mattias Segato Consulting abgeleitet) – davon hängen Preisanzeige (netto/brutto), Impressum-Angabe und Rechnungen ab.
Danach: Stripe-Preise anlegen (Basis + Menge Nutzer), Checkout-Menge im Code von Outlets auf Nutzer umstellen, `PLANS_FINAL=1` setzen, AGB § 4 ergänzen.

Weitere offene Punkte: `replica/launch/listing.json` beschreibt noch alte Funktionen (Zentralküche, Barcode, HACCP) – vor einer Store-Veröffentlichung neu schreiben. Impressum nennt weiterhin „Kleinunternehmer nach § 19 UStG“ für Mattias Segato Consulting – prüfen, ob das der Anbieter von GLB ist.

## Nächster Schritt
Antworten zu den Tarifpunkten 1–6 einholen; dann Checkout-Logik und AGB final machen.
