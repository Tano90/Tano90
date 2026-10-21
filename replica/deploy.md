# Deploy-Checkliste: Mirepa

Datum: 2026-10-21 · Vorabprüfung auf `9e92c72` · **Go von dir: noch nicht**

## Urteil: **Deploy gestoppt**

Vier Punkte stoppen den Deploy, jeder für sich:

1. **Ein Must-have offen:** Login, gebaut und mit Demo-Konten getestet, aber nie mit einem echten Supabase-Projekt
   durchgeklickt (Testplan A02). Score 94,1, Must-haves 20 von 21.
2. **Rechtsseiten ohne Betreiberangaben:** Impressum, Datenschutz, Nutzungsbedingungen und Auftragsverarbeitung sind
   ausgeschrieben (2026-10-21), aber 13 Angaben des Betreibers fehlen (`npm run legal:check` → exit 1), und eine rechtliche
   Prüfung steht aus. In Deutschland ist ein vollständiges Impressum Pflicht.
3. **Name gewählt, aber nicht geprüft:** Mirepa (2026-10-21, statt Pantra, das einen Namensvetter im App Store hat).
   Bisher nur Websuche; Markenregister, Domain und Stores sind hier gesperrt. Vor dem Domainkauf prüfen (`brand.md`).
4. **Produktionsdienste fehlen:** kein Supabase-, Stripe-, Resend- oder Vercel-Konto verbunden. Die lege ich nicht an.

Alles, was sich ohne deine Konten prüfen lässt, ist grün. Live ging nichts, es gibt keine URL.

## Vorabprüfung (ausgeführt, nicht angenommen)

| Prüfung | Ergebnis | Befehl / Beleg |
| --- | --- | --- |
| E2E-Suite | ✅ **189 / 189** | `E2E_DATABASE_URL=… npx playwright test` (Produktions-Build auf Postgres 16, Migrationen 0001–0013) |
| Unit- und Integrationstests | ✅ **61 / 61** | `TEST_DATABASE_URL=… npx vitest run` (inkl. RLS mit zweitem Betrieb) |
| Typprüfung | ✅ | `npx tsc --noEmit` |
| Linter | ⚠️ **nicht eingerichtet** | es gibt kein `lint`-Skript und keine ESLint-Konfiguration; frühere Meldungen „Lint grün“ in diesem Verlauf waren falsch (das Skript fehlte, `-s` verschluckte den Fehler) |
| Offene S1/S2-Bugs | ✅ keine | `replica/bugs.md`: 21 gefunden, 21 behoben |
| Parität: alle Must-haves | ❌ **20 / 21**, Score **94,1** | `parity.py replica/features.csv --fail-under 80` → Score über 80, aber ein Must-have teilweise (A02) |
| Rebrand-Sweep | ✅ sauber (exit 0) | `sweep.py . --config replica/brand.json`; **Lücke:** Farben des Originals unbekannt, daher nicht geprüft |
| Store-Listing | ✅ 0 Fehler, 1 Warnung (HACCP in Großbuchstaben, gewollt) | `listing.py replica/launch/listing.json` (erst mit nativer App relevant) |
| Produktions-Build | ✅ | `npm run build` |
| Abhängigkeiten | ✅ 0 Schwachstellen | `npm audit --omit=dev` |
| Datenschutz und Nutzungsbedingungen live, alle Auftragsverarbeiter | ⚠️ Text fertig, Betreiberangaben fehlen | `/legal/imprint`, `/legal/privacy` (Zwecke, Rechtsgrundlagen, Fristen aus dem Code, Cookies, Drittland), `/legal/terms` (B2B-AGB), `/legal/dpa` (AVV nach Art. 28 mit TOMs); Dienstleister aus einer Liste (`src/lib/legal.ts`), E2E `legal.spec.ts`; `npm run legal:check` → **exit 1**, 13 Felder offen; anwaltliche Prüfung offen |
| Cookie-Banner | ✅ nicht nötig, solange es so bleibt | nur technisch notwendige Cookies (Sitzung, gewähltes Outlet) |
| Konto löschen funktioniert | ⚠️ teilweise | Daten: E2E A04-H1/N1 grün, inkl. Zentralküchen-Anforderungen (Migration 0012); Login-Löschung über die Supabase Admin API nicht getestet (kein Projekt) |
| Favicon, Titel, OG-Bild, E-Mails, App-Icon eigen | ⚠️ teilweise | Titel „… · Mirepa“ ✅, E-Mail-Absender ✅, Favicon nur Platzhalter, **kein OG-Bild**, kein Logo (Briefing in `brand.md`) |
| Kamera-Scan (Barcode) | 🖐 von Hand offen | F08-B5: Chrome auf Android über HTTPS; erst auf der Live-Domain prüfbar |

