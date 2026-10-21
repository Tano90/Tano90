// The DATEV "Buchungsstapel" of supplier invoices in a period, as the accountant imports it (Windows-1252, ; separated).
// Works in the read-only state too: the accountant needs past invoices whatever the subscription does.
import { NextResponse } from "next/server";
import { getDatevSetup, listInvoices } from "@/data/repo";
import { canManageTeam, getSession } from "@/data/session";
import { datevExtf } from "@/domain/datev";

export const dynamic = "force-dynamic";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (!canManageTeam(s.role)) return NextResponse.json({ error: "Den DATEV-Export dürfen Inhaber und Admins." }, { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || from > to) return NextResponse.json({ error: "Bitte einen gültigen Zeitraum wählen." }, { status: 400 });
  const setup = await getDatevSetup(s);
  if (!setup.settings) return NextResponse.json({ error: "Erst die DATEV-Einstellungen ausfüllen." }, { status: 400 });
  const invoices = await listInvoices(s, from, to);
  try {
    const { csv, bookings, estimated } = datevExtf({
      settings: setup.settings, from, to, createdAt: new Date(), defaultVatBp: setup.defaultVatBp,
      invoices: invoices.map((i) => ({ number: i.number, date: i.date, supplierName: i.supplierName, creditor: i.creditor, netCents: i.netCents, taxLines: i.taxLines })),
    });
    // DATEV reads ANSI; characters outside Windows-1252 become "?".
    const body = Buffer.from(csv.replace(/[^\u0000-ÿ€]/g, "?").replace(/€/g, "EUR"), "latin1");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=windows-1252",
        "Content-Disposition": `attachment; filename="EXTF_Buchungsstapel_${from}_${to}.csv"`,
        "Cache-Control": "no-store",
        "X-Datev-Bookings": String(bookings),
        "X-Datev-Estimated": String(estimated.length),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Export fehlgeschlagen." }, { status: 400 });
  }
}
