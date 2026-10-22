# Camperteil – Designsystem (MASTER)

Stand 22.10.2026. Verbindliche Quelle für Gestaltungsentscheidungen. Umgesetzt als CSS-Variablen in `dist/assets/css/experience.css` (Block „Designsystem“) und darauf aufbauenden Komponentenregeln.

Ausrichtung: Camperteil hilft Camperbesitzern, die Machbarkeit eines Ersatzteils anhand von Fotos und Maßen prüfen zu lassen. Die Gestaltung verbindet Reisegefühl (Filme, Landschaft), technische Präzision (Zeichnungen, Maße, Mono-Schrift) und Handwerk (Materialien, ruhige Flächen).

## 1. Herkunft: UI UX Pro Max

- **Skill:** `ui-ux-pro-max` 2.15.0 aus https://github.com/nextlevelbuilder/ui-ux-pro-max-skill, installiert über den dokumentierten Marketplace-Weg mit der Claude-Code-CLI (`claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill`, `claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill`), Bereich „user“.
- **Installationsort:** `~/.claude/plugins/cache/ui-ux-pro-max-skill/ui-ux-pro-max/2.15.0/.claude/skills/ui-ux-pro-max/` (SKILL.md, `scripts/search.py`, Daten als CSV). Voraussetzung Python 3 (Standardbibliothek), geprüft mit Python 3.13.
- **Abfragen** (Rohausgaben in `skill-abfragen/`):
  1. `search.py "travel craftsmanship spare parts service" --design-system -p "Camperteil" --variance 5 --motion 3 --density 3 -f markdown`
  2. Wiederholung, enger gefasst (wie in der SKILL.md vorgesehen): `"outdoor travel automotive repair service"` mit denselben Reglern
  3. UX-Einzelabfragen (`--domain ux`): „error summary validation“, „focus not obscured“, „video autoplay pause control“, „reduced motion animation“, „form step progress back“, „sticky cta mobile“
  4. Stack-Abfrage `--stack threejs`: „material lighting performance orbit“
  5. Regeln aus `references/quick-reference.md` (Touch-Abstand, Schriftgröße, Abstandsraster, Bewegungstokens)

`--persist` wurde bewusst nicht verwendet: Die SKILL.md verlangt, ungeprüfte Ausgaben nicht zu speichern, und beide Designsystem-Vorschläge passen nicht zur Marke (siehe 2). Dieses Dokument ist die geprüfte Fassung.

## 2. Bewertung der Empfehlungen

