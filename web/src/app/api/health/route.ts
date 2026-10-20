// For uptime checks: 200 when the app and (if configured) the database answer, 503 otherwise.
// No data, no auth, nothing that identifies a user.
import { NextResponse } from "next/server";
import { sql } from "@/data/pg/client";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ ok: true, database: "not configured" });
  try {
    await sql()`select 1`;
    return NextResponse.json({ ok: true, database: "ok" });
  } catch {
    return NextResponse.json({ ok: false, database: "unreachable" }, { status: 503 });
  }
}
