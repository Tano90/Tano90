# Camperteil

Website für Camperteil, ein Angebot von Mattias Segato Consulting: Anfragen für kleine Kunststoff-Ersatzteile älterer Wohnmobile.
Statisches HTML/CSS/JS ohne Build-Schritt und ohne externe Abrufe (Schriften liegen in `assets/fonts`, OFL-Lizenz).

## Starten

```sh
npm run serve            # http://localhost:4173
npm install && npm test  # Browserprüfung (Server muss laufen), Bilder in test-results/
npm run preview:single   # dist/camperteil-vorschau.html als Einzeldatei
```

`npm test` nutzt `playwright-core` mit einem vorhandenen Chromium (`CHROMIUM_PATH`, Standard `/opt/pw-browsers/chromium`).

## Versand der Anfrage

Ist **nicht eingerichtet**. Ohne Versandweg zeigt die Seite das an, es gibt keinen Senden-Knopf und keine Erfolgsmeldung.
Am Ende lassen sich die Angaben kopieren oder als Textdatei speichern (ohne Fotos).

Einschalten: vor `assets/js/app.js` einbinden

```html
<script>window.CAMPERTEIL_CONFIG = { submitEndpoint: "/api/anfrage" };</script>
```

Der Endpunkt erhält `multipart/form-data` (Textfelder plus `photos`) und muss mit HTTP 2xx antworten; nur dann meldet die Seite Erfolg.
Keine Zugangsdaten in den Client schreiben; Schlüssel gehören auf den Server hinter dem Endpunkt.

## Offen vor dem Start

- Impressum und Datenschutz sind Entwürfe mit markierten Platzhaltern.
- Fotos: Die Seite nutzt eigene technische Zeichnungen (als Beispiele gekennzeichnet). Echte Fotos fehlen noch.
- Partnerbetrieb: im Text als „noch nicht bestätigt“ geführt (Abschnitt „Stand“, Ablauf Schritt 3, Fragen).
