# Launch-Plan

Voraussetzung: `/replica-deploy` grün, alle Must-haves fertig (`parity.md`: noch 1 offen, dein Login-Durchklick A02),
Entwürfe der Rechtsseiten geprüft, **Name entschieden** (`brand.md`: Pantra hat einen Namensvetter im App Store).

## Vor dem Start (4–6 Wochen)

1. **Warteliste / Beta.** Auf der Landingpage den zweiten Button „Beta-Platz anfragen“ mit E-Mail-Feld (Double-Opt-in über
   Resend). Ziel: 30 Betriebe, davon 10 aktiv.
2. **Messen, ohne zu überwachen.** Fehler-Tracking (Sentry) und datensparsame Statistik ohne Cookies (z. B. Plausible,
   EU-gehostet) einrichten; beide in der Datenschutzerklärung nennen. Messen: Registrierung → erstes Rezept mit Preis →
   erste Bestellung → zweite Woche aktiv.
3. **Recherche nachholen.** `/replica-entrepreneur` mit freigegebenen Quellen. Erst danach steht fest, für wen die
   Überschrift spricht und wo die unzufriedenen Nutzer des Originals sich austauschen.

## Wo die Zielgruppe ist (zu prüfen, nicht recherchiert)

Die Recherche ist blockiert, deshalb sind das Kandidaten, keine Belege:
- Reddit: r/KitchenConfidential, r/Chefit, r/restaurateur (Suchen: „recipe costing“, „inventory software“, „food cost spreadsheet“)
- Deutschsprachig: Gastro-Gruppen auf Facebook und LinkedIn, Foren von Branchenmedien (z. B. HOGAPAGE), Verbände (DEHOGA-Landesverbände, Veranstaltungen)
- Berufsschulen und Meisterkurse für Köche (Kalkulation ist Prüfungsstoff)
Erst lesen, dann schreiben: in jeder Community zuerst Fragen beantworten, Pantra nur nennen, wenn es passt und die Regeln es erlauben.

## Launch-Post (Product Hunt / Hacker News „Show HN“)

Führt mit dem, was belegt besser ist, nicht mit dem Vergleich zum Original (den Namen des Originals nicht nennen):

> Pantra: Was jeder Teller kostet, live – und Lager und Zentralküche rechnen mit.
> Zutaten so anlegen, wie der Lieferant sie verkauft; Rezepte zeigen beim Tippen den Wareneinsatz pro Portion; die
> Zentralküche sieht pro Tag, was die Standorte brauchen und welche Rohware fehlt; die Inventur auf dem Handy speichert
> jede Zahl sofort, auch ohne Netz. HACCP und Rechnungsabgleich ohne Zusatzmodul. Pro Standort bezahlt, beliebig viele
> Nutzer, Kündigen mit einem Klick.

Für HN zusätzlich ehrlich die Technik: Postgres mit Row Level Security als Zugriffsgrenze, Lager als Buchungsjournal mit
gleitendem Durchschnittspreis im Datenbank-Trigger.

## Die ersten 10 Nutzer, von Hand

Profile, keine Namen (nicht erfunden):
- 3 einzelne Restaurants mit wechselnder Karte (Kalkulation heute in Excel)
- 3 kleine Gruppen mit 2–5 Standorten
- 2 Betriebe mit Zentralküche oder Catering
- 2 Küchenchefs in Ausbildung/Meisterkurs (gute Testerinnen und Tester für die Kalkulation)

Für jeden: 30 Minuten gemeinsame Einrichtung (ihre 20 meistgekauften Artikel, ihr teuerstes Gericht), nach einer Woche
nachfragen, was sie in Pantra nicht tun konnten. Das ist die echte Feature-Liste und die Grundlage für Preisgespräche.

## Store (später)

`listing.json` ist für die native App vorbereitet und besteht `listing.py`. Pantra läuft heute nur im Browser; eingereicht
wird erst mit einer echten App. Dann: Screenshots in den aktuell geforderten Größen, Datenschutz-Angaben (App Privacy /
Data safety: E-Mail, Name, Betriebsdaten; keine Werbung, kein Tracking), Altersfreigabe 4+, Datenschutz- und Support-URL,
Review-Notizen mit einem Demo-Konto. Nach Apple-Richtlinie 4.1 (Nachahmer) helfen die eigenen Funktionen und die eigene
Marke durch die Prüfung: Live-Kalkulation, Zentralküche und Offline-Inventur gehören in die ersten Zeilen und Screenshots.
