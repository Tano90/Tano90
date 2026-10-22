# Camperteil

Website für Camperteil, ein Angebot von Mattias Segato Consulting: Anfragen für kleine Kunststoff-Ersatzteile älterer Wohnmobile.
Statische Website in `dist/`, ohne Build-Schritt und ohne Abrufe von fremden Servern (Schriften, Filme und Three.js liegen lokal).

Der Anfrageversand ist **nicht eingerichtet**. Die Seite sagt das sichtbar und täuscht keinen Versand vor.

## Inhalt

```
dist/                         Auslieferung (diesen Ordner hochladen)
  index.html                  Startseite mit Film, 3D-Werkbank und fünfstufiger Anfrage
  nachweise.html              Bild-, Video- und Lizenznachweise
  impressum.html              Entwurf mit Platzhaltern
  datenschutz.html            Entwurf mit Platzhaltern
  assets/css/site.css         Grundgestaltung, Formular, Zeichnungen
  assets/css/experience.css   Filmische Fassung: Kopfzeile, Filme, Werkbank, Typografie
  assets/js/app.js            Navigation, Stückliste, Höhenlinien, Anfrage-Ablauf, Versand-Schalter
  assets/js/experience.js     Filme, Kopfzeile, Einblendungen, Bedienung der Werkbank
  assets/js/part3d.js         WebGL-Ansicht (Three.js), wird erst kurz vor der Werkbank geladen
  assets/js/software3d.js     Canvas-Ansicht für Geräte ohne (schnelles) WebGL
  assets/vendor/              Three.js 0.180.0 (minifiziert) und OrbitControls, MIT
  assets/video/               je Film: Querformat und Hochformat, WebM (VP9) und MP4 (H.264)
  assets/img/                 Standbilder (erstes Bild der Filme), Favicon
  assets/fonts/               Archivo (Gewichtsachse), IBM Plex Sans/Mono, OFL
scripts/build-preview.mjs     erzeugt preview/index.html für eine private Claude-Artifact-Vorschau
tests/flow.mjs                Browserprüfung (siehe unten)
MEDIEN.md                     Herkunft und Bearbeitung aller Medien
design-system/camperteil/     Designsystem (MASTER.md) und Rohausgaben der UI-UX-Pro-Max-Abfragen
PRUEFSTATUS.md                was tatsächlich geprüft wurde und was offen ist
```

## Voraussetzungen

- Node.js 18 oder neuer (geprüft mit 22) und npm
- Python 3 für den lokalen Server (jeder statische Server geht)
- Für die Tests ein Chromium oder Chrome; Pfad über `CHROMIUM_PATH`

## Befehle

Alle Befehle im Ordner `camperteil/`.

```sh
npm ci                     # installiert nur playwright-core (für die Tests)
npm run serve              # http://localhost:4173 aus dist/

# in einem zweiten Terminal, während der Server läuft:
CHROMIUM_PATH=/absoluter/pfad/zu/chromium BASE_URL=http://localhost:4173 npm test

npm run preview            # baut preview/index.html (nur für die Artifact-Vorschau)
```

Veröffentlichen: den Inhalt von `dist/` auf einen statischen Hoster kopieren. Videos und 3D brauchen die mitgelieferten Dateien; eine einzelne HTML-Datei reicht nicht.

## Was die Tests prüfen

`tests/flow.mjs` startet Chromium mit SwiftShader, damit WebGL ohne Grafikkarte läuft. Das prüft den WebGL-Code, nicht die Darstellung auf einer echten GPU.

- Darstellung bei 320, 390, 768 und 1440 px: kein seitliches Scrollen, eigene Schriften geladen, keine Schrift unter 11 px, Bedienelemente auf dem Handy mindestens 44 × 44 px, Hauptaktion im ersten Bild
- Kontrast der Textfarben, berechnet aus den tatsächlichen Farben (mindestens 4,5:1, große Schrift 3:1)
- Navigation: Menü, Sprungmarken, Kopfzeile weicht beim Lesen aus und kommt beim Zurückscrollen, mobile Schaltfläche verdeckt weder 3D-Bühne noch Formular
- Tastatur: Sprunglink, sichtbarer Fokus, Hauptaktion per Tab und Enter
- Filme: Standbild zuerst, stummer Start, Anhalten und Starten, zweiter Film erst im Bild, Pause außerhalb des Bildes, gesperrtes Autoplay, weniger Bewegung, Datensparmodus, Ladefehler
- 3D mit WebGL: Ausgangsansicht, kein Zeichnen ohne Bewegung oder außerhalb des Bildes, Maus, Mausrad (scrollt die Seite; Strg zoomt), Zoom-Knöpfe, Farbe, Explosion mit Beschriftung, Drahtgitter, Drehen, Zurücksetzen, Tastatur, Ansagen für Screenreader, Kontextverlust
- 3D per Touch: waagerecht wischen dreht, senkrecht scrollt, zwei Finger zoomen
- 3D ohne WebGL (Canvas-Ansicht) und ganz ohne Canvas (Standbild, Regler deaktiviert); automatische Qualitätsanpassung bei langsamer Darstellung
- Gesamter Anfrage-Ablauf: Dateiprüfung, Fehlermeldungen, Zurück, Ändern, Neuladen mit Textentwurf, Löschen; Browser-Zurück und -Vorwärts gehen schrittweise
- Designsystem: Text auf der Hauptaktion mindestens 4,5:1, Fokusringe auf hellen und dunklen Flächen mindestens 3:1, Fokus nicht von der Kopfzeile verdeckt, Wege zur Anfrage
- 3D-Blickwinkel Schräg, Vorne, Seite in WebGL und Canvas-Ansicht
- Unterseiten bei 320 und 1440 px: gleiche Flächen und Kopfzeile, Überschrift nicht verdeckt, kein Überlauf

## Designsystem

`design-system/camperteil/MASTER.md` beschreibt Farben mit Rollen, Typografieskala, Abstände, Komponenten, Zustände, Bewegung und mobile Regeln. Die Werte stehen als CSS-Variablen am Anfang von `dist/assets/css/experience.css`. Neue Komponenten nutzen die Rollen (`--color-*`, `--space-*`, `--text-*`, `--dur-*`), keine Rohwerte.

## Versand später anbinden

1. Einen Server-Endpunkt bereitstellen, der `POST` mit `multipart/form-data` annimmt. Felder: `make`, `model`, `year`, `chassis`, `partName`, `location`, `dimL`, `dimB`, `dimH`, `marking`, `color`, `qty`, `desc`, `dimsEstimated` und `consent` (`ja`/`nein`), `name`, `email`, `phone`, dazu `photos` (1 bis 8 Bilder, je bis 15 MB).
2. In `dist/index.html` **vor** `assets/js/app.js` eintragen:
   ```html
   <script>window.CAMPERTEIL_CONFIG = { submitEndpoint: "/api/anfrage" };</script>
   ```
3. Erfolg zeigt die Seite nur bei HTTP 2xx. Bei Fehlern bleiben alle Eingaben erhalten.

Der Endpunkt muss alle Prüfungen auf dem Server wiederholen und braucht eine Begrenzung gegen massenhafte Anfragen. Keine Zugangsdaten oder Schlüssel in `dist/` schreiben. Danach `datenschutz.html` und den FAQ-Eintrag zu den Fotos anpassen.

## Offen vor dem Start

Siehe `PRUEFSTATUS.md`: Rechtstexte mit Platzhaltern, kein bestätigter Partner, kein Versandweg, Prüfung auf echten Geräten.
