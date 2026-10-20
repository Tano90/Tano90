# Fixes und Positionierung

Stand: 2026-10-20 · **Stichprobe: 0 Bewertungen.** · Status: **blockiert, nicht ausgewertet**

## Warum es keine Auswertung gibt

Jede Aussage hier muss auf echten, wörtlich zitierten und verlinkten Bewertungen beruhen. In dieser Umgebung ist
jede Bewertungsquelle durch die Netzwerk-Richtlinie gesperrt (`403` beim Verbindungsaufbau, am 2026-10-20 geprüft):

| Quelle | Host | Status |
| --- | --- | --- |
| G2 | www.g2.com | gesperrt |
| Capterra | www.capterra.com, www.capterra.com.de | gesperrt |
| GetApp | www.getapp.com | gesperrt |
| Trustpilot | www.trustpilot.com | gesperrt |
| Reddit (offizielle API) | www.reddit.com | gesperrt |
| Hacker News (Algolia API) | hn.algolia.com | gesperrt |
| App Store (RSS/Search) | itunes.apple.com | gesperrt |
| Apicbase Hilfecenter / Changelog | get.apicbase.com, support.apicbase.com | gesperrt |

Die Websuche liefert nur von einem Modell zusammengefasste Auszüge. Die sind nicht wörtlich und taugen deshalb nicht als
Beleg. Darum: **keine Themen, keine Zitate, keine Zahlen, keine Positionierung**, und keine neuen Zeilen in `features.csv`.

## So geht es weiter (eine der beiden Wege)

**A. Netzwerk freigeben, dann sammle ich.** In der Cloud-Umgebung (Menü in der Titelleiste der Sitzung → Bearbeiten →
Network access) die Hosts oben unter „Allowed domains“ eintragen. Anleitung:
https://code.claude.com/docs/en/cloud-environments#network-access. Danach lese ich die Seiten wie ein Mensch (kein Scraping),
nutze für Hacker News und den App Store die offiziellen Feeds und trage jede Bewertung wörtlich mit Link ein.

**B. Du sammelst im Browser.** Bewertungen öffnen, wörtlich kopieren, eine Zeile pro Bewertung in `replica/reviews.csv`:

```
source,url,date,rating,text
G2,https://www.g2.com/products/…/reviews/…,2026-05-14,3,"Der Text, exakt wie auf der Seite."
```

Dann:

```bash
python3 ~/.claude/skills/replica-entrepreneur/reviews.py replica/reviews.csv --themes replica/themes.json --out replica/feedback.md
```

Ziel: **100+ Bewertungen aus mindestens drei Quellen**, neueste zuerst, ausdrücklich auch die mit 3 und 4 Sternen.

Wo zu suchen ist (Seiten, die die Recon gefunden hat; Inhalte noch nicht gelesen):

- G2: https://g2.com/products/https-get-apicbase-com/reviews (laut Suchtreffer seit Monaten ohne neue Bewertung, also eher wenige)
- GetApp: https://www.getapp.com/all-software/a/apicbase-food-management
- Capterra / Software Advice: Produktseite „Apicbase“ (Vergleichsseite gefunden: https://softwareadvice.com.au/compare/176971/326163/apicbase-restaurant-management/vs/recipe-costing)
- Reddit: Suchen „apicbase“, „apicbase alternative“, „recipe costing software“, „restaurant inventory software“ in r/KitchenConfidential, r/restaurateur, r/Chefit
- Hacker News: `https://hn.algolia.com/api/v1/search?query=apicbase`
- App Store / Google Play: die Inventur-App, falls gelistet (in der Recon nicht gefunden)
- Achtung bei Anbieter-Vergleichen (z. B. Blog eines Konkurrenten): parteiisch, nicht als Nutzerstimme zählen

Kleine Produkte haben oft nur wenige Bewertungen. Kommen weniger als 100 zusammen, wird das Ergebnis mit der echten Zahl
berichtet und dünne Themen bleiben als „dünn“ markiert. Für Muster auf Ebene der ganzen Kategorie lohnt es sich, auch
Bewertungen direkter Konkurrenten derselben Kategorie zu lesen (gleiche Nutzer, gleiche Probleme), jeweils als eigene Quelle gekennzeichnet.

## Vorbereitet

- `replica/reviews.csv`: leeres Sheet mit den richtigen Spalten.
- `replica/themes.json`: die Standardthemen plus 11 Themen dieser Branche (Einrichtungsaufwand, Inventur, Kalkulation,
  Einheiten und Gebinde, Kassen-Anbindung, Bestellung und Lieferanten, Allergene und Etiketten, Berichte, mehrere Standorte,
  mobile App, Eignung für kleine Betriebe), Muster auf Englisch und Deutsch; alle 203 Muster geprüft.

## Fragen, die die Bewertungen beantworten sollen

Keine Behauptungen, nur Fragen. Sie kommen aus dem Bau des Klons und entscheiden über die Reihenfolge in `parity.md`:

1. Ist der **Einrichtungsaufwand** (Zutaten, Gebinde, Preise erfassen) ein Hauptgrund für Ärger oder Abbruch?
2. Ist die Software für **einzelne Betriebe** zu groß oder zu teuer (sie ist auf Gruppen mit mehreren Standorten ausgerichtet)?
3. Wie oft geht es um **Inventur** (Dauer, mobile App, Zählen in Gebinden)? Das ist ein offenes Must-have im Klon.
4. Wie oft um **Kassen-Anbindung** (fehlende Kasse, falsche Abzüge)? Das ist im Klon noch gar nicht gebaut.
5. Gibt es Klagen über **Support oder Kündigung**? Die gehen an `/replica-launch`.
6. Was loben die 4- und 5-Sterne-Bewertungen? Das ist nicht verhandelbar und muss im Klon mindestens genauso gut sein.

## Drei Listen, Fix-Plan, Positionierung

Noch leer. Sie entstehen erst aus `feedback.md`.
