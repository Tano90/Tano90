# Backend

Stand: 2026-10-20. Grundlage: `replica/architecture.md`. Code: `web/`.

## Was du anlegen musst (Claude legt keine Konten an und trägt keine Schlüssel ein)

| Dienst | Was | Wohin |
| --- | --- | --- |
| Supabase | Projekt in **EU (Frankfurt)**; Auth → E-Mail-Bestätigung an; Redirect-URL `APP_URL/auth/callback` erlauben | `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Supabase | **API → Exposed schemas: `public` entfernen.** Die App spricht direkt mit Postgres; die öffentliche Daten-API wird nicht gebraucht. RLS schützt sie trotzdem, das ist die zweite Sicherung. | – |
| Supabase | Auth → SMTP auf Resend umstellen, damit Bestätigungs-Mails von deiner Domain kommen; Mail-Vorlagen auf Deutsch | – |
| Supabase | Backups: Pro-Plan hat tägliche Backups; Point-in-Time-Recovery optional. **Prüfen, dass sie aktiv sind.** | – |
| Resend | Konto, Sende-Domain verifizieren (SPF, DKIM, DMARC) | `RESEND_API_KEY`, `MAIL_FROM` |
| Stripe | **Testmodus.** Produkt „Kitchen Ledger“ mit monatlichem Preis pro Outlet (Mengenpreis); Customer Portal aktivieren mit Kündigen + Zahlungsart ändern | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` |
| Stripe | Webhook auf `APP_URL/api/webhooks/stripe` mit den 4 Events unten (lokal: `stripe listen`) | `STRIPE_WEBHOOK_SECRET` |
| Vercel | `CRON_SECRET` setzen; die Crons stehen in `web/vercel.json` | `CRON_SECRET` |

Dann:

```bash
cd web
cp .env.example .env.local      # ausfüllen
npm run db:migrate              # wendet supabase/migrations/*.sql an
npm run dev                     # registrieren -> Mail bestätigen -> Betrieb anlegen
```

Lokal ohne Supabase: ein Postgres reicht. `db:migrate` legt dann einen Stub des `auth`-Schemas an, `db:seed` lädt den Demo-Betrieb mit drei Demo-Logins.

## Entscheidungen, die von `architecture.md` abweichen

- **postgres.js statt Drizzle.** Die Migrationen sind handgeschriebenes SQL (Trigger, RLS, Funktionen). Jede Anfrage läuft in einer Transaktion als Rolle `authenticated` mit `auth.uid()` = Nutzer, also genau wie über Supabases API: **die RLS-Policies sind die Zugriffsgrenze**, nicht nur Prüfungen im Code.
- **Vercel Cron statt Inngest.** Es gibt bisher nur zwei tägliche Jobs; die Neuberechnung nach Preisänderungen ist nicht nötig, weil Kosten live berechnet werden. Wiederholungen und Dead-Letter über die Tabelle `job_runs`.
- **Ein Datenbank-Backend, zwei Implementierungen:** `repo-pg.ts` (Postgres) und `repo-memory.ts` (Demo). `repo.ts` wählt anhand von `DATABASE_URL`; TypeScript erzwingt, dass beide dieselben Funktionen und Rückgabetypen haben.

## Auth

- [x] Registrierung mit E-Mail-Bestätigung (`/signup` → Mail → `/auth/callback` → `/onboarding`)
- [x] Anmeldung mit Passwort, Magic Link (nur bestehende Konten), Passwort vergessen / neu setzen
- [x] Sessions in http-only Cookies (`@supabase/ssr`), Auffrischung im `proxy.ts`
- [x] Auf allen Geräten abmelden (`signOut({ scope: "global" })`)
- [x] Rollen owner / admin / chef / outlet_staff; eine Regel-Datei (`session-rules.ts`) plus RLS in der Datenbank
- [x] Konto löschen: löscht Login (Supabase Admin API) und Daten; Alleinbetrieb wird komplett gelöscht; Inhaber mit Team muss vorher übergeben
- [x] Einladungen per E-Mail mit Token (nur Hash gespeichert), 7 Tage gültig, nur für die eingeladene Adresse
- [ ] Inhaberschaft übertragen (Oberfläche fehlt, nötig für „Konto löschen“ bei Teams)
- [ ] Google/Apple-Login (im Original nicht belegt, daher nicht gebaut)
- [ ] **Nicht end-to-end getestet:** Supabase Auth läuft hier nicht (kein Docker). Code ist typgeprüft; Registrierung, Magic Link und Reset bitte mit deinem Projekt einmal durchklicken.

## Datenbank

