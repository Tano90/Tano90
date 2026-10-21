# Marketing-Plan vor dem Start: Nachfrage messen

Stand: 2026-10-21 · Produkt: GLB AI Suite · Ziel dieses Plans: **in sechs Wochen herausfinden, ob Küchen das wollen**, bevor
Geld in Domain, Werbung oder Abrechnung fließt.

## Die Frage, die der Plan beantwortet

> Melden sich genug Küchen von selbst, wenn sie GLB AI Suite sehen, und wollen sie es nach einer Vorführung nutzen?

Gemessen wird das in deiner Übersicht unter **Einstellungen → Anfragen** (`/admin/leads`): Aufrufe der Startseite,
Anfragen, Anfragen je Aufruf, nach Quelle und Woche, dazu der Status jeder Anfrage (neu, kontaktiert, Vorführung,
Kunde, kein Interesse).

### Schwellen nach sechs Wochen (Vorschlag)

| Ergebnis | Bedeutung | Nächster Schritt |
| --- | --- | --- |
| **30+ Anfragen, 10+ Vorführungen, 3+ sagen „ich würde zahlen“** | Nachfrage da | Domain kaufen, Konten anlegen, `LAUNCH_MODE=open`, Start |
| 10 bis 29 Anfragen oder viele Anfragen, wenig Vorführungen | Interesse, Botschaft oder Zielgruppe passt noch nicht ganz | Botschaft schärfen (siehe Inhalte, Variante B), zwei Wochen verlängern |
| unter 10 Anfragen | zu wenig Zug | Mit 10 Küchen sprechen, warum nicht; Positionierung überdenken, bevor gebaut oder bezahlt wird |

Die Zahlen sind Vorschläge für einen Test mit kleinem Budget, keine Branchenwerte. Wichtiger als die Menge: Was sagen
die Leute in der Vorführung? Das steht in den Notizen jeder Anfrage.

## Was schon gebaut ist

- **Anfrageformular** auf der Startseite („Zeig uns dein teuerstes Gericht“): Name, Betrieb, E-Mail, optional Telefon,
  Standorte, Nachricht. Bot-Falle und Begrenzung auf 5 Anfragen pro Stunde und Adresse.
- **Sofort-Mail an dich** bei jeder Anfrage (an `LEADS_NOTIFY_EMAIL`, sonst die Impressums-Adresse), mit „Antworten“
  direkt an die anfragende Person. Die Person bekommt eine kurze Bestätigung.
- **Zähler ohne Cookies**: nur Aufrufe der Startseite pro Tag und Quelle. Kein Cookie-Banner nötig.
- **Kampagnen-Links** für jeden Kanal in der Übersicht: Jede Anfrage zeigt, woher sie kam.
- **Vorstart-Modus**: Mit `NEXT_PUBLIC_LAUNCH_MODE=waitlist` führen alle Knöpfe zum Anfrageformular statt zur
  Registrierung. So geht die Seite online, bevor Supabase-Login und Stripe eingerichtet sind.
- Datenschutzerklärung nennt Formular und Zähler; Anfragen werden zwölf Monate nach dem letzten Kontakt automatisch gelöscht.

## Warum nicht Shopify

Shopify verkauft Waren und Downloads. GLB AI Suite ist ein Abo-Dienst, die Abrechnung pro Standort läuft schon über Stripe in
der App. Ein Shop wäre eine zweite Website mit eigenen Kosten (ab ca. 30 € im Monat), die Anfragen lägen getrennt von der
App, und ein Abo dort bräuchte eine Zusatz-App. Die Startseite von GLB AI Suite kann alles, was der Test braucht.

## Was du einmal einrichten musst (ohne Domain)

Für die Vorstart-Phase reicht eine kostenlose Adresse von Vercel (`glb-xyz.vercel.app`), die Domain kommt später.

1. **Vercel-Konto** (kostenlos) und das Repository verbinden, Root Directory `web`.
2. **Supabase-Projekt** (kostenlos, Region Frankfurt): Datenbank für Anfragen und Zähler, und die Anmeldung für deinen
   eigenen Zugang zur Übersicht. Im Vorstart-Modus zeigt die Startseite keine Registrierung; du registrierst dich selbst
   direkt unter `/signup` und trägst deine Adresse in `OPERATOR_EMAILS` ein.
3. **Resend-Konto** (kostenlos bis 3.000 Mails/Monat). Ohne eigene Domain verschickt Resend nur an deine eigene
   Adresse; das reicht für die Benachrichtigung an dich. Die Bestätigung an Interessenten geht erst mit verifizierter
   Domain zuverlässig raus. Bis dahin: Interessenten innerhalb eines Werktags persönlich antworten.
