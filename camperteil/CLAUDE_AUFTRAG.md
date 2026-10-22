Du arbeitest als Creative Director, Frontend-Entwickler und QA-Verantwortlicher an Camperteil. Im ZIP liegt die aktuelle Website mit lokal gespeicherten Videos, Schriften und Three.js. Lies zuerst START_HIER.md, PRUEFSTATUS.md und DESIGN_NOTES.md. Dieser Stand ist die verbindliche Basis. Verfeinere ihn mit hoher gestalterischer Qualität und setze die Änderungen direkt im Code um.

Ziel: Eine eigenständige, filmische Premium-Website für Menschen, denen ein kleines Camperteil fehlt oder kaputtgegangen ist. Der Besucher soll innerhalb weniger Sekunden verstehen: Foto und Maße einreichen, Machbarkeit prüfen lassen. Keine Liefer- oder Fertigungszusage. Bewahre Kieferngrün, warmes Creme, Ocker, technische Zeichnungen und die vorhandene emotionale Bildsprache. Keine austauschbaren Vorlagen, keine überladenen Effekte.

Arbeite ausschließlich im Camperteil-Projekt. Falls das Zielrepository web/ oder replica/ mit einer anderen Anwendung enthält, fasse diese nicht an. Übernimm den Inhalt dieses Pakets in einen eigenen camperteil/-Ordner auf einem neuen Arbeitsbranch. Bestehende Projektregeln beachten. Keine Zugangsdaten nötig; keine kostenpflichtigen Dienste, Bestellungen oder externen Nachrichten auslösen. Vorschau privat halten.

1. Bestandsaufnahme und Prioritäten
Starte die aktuelle Version lokal. Prüfe Desktop und Handy visuell, Formular und Medien technisch. Nenne kurz die fünf wichtigsten konkreten Verbesserungen und implementiere sie anschließend. Triff sinnvolle reversible Entscheidungen selbstständig. Wenn frontend-design bereits verfügbar ist, verwende es. Ein fehlendes Plugin darf die Umsetzung nicht blockieren.

2. Art Direction und Interaktion
Verfeinere Typografie, Zeilenumbrüche, Abstände, Bildausschnitte und Übergänge. Schaffe eine klare Dramaturgie von Reisegefühl über kaputtes Teil bis zur Anfrage. Verwende wenige präzise Animationen, die Orientierung geben. Kein erzwungenes Scrollen oder Scroll-Hijacking. Alle Funktionen müssen mit Touch, Tastatur und ohne Hover verständlich sein. Ein klarer Haupt-CTA bleibt gut erreichbar, ohne Inhalt zu verdecken.

3. Cinematik
Nutze die mitgelieferten Filme als Basis. Verbessere Schnittwirkung durch Ausschnitt, Überblendung und passende Bildhierarchie. Keine zusätzlichen Videos nur zur Dekoration. Videos bleiben stumm, inline und pausierbar. Poster müssen vor Videoload funktionieren. Beachte prefers-reduced-motion, Autoplay-Sperren, langsame Verbindung und Data-Saver soweit unterstützt. Lade nicht sofort alle Filme. Verwende nur nachweislich zulässige Medien und dokumentiere neue Quellen; keine fremden Markenfilme übernehmen.

4. 3D als verständliche Demonstration
Verfeinere das vorhandene illustrative Modell: glaubwürdige Materialien, Licht, Schatten und eine ruhige Ausgangsperspektive. Prüfe Drehen, Zoom, Explosionsansicht, Farbwechsel, Wireframe und Reset mit Maus, Touch und Tastatur. Erkläre knapp, wie man es bedient. Kennzeichne das Modell weiterhin als Beispiel, ohne Passgenauigkeit oder Verfügbarkeit zu suggerieren. Animation und Rendering bei Unsichtbarkeit pausieren, Pixeldichte und Detailgrad für Handys begrenzen. Erhalte den Software-3D-Fallback und teste WebGL-Ausfall. Teste den WebGL-Pfad auf einer Umgebung mit echtem WebGL; falls nicht möglich, offen kennzeichnen.

5. Anfrage und Vertrauen
Erhalte den vollständigen fünfstufigen Ablauf inklusive Dateiüberprüfung, Fehlermeldungen, Zurück, Ändern und Textentwurf. Keine erfundenen Kunden, Bewertungen, Preise oder bestätigten Partner. Versand bleibt deaktiviert, solange kein tatsächlicher Empfangsweg vorhanden ist. Verstecke diese Einschränkung nicht. Lade Kundenfotos weder zu externen Diensten hoch noch in Analytics. Impressum und Datenschutz bleiben erkennbare Entwürfe, bis echte Angaben vorliegen. Keine angeblich rechtsgeprüften Texte.

6. Qualität nachweisen
Prüfe 320, 390, 768 und 1440 Pixel, Touch, Tastatur, Fokus, Kontrast, Reduced Motion, Videofehler, WebGL-Ausfall sowie den gesamten Anfrageprozess. Nutze vorhandene Browserwerkzeuge; passe tests/flow.mjs an tatsächliches Verhalten an und führe aussagekräftige Tests aus. Installiere keine beliebigen Agentenpakete. Miss mobile Ladezeit und Lighthouse, wenn die Umgebung es erlaubt. Zielwerte LCP <= 2,5 s, CLS <= 0,1 und INP <= 200 ms dienen als Ziele; Labormessungen sind keine Felddaten und dürfen nicht als solche ausgegeben werden. Keine erfundenen Scores oder pauschales „alle Tests bestanden“.

7. Ergebnis
Liefere funktionierenden Quellcode, private Vorschau, aktualisierte Startanleitung, Medien-/Lizenznachweise und einen knappen Bericht mit Änderungen, tatsächlich ausgeführten Prüfungen und offenen Punkten. Keine reine Konzeptantwort. Veröffentliche nichts öffentlich und richte keinen Produktivversand ohne gesonderten Auftrag ein.

