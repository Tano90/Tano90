# Komponenten

Grundlage: Komponentenliste in `replica/recon.md`. Werte aus `tokens.json`. **Nicht gemessen**:
Es gab keine Referenz-Screenshots, und die Seiten des Originals waren gesperrt. Größen und
Abstände sind Standardwerte für eine dichte Tabellen-App. Sie werden angepasst, sobald
Screenshots in `replica/screens/` liegen.

Code: `web/src/components/ui/`. Alle Zustände sind sichtbar unter `/design`, Screenshots in
`replica/design/screens/`. Basis: Radix (Dialog, Tabs, Popover), cmdk (Combobox), Lucide-Icons (ISC-Lizenz),
Inter (OFL). Keine Logos, Icons, Texte oder Farben des Originals.

Tailwind kennt nur Token-Rollen (`bg-surface`, `text-text-muted`, `border-border-input`). Die
Standardpalette ist abgeschaltet, rohe Hex-Werte in Komponenten sind damit gar nicht möglich.
Abstände nur in den Stufen 0, 1, 2, 3, 4, 6, 8, 12, 16 (× 4px).

Allgemein für alle interaktiven Elemente: sichtbarer Fokus (2px `focus-ring`, 2px Abstand),
`disabled` mit 50 % Deckkraft und `not-allowed`, Bewegung 120–200 ms, abgeschaltet bei
`prefers-reduced-motion`. Zahlen (Geld, Mengen, Prozent) immer mit `.num` (tabellarische Ziffern), rechtsbündig.

