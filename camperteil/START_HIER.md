# Camperteil – Übergabe an Claude

Stand: 22.10.2026. Basis-Commit: 008e51beeadaf4a1531934849dcc9d4faa251f2c.

1. ZIP in Claude Code bereitstellen oder in das verbundene Repository hochladen. Im Zielrepository nur camperteil/ bearbeiten, andere Anwendungen unangetastet lassen.
2. CLAUDE_AUFTRAG.md vollständig als Auftrag verwenden. Die vorhandene Gestaltung gezielt weiterentwickeln.
3. Lokal starten: `npm run serve` oder `python3 -m http.server 4173 --directory dist`. Öffnen: http://localhost:4173. Kein Build erforderlich.
4. Veröffentlichung erfolgt aus dist/. Vollständige Website als mehrere Dateien betreiben: Videos und 3D benötigen die mitgelieferten Assets. Eine einzelne HTML-Datei ist nicht die Auslieferung.

## Enthalten
- Vollständige statische Website in dist/, zwei lokale Filme und Poster.
- JavaScript-generiertes 3D-Beispiel mit Three.js, OrbitControls und Canvas-Fallback. Keine zusätzliche GLB-Datei erforderlich.
- Lokale Schriften, Lizenzdateien, technische Notizen und vorhandener Browser-Test.
- Verbindlicher Verbesserungsauftrag und ehrlicher Prüfstatus.

## Optionales offizielles Design-Plugin
Frontend Design von Anthropic: https://github.com/anthropics/claude-plugins-official/tree/main/plugins/frontend-design

In einer Claude-Code-Sitzung kann `/plugin install frontend-design@claude-plugins-official` die Plugin-Details zur Installation öffnen. Auf der jeweiligen Oberfläche Verfügbarkeit und Projektumfang prüfen; dies ist kein garantierter Installationsweg im normalen Handy-Chat. Falls die Oberfläche keinen Plugin-Dialog bietet, den Auftrag mit vorhandenen Werkzeugen ausführen. Nicht erst eine Agentensammlung installieren.

Offizielle Anleitung: https://code.claude.com/docs/en/discover-plugins

## Tests
`npm ci` installiert die gebundene Entwicklungsabhängigkeit playwright-core. Ein Chromium-Browser muss separat vorhanden sein. Server starten, dann mit tatsächlichem Browserpfad ausführen:

`CHROMIUM_PATH=/absoluter/pfad/zum/chromium BASE_URL=http://localhost:4173 npm test`

Der Pfad ist ein Platzhalter. Keine angeblich bestandenen Tests aus einer vorherigen Version übernehmen. Siehe PRUEFSTATUS.md.

## Übergabe-Anpassungen
Das frühere Script für eine einzelne HTML-Vorschau war auf die alte Ordnerstruktur ausgelegt und berücksichtigt die neuen Medien/3D-Module nicht. Es und der zugehörige npm-Befehl sind in diesem Paket weggelassen. Hosting-Projektkennung und Git-Metadaten sind ebenfalls nicht enthalten. README-Claude.md ist historische Dokumentation; bei abweichenden Pfaden gilt diese Datei.

Keine Produktiv-Zugangsdaten erforderlich. Versand bleibt aus; private Vorschau beibehalten.
