> **Stand 2026-10-21: Das Produkt heißt jetzt GLB AI Suite (Gastro Leadership Board).** Die Abschnitte unten
> beschreiben die Markenentscheidungen des früheren Arbeitsnamens; Farben, Stimme und Regeln gelten weiter.
> Neues Logo: drei steigende Balken auf der Aubergine-Kachel mit Safran-Punkt (`web/src/components/brand/logo.tsx`).
> Vor dem Start: Markenrecherche für „GLB AI Suite“ (DPMA, EUIPO) und Domain prüfen.

# Marke: GLB AI Suite

Stand: 2026-10-21 (zweiter Durchgang, „ohne Reviews“). Die Positionierung aus `/replica-entrepreneur` fehlt weiter (0 Bewertungen, Quellen gesperrt). Der Name
stützt sich deshalb auf das, was das Produkt nachweislich besser macht: Es zeigt live, was ein Teller kostet, und hält das
Lager dazu. Wenn die Bewertungen eine andere Positionierung ergeben, kann der Name noch wechseln. Er steht an einer Stelle:
`web/src/lib/brand.ts`.

## Name

**Entschieden am 2026-10-21: GLB AI Suite.** Du hast die Wahl mir überlassen, mit der Vorgabe „ein Name, den es noch nicht gibt“.
GLB AI Suite ist ein Kunstwort aus *Mirepoix*, dem gewürfelten Röstgemüse, auf dem die klassische Küche ihre Fonds und Saucen
aufbaut: die Grundlage, auf der alles andere rechnet. Drei Silben, im Deutschen und Englischen gleich gesprochen
(Mi-re-pa), keine schiefe Bedeutung bekannt. Nichts teilt Klang, Schriftbild oder Bedeutung mit dem Original.

**„Gibt es noch nicht“ heißt hier: Die Websuche fand nichts.** Markenregister, Domain-Abfragen und die Stores sind in
dieser Umgebung gesperrt. Das ist eine Vorprüfung, keine Freigabe; vor dem Domainkauf die Zeilen unten abarbeiten.

### Kandidaten dieser Runde (Websuche 2026-10-21)

| Name | Ergebnis | Entscheidung |
| --- | --- | --- |
| Pantra | iOS-App „Pantra: Pantry Inventory“ (Haushaltsvorrat) | raus |
| Kuvo | KUVO, Radio-App eines Senders in Denver, und KUVO, Club-App von Pioneer DJ | raus |
| Fenno | Fennoa, Buchhaltungssoftware aus Finnland (750+ Kanzleien) | raus, zu nah |
| Platevo | **platevo.io: Restaurant-Software** (digitale Speisekarte, Bestellungen, Küchenmonitor) | raus |
| Gramzo | gramzo.in, Essensbestell-App | raus |
| Kalkulo | Rechner-App „Kalkulilo“ im App Store | raus, zu nah |
| Portora | nur Pflanzensorte, Burg und Schule in Nordirland; kein Unternehmen gefunden | Ersatz, falls GLB AI Suite in einem Register scheitert |
| Tellerwert | kein Produkt; beschreibend, schwer einzutragen | Ersatz nur für DACH |
| **GLB AI Suite** | **kein Treffer**, auch nicht mit Branche; „Mirepoix“ als Software ebenfalls nicht gefunden | **gewählt** |

Der Name steht an einer Stelle (`web/src/lib/brand.ts`); die Landingpage liest ihn von dort. Der alte Name „Pantra“
steht in `brand.json` → `avoid`, damit der Sweep jeden Rest findet. API-Schlüssel beginnen jetzt mit `glb_`.