- [x] Migrationen eingecheckt (`web/supabase/migrations/0001–0004`), Runner `npm run db:migrate`, wiederholbar
- [x] RLS auf jeder Tabelle; Server-Tabellen (`job_runs`, `rate_limit_events`, `processed_webhooks`, …) ohne Policies = für Nutzer gesperrt
- [x] **Getestet mit zweitem Nutzer** (`tests/backend.integration.test.ts`): bekommt nichts zurück, kann nichts schreiben, auch mit gefälschter Session
- [x] Seed mit erfundenen Daten (`npm run db:seed`), verweigert echte Supabase-Projekte
- [ ] Backups: im Supabase-Dashboard prüfen (siehe oben)

Beim Testen gefunden und behoben:
- Ein Inhaber konnte seinen Tarif selbst auf „aktiv“ setzen (Spalten-REVOKE wirkt nicht neben Tabellen-GRANT).
- Teammitglieder konnten ihre eigene Outlet-Zuordnung nicht lesen und hätten nach dem Login kein Outlet gesehen.
- Ein Betrieb mit Lagerbewegungen ließ sich nicht löschen (RESTRICT-Schlüssel während der Kaskade) – jetzt `delete_library()`.
- Ohne Auth-Konfiguration wurde die Startseite beim Build als „Weiterleitung zu /login“ fest vorgerendert.

## Zahlungen (Testmodus)

- [x] Stripe Checkout für das Abo (Menge = Anzahl Outlets), Customer Portal für Ändern und **Kündigen mit einem Klick**
- [x] Webhook: Signatur geprüft, Event-ID gespeichert, idempotent, in einer Transaktion
- [x] Events: `checkout.session.completed`, `customer.subscription.updated` / `.deleted`, `invoice.payment_failed`
- [x] Tarif nur in der Datenbank, nur vom Webhook geschrieben; Nutzer haben kein Update-Recht auf diese Spalten (getestet)
- [x] Live-Schlüssel außerhalb von Produktion werden abgelehnt
- [x] Outlet anlegen passt die Abo-Menge an
- [ ] **Nicht end-to-end getestet:** Checkout und Portal brauchen deine Testschlüssel. Webhook-Signatur und -Logik sind offline getestet.
- [ ] Zugang sperren, wenn Testphase abgelaufen oder gekündigt ist (Status wird angezeigt, aber noch nicht durchgesetzt)

## E-Mail und Jobs

- [x] Resend von deiner Domain; ohne Schlüssel lokal in `web/.outbox/`
- [x] Vorlagen neu geschrieben: Bestellung an Lieferanten, Einladung, Mindestbestand
- [x] Bestell-Mail: erst senden, dann als bestellt markieren; Bestell-ID als Idempotenzschlüssel → nie doppelt beim Lieferanten
- [x] Jobs: `low-stock` täglich 04:00 UTC (06:00 Sommerzeit), `cleanup` täglich; pro Eintrag Wiederholung, nach 5 Versuchen „dead“ in `job_runs`
- [x] Cron-Route nur mit `CRON_SECRET`

## Integrationen

Laut Feature-Matrix sind fertige Kassen- und Lieferanten-Integrationen `skip` (Partnernetzwerk des Originals). Geplant (should):
- **Eigene POS-API** (`/api/v1/pos/*`, Schlüssel pro Outlet) – noch nicht gebaut.
- Spätere Anbindungen nur über offizielle APIs der Kassenanbieter mit deinen eigenen Partner-Zugängen; deren Freigabeprozesse dauern oft Wochen.
- Keine Google-Scopes in Verwendung, daher keine OAuth-Verifizierung nötig.

## Sicherheits-Checkliste

- [x] Geheimnisse nur in Umgebungsvariablen, `.env*` in `.gitignore`, nichts davon im Client-Bundle (geprüft)
- [x] Eingaben serverseitig mit zod geprüft, in jeder Server-Aktion
- [x] Berechtigung bei jedem Lesen und Schreiben: RLS in der Datenbank, getestet mit zweitem Nutzer
- [x] Rate-Limits: Anmeldung, Registrierung, Magic Link, Passwort-Reset, Einladungen, Bestell-Mails (Postgres-basiert)
- [x] Webhooks prüfen Signaturen
- [x] Uploads: noch keine (Excel-Import, Rechnungen kommen später; dann Größen-/Typlimit und eigener Bucket)
- [x] Keine Nutzerdaten in URLs oder Logs (Mail-Log ohne Empfänger)
- [x] `npm audit`: 0 Schwachstellen
- [ ] Datenschutzerklärung: Entwurf mit allen Auftragsverarbeitern unter `/legal/privacy`; Betreiberangaben fehlen, rechtliche Prüfung nötig
