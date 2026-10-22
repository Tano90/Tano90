# Camperteil – cinematic revision

Source imported from user archive camperteil-dc73831.zip. Original five-step form retained. Existing Site identity and owner-private audience retained.

## Added
- Full-bleed local camper/lake film and separate landscape film, poster images, pause/start controls, viewport pause and reduced-motion handling.
- Own illustrative 3D cover, real WebGL geometry using locally bundled Three.js 0.180.0 and OrbitControls. Rotation, mouse/touch orbit, keyboard controls, zoom, material colors, exploded view, wireframe and reset. Explicit non-product disclaimer and a perspective-projected software 3D renderer when WebGL is unavailable.
- Redesigned typography, spacing and responsive styling in experience.css; original form styling and JS retained.
- Touch/keyboard selection in illustrative parts table.
- Separate inspiration.html with HYMER Venture S and Bowlus references, no claim of partnership, and stock footage source/license notes.

## Asset sources
Mixkit 4122 https://mixkit.co/free-stock-video/an-off-road-camper-van-by-the-lake-4122/
Mixkit 4070 https://mixkit.co/free-stock-video/time-lapse-of-a-green-meadow-4070/
Both pages explicitly identify Stock Video Free License and commercial/personal use. Footage hosted locally; no remote playback services.
Three.js and OrbitControls 0.180.0 from official npm distribution via jsDelivr; MIT license in dist/assets/vendor/LICENSE-three.txt.
Fonts and license files preserved from user source archive.

## Outstanding
No production inquiry endpoint, no confirmed fabrication partner, legal pages still placeholder drafts. Images aren't persisted on reload. Imported original browser tests have not been run via their standalone automation harness; actual QA is performed using the supported browser interface. Verified: 320/390 px embedded mobile viewports without horizontal overflow, desktop, both videos playing, software 3D colors/explode/rotation/reset, required-photo error, photo picker/preview and complete five-step form through summary. WebGL path could not be visually exercised because WebGL is disabled in the browser environment. Public launch remains out of scope.

# Revision „Cinematik, 3D, Handy“ (22.10.2026)

Bestandsaufnahme der Übergabe, fünf wichtigste Verbesserungen und ihre Umsetzung:

1. **Ladezeit und Filme.** Three.js lag unminifiziert bei 2 MB und wurde mit dem Modell beim Seitenstart aufgebaut (mobil TBT bis 2,6 s). Jetzt minifiziert (720 KB) und erst kurz vor der Werkbank geladen. Filme neu kodiert: Farbe im Film statt per CSS-Filter, nahtlose Schleife, Hochformat-Ausschnitt fürs Handy, WebM und MP4. Standbild zuerst, Film blendet erst nach dem Laden weich darüber; kein Autoplay bei weniger Bewegung oder Datensparmodus.
2. **Dramaturgie.** Film → Stand (ehrliche Lage direkt nach dem Film) → Idee → Teile → Werkbank → Reisefilm → Ablauf → Messen → Anfrage → Fragen. Hero nennt sofort, worum es geht (Fotos, Maße, Machbarkeit prüfen) statt Kapitelnummern ohne Bedeutung.
3. **3D als Demonstration.** Studio-Umgebungslicht, weiche Schatten mit Kontaktschatten, Kunststoff mit Narbung und Klarlack, Metall mit Reflexen. Ruhige Ausgangsansicht mit einmaliger Einstiegsfahrt. Explosion mit Beschriftung der Bauteile, Farbwechsel mit Überblendung. Zeichnet nur bei Bewegung und Sichtbarkeit, passt Qualität an, wechselt bei Kontextverlust oder dauerhaft langsamer Darstellung auf Canvas.
4. **Bedienung am Handy.** Kein Scroll-Fang mehr: Mausrad scrollt die Seite (Zoom mit Strg), senkrechtes Wischen scrollt, waagerechtes dreht. Zoom-Knöpfe, Tastatur, Ansagen für Screenreader. Alle Bedienelemente mindestens 44 px. Kopfzeile und mobile Schaltfläche weichen beim Lesen aus und kommen beim Zurückscrollen.
5. **Typografie und Lesbarkeit.** Einheitlich „Sie“. Kleinste Schrift 11 px statt 7 bis 9 px, Fließtext 15 bis 17 px, ausgewogene Zeilenumbrüche, engere, aber nicht gequetschte Laufweite der großen Überschriften. Kontrast der grauen und ockerfarbenen Texte angehoben.

Weitere Korrekturen: Farbknöpfe setzten ihren Zustand versehentlich auch auf die 3D-Bühne (`aria-pressed` am falschen Element). Die Seite ist bewusst nur hell; die ungenutzten Dunkel-Regeln sind entfernt. „Design-Referenzen“ heißt jetzt „Bild- und Videonachweise“ (`nachweise.html`), Herstellernamen stehen dort nur noch als Anregung.

Medien: siehe MEDIEN.md. Prüfungen: siehe PRUEFSTATUS.md.
