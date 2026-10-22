# Prüfstatus und offene Punkte

## Revision „Designsystem mit UI UX Pro Max“ (22.10.2026)

Tatsächlich durchgeführt:
- Skill `ui-ux-pro-max` 2.15.0 über die Claude-Code-CLI installiert (Marketplace-Weg), `claude plugin list` zeigt ihn als aktiviert. SKILL.md vollständig gelesen, Python 3.13 vorhanden, vier Abfragearten ausgeführt; Rohausgaben in `design-system/camperteil/skill-abfragen/`, Bewertung in `design-system/camperteil/MASTER.md`.
- `tests/flow.mjs` (Chromium 141, SwiftShader): vier vollständige Läufe. Drei ohne Fehler (195 von 195), einer mit 194 von 195; der Fehlschlag („Langsames Drehen“) war eine zu kurze feste Wartezeit bei SwiftShader-Bildraten und ist durch Warten auf die Bewegung ersetzt. Neu geprüft: Kontrast der Hauptaktion, Fokusringe auf hellen und dunklen Flächen, Fokus nicht verdeckt, Wege zur Anfrage, 3D-Blickwinkel (WebGL und Canvas), Browser-Zurück/-Vorwärts im Formular, Unterseiten bei 320 und 1440 px.
- Sichtprüfung aller Formularschritte (390 und 1440 px), Nachweisseite (390 und 1440 px), Werkbank mit Blickwinkeln, Zwischen-CTA. Gefunden und behoben: verzerrte Vorschaubilder auf der Nachweisseite, umbrechendes Kontrollkästchen bei den Maßen, doppelte Schrittanzeige auf dem Handy, blauer Fokusring auf Kieferngrün kaum sichtbar, mobile Schaltfläche überdeckte den Rand der 3D-Bühne.
- Lighthouse 12.8.2 mobil, drei Läufe (Labor, simulierte Drosselung): Leistung 0,94 bis 0,95, LCP 2,7 bis 2,9 s, CLS 0, TBT 0 ms, 480 KiB; Barrierefreiheit, Best Practices, SEO je 1. Nachweisseite: Leistung 0,95, Barrierefreiheit 1, Best Practices 1, SEO 0,91 (danach Meta-Beschreibung ergänzt, nicht erneut gemessen). Ziel LCP ≤ 2,5 s im Labor weiter knapp verfehlt.

Weiter offen: wie unten (echte Geräte, GPU, Safari/Firefox, H.264 im Browser, Rechtstexte, Versandweg, Partner). Die Seitenüberblendung (`@view-transition`) wirkt nur in Browsern, die sie unterstützen; geprüft wurde nur, dass sie nichts stört.

---

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
