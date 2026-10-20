// POS sales API: a till (or a small bridge script) posts receipt lines with an outlet's API key.
// Repeating a request is safe: lines are deduplicated by their id per outlet.
//   curl -X POST https://DEINE-DOMAIN/api/pos/sales -H "Authorization: Bearer pantra_…" -H "Content-Type: application/json" \
//     -d '{"sales":[{"id":"B17-1","plu":"1001","name":"Linsensuppe","quantity":2,"netRevenueCents":1480,"soldAt":"2026-10-20T12:30:00+02:00"}]}'
import { NextResponse } from "next/server";
import { z } from "zod";
import { importSalesWithKey } from "@/data/repo";
import { hashKey } from "@/lib/api-key";
import { allow } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Body = z.object({
  sales: z.array(z.object({
    id: z.string().trim().min(1).max(200),
    plu: z.string().trim().min(1).max(64),
    name: z.string().trim().max(200).optional(),
    quantity: z.number().positive().max(100000),
    netRevenueCents: z.number().int().min(0).max(100_000_000).optional(),
    soldAt: z.iso.datetime({ offset: true }),
  })).min(1).max(1000),
});

const error = (status: number, message: string, extra: object = {}) => NextResponse.json({ error: message, ...extra }, { status });

export async function POST(request: Request) {
  const key = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!key) return error(401, "Authorization: Bearer <API-Schlüssel> fehlt.");
  if (!(await allow(`pos:${hashKey(key).slice(0, 24)}`, 60, 60))) return error(429, "Zu viele Anfragen. Höchstens 60 pro Minute.");
  if (Number(request.headers.get("content-length") ?? 0) > 2_000_000) return error(413, "Höchstens 2 MB pro Anfrage.");
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return error(400, "Kein gültiges JSON.");
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return error(400, "Ungültige Daten.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  const result = await importSalesWithKey(key, parsed.data.sales.map((x) => ({
    externalId: x.id, plu: x.plu, name: x.name || x.plu, quantity: x.quantity, revenueNetCents: x.netRevenueCents ?? 0, soldAt: new Date(x.soldAt).toISOString(),
  })));
  if (!result) return error(401, "Unbekannter oder widerrufener API-Schlüssel.");
  return NextResponse.json(result);
}