| Empfehlung des Skills | Entscheidung | Begründung |
|---|---|---|
| Palette Marineblau/Blau (#0F172A, #0369A1) bzw. Blau/Orange | abgelehnt | widerspricht der festgelegten Identität (Kieferngrün, Creme, Ocker); generische Konzernpalette |
| Schriften Outfit/Work Sans bzw. Inter, über Google Fonts | abgelehnt | Identität und Datenschutz: lokale Schriften Archivo und IBM Plex bleiben; kein Abruf von Google |
| Muster „Trust & Authority“ mit Siegeln, Fallstudien, Preisen, Logo-Karussell | abgelehnt | es gibt weder Kunden noch Partner noch Preise; würde Ehrlichkeitsregeln verletzen |
| GSAP-Scroll-Reveal | abgelehnt | kein Framework-Wechsel nötig; vorhandene, kürzere CSS-Einblendung mit gleichen Werten (8–20 px, unter 0,8 s) |
| Semantische Farbrollen (background, surface, foreground, primary, accent, border, ring, destructive) | übernommen | auf bestehende Markenfarben abgebildet |
| CTA-Text mindestens 4,5:1 auf der Knopffläche | übernommen, geprüft | Kieferngrün auf Ocker: 7,3:1 |
| CTA im Hero und am Ende, dazu fester Zugang | übernommen | Hero, Ende von „Ablauf“ und „Messen“, Kopfzeile, mobile Schaltfläche |
| Bewegungsstufe „subtil“, 1–2 animierte Elemente je Ansicht, Austreten kürzer als Eintreten | übernommen | Bewegungstokens, siehe 6 |
| Dichte „großzügig“, 4-px-Raster | übernommen | Abstandstokens, siehe 4 |
| Fokussierbare Fehlerübersicht mit Links zu den Feldern, Fehler zusätzlich am Feld | war vorhanden, bestätigt | ergänzt um `aria-labelledby` |
| Fokus nie verdeckt (scroll-padding für feste Leisten) | übernommen | oben für die Kopfzeile, unten für die mobile Schaltfläche |
| Autoplay-Video: Pause, außerhalb des Bildes anhalten, Reduced Motion | war vorhanden, bestätigt | zusätzlich Ladepriorität (siehe 7) |
| Untertitel für Videos | nicht anwendbar | Filme ohne Ton und ohne Sprache, rein atmosphärisch und `aria-hidden` |
| Zurück-Taste vorhersehbar | übernommen | Browser-Zurück geht im Formular einen Schritt zurück |
| Mindestens 8 px zwischen Tippflächen, 44 × 44 px | übernommen | Werkbank-Knöpfe auf 8 px Abstand |
| Three.js: Farbmanagement, sRGB-Ausgabe, Tone Mapping | war vorhanden, bestätigt | ACES Filmic, `SRGBColorSpace` |
| Three.js: InstancedMesh ab 50 gleichen Objekten | nicht nötig | Modell hat wenige Teile |

## 3. Farben

Markenwerte (unverändert) und ihre Rollen:

| Rolle | Variable | Wert | Einsatz |
|---|---|---|---|
| Hintergrund | `--color-background` | Creme #f3f0e6 | Seitenfläche |
| Fläche | `--color-surface` | #f8f6ec | Formular, Karten mit Inhalt |
| Vertiefte Fläche | `--color-surface-sunken` | #e7e6da | Werkbank-Abschnitt, Stand |
| Text | `--color-foreground` | Kiefer-Tinte #1f342b | Fließtext, Überschriften |
| Gedämpfter Text | `--color-muted-foreground` | #5d675e (5,2:1 auf Creme, 4,7:1 auf vertiefter Fläche) | Hinweise, Einleitungen |
| Primär | `--color-primary` | Kieferngrün #172b22 | Nachtflächen, erledigte Schritte, Fußzeile |
| Auf Primär | `--color-on-primary` | #f4f1e6 | Text auf Kieferngrün |
| Akzent / Hauptaktion | `--color-accent` | Ocker #d1b96f | nur Hauptaktionen, aktiver Schritt, Markierungen |
| Auf Akzent | `--color-on-accent` | #1d2f26 (7,3:1, Hover 8,9:1) | Text auf Ocker |
| Akzent als Text | `--color-accent-text` | #6f5822 (6,0:1 auf Creme) | Eyebrows, Pflicht-Kennzeichen |
| Linie | `--color-border` / `--color-border-strong` | #cfd2c5 / #bfc3b2 | Trenner / Bedienrahmen |
| Fokus hell | `--color-ring` | #1f5fbf (5,3:1 auf Creme) | auf hellen Flächen |
| Fokus dunkel | `--color-ring-on-dark` | #e6d8ae (10,5:1 auf Kieferngrün) | auf Film, Nacht, Werkbank, Fußzeile |
| Fehler | `--color-destructive` | #a3231b auf #fbecea | Feldfehler, Fehlerübersicht |

Regel: Ocker bleibt den Hauptaktionen und Zustandsmarken vorbehalten. Neue Komponenten verwenden die Rollen, keine Rohwerte.

## 4. Abstände

4-px-Raster: `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 24 · `--space-6` 32 · `--space-7` 48 · `--space-8` 64 · `--space-9` 96 · `--space-10` 128.
Abschnitte 96 px (Handy 64 px), Feldabstände 24 px, Tippflächen mindestens 8 px auseinander. Seitenrand 40 px, ab 560 px Breite und darunter 20 px (mit Safe Area).

## 5. Typografie

| Stufe | Variable | Größe | Schrift |
|---|---|---|---|
| Display | `--text-display` | 48–112 px | Archivo 500, Laufweite −0,048em; Akzentwort in Serif kursiv |
| H2 | `--text-h2` | 32–54 px | Archivo 460–480 |
| H3 / Schritt | `--text-h3` | 22–30 px | Archivo 600 |
| H4 | `--text-h4` | 18 px | Plex Sans 600 |
| Einleitung | `--text-lead` | 17 px | Plex Sans 400 |
| Fließtext, Eingaben | `--text-body` | 16 px | Plex Sans 400 (Eingaben nie kleiner, kein iOS-Zoom) |
| Hinweis | `--text-sm` | 13 px | Plex Sans |
| Label | `--text-label` | 11 px | Plex Mono 500, Versalien, Laufweite 0,08–0,16em |

Zeilenlänge 40–46 Zeichen für Einleitungen, höchstens 65 für Fließtext. Überschriften `text-wrap: balance`, Absätze `pretty`. Nichts unter 11 px.

## 6. Bewegung

| Token | Wert | Einsatz |
|---|---|---|
| `--dur-press` | 120 ms | Drücken |
| `--dur-fast` | 180 ms | Hover, Farbwechsel an Bedienelementen |
| `--dur-base` | 280 ms | Ausblenden, Seitenwechsel raus |
| `--dur-slow` | 450 ms | Einblenden von Leisten, Seitenwechsel rein |
| `--dur-film` | 1400 ms | Standbild → Film |
| `--ease-enter` | cubic-bezier(.2,.7,.2,1) | abbremsend beim Ankommen |
| `--ease-exit` | cubic-bezier(.4,0,1,1) | beschleunigend beim Gehen |

Regeln: Jede Animation dient der Orientierung oder Atmosphäre. Höchstens ein bis zwei bewegte Elemente pro Ansicht. Kein erzwungenes Scrollen. Bei `prefers-reduced-motion: reduce` gibt es keine Einblendungen, kein Autoplay, keine Kamerafahrt und keine Seitenüberblendung; Zustände wechseln sofort.

## 7. Komponenten und Zustände

- **Hauptaktion** (`.btn-primary`): Ocker, Höhe 54 px; Hover heller, Drücken 1 px tiefer, Fokus-Ring 3 px, gesperrt 50 % Deckkraft.
- **Ruhige Aktion** (`.btn-quiet`): Rahmen `--color-border-strong`, Hover Rahmen in Textfarbe.
- **Wahlknöpfe** (Oberfläche, Blickwinkel): 44 px, `aria-pressed`, aktiver Zustand mit doppeltem Rahmen.
- **Formularschritte**: Fortschrittsleiste (Desktop) bzw. Fortschrittszeile (Handy), Titel in `--text-h3`, Felder mit sichtbarem Label, Pflicht/Optional in Mono, Fehler am Feld und in fokussierter Übersicht, Zurück/Weiter unten, „Ändern“ in der Übersicht. Browser-Zurück geht einen Schritt zurück.
- **Anfrage-Bereich**: Desktop zweispaltig (Leitfaden mit „Versand noch nicht eingerichtet“ und Bereitlege-Liste links, haftend; Formular rechts), Handy einspaltig.
- **Filme**: Standbild mit `fetchpriority=high` (Hero) bzw. `loading=lazy`; Hero-Film nach dem Laden der Seite, weitere Filme eine Bildschirmhöhe vorher vorgeladen; Knopf „Film abspielen / Film anhalten“ mit Symbol; bei Fehler „Film nicht verfügbar, Standbild bleibt“.
- **3D-Werkbank**: als Beispiel gekennzeichnet; Blickwinkel Schräg/Vorne/Seite, Oberfläche, Explosion mit Beschriftung, langsames Drehen, Zurücksetzen, Zoom-Knöpfe, Tastatur (Pfeile, + / −, Pos1); Mausrad scrollt die Seite.
- **Unterseiten**: gleiche Flächen, Kopfzeile (fest, hell) und Fußzeile wie die Startseite; Abschnitte mit Linie und `--text-h4`; Nachweise mit Standbildern.

## 8. Mobile Darstellung

Breakpoints 560 / 640 / 720 / 880 / 1000 px. Getestet bei 320, 390, 768 und 1440 px.
- Hero mindestens bildschirmhoch, wächst mit dem Text; Hochformat-Film mit Ausschnitt auf die Fahrzeugfront.
- Kopfzeile und mobile Schaltfläche weichen beim Weiterlesen aus und kommen beim Zurückscrollen; die Schaltfläche verdeckt weder 3D-Bühne, Formular noch Fußzeile.
- Senkrechtes Wischen auf der 3D-Bühne scrollt die Seite, waagerechtes dreht.
- Bereitlege-Liste nur ab 1000 px; auf dem Handy stehen die Angaben in den Schritten.
