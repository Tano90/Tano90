# POS Webhook – Integrationsvertrag v1.1

**Ziel:** Eine beliebige POS-ETL-Strecke liefert neue Positionsdaten an den GLB Worker. Keine fertige Anbindung an eine konkrete Kasse.

## Voraussetzung

- Zielorganisation ID und `outlet_id` stammen aus bereits registrierten GLB Stammdaten.
- Cloudflare Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POS_INGEST_SECRET`, `POS_INGEST_ORG`.
- Das Secret ist mindestens 32 Zeichen lang, wird niemals im Browser oder Git gespeichert.
- HTTPS für Übertragung, signierter Body mit HMAC SHA256. Replays werden anhand der stabilen `external_line_id` nicht doppelt gebucht.
- Externe Schnittstelle liefert nur **neue** oder eindeutig referenzierte Positionen inklusive **bonübergreifend eindeutiger** `external_line_id`. Bei Stornos/Retouren nicht einfach negative Mengen schicken: dafür muss eine eigene Korrekturlogik ergänzt werden.

## JSON Schema – Beispiel

```json
{
  "organization_id": "<org-uuid>",
  "source_system": "pos_provider",
  "lines": [
    {
      "external_line_id": "bon-240109-1",
      "service_date": "2026-10-21",
      "check_id": "240109",
      "outlet_id": "<outlet-uuid>",
      "product_name": "Cheeseburger",
      "quantity": 2,
      "unit_price_gross": 19.5,
      "unit_cost_net": 4.6,
      "vat_percent": 7,
      "guests": 2,
      "stage": "none"
    }
  ]
}
```

## Signature

`x-glb-signature: sha256=HEX(HMAC_SHA256(UTF8(raw_body), POS_INGEST_SECRET))`

Der Worker antwortet mit `inserted`, `received`, `duplicates_skipped`. Er überschreibt vorhandene Daten nicht. Ein fehlendes/ungültiges HMAC wird mit `403` abgelehnt. Für produktiven Betrieb Rate-Limits, Secret-Rotation, IP-/Anbieterkontrolle, Quarantäne für unklare Daten, Kassen-Stornos und Importmonitoring ergänzen. Die Worker-Route ist eine sichere **Schnittstellenvorlage**, kein zertifizierter fertiger POS-Connector.
