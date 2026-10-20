# Marke: Pantra

Stand: 2026-10-20. Die Positionierung aus `/replica-entrepreneur` fehlt noch (0 Bewertungen, Quellen gesperrt). Der Name
stützt sich deshalb auf das, was das Produkt nachweislich besser macht: Es zeigt live, was ein Teller kostet, und hält das
Lager dazu. Wenn die Bewertungen eine andere Positionierung ergeben, kann der Name noch wechseln. Er steht an einer Stelle:
`web/src/lib/brand.ts`.

## Name

**Empfehlung: Pantra.** Kunstwort, klingt nach *pantry* (Vorratskammer), sagt also Lager und Küche, ohne beschreibend
und damit schwach schützbar zu sein. Zwei Silben, nach einmal Hören schreibbar, im Deutschen und Englischen ohne
schiefe Bedeutung. Nichts teilt Klang, Schriftbild oder Bedeutung mit „Apicbase“.

Alternative für einen rein deutschsprachigen Start: **Tellerwert**. Sagt genau, was das Produkt kann, ist aber beschreibend
und damit als Marke schwerer einzutragen.

### 20 Kandidaten

| Stil | Kandidaten |
| --- | --- |
| beschreibend | Kitchen Ledger (Platzhalter), Tellerwert, Portionspreis, Rezeptkasse, Kochwert |
| zusammengesetzt | Kostwerk, Wiegewerk, Kornbuch, Tellr |
| Kunstwort | Pantra, Kuvo, Fenno, Margo |
| Metapher | Mise, Brigade, Passe, Larder, Vorrat |
| Verb/Einheit | Gramm, Abwiegen |

### Ausgeschieden, mit Grund

| Name | Grund |
| --- | --- |
| Kitchen Ledger | **besetzt:** iOS-App „Kitchen Ledger: Cottage Baker“, Back-Office für Heimbäcker mit Allergenen und Etiketten (Websuche 2026-10-20) |
| Margo | zu nah an MarginEdge und Marge Brut, beides Kalkulations-Software derselben Kategorie (Websuche 2026-10-20) |
| Kostwerk | zu nah an „KOST“ (KOST Software GmbH, Gastronomie und Gemeinschaftsverpflegung) (Websuche 2026-10-20) |
| Larder | Meal-Planner-App mit Vorratsverwaltung und eine Rezeptkosten-Vorlage gleichen Namens (Websuche 2026-10-20) |
| Mise, Brigade, Vorrat, Gramm, Passe | Alltagswörter der Küche; im Bereich vermutlich vielfach belegt und schwach schützbar (nicht einzeln geprüft) |
| Portionspreis, Rezeptkasse, Kochwert, Abwiegen, Wiegewerk, Kornbuch, Tellr | lang, rein beschreibend oder schwer zu buchstabieren |

### Prüfungen der fünf

In dieser Umgebung sind Markenregister, Domain-Abfragen, App Stores und soziale Netzwerke gesperrt. **Keine dieser
Prüfungen ist gelaufen.** Nur die Websuche nach „Name + Branche“ lief. Kein Treffer heißt nur, dass die Suche nichts
gefunden hat. Es heißt nicht „frei“.

| Prüfung | Pantra | Tellerwert | Kuvo | Fenno | (5.) |
| --- | --- | --- | --- | --- | --- |
| Websuche Name + Branche | 2026-10-20: kein Produkt gefunden | 2026-10-20: kein Produkt gefunden (Nachbarn: GastroCalc, GastroCost) | 2026-10-20: kein Produkt gefunden | 2026-10-20: kein Produkt gefunden | – |
| US-Marke (USPTO, Klassen 9 und 42) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| EU-Marke (EUIPO / TMview) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| DE-Marke (DPMAregister) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| Kanada (ISED) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| Weltweit (WIPO Global Brand Database) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| Domains (.com, .de, .app) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| App Store und Google Play | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| Handles (X, Instagram, TikTok, GitHub, LinkedIn) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |

Nur vier Kandidaten haben die Websuche überstanden. Einen fünften sucht man am besten, sobald die Positionierung steht.
Das ist eine Vorprüfung, keine rechtliche Freigabe: Bevor Geld in den Namen fließt (Domain, Logo, Anmeldung), sollte eine
Markenanwältin oder ein Markenanwalt recherchieren.

## Palette

Die Markenfarbe des Originals ist unbekannt: Seine Seite ist hier gesperrt, und es gibt keine Screenshots. Pantra nutzt
**Aubergine**, eine Farbfamilie, die keine Statusrolle belegt (Rot = Fehler, Grün = Erfolg, Bernstein = Warnung, Blau = Hinweis).
Damit wird ein Button nie mit einer Meldung verwechselt. Vor dem Start mit dem Original vergleichen und dessen Farben in
`brand.json` → `colors` eintragen, damit der Sweep sie findet.

| Rolle | Wert | Kontrast |
| --- | --- | --- |
| accent | #7a2e6e | weiß darauf 8,6 : 1 |
| accent-hover | #5e2155 | weiß darauf 11,5 : 1 |
| accent-subtle | #f6eef4 | accent darauf 7,6 : 1 |
| focus-ring | #7a2e6e | auf Weiß 8,6 : 1 |
| nav-bg | #1f1622 | nav-text darauf 10,4 : 1 |
| nav-item-active | #33263a | weiß darauf 14,2 : 1 |