```
AppShell (app-shell.tsx)
  layout    Sidebar 240px (nav-bg) + Header 56px + Inhalt max. 1440px; unter lg wird die Sidebar zur Schublade
  parts     Hauptnavigation (8 Bereiche), Outlet-Switch im Header, Nutzername, Skip-Link
  states    Nav-Eintrag default, hover, active (aria-current=page); Schublade offen/zu
  tokens    nav-bg, nav-text, nav-text-active, nav-item-active, border, bg
  a11y      <nav aria-label>, Skip-Link „Zum Inhalt springen“, Menü-Button mit aria-expanded, <main id="main">
  used on   alle Screens S02–S27

Button (button.tsx)
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 40px, lg 48px, icon 40×40
  states    default, hover, focus-visible, disabled, loading
  tokens    primary: bg accent → accent-hover, text on-accent; secondary: border border-input; radius sm; font sm/600
  a11y      echtes <button type="button">, loading setzt aria-busy und disabled, das Label bleibt stehen
  used on   alle

Field + Input / Textarea / Select (field.tsx)
  parts     Label (xs/500), Pflicht-Stern, Hinweis (xs muted), Fehler (xs danger)
  sizes     Höhe 40px, Textarea min. 96px
  states    default, focus-visible, invalid (2px danger-Rand + Text), disabled (surface-sunken), placeholder (text-subtle)
  tokens    border-input (3,3:1 auf bg), radius sm
  a11y      Label per htmlFor, Hinweis/Fehler über aria-describedby, aria-invalid, required; hideLabel für Tabellenzellen
  used on   S04, S06, S08, S11, S13, S24, S25

QuantityInput (quantity-input.tsx)
  parts     Zahl (rechtsbündig, inputmode=decimal) + Einheit (g, kg, mg, ml, cl, l, Stk.)
  states    default, focus, invalid (beide Teile rot), disabled
  rules     Komma und Punkt als Dezimaltrenner; „1.500,5“ → 1500,5; nur positive Zahlen; parseQuantity()
  a11y      Einheit hat eigenes aria-label „Einheit“
  used on   S04 (Gebinde), S06, S13, S14, S17, S18, S19

MoneyInput (money-input.tsx)
  parts     Betrag + €-Suffix, optional netto/brutto-Umschalter (nur Verkaufspreise; Einkaufspreise sind immer netto)
  states    default, focus, invalid, disabled; Umschalter aria-pressed
  rules     Eingabe in Euro mit Komma, gespeichert als Integer-Cent (parseCents)
  used on   S04, S06, S08, S11

Combobox (combobox.tsx)
  parts     Auslöser (wie Input), Popover mit Suchfeld, Liste mit Hinweis rechts (Zutat / Unterrezept), „neu anlegen“
  states    zu, offen, lädt, keine Treffer, ausgewählt (Häkchen), Option aktiv (accent-subtle)
  keyboard  Tippen filtert, Pfeile bewegen, Enter wählt, Esc schließt, Fokus kehrt zum Auslöser zurück
  a11y      role=combobox, aria-expanded; Liste über cmdk mit role=listbox/option
  used on   S06, S08, S13 (Zutat, Rezept, Lieferant)

LineEditor (line-editor.tsx)
  parts     Zeile = Combobox + QuantityInput + Kosten + Entfernen; „Zeile hinzufügen“
  layout    ab md als Raster (1fr / 12rem / 7rem / 2.5rem), darunter Zeile als Karte
  states    Zeile ok, Zeile mit Warnung (fehlender Preis oder Umrechnung: Kosten „–“ mit Warn-Icon, Text darunter), leere Zeile
  a11y      <ol aria-label>, jede Zeile „Zeile n von m“, Entfernen-Button nennt die Zeilennummer
  used on   S06 (Zutaten), S08 (Gänge), S13, S14, S17, S18, S19

Tabs (tabs.tsx)
  states    default, hover, active (2px accent-Unterstrich, 600), focus-visible, mit Warnung (Icon + sr-Text)
  keyboard  Pfeile links/rechts, Home/End (Radix)
  used on   S04, S06, S08

DataTable (data-table.tsx)
  parts     Kopf (surface, xs muted), Zeilen 40px (compact 32px), optional Auswahl-Checkboxen, Sortierung pro Spalte
  states    loading (5 Skelettzeilen, aria-busy), error (+ „Erneut versuchen“), empty (eigener EmptyState),
            filtered-empty („Keine Treffer“ + „Filter zurücksetzen“), filled, Zeile hover, Zeile ausgewählt (accent-subtle)
  a11y      <caption> (sr-only), scope=col/row, aria-sort an sortierten Spalten, Sortier-Buttons, Checkboxen mit Label
  mobile    eigener horizontaler Scrollbereich, die Seite scrollt nie seitlich
  used on   S03, S05, S07, S10, S12, S16, S17, S20, S21

FilterBar (filter-bar.tsx)
  parts     Suchfeld mit Icon, Filter-Dropdowns (slot), aktive Filter als Chips (entfernbar)
  a11y      role=search, Chips als Buttons mit „Filter entfernen“
  used on   S03, S05, S07, S10, S12

Badge / OrderStatusBadge (badge.tsx)
  tones     neutral, accent, success, warning, danger, info (alle ≥ 4,7:1 auf ihrer subtle-Fläche)
  status    Entwurf, Bestellt, Teilweise geliefert, Geliefert, Storniert
  rule      Farbe ist nie die einzige Information; der Text steht immer dabei
  used on   S05 (Wareneinsatz über Ziel), S12, S14

StatTile (stat-tile.tsx)
  parts     Label, Wert (xl, tabellarisch), optional Delta mit Pfeil
  rule      Die Farbe des Deltas folgt „gut/schlecht“, nicht dem Vorzeichen (steigender Wareneinsatz = rot)
  used on   S02, S06, S08

AllergenMatrix (allergen-matrix.tsx)
  parts     14 EU-Allergene × Status: Unbekannt, Frei, Spuren, Enthält; Marke „geerbt“ für Werte aus Zutaten
  states    bearbeitbar (Segment-Radiogruppe pro Zeile), nur lesen (Badge)
  rules     „Unbekannt“ ist eine Warnung (warning), nie „frei“; beim Vererben gewinnt der stärkere Status
  a11y      Tabelle mit Zeilenköpfen, pro Allergen eine benannte Radiogruppe (Pfeiltasten wechseln)
  mobile    eigener Scrollbereich, schmalere Segmente unter sm
  used on   S04, S06, S09

Dialog / ConfirmDialog (dialog.tsx)
  parts     Titel, Beschreibung, Inhalt (scrollt), Fußzeile mit Aktionen, Schließen-Button
  states    offen/zu; Bestätigen mit loading; danger-Variante
  a11y      Fokusfalle, Esc schließt, Fokus kehrt zurück (Radix); bei Bestätigung hat „Abbrechen“ zuerst den Fokus
  used on   Gebinde anlegen (S04), Archivieren, Inventur abschließen (S17), Bestellung senden (S13)

Toast (toast.tsx, sonner)
  tones     default, success, error (Fehler bleiben bis zum Schließen)
  a11y      Live-Region, Schließen-Button
  used on   alle Speicher-Aktionen

EmptyState (empty-state.tsx)
  parts     Icon (Lucide), Titel (base/600), Text, eine Aktion
  rule      Jede Liste hat einen eigenen Leerzustand mit dem nächsten sinnvollen Schritt
  used on   alle Listen, DataTable

FileUpload (file-upload.tsx)
  parts     Ablagefläche (gestrichelter Rand), echtes File-Input (sr-only), Limit-Hinweis, Fehlerliste pro Zeile
  states    idle, drag-over (accent-subtle), uploading (Spinner), done ohne Fehler, done mit Fehlern, Datei zu groß
  a11y      Label umschließt Input (Tastatur und Screenreader), Fehler als role=alert
  used on   S26, S21 (POS-Import), S15 (Rechnung)
```

Noch nicht gebaut (werden zusammen mit ihren Screens gebaut, Spezifikation hier):

```
Label-/Druckansicht (S09)
  parts     A6/A7-Etikett: Name, Zutatenliste mit hervorgehobenen Allergenen (fett), Nährwerttabelle pro 100 g, Hinweiszeile
  rule      Druck-CSS (@page), schwarz auf weiß, kein Token-Farbsystem; PDF serverseitig (React-PDF)

Menu-Engineering-Matrix (S22, could)
  parts     Streudiagramm Beliebtheit × Deckungsbeitrag, 4 Quadranten mit Text-Labels, Tabelle als Alternative
  rule      vor dem Bau /dataviz-Regeln anwenden; Daten zusätzlich als Tabelle für Screenreader

Mobile Inventur (S17 mobil, could)
  parts     große Zählfelder (48px), Barcode-Button (BarcodeDetector, ZXing-Fallback), Zwischenstand automatisch speichern
```
