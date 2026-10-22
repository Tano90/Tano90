# STATUS – Überarbeitung GLB AI Suite (Kundenablauf)

Stand: 22.10.2026 · Branch `claude/replica-skill-install-vzriug` · Ausgangsstand `2584595`

## Kunden-Durchlauf (lokal, Demo im Browser, vor den Änderungen)
- Startseite → „Live ausprobieren“ → `/suite`: zeigt Dashboard, Navigation markiert „Mein Arbeitsplatz“ (Fehler C bestätigt).
- Dashboard: „Netto-Umsatz · alle Monate 22.766 €“ mit „September ggü. August +16,7 %“ direkt darunter (Monatsvergleich wirkt wie Vergleich der Summe). Hinweise allgemein („Artikel mit hoher Warenquote prüfen“) ohne Artikel.
- Report Studio: Kostenbasis „Kostenstand im Verkaufsmonat“, Kachel sagt „Aktuelle Produktkosten“, Tabelle „Produktkosten sind aktuell, nicht historisiert“ (Fehler A bestätigt; Berechnung selbst nutzt die gewählte Basis).
- Bestell-Forecast: Kachel „1 ohne Verbrauchsgrundlage · 0 ohne Bestand“; Mengen wie „12.616,07 g“ statt kg (Fehler B wird geprüft).
- Mission Control „Keine automatischen Hinweise“, GLB Intelligence 4 Hinweise, Cockpit 2 Hinweise (widersprüchlich).
- GLB Intelligence: Dezimalpunkt statt Komma („33.7 %“, „5.97 €“).
- Deckungsbeiträge: Demo ohne Monatsfixkosten → Zielpreise nicht berechenbar.
- KI-Marktcheck: Demo ohne Beobachtungen.
- Einrichtung: unter der Checkliste hängt das komplette Dashboard (doppelt).
- Keine Konsolenfehler.

## Erledigt
- (wird fortgeschrieben)

## Offen / Entscheidungen
- Tarifdetails (siehe Abschlussbericht): Leistungsunterschied Standard/Premium, Nutzer inklusive?, Bedeutung „Kunde“, Inhalt 29,99 €, Zahlungsplan Entwicklungsgebühr, Umsatzsteuerstatus des Anbieters von GLB.

## Nächster Schritt
- Navigation neu gruppieren, Start-Route synchronisieren.