`python3 replica/design/contrast.py replica/design/tokens.json`: **31 Paare, 0 AA-Fehler.** Alle anderen Rollen bleiben gleich.

## Logo-Briefing

- **Idee:** ein Vorratsglas oder Regalfach, das zugleich ein „P“ ist. Ordnung im Lager und Klarheit beim Preis.
- **Markentyp:** Symbol plus Wortmarke. Das Symbol muss allein als App-Icon und Favicon funktionieren.
- **Größen:** lesbar bei 16 px (Favicon) und als 1024 px App-Icon. Bei 16 px höchstens zwei Formen, keine feinen Linien.
- **Farben:** Aubergine #7a2e6e auf Weiß, Weiß auf Aubergine. Funktioniert auch einfarbig schwarz (Kassenbon, Fax an Lieferanten).
- **Schrift der Wortmarke:** offen lizenziert (Inter wie in der App, oder eine freie Grotesk mit mehr Charakter).
- **Lieferumfang:** SVG (Symbol, Wortmarke, beides), App-Icon 1024×1024 ohne Transparenz für iOS, Favicon-Set
  (16, 32, 180, SVG), Social-Bild 1200×630.
- **Darf dem Original nicht ähneln:** kein gemeinsames Grundelement, kein gleiches Farbpaar, kein gleicher Buchstabentrick.
  Die Entwürfe neben das Logo des Originals legen und prüfen. Dessen Logo konnte hier nicht angesehen werden.
- **Aktuell:** `web/src/app/icon.svg` ist ein Platzhalter (weißes „P“ auf Aubergine), kein Logo.

## Stimme

Pantra spricht wie eine erfahrene Kollegin am Pass: weiß, was zu tun ist, und sagt es so, dass es in der Hektik ankommt.
Wir duzen.

**Drei Wörter**
- **klar**, nicht knapp: ein ganzer Satz, wenn er nötig ist, aber kein Wort zu viel.
- **kollegial**, nicht kumpelhaft: auf Augenhöhe, ohne Ausrufezeichen und Emojis.
- **genau**, nicht pedantisch: Zahlen und Einheiten stimmen; erklärt wird nur, was gerade gebraucht wird.

| Tun | Lassen |
| --- | --- |
| „Für „Zwiebeln“ fehlt das Gewicht pro Stück.“ (sagt, was fehlt) | „Ungültige Eingabe.“ |
| „Bestellung ist raus. Geht an bestellung@…“ | „Ihre Bestellung wurde erfolgreich übermittelt!“ |
| „2 Zeilen ohne Preis – der echte Wareneinsatz liegt höher.“ | „Achtung: Daten unvollständig.“ |
| Fachwörter der Küche: Gebinde, Wareneinsatz, Inventur, Schwund | Software-Wörter: Entität, Datensatz, Objekt |
| Eine Handlung pro Button: „Lieferung erfassen“ | „OK“, „Absenden“, „Weiter“ ohne Ziel |

### Die zehn meistgesehenen Texte, neu geschrieben

| Ort | vorher | jetzt |
| --- | --- | --- |
| Anmeldung | Rezepte, Kalkulation, Einkauf und Lager an einem Ort. | Rezepte, Preise und Lager – alles, was deine Küche rechnet. |
| Registrierung | 14 Tage kostenlos testen. Keine Zahlungsdaten nötig. | 14 Tage kostenlos. Ohne Kreditkarte, ohne Haken. |
| Einrichtung | Zwei Angaben, dann kann es losgehen. Beides lässt sich später ändern. | Zwei Angaben, dann geht es los. Beides kannst du später ändern. |
| Zutaten leer | Lege deine erste Zutat mit Gebinde und Preis an. Danach kannst du Rezepte kalkulieren. | Fang mit dem an, was du am häufigsten kaufst. Mit Gebinde und Preis rechnet jedes Rezept von selbst. |
| Rezepte leer | Lege dein erstes Rezept an und sieh sofort, was eine Portion kostet. | Leg ein Rezept an – noch beim Tippen siehst du, was ein Teller kostet. |
| Übersicht ohne Aufgaben | Alles erledigt. Preise vollständig, Bestände über Minimum. | Nichts offen: Alle Preise sind da, alle Bestände über Minimum. |
| Kalkulation unvollständig | n Zeile(n) ohne Kosten – der Wert ist zu niedrig. | n Zeile(n) ohne Preis – der echte Wareneinsatz liegt höher. |
| Bestellung gesendet | Bestellung gesendet · An … | Bestellung ist raus · Geht an … |
| Allgemeiner Fehler | Unbekannter Fehler. | Da ist etwas schiefgegangen. Bitte versuch es noch einmal. |
| Fehlerseite | (Fehlermeldung des Systems, in Produktion englisch) | Die Seite ließ sich gerade nicht laden. Meist hilft ein zweiter Versuch. (+ Fehlercode) |

Alle Texte sind für Pantra neu geschrieben. Die des Originals hat der Klon nie gesehen, weil die Recon nur Zusammenfassungen kannte.

## Sweep

`python3 ~/.claude/skills/replica-brand/sweep.py . --config replica/brand.json` → Ergebnis im Commit-Log und unten.
Per Augenschein geprüft: Seitentitel (Vorlage „Seite · Pantra“), Favicon (Platzhalter), Absendername der E-Mails, Kopf der App
und der Anmeldeseiten. Noch offen: OG-Bild und App-Icon, die kommen mit dem Logo.