4. In Vercel diese Variablen setzen: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_LAUNCH_MODE=waitlist`, `OPERATOR_EMAILS` (deine Adresse),
   `LEADS_NOTIFY_EMAIL`, `RESEND_API_KEY`, `MAIL_FROM` (ohne eigene Domain: `onboarding@resend.dev`), `APP_URL`,
   `CRON_SECRET`. Stripe bleibt leer, bis ihr startet.
5. Deine Angaben in `web/src/lib/legal.ts` eintragen: Impressum und Datenschutz müssen stehen, bevor die Seite
   öffentlich ist.

Die Schritte im Detail stehen in `replica/deploy.md`; du legst die Konten an, ich trage nichts ein.

## Kanäle

| Kanal | Warum | Aufwand pro Woche | Link-Quelle |
| --- | --- | --- | --- |
| **Persönliches Netzwerk** (Köche, Gastronomen, die du kennst) | Höchste Antwortquote; erste Vorführungen | 2 h | `email` / `personal` |
| **LinkedIn** (eigenes Profil) | Inhaber von Gruppen und Küchenchefs sind dort; Beiträge mit Beispielrechnung | 2 h | `linkedin` / `social` |
| **Facebook-Gruppen für Gastronomie** | Viele Inhaber kleiner Betriebe; nur wo Regeln Werbung erlauben, sonst nur helfen | 1 h | `facebook` / `community` |
| **Instagram** | Für Bilder aus der Küche; zweitrangig für B2B, aber Köche folgen dort | 1 h | `instagram` / `social` |
| **Vor Ort**: Großmarkt, Lieferanten, Gastro-Stammtische, Berufsschulen | Persönlicher Kontakt, Flyer mit QR-Code | nach Gelegenheit | `flyer` / `print`, `event` / `offline` |
| **Google Ads, Testbudget** (optional, ab Woche 3) | Misst, ob Leute aktiv nach so etwas suchen | 30 min | `google` / `cpc` |

**Nicht** machen: Werbe-E-Mails oder Anrufe an Betriebe, die nicht zugestimmt haben. In Deutschland ist das auch
gegenüber Unternehmen in der Regel unzulässig (§ 7 UWG). Persönliche Nachrichten an Kontakte, die dich kennen, und
Beiträge, auf die Leute selbst reagieren, sind der sichere Weg. Den Namen des Originals nirgends nennen, keine
erfundenen Kundenstimmen oder Zahlen.

## Sechs Wochen

| Woche | Schwerpunkt | Konkret |
| --- | --- | --- |
| 0 | Einrichten | Konten, Variablen, Rechtsangaben; Seite online im Vorstart-Modus; selbst eine Testanfrage schicken |
| 1 | Netzwerk | 20 persönliche Nachrichten (Vorlage in `content.md`); LinkedIn-Beitrag 1 und 2 |
| 2 | Erste Vorführungen | Jede Anfrage binnen 24 h beantworten; 30 Minuten Vorführung (Ablauf in `content.md`); LinkedIn 3, Instagram 1–2 |
| 3 | Gemeinschaften | Zwei Facebook-Gruppen: erst helfen, dann Beitrag „Rechenbeispiel“; optional Google Ads mit 10 € pro Tag starten |
| 4 | Vor Ort | 50 Flyer: Großmarkt, Lieferanten, Berufsschule; LinkedIn 4 und 5 |
| 5 | Nachfassen | Alle „kontaktiert“ ohne Vorführung einmal freundlich erinnern; Instagram 3–4 |
| 6 | Auswerten | Übersicht ansehen: Anfragen je Quelle, Vorführungen, Notizen; Entscheidung nach der Schwellen-Tabelle |

## Ablauf pro Anfrage

1. Mail kommt an → binnen 24 Stunden persönlich antworten (Vorlage in `content.md`), Status **kontaktiert**.
2. Termin für 30 Minuten (Video oder vor Ort) → Status **Vorführung**, Termin in die Notiz.
3. In der Vorführung: ihr teuerstes Gericht anlegen, Wareneinsatz zeigen; Fragen aus `content.md` stellen, Antworten in
   die Notiz.
4. Danach: **Kunde** (will starten, wenn es losgeht) oder **kein Interesse**, mit Grund in der Notiz.

## Budget

| Posten | Betrag |
| --- | --- |
| Vercel, Supabase, Resend in der Vorstart-Phase | 0 € (kostenlose Tarife) |
| Flyer, 100 Stück | ca. 20–40 € |
| Google Ads, optional, 3 Wochen × 10 €/Tag | ca. 210 € |
| **Summe** | **ca. 20 bis 250 €** |

Preise der Anbieter vor dem Abschluss selbst prüfen; sie ändern sich.

## Branchenseiten (neu)

Für Anzeigen und Mails je Zielgruppe direkt auf die passende Seite verlinken, mit `utm_source`, damit die Anfrage
die Quelle trägt: `/branchen/hotel`, `/branchen/restaurant`, `/branchen/catering`, `/branchen/kantine`.
Hotels zuerst mit F&B-Controlling und Housekeeping ansprechen; die Seite sagt offen, dass es noch keine
PMS-Anbindung gibt und GLB AI Suite keine Finanzbuchhaltung ersetzt.
