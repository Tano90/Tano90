# Einrichtung: GLB AI Suite online bringen (ohne eigene Domain)

Stand: 2026-10-21. Du hast Konten bei Supabase, Vercel, Resend und Stripe, jeweils im kostenlosen Tarif. Diese
Anleitung bringt die Seite im **Vorstart-Modus** online: Interessenten fragen an, du siehst Aufrufe und Anfragen,
noch ohne Zahlungen. Danach steht, was sich ändert, wenn ihr Umsatz machen wollt.

Schlüssel und Passwörter trägst nur du ein, direkt bei Vercel. Bitte nichts davon in den Chat kopieren.

## 1. Supabase (Datenbank und Anmeldung)

1. Neues Projekt anlegen, **Region: Frankfurt (eu-central-1)**. Das Datenbank-Passwort sicher notieren.
2. **Connect** (oben) → **Session pooler** → Verbindungs-URL kopieren (Port 5432, Passwort einsetzen) → wird `DATABASE_URL`.
3. **Project Settings → API**: `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`, `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (geheim, nur in Vercel).
4. **Authentication → URL Configuration** (vor der ersten Registrierung, sonst zeigen die Bestätigungslinks auf `localhost`): Site URL = deine Vercel-Adresse (Schritt 3, z. B. `https://DEIN-PROJEKT.vercel.app`),
   Redirect URL hinzufügen: `https://DEIN-PROJEKT.vercel.app/auth/callback`.
5. **Authentication → Providers → Email**: „Confirm email“ an lassen.
6. **Project Settings → Data API**: die Data API ausschalten (oder `public` aus „Exposed schemas“ entfernen). GLB AI Suite
   spricht direkt mit der Datenbank und braucht die REST-Schnittstelle nicht; ausgeschaltet ist eine Angriffsfläche weniger.

Die Tabellen legt Vercel beim ersten Deploy selbst an (`vercel-build` führt die Migrationen aus).

## 2. Resend (E-Mails)

1. **API Keys → Create** (Berechtigung „Sending access“) → `RESEND_API_KEY`.
2. Ohne eigene Domain: `MAIL_FROM="GLB AI Suite <onboarding@resend.dev>"`. Damit stellt Resend nur an die E-Mail-Adresse zu,
   mit der du dich bei Resend angemeldet hast. Deshalb `LEADS_NOTIFY_EMAIL` = genau diese Adresse.
   Die Bestätigung an Interessenten kommt erst mit verifizierter Domain an; bis dahin antwortest du persönlich.

## 3. Vercel (Hosting)

1. **Add New → Project** → GitHub-Repository `tano90/Tano90` importieren.
2. **Root Directory: `web`**, Framework: Next.js. Build-Befehl nicht ändern (Vercel nutzt `vercel-build`).
3. **Settings → Git → Production Branch**: `claude/replica-skill-install-vzriug` (das ist der Stand mit allem), oder
   vorher in `main` zusammenführen. Sag Bescheid, wenn ich dafür einen Pull Request anlegen soll.
4. **Settings → Environment Variables**, nur für **Production** (sonst würden Vorschau-Deployments deine Datenbank
   migrieren):

| Variable | Wert |
| --- | --- |
| `DATABASE_URL` | aus Supabase, Schritt 1.2 |
| `NEXT_PUBLIC_SUPABASE_URL` | Schritt 1.3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Schritt 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | Schritt 1.3 |
| `APP_URL` | deine Vercel-Adresse, z. B. `https://DEIN-PROJEKT.vercel.app` |
| `NEXT_PUBLIC_LAUNCH_MODE` | `waitlist` |
| `OPERATOR_EMAILS` | die E-Mail, mit der du dich gleich in GLB AI Suite registrierst |
| `LEADS_NOTIFY_EMAIL` | deine Resend-Anmeldeadresse |
| `RESEND_API_KEY` | Schritt 2.1 |
| `MAIL_FROM` | `GLB AI Suite <onboarding@resend.dev>` |
| `CRON_SECRET` | eine lange Zufallsfolge, z. B. 64 Zeichen aus einem Passwortgenerator |