## Produktion (vorbereitet, von dir auszuführen)

- [ ] **Datenbank:** eigenes Supabase-Projekt nur für Produktion (EU Frankfurt), nie das Entwicklungsprojekt. Pro-Plan für tägliche Backups; Backups im Dashboard prüfen. API → Exposed schemas: `public` entfernen.
- [x] **Migrationen im Deploy:** `vercel-build` = `npm run db:migrate && npm run build`. Achtung: Preview-Deployments brauchen eine eigene `DATABASE_URL` (Staging-Projekt), sonst migrieren sie die Produktion.
- [ ] **Umgebungsvariablen** in Vercel → Production, Namen exakt wie `web/.env.example`. `ALLOW_DEMO` **niemals** setzen: Damit könnte sich jeder ohne Passwort als Demo-Inhaber anmelden.
- [ ] **Stripe live:** Produkt und beide gestaffelten Preise neu im Live-Modus anlegen (`launch/pricing.md`), Webhook `https://DEINE-DOMAIN/api/webhooks/stripe` mit `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, Signatur-Secret in `STRIPE_WEBHOOK_SECRET`. Kundenportal: Kündigen aktivieren. Ein echter Kauf, dann erstatten.
- [ ] **Supabase Auth:** Site-URL = Produktionsdomain, Redirect-URL `https://DEINE-DOMAIN/auth/callback`, E-Mail-Bestätigung an, SMTP auf Resend umstellen.
- [x] OAuth (Google/Apple): nicht im Einsatz, nichts zu verifizieren.
- [ ] **E-Mail-Domain** in Resend verifiziert (DNS unten), `MAIL_FROM` darauf.
- [ ] **Cron:** `CRON_SECRET` setzen; die Crons stehen in `web/vercel.json` (`/api/cron/low-stock` 04:00 UTC, `/api/cron/trial` 08:00 UTC, `/api/cron/cleanup` 03:30 UTC).

## Host und Domain

Vercel, Root Directory `web`, Framework Next.js, Branch `main` → Produktion, Pull Requests → Previews.

Die Domain kaufst du (Name erst nach der Markenprüfung in `brand.md`). Dann:

| Typ | Name | Wert |
| --- | --- | --- |
| A | @ | die Apex-IP aus Vercel → Domains (dort angezeigt; nicht raten) |
| CNAME | www | `cname.vercel-dns.com` (bzw. der Wert, den Vercel anzeigt) |
| TXT | wie von Vercel verlangt | Verifizierungswert, falls angezeigt |
| TXT (SPF) | Absender-Subdomain laut Resend, z. B. `send` | Wert aus Resend → Domains |
| CNAME/TXT (DKIM) | laut Resend, z. B. `resend._domainkey` | Wert aus Resend → Domains |
| MX (Bounce) | laut Resend, falls angezeigt | Wert aus Resend |
| TXT (DMARC) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@DEINE-DOMAIN` → nach zwei Wochen sauberer Berichte `p=quarantine` |

- [ ] Kanonischer Host: **Apex** (`DEINE-DOMAIN`), `www` leitet in Vercel per 308 dorthin um. `APP_URL` = `https://DEINE-DOMAIN`.
- [ ] HTTPS: automatisch bei Vercel; nach dem Umschalten Zertifikat und Weiterleitung `http → https` prüfen.

## Beobachten

- [ ] **Fehler:** Sentry (EU-Region) oder Vercel-Fehlerlogs; Alarm per E-Mail/Push an dich. In der Datenschutzerklärung nennen.
- [ ] **Uptime:** zwei Checks alle 5 Minuten, z. B. mit Better Stack oder UptimeRobot: `https://DEINE-DOMAIN/` (Landingpage) und `https://DEINE-DOMAIN/api/health` (prüft auch die Datenbank; gibt 503, wenn sie nicht antwortet; lokal in beiden Zuständen geprüft).
- [ ] **Statistik:** ohne Cookies (z. B. Plausible EU), damit kein Banner nötig wird.
- [ ] **Logs:** Vercel-Logs aufbewahren; die App loggt keine E-Mail-Adressen.
- [ ] **Kernablauf live:** registrieren → Betrieb anlegen → Zutat mit Preis → Rezept → Bestellung an dich selbst als Lieferant → Wareneingang → Inventur. Ich auf dem Desktop, du auf dem Handy.

