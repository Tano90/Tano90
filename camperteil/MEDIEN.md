# Medien- und Lizenznachweise

Alle Dateien liegen in `dist/assets/` und werden von der eigenen Website ausgeliefert. Es werden keine Medien von fremden Servern eingebunden.

## Filme

| Datei | Quelle | Bearbeitung |
|---|---|---|
| `video/hero-wide.webm`, `video/hero-wide.mp4`, `img/hero-wide.jpg` | Mixkit 4122, „An off road camper van by the lake“ (Beitrag von dubassy), https://mixkit.co/free-stock-video/an-off-road-camper-van-by-the-lake-4122/ | Farbe und Helligkeit angepasst (Sättigung 0,66, Helligkeit 0,84), nahtlose Schleife durch 1 s Überblendung von Ende in Anfang, 1280 × 720, 8,2 s, ohne Ton |
| `video/hero-tall.webm`, `video/hero-tall.mp4`, `img/hero-tall.jpg` | wie oben | zusätzlich Hochformat-Ausschnitt 540 × 720 auf die Fahrzeugfront (x = 300) für Handys |
| `video/journey-wide.webm`, `video/journey-wide.mp4`, `img/journey-wide.jpg` | Mixkit 4070, „Time lapse of a green meadow“, https://mixkit.co/free-stock-video/time-lapse-of-a-green-meadow-4070/ | Sättigung 0,68, Helligkeit 0,86, nahtlose Schleife, 1280 × 720, 11 s, ohne Ton |
| `video/journey-tall.webm`, `video/journey-tall.mp4`, `img/journey-tall.jpg` | wie oben | Hochformat-Ausschnitt 540 × 720 (Mitte) |

Lizenz laut Übergabe (DESIGN_NOTES.md): Mixkit Stock Video Free License, kommerzielle und private Nutzung, https://mixkit.co/license/.
Die Mixkit-Seiten waren aus der Arbeitsumgebung dieser Revision nicht erreichbar. Die Lizenzangabe wurde deshalb aus der Übergabe übernommen und nicht erneut am Original geprüft.

Hinweis: Im Hero-Film ist ein Geländewagen mit erkennbarem Markenschriftzug am Kühlergrill zu sehen. Es handelt sich um eine Stockaufnahme, nicht um Material des Herstellers. Vor dem Start sollte geprüft werden, ob das für den Auftritt gewünscht ist.

Kodierung: ffmpeg, H.264 (libx264, CRF 26, `+faststart`) und VP9 (libvpx-vp9, CRF 36 bis 41). Die Seite wählt WebM, wenn der Browser VP9 abspielt, sonst MP4. Standbilder sind jeweils das erste Bild des bearbeiteten Films, damit der Übergang vom Standbild zum Film nicht springt.

Die ursprünglichen Dateien `camper-lake.mp4` (3,0 MB), `landscape.mp4` (2,6 MB) und die zugehörigen Poster aus der Übergabe sind ersetzt.

## Schriften

- Archivo, nur Gewichtsachse, lateinischer Zeichensatz (`fonts/archivo-wght.woff2`), SIL Open Font License 1.1, aus `@fontsource-variable/archivo` 5.3.0. Lizenz: `fonts/LICENSE-Archivo-OFL.txt`
- IBM Plex Sans und IBM Plex Mono, SIL Open Font License 1.1, aus `@fontsource/ibm-plex-sans` und `@fontsource/ibm-plex-mono` 5.3.0. Lizenz: `fonts/LICENSE-IBM-Plex-OFL.txt`

## Software

- Three.js 0.180.0 (`vendor/three.core.min.js`, `vendor/three.module.min.js`) und OrbitControls aus dem offiziellen npm-Paket `three@0.180.0`, MIT-Lizenz: `vendor/LICENSE-three.txt`. In `OrbitControls.js` ist nur der Importpfad auf `three.module.min.js` geändert.

## Eigene Darstellungen

- Technische Zeichnungen (Fensterriegel, Teile-Tafel, Messschieber) und das 3D-Modell der Abdeckung sind eigene, illustrative Darstellungen ohne Bezug zu einem realen Bauteil.
- Die Oberflächennarbung des 3D-Modells wird im Browser aus Zufallswerten erzeugt; es gibt keine Texturdateien.
