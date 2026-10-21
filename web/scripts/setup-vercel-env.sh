#!/usr/bin/env bash
# Sets the production environment variables of the GLB project on Vercel, asking for each value.
# Runs on YOUR computer: the keys go from your keyboard straight to Vercel and are not stored anywhere else.
#
#   cd web
#   npx vercel@latest login          # once, in the browser
#   npx vercel@latest link           # pick the GLB project you imported on vercel.com
#   bash scripts/setup-vercel-env.sh
#
# Then on vercel.com: Deployments → the latest one → Redeploy. Re-running the script replaces existing values.
set -euo pipefail

VERCEL="${VERCEL:-npx --yes vercel@latest}" # overridable for a dry run
[ -f .vercel/project.json ] || { echo "Erst 'npx vercel@latest link' im Ordner web ausführen."; exit 1; }

put() { # name value
  $VERCEL env rm "$1" production --yes >/dev/null 2>&1 || true
  printf "%s" "$2" | $VERCEL env add "$1" production >/dev/null
  echo "  ✓ $1"
}

ask() { # name hint secret?
  local value
  echo
  echo "$1 – $2"
  if [ "${3:-}" = "secret" ]; then read -r -s -p "> " value; echo; else read -r -p "> " value; fi
  [ -n "$value" ] || { echo "Leer gelassen, abgebrochen."; exit 1; }
  put "$1" "$value"
}

echo "GLB AI Suite: Variablen für Production auf Vercel setzen (Vorstart-Modus, ohne Stripe)."

ask DATABASE_URL "Supabase → Connect → Session pooler (Port 5432), mit eingesetztem Datenbank-Passwort" secret
ask NEXT_PUBLIC_SUPABASE_URL "Supabase → Project Settings → API → Project URL"
ask NEXT_PUBLIC_SUPABASE_ANON_KEY "Supabase → Project Settings → API → anon public"
ask SUPABASE_SERVICE_ROLE_KEY "Supabase → Project Settings → API → service_role (geheim)" secret
ask APP_URL "Adresse der Seite bei Vercel, z. B. https://DEIN-PROJEKT.vercel.app (ohne / am Ende)"
ask OPERATOR_EMAILS "Deine E-Mail, mit der du dich in der GLB AI Suite registrierst (sieht die Anfragen)"
ask LEADS_NOTIFY_EMAIL "E-Mail für neue Anfragen; ohne eigene Domain: deine Resend-Anmeldeadresse"
ask RESEND_API_KEY "Resend → API Keys → Create (Sending access)" secret

put NEXT_PUBLIC_LAUNCH_MODE "waitlist"
put MAIL_FROM "GLB AI Suite <onboarding@resend.dev>"
put CRON_SECRET "$(openssl rand -hex 32)"

echo
echo "Fertig. Jetzt auf vercel.com neu deployen (Deployments → Redeploy), dann setup.md Schritt 4 prüfen."
echo "ALLOW_DEMO bitte nie setzen; Stripe-Variablen erst, wenn ihr Geld nehmt."
