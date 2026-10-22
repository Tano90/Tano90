# Prüfstatus und offene Punkte

Stand: 22.10.2026, Revision „Cinematik, 3D, Handy“. Alle Angaben beziehen sich auf den Code in diesem Ordner.

## Tatsächlich durchgeführt

### Automatischer Browsertest `tests/flow.mjs`
Chromium 141 (Playwright-Build) mit SwiftShader. Zwei vollständige Läufe nacheinander ohne Fehler, zuletzt 170 von 170 Prüfungen bestanden. Inhalt siehe README.md. Wichtig:

- WebGL lief über **SwiftShader**, also in Software auf der CPU. Das prüft den WebGL-Code (Szene, Bedienung, Kontextverlust), **nicht** die Darstellung oder Geschwindigkeit auf einer echten Grafikkarte.
- Für die WebGL-Bedienprüfungen ist die automatische Qualitätsanpassung abgeschaltet (`window.CAMPERTEIL_3D = { adaptive: false }`), weil SwiftShader sonst wie vorgesehen auf die Canvas-Ansicht wechselt. Die Anpassung selbst wird in einem eigenen Schritt geprüft (sie senkte in SwiftShader bei 1440 px die Qualitätsstufe auf 1).
- Touch wurde mit Handy-Emulation und erzeugten Zeiger-Ereignissen (`pointerType: touch`) geprüft, nicht auf einem echten Gerät.
- Gesperrtes Autoplay wurde nachgestellt, indem `play()` ohne Nutzergeste abgelehnt wird. Der Datensparmodus wurde über ein nachgebildetes `navigator.connection.saveData` geprüft.
- Der Playwright-Chromium spielt kein H.264. Geprüft wurde deshalb die WebM/VP9-Fassung; die MP4-Dateien wurden nur mit ffprobe auf Format, Größe und Dauer geprüft.

### Sichtprüfung
Bildschirmfotos bei 320, 390, 768 und 1440 px (Hero, Stand, Teile, Werkbank, Reisefilm, Anfrage) sowie 3D in Ruhe, Explosion, Drahtgitter, Handy und Canvas-Ansicht angesehen. Dabei gefunden und behoben: Hero-Text unter der Kopfzeile auf 320 px, umbrechende Schrittleiste im Hero, Schrauben verließen in der Explosionsansicht das Bild, fehlende Rippen in der Canvas-Ansicht.

### Labormessungen (keine Felddaten)
Lighthouse 12.8.2, lokaler Server, simulierte Drosselung. Mobil drei Läufe, Desktop ein Lauf.

| | vorher (Übergabe) | nachher |
|---|---|---|
| Mobil Leistung | 0,45 bis 0,48 | 0,94 bis 0,95 |
| Mobil LCP | 5,1 bis 7,1 s | 2,7 s |
| Mobil CLS | 0 | 0 |
| Mobil TBT | 570 bis 2.610 ms | 0 ms |
| Übertragene Daten beim Laden | 1.277 KiB | 465 KiB |
| Desktop Leistung / LCP | 0,74 / 0,6 s | 1,0 / 0,6 s |
| Barrierefreiheit, Best Practices, SEO | 1 / 1 / 1 | 1 / 1 / 1 |

Das Ziel LCP ≤ 2,5 s ist im mobilen Labor mit 2,7 s **knapp verfehlt**. CLS ≤ 0,1 ist erreicht.

INP lässt sich mit Lighthouse nicht messen. Ersatzweise wurde die Dauer bis zum nächsten Bild je Bedienschritt mit der Event-Timing-API gemessen (Handy-Viewport, Chromium ohne Grafikkarte):
- Menü, Film-Knopf, Stückliste, Formular „Weiter“, FAQ: 40 bis 160 ms, auch bei vierfach gedrosselter CPU.
- Bedienknöpfe der 3D-Werkbank: ohne Drosselung 30 bis 300 ms, bei vierfach gedrosselter CPU bis 650 ms. Die Zeit entsteht beim Zeichnen ohne Grafikkarte (Software-Rasterung). Auf Geräten mit GPU ist das nicht gemessen. Gegenmaßnahmen sind umgesetzt: Knopfzustand wird vor dem 3D-Bild gezeichnet, Qualitätsstufen, Wechsel auf Canvas bei dauerhaft langsamer Darstellung.

## Noch zu prüfen

- Echte Geräte: iPhone (Safari), Android (Chrome), ein Desktop mit GPU. Besonders 3D-Bildrate, Akkuverbrauch, Touch-Gefühl beim Drehen und Zoomen.
- WebGL auf echter Grafikkarte: Materialien, Schatten und Licht wurden nur in SwiftShader gesehen.
- H.264-Wiedergabe der MP4-Dateien in Safari.
- Firefox wurde nicht geprüft.
- Felddaten (Core Web Vitals echter Besucher) gibt es noch nicht.

## Fachlich offen

- Kein produktiver Anfrage-Endpunkt. Die Seite zeigt das und täuscht keinen Versand vor.
- Kein bestätigter Partnerbetrieb; keine Preise, Lieferzeiten oder Passzusagen.
- Impressum und Datenschutz sind Entwürfe mit Platzhaltern, nicht rechtlich geprüft.
- Fotos bleiben nur im Arbeitsspeicher; nach Neuladen bleibt nur der Textentwurf. Kopieren und Textdatei enthalten keine Fotos.
- HEIC-Vorschau hängt vom Browser ab.
- Lizenz der Mixkit-Filme aus der Übergabe übernommen, nicht erneut am Original geprüft; Markenschriftzug im Hero-Film (siehe MEDIEN.md).
