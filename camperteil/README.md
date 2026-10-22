# Camperteil

Website für Camperteil, ein Angebot von Mattias Segato Consulting: Anfragen für kleine Kunststoff-Ersatzteile älterer Wohnmobile.
Statisches HTML/CSS/JS ohne Build-Schritt und ohne externe Abrufe. Schriften liegen in `assets/fonts` (SIL Open Font License, Lizenztexte daneben).

## Inhalt

```
index.html              Startseite mit Anfrage-Ablauf
impressum.html          Entwurf mit Platzhaltern
datenschutz.html        Entwurf mit Platzhaltern
assets/css/site.css     Gestaltung
assets/js/app.js        Navigation, Zeichnungen, Anfrage-Ablauf, Versand-Schalter
assets/fonts/           Archivo, IBM Plex Sans, IBM Plex Mono (woff2)
assets/img/favicon.svg
scripts/build-single.mjs  baut eine Einzeldatei-Vorschau
tests/flow.mjs          Browserprüfung (erzeugt seine Testbilder selbst)
package.json, package-lock.json
```

## Voraussetzungen

- Node.js 18 oder neuer (getestet mit 22) und npm
- Python 3 (nur für den lokalen Testserver; jeder andere statische Server geht auch)
- Für `npm test`: ein Chromium/Chrome. Pfad über `CHROMIUM_PATH`, Standard `/opt/pw-browsers/chromium`

## Befehle

Alle Befehle im Ordner `camperteil/`.

```sh
# Abhängigkeiten exakt nach Lockdatei installieren (nur playwright-core für die Tests)
npm ci

# Website lokal ausliefern: http://localhost:4173
npm run serve

# Browserprüfung, in einem zweiten Terminal, während der Server läuft
npm test
# mit anderem Browserpfad oder Server:
CHROMIUM_PATH=/usr/bin/chromium BASE_URL=http://localhost:4173 npm test

# Einzeldatei-Vorschau (Schriften eingebettet) nach dist/camperteil-vorschau.html
npm run preview:single
```

Ein Build ist für die Website nicht nötig. Zum Veröffentlichen genügt es, `index.html`, `impressum.html`, `datenschutz.html` und `assets/` auf einen beliebigen statischen Hoster zu kopieren.

`npm test` prüft Darstellung (Handy, Tablet, Desktop, hell und dunkel), Navigation und den gesamten Anfrage-Ablauf einschließlich Fehlerfällen. Bildschirmfotos und die erzeugten Testdateien landen in `test-results/`.

## Versand der Anfrage

Der Versand ist **nicht eingerichtet**. Solange das so ist:

- zeigt die Seite oben im Formular und in der Übersicht den Hinweis „Versand noch nicht eingerichtet“,
- gibt es keinen Senden-Knopf und keine Erfolgsmeldung,
- lassen sich die Angaben nur kopieren oder als Textdatei speichern (ohne Fotos).

### Später anbinden

1. Einen Server-Endpunkt bereitstellen, der `POST` mit `multipart/form-data` annimmt. Felder:

   | Feld | Inhalt |
   |---|---|
   | `make`, `model`, `year`, `chassis` | Fahrzeug |
   | `partName`, `location`, `dimL`, `dimB`, `dimH`, `marking`, `color`, `qty`, `desc` | Teil und Maße (Maße als Text, Komma oder Punkt) |
   | `dimsEstimated`, `consent` | `ja` oder `nein` |
   | `name`, `email`, `phone` | Kontakt |
   | `photos` | eine bis acht Bilddateien, je höchstens 15 MB |

2. Den Endpunkt in `index.html` **vor** `assets/js/app.js` eintragen:

   ```html
   <script>window.CAMPERTEIL_CONFIG = { submitEndpoint: "/api/anfrage" };</script>
   ```

3. Dann blendet die Seite den Hinweis aus und zeigt „Anfrage senden“. Erfolg meldet sie nur, wenn der Endpunkt mit HTTP 2xx antwortet. Bei Fehlern bleiben alle Eingaben erhalten.

Der Endpunkt muss die Prüfungen auf dem Server wiederholen (Pflichtfelder, Dateityp und -größe, Anzahl), sollte eine Begrenzung gegen massenhafte Anfragen haben und die Fotos sicher ablegen. **Keine Zugangsdaten oder API-Schlüssel in `app.js` oder `index.html` schreiben.** Schlüssel für E-Mail- oder Speicherdienste gehören als Umgebungsvariablen auf den Server hinter dem Endpunkt. Wenn der Versand läuft, müssen `datenschutz.html` (Empfänger, Weitergabe an den Fachbetrieb, Speicherdauer) und der FAQ-Eintrag „Was passiert mit meinen Fotos?“ angepasst werden.

## Offen vor dem Start

- Impressum und Datenschutz sind Entwürfe mit markierten Platzhaltern.
- Fotos: Die Seite nutzt eigene technische Zeichnungen (als Beispiele gekennzeichnet). Echte Fotos fehlen noch.
- Partnerbetrieb: im Text als „noch nicht bestätigt“ geführt (Abschnitt „Stand“, Ablauf Schritt 3, Fragen).
- Fotos werden nicht im Entwurf gespeichert und gehen beim Neuladen verloren.
