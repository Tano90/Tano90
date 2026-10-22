# Changelog

## v1.1.0 RC1 – 21.10.2026

- Unveränderte v1.0 Kernmodule erhalten (Cockpit, Monats-Import, Menü, Bestand, Aufgaben, Einstellungen).
- Tages-POS-Einzelpositionen als neuer deduplizierter Import mit BonID, Datum, Outlet, Gästezahl, Steuersatz und Kosten-Snapshot.
- Tagesfunnel (6 unabhängig beobachtbare Bon-Conversion-Stufen), Zielwerte, Artikelmappings und DB-I-Uplift-Szenarien.
- Funnel Quest mit 6 Microtrainings, Feedback, XP und zugriffsgeschützten Lernergebnissen.
- Quellengestützter Marktpreisvergleich, OSM-Entdeckung, optionale OpenAI-Auswertung via geschütztem Worker.
- Signierter HMAC-POS-Webhook für spätere automatische Kassenanbindungen (ohne spezifischen POS-Anbieter).
- Read-only v0.8 Legacy-Workspace-Check und Link. **Keine automatische Migration aller v0.8-Funktionen.**
- Additives SQL `005_glb_v11_intelligence.sql`, Mandanten-RLS und signierte API.
- Keine Live-Deployment- oder echten API-Tests in diesem Release.
