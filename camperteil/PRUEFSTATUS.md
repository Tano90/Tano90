# Prüfstatus und offene Punkte

## Bei der aktuellen Revision tatsächlich geprüft
- Visuelle Desktopansicht und eingebettete mobile Ansichten mit 320/390 Pixeln, ohne seitlichen Überlauf.
- Beide lokalen Videos spielen ab.
- Software-3D-Fallback: Farbe, Explosionsansicht, Rotation und Reset.
- Pflichtfoto-Fehler, Fotoauswahl/Vorschau und vollständiger fünfstufiger Anfrageprozess bis zur Übersicht.
- JavaScript-Syntax und lokale Assetverweise.

## Noch zu prüfen
- Echtes WebGL-Rendering: in der bisherigen Browserumgebung deaktiviert. Nicht als GPU-getestet behandeln.
- Gesamter alter Playwright-Test tests/flow.mjs wurde nach der Cinematik-Revision nicht ausgeführt.
- Physische iPhone-/Android-Geräte, Safari, Energieverbrauch und belastbare Performancewerte.
- Neue Änderungen von Claude benötigen neue Prüfungen; diese Liste ist keine Zusage für geänderten Code.

## Fachlich offen
- Kein produktiver Anfrage-Endpunkt. Niemals erfolgreichen Versand vortäuschen.
- Partner noch nicht bestätigt; keine zugesagten Preise oder Lieferzeiten.
- Rechtstexte enthalten Platzhalter und benötigen echte Angaben.
- Fotos bleiben nur im Arbeitsspeicher und gehen bei Neuladen verloren. Nur Textentwürfe bleiben im Browser. Kopieren/Textdownload enthält keine Fotos.
- HEIC-Vorschau ist browserabhängig.

## Abnahme der nächsten Revision
Alle fünf Formularschritte einschließlich Fehlerbehebung, Zurück, Ändern und Neuladen testen. Videos mit Autoplay-Sperre und Reduced Motion prüfen. 3D mit WebGL sowie ohne WebGL, Touch, Tastatur und allen Reglern prüfen. Neue Medienquellen dokumentieren. Tatsächliche Messergebnisse getrennt von Zielwerten berichten.