`ALLOW_DEMO` **nie** setzen. Stripe-Variablen bleiben in dieser Phase leer.

**Schneller per Skript** (auf deinem Rechner, Node.js nötig; Mac/Linux, unter Windows in Git Bash oder WSL):

```bash
git clone https://github.com/tano90/Tano90.git && cd Tano90/web
npx vercel@latest login     # einmal im Browser bestätigen
npx vercel@latest link      # dein GLB AI Suite-Projekt auswählen
bash scripts/setup-vercel-env.sh
```

Das Skript fragt jeden Wert einzeln ab (Geheimes verdeckt), trägt ihn für Production ein und erzeugt `CRON_SECRET`
selbst. Die Werte gehen nur von deiner Tastatur zu Vercel. Danach auf vercel.com „Redeploy“.

5. **Deploy**. Dann die Adresse öffnen: Die Startseite zeigt „Vorführung anfragen“.

## 4. Prüfen (10 Minuten)

1. Unter `/signup` selbst registrieren (mit der Adresse aus `OPERATOR_EMAILS`), Bestätigungsmail anklicken, Betrieb anlegen.
2. Einstellungen → **Anfragen** öffnen: Die Übersicht ist da.
3. Im privaten Fenster die Startseite mit `?utm_source=test` öffnen und eine Anfrage schicken: Du bekommst eine Mail,
   die Anfrage steht in der Übersicht mit Quelle „test“.
4. `/legal/imprint` öffnen: Es dürfen keine gelben „fehlt“-Stellen mehr da sein. Dafür fehlen noch **E-Mail, Telefon
   und Datenschutz-Kontakt** in `web/src/lib/legal.ts`. Bis dahin die Seite nicht bewerben.

## 5. Wenn ihr Geld nehmen wollt

| Dienst | Kostenlos reicht für den Vorstart? | Für zahlende Kunden | Grund |
| --- | --- | --- | --- |
| **Vercel** | ja, als Prototyp | **Pro (ca. 20 $/Monat)** | Hobby ist laut Vercel nur für nicht-kommerzielle Nutzung; sobald ihr Geld nehmt (oder nehmen wollt), Pro. Streng gelesen zählt schon Werbung für ein Produkt als kommerziell; im Zweifel den Vercel-Support fragen. |
| **Supabase** | ja | **Pro (ca. 25 $/Monat)** | Gratis-Projekte pausieren nach einer Woche ohne Aktivität, und tägliche Sicherungen gibt es erst im Pro-Tarif. Die Datenschutzerklärung und der AVV versprechen tägliche Sicherungen. |
| **Resend** | ja | kostenlos reicht vorerst (3.000 Mails/Monat) | braucht aber eine **verifizierte Domain**, sonst kommen Mails nur bei dir an |
| **Stripe** | Testmodus | Live-Modus freischalten (Firmendaten, Bankkonto) | nur Gebühren pro Zahlung, keine Grundgebühr |
| **Domain** | nicht nötig | ca. 10–20 €/Jahr | für E-Mails an Kunden und Vertrauen |

**Laufende Kosten mit zahlenden Kunden: rund 45 $ im Monat plus Domain.** Ein einziger Kunde mit einem Standort (49 €)
deckt das. Stripe behält pro Zahlung eine Gebühr ein; die aktuellen Sätze siehst du im Stripe-Dashboard.

Reihenfolge beim Umschalten:
1. Domain kaufen, in Vercel verbinden, bei Resend verifizieren (DNS-Einträge stehen in `deploy.md`).
2. Vercel und Supabase auf Pro.
3. Stripe Live: Produkt und die zwei gestaffelten Preise anlegen, dazu die Add-ons Housekeeping und F&B-Controlling (je 29 €/Monat und 290 €/Jahr, `launch/pricing.md`), Rechnungs-Fußzeile
   „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“, Firmenanschrift, Webhook. Variablen `STRIPE_*` in Vercel.
4. `NEXT_PUBLIC_LAUNCH_MODE=open`, `APP_URL` und Supabase-URLs auf die Domain umstellen, neu deployen.
5. Einen echten Kauf machen und erstatten.