> **Vorher am 2026-10-21: Pantra hat einen Namensvetter.** Im App Store gibt es „Pantra: Pantry Inventory“ (iOS, Entwickler
> Artur Popov), eine Vorratsverwaltung für den Haushalt mit Mindestbestand, Einkaufsliste und Schwund-Historie
> ([App Store](https://apps.apple.com/us/app/pantra-pantry-inventory/id6757634576), gefunden per Websuche 2026-10-21; am
> 2026-10-20 fand die Suche sie noch nicht). Gleicher Name, Software, Lebensmittel-Bestand: Das ist genau die Nähe, die
> Markenämter prüfen (Klasse 9), auch wenn die Zielgruppe privat statt gewerblich ist. Und im App Store stünden beide
> nebeneinander. **Empfehlung jetzt: vor dem Start umbenennen**, solange es nur eine Konstante ist
> (`web/src/lib/brand.ts`). Die Wahl liegt bei dir, siehe „Entscheidung“ unten. Bis dahin bleibt Pantra im Code.

**Frühere Empfehlung (überholt): Pantra.** Kunstwort, klingt nach *pantry* (Vorratskammer), sagt also Lager und Küche, ohne beschreibend
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

Stand 2026-10-21 für **GLB AI Suite**: Websuche ohne Treffer (auch „GLB AI Suite app/software/restaurant/food“); alle anderen Zeilen
**noch zu prüfen**: DPMA, EUIPO/TMview, USPTO (Klassen 9 und 42), ISED, WIPO, `glb.com`/`.de`/`.app`, App Store und
Google Play, Handles auf X, Instagram, TikTok, GitHub, LinkedIn.

Ältere Tabelle der ersten Runde:

| Prüfung | Pantra | Tellerwert | Kuvo | Fenno | (5.) |
| --- | --- | --- | --- | --- | --- |
| Websuche Name + Branche | 2026-10-21: **iOS-App „Pantra: Pantry Inventory“** (Haushalts-Vorrat); keine Gastro-Software | 2026-10-21: kein Produkt gefunden (Nachbarn: GastroCalc, Rezeptrechner PRO) | 2026-10-21: kein Produkt gefunden | 2026-10-21: kein Produkt gefunden | – |
| US-Marke (USPTO, Klassen 9 und 42) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| EU-Marke (EUIPO / TMview) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| DE-Marke (DPMAregister) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| Kanada (ISED) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| Weltweit (WIPO Global Brand Database) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| Domains (.com, .de, .app) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| App Store und Google Play | App Store **belegt** (per Websuche gefunden, Store selbst gesperrt); Play noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |
| Handles (X, Instagram, TikTok, GitHub, LinkedIn) | noch zu prüfen | noch zu prüfen | noch zu prüfen | noch zu prüfen | |

Am 2026-10-21 erneut versucht: USPTO, EUIPO/TMview, WIPO, DPMA, RDAP/Whois, App Store und Google Play sind weiterhin gesperrt.
Nur vier Kandidaten hatten die Websuche überstanden, nach dem Fund oben sind es drei ohne bekannten Konflikt. Einen fünften sucht man am besten, sobald die Positionierung steht.
Das ist eine Vorprüfung, keine rechtliche Freigabe: Bevor Geld in den Namen fließt (Domain, Logo, Anmeldung), sollte eine
Markenanwältin oder ein Markenanwalt recherchieren.

### Entscheidung (erste Runde, überholt)

| Option | Für | Gegen |
| --- | --- | --- |
| **Kuvo** (Empfehlung) | Kunstwort, zwei Silben, stark schützbar, kein Treffer in der Branche | sagt nichts über Küche oder Preis; die Bedeutung muss die Marke erst aufbauen |
| Fenno | Kunstwort, freundlich, kein Treffer | lat. „Finne“, im Nordischen als Vorsilbe bekannt; sagt nichts über das Produkt |
| Tellerwert | sagt genau, was das Produkt kann; nur DACH | beschreibend und damit schwer als Marke einzutragen; schlecht international |
| Pantra behalten | nichts zu ändern | Namensgleichheit mit einer Vorrats-App, Risiko im Store und beim Eintragen |

Umbenennen kostet im Code eine Zeile (`APP_NAME`) plus Platzhalter-Icon und Mail-Absendername; der Sweep bleibt gleich.

## Positionierung ohne Bewertungen

Auf deinen Wunsch ohne `/replica-entrepreneur`. Diese drei Winkel stützen sich **nur auf das, was der Klon nachweislich
anders macht** (Testplan, Parität), nicht auf Nutzerstimmen. Ob es Kunden genau das stört, ist unbelegt.

```
Für Küchenchefs mit mehreren Outlets, die ihre Kalkulation erst nach dem Speichern sehen,
zeigt {Name} noch beim Tippen, was ein Teller kostet, und hält Lager und Zentralküche dazu.
Beleg: eigene Funktionen (F02 live, F13 Zentralküche), keine Bewertungen.
```
```
Für Betriebe, die HACCP, Inventur und Einkauf in drei Werkzeugen pflegen,
bringt {Name} alles in eine App, HACCP im Grundpreis statt als Zusatzmodul.
Beleg: Recon (HACCP ist beim Original ein Add-on), keine Bewertungen.
```
```
Für Küchen, in denen ein Tippfehler die Bestellung verzehnfacht,
fängt {Name} Eingabefehler ab, bevor sie Geld kosten: Punkt oder Komma, falsche Barcodes, doppelte Rechnungen.
Beleg: BUG-014/015/016/017 und der Rechnungsabgleich, keine Bewertungen.
```

**Empfehlung: der erste Winkel.** Er passt zur Tagline („Was jeder Teller kostet. Und was im Lager liegt.“) und
zum stärksten Unterschied, der Live-Kalkulation. Sobald echte Bewertungen da sind, gegenprüfen.

## Palette

Die Markenfarbe des Originals ist unbekannt: Seine Seite ist hier gesperrt, und es gibt keine Screenshots. GLB AI Suite nutzt
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

## Zweite Markenfarbe (2026-10-21)

**Safran** `#f6b13b` für Knöpfe und Akzente auf dunklem Grund, dazu die Bühnenfarbe **Tinte** `#170f1a`. Neue Rollen in
den Tokens: `ink`, `ink-raised`, `on-ink`, `on-ink-muted`, `saffron`, `on-saffron`, `accent-glow`; `contrast.py`:
39 Paare, 0 AA-Fehler. Safran nur auf dunklem Grund oder mit `on-saffron` als Schrift, nie als Textfarbe auf Weiß.

## Logo-Briefing

- **Idee:** drei gewürfelte Stücke (Mirepoix), die zusammen ein „M“ bilden: die Grundlage, aus der alles entsteht.
- **Markentyp:** Symbol plus Wortmarke. Das Symbol muss allein als App-Icon und Favicon funktionieren.
- **Größen:** lesbar bei 16 px (Favicon) und als 1024 px App-Icon. Bei 16 px höchstens zwei Formen, keine feinen Linien.
- **Farben:** Aubergine #7a2e6e auf Weiß, Weiß auf Aubergine. Funktioniert auch einfarbig schwarz (Kassenbon, Fax an Lieferanten).
- **Schrift der Wortmarke:** offen lizenziert (Inter wie in der App, oder eine freie Grotesk mit mehr Charakter).
- **Lieferumfang:** SVG (Symbol, Wortmarke, beides), App-Icon 1024×1024 ohne Transparenz für iOS, Favicon-Set
  (16, 32, 180, SVG), Social-Bild 1200×630.
- **Darf dem Original nicht ähneln:** kein gemeinsames Grundelement, kein gleiches Farbpaar, kein gleicher Buchstabentrick.
  Die Entwürfe neben das Logo des Originals legen und prüfen. Dessen Logo konnte hier nicht angesehen werden.
- **Umgesetzt (2026-10-21):** Bildmarke aus fünf Würfeln, die ein „M“ bilden, auf Aubergine; der mittlere Würfel in
  Safran (die Karotte im Mirepoix), leicht gedreht. Wortmarke „glb“ klein, extrafett, eng. Komponente
  `web/src/components/brand/logo.tsx`, Favicon `web/src/app/icon.svg`, Vorschaubild für geteilte Links
  `web/src/app/opengraph-image.tsx` (Abbild: `replica/launch/og-image.png`). Eine Designerin kann daraus noch eine
  Reinzeichnung machen; das App-Icon 1024 px für die Stores folgt mit der nativen App.

## Stimme

GLB AI Suite spricht wie eine erfahrene Kollegin am Pass: weiß, was zu tun ist, und sagt es so, dass es in der Hektik ankommt.
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

**Durchgang 2026-10-21:** Die Texte der neuen Screens (Rechnung, HACCP, Zentralküche, Barcode) gegen die Stimme gelesen.
Ein Fehler zog sich durch die ganze App: Zahlen mit Mehrzahl auch bei 1 („1 Einträge gespeichert“, „1 Zeilen übernehmen“,
„1 neue Preise“, „1 Verkäufe übernommen“, „1 Gerichte“). Jetzt über `countOf()` in `web/src/lib/format.ts` an 18 Stellen:
„1 Eintrag gespeichert“, „1 Zeile übernehmen“, „1 neuer Preis (davon 1 neue Zutat)“. Große Zahlen mit Tausenderpunkt
(„24.000 Verkäufe“).

Alle Texte sind für GLB AI Suite neu geschrieben. Die des Originals hat der Klon nie gesehen, weil die Recon nur Zusammenfassungen kannte.

## Sweep

`python3 ~/.claude/skills/replica-brand/sweep.py . --config replica/brand.json` → 2026-10-21: **sauber** („Nothing of the
original's name, domain or colours found“). `contrast.py`: 31 Paare, 0 AA-Fehler. Die Farben des Originals sind weiter
unbekannt und deshalb nicht im Sweep.
Per Augenschein geprüft: Seitentitel (Vorlage „Seite · GLB AI Suite“), Favicon (Platzhalter), Absendername der E-Mails, Kopf der App
und der Anmeldeseiten. Noch offen: OG-Bild und App-Icon, die kommen mit dem Logo.