## Mobile

Keine native App. Mirepa läuft im Browser (Handy-Layout geprüft). `launch/listing.json` ist für später vorbereitet.

## Erste Woche nach dem Start

- Stripe: fehlgeschlagene Webhooks (Dashboard → Webhooks) und `job_runs` mit Status `failed`/`dead`.
- Resend: Bounces und Spam-Beschwerden der Bestell-Mails an Lieferanten.
- `/api/health` und Fehler-Rate; jede 5xx ansehen.
- Registrierungen, die nie ein Rezept mit Preis anlegen: dort hakt der Einstieg.
- DMARC-Berichte, danach auf `quarantine` verschärfen.

## Bis zum Go

1. **Namen prüfen:** Mirepa in DPMA, EUIPO/TMview, USPTO (Klassen 9 und 42), Domains und Stores (Liste in `brand.md`);
   dann Markenrecherche durch eine Anwältin oder einen Anwalt, Domain kaufen, Logo und OG-Bild anfertigen.
2. **Rechtsseiten:** deine Angaben in `web/src/lib/legal.ts` → `OPERATOR` eintragen, bis `npm run legal:check` grün ist;
   dann alle vier Seiten anwaltlich prüfen lassen. Die Seiten versprechen auch Dinge, die du organisatorisch einlösen
   musst: Zwei-Faktor-Anmeldung für alle Zugänge zu Produktivsystemen (AVV, Anlage 1), Datenherausgabe binnen 30 Tagen
   nach Vertragsende und danach Löschen (von Hand; es gibt keinen Export aller Daten), Standort aus der Abrechnung nehmen
   auf Nachricht (in der App gibt es kein Archivieren von Standorten), sechs Wochen Vorlauf bei Preis- und AGB-Änderungen.
3. **Konten anlegen** (oben), Schlüssel in Vercel eintragen. `ALLOW_DEMO` nie setzen.
4. **A02 durchklicken** mit dem Produktions- oder einem Staging-Supabase-Projekt: registrieren, Bestätigungsmail, Magic
   Link, Passwort zurücksetzen, falsches Passwort.
5. Diese Checkliste erneut ausführen (`/replica-deploy`). Erst wenn alles ✅ ist, frage ich nach deinem Go.

## Lücken im Produkt, beim Schreiben der Rechtsseiten gefunden (geschlossen 2026-10-21)

- **Ende der Testphase:** Nach 14 Tagen ohne Abo ist der Betrieb nur noch lesbar. Jede schreibende Aktion wird auf dem
  Server abgelehnt, ebenso die Kassen-API (402). Ausgenommen sind Abo, Kundenportal, Team und die Vorschau-Berechnungen.
  Hinweisband in der App ab drei Tagen vor dem Ende. Erinnerungsmail an die Inhaber drei Tage vorher und nach dem Ende,
  je einmal (Cron `/api/cron/trial`, täglich 08:00 UTC). Dasselbe gilt nach einem beendeten Abo.
  Getestet: Unit `access.test.ts`, Integrationstest, E2E T-H1/T-N1.
- **Standorte archivieren:** unter Einstellungen → Outlets & Team. Abgelehnt beim letzten Standort, bei offenen
  Bestellungen, einer laufenden Inventur, offenen Anforderungen der Zentralküche und bei Teammitgliedern, die nur diesem
  Standort zugeordnet sind. Kassen-Schlüssel des Standorts werden widerrufen, die Abrechnung wird anteilig angepasst.
  Getestet: Integrationstest, E2E O-H1.
- **Export:** Einstellungen → Daten exportieren lädt alle Daten des Betriebs als JSON herunter (`/api/export`, Inhaber
  und Admins, auch im Nur-Lesen-Zustand). Ohne Schlüssel-Hashes, Token-Hashes und Stripe-IDs. Getestet: Integrationstest
  (auch: nichts aus einem fremden Betrieb), E2E E-H1.
- **Cron:** Der neue Job steht in `web/vercel.json`. Er braucht dasselbe `CRON_SECRET` wie die anderen.
