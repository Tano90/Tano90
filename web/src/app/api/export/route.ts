// Everything a library owns as one JSON file: for the owner's own backups and for leaving (terms § 8, DPA § 8).
// Works in the read-only state after the trial or a cancelled subscription, on purpose.
import { NextResponse } from "next/server";
import { exportLibrary } from "@/data/repo";
import { canManageTeam, getSession } from "@/data/session";
import { APP_NAME } from "@/lib/brand";
import { dayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (!canManageTeam(s.role)) return NextResponse.json({ error: "Den Export dürfen Inhaber und Admins." }, { status: 403 });
  const data = await exportLibrary(s);
  const body = JSON.stringify({ format: `${APP_NAME.toLowerCase()}-export`, version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${APP_NAME.toLowerCase()}-export-${dayIn()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
