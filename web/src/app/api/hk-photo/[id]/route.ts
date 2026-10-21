// The photo of a housekeeping report. Access follows the report's outlet (row-level security).
import { NextResponse } from "next/server";
import { getTicketPhoto } from "@/data/repo";
import { getSession } from "@/data/session";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const photo = await getTicketPhoto(s, (await params).id);
  if (!photo) return NextResponse.json({ error: "Kein Foto." }, { status: 404 });
  return new NextResponse(Buffer.from(photo.data), { headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
