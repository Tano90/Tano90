# Deploy-Checkliste: Pantra

Datum: 2026-10-20 · Commit: siehe `git log -1` (Vorabprüfung auf `dd49659` + Health-Endpoint) · **Go von dir: noch nicht**

## Urteil: **Deploy gestoppt**

Drei Prüfungen schlagen fehl, und jede allein stoppt den Deploy:

1. **Parität:** 16 von 21 Must-haves, Score 62,3 (Schwelle 80). Fünf Must-haves sind nur teilweise da.
2. **Rechtsseiten sind Entwürfe:** Impressum, Datenschutz, Nutzungsbedingungen ohne Betreiberangaben und ohne rechtliche Prüfung.
   In Deutschland ist ein vollständiges Impressum Pflicht.
3. **Produktionsdienste fehlen:** Kein Supabase-, Stripe-, Resend- oder Vercel-Konto verbunden. Die lege ich nicht an; das bist du.

Alles, was sich ohne deine Konten prüfen lässt, ist grün (unten). Live ging nichts, es gibt keine URL.

## Vorabprüfung (ausgeführt, nicht angenommen)

| Prüfung | Ergebnis | Befehl / Beleg |
| --- | --- | --- |
| E2E-Suite | ✅ **66 / 66** | `E2E_DATABASE_URL=… npx playwright test` (Produktions-Build auf Postgres 16) |
| Unit- und Integrationstests | ✅ **32 / 32** | `TEST_DATABASE_URL=… npx vitest run` (inkl. RLS mit zweitem Nutzer) |
| Offene S1/S2-Bugs | ✅ keine | `replica/bugs.md`: 6 gefunden, 6 behoben |
| Parität: alle Must-haves | ❌ **16 / 21**, Score **62,3** | `parity.py replica/features.csv --fail-under 80` → exit 1 |
| Rebrand-Sweep | ✅ sauber (exit 0) | `sweep.py . --config replica/brand.json`; **Lücke:** Farben des Originals unbekannt, daher nicht geprüft |
| Store-Listing | ✅ 0 Fehler, 0 Warnungen | `listing.py replica/launch/listing.json` (nur relevant, wenn eine native App kommt) |
| Produktions-Build | ✅ | `npm run build` |
| Abhängigkeiten | ✅ 0 Schwachstellen | `npm audit --omit=dev` |
| Datenschutz und Nutzungsbedingungen live, alle Auftragsverarbeiter | ❌ Entwurf | `/legal/privacy` nennt Supabase, Vercel, Stripe, Resend; Betreiber, Rechtsgrundlagen, Fristen fehlen; `/legal/terms` und `/legal/imprint` Entwurf |
| Cookie-Banner | ✅ nicht nötig, solange es so bleibt | nur technisch notwendige Cookies (Sitzung, gewähltes Outlet); Statistik nur ohne Cookies wählen (siehe unten) |
| Konto löschen funktioniert | ⚠️ teilweise | Daten: E2E A04-H1/N1 grün; Login-Löschung über die Supabase Admin API nicht getestet (kein Projekt) |
| Favicon, Titel, OG-Bild, E-Mails, App-Icon eigen | ⚠️ teilweise | Titel „… · Pantra“ ✅, E-Mail-Absender ✅, Favicon nur Platzhalter, **kein OG-Bild**, kein Logo (Briefing in `brand.md`) |

### Die fünf offenen Must-haves (Reihenfolge aus `parity.md`)

1. Menüs (schließt „Preisänderung aktualisiert … Menüs“)
2. Team: Rolle ändern, Mitglied entfernen, Inhaberschaft übertragen
3. Inventur in Gebinden
4. Lieferanten archivieren
5. Login: mit deinem Supabase-Projekt durchklicken (Testplan A02)

## Produktion (vorbereitet, von dir auszuführen)

- [ ] **Datenbank:** eigenes Supabase-Projekt nur für Produktion (EU Frankfurt), nie das Entwicklungsprojekt. Pro-Plan für tägliche Backups; Backups im Dashboard prüfen. API → Exposed schemas: `public` entfernen.
- [x] **Migrationen im Deploy:** `vercel-build` = `npm run db:migrate && npm run build`. Achtung: Preview-Deployments brauchen eine eigene `DATABASE_URL` (Staging-Projekt), sonst migrieren sie die Produktion.
- [ ] **Umgebungsvariablen** in Vercel → Production, Namen exakt wie `web/.env.example`. `ALLOW_DEMO` **niemals** setzen: Damit könnte sich jeder ohne Passwort als Demo-Inhaber anmelden.
- [ ] **Stripe live:** Produkt und beide gestaffelten Preise neu im Live-Modus anlegen (`launch/pricing.md`), Webhook `https://DEINE-DOMAIN/api/webhooks/stripe` mit `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, Signatur-Secret in `STRIPE_WEBHOOK_SECRET`. Kundenportal: Kündigen aktivieren. Ein echter Kauf, dann erstatten.
- [ ] **Supabase Auth:** Site-URL = Produktionsdomain, Redirect-URL `https://DEINE-DOMAIN/auth/callback`, E-Mail-Bestätigung an, SMTP auf Resend umstellen.
- [x] OAuth (Google/Apple): nicht im Einsatz, nichts zu verifizieren.
- [ ] **E-Mail-Domain** in Resend verifiziert (DNS unten), `MAIL_FROM` darauf.
- [ ] **Cron:** `CRON_SECRET` setzen; die Crons stehen in `web/vercel.json` (`/api/cron/low-stock` 04:00 UTC, `/api/cron/cleanup` 03:30 UTC).

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

Keine native App. Pantra läuft im Browser (Handy-Layout geprüft). `launch/listing.json` ist für später vorbereitet.

## Erste Woche nach dem Start

- Stripe: fehlgeschlagene Webhooks (Dashboard → Webhooks) und `job_runs` mit Status `failed`/`dead`.
- Resend: Bounces und Spam-Beschwerden der Bestell-Mails an Lieferanten.
- `/api/health` und Fehler-Rate; jede 5xx ansehen.
- Registrierungen, die nie ein Rezept mit Preis anlegen: dort hakt der Einstieg.
- DMARC-Berichte, danach auf `quarantine` verschärfen.

## Bis zum Go

1. Die fünf Must-haves bauen (`/replica-build`), dann `/replica-test` und `/replica-diff` erneut.
2. Rechtsseiten mit Betreiberangaben füllen und prüfen lassen.
3. Name markenrechtlich prüfen lassen, Domain kaufen, Logo und OG-Bild anfertigen.
4. Konten anlegen (oben), Schlüssel eintragen.
5. Diese Checkliste erneut ausführen – erst bei allen ✅ frage ich nach deinem Go.
