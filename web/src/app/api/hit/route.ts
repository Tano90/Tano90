// Cookie-free view counter for the landing page: one number per day, page and campaign source.
// Nothing about the visitor is stored (no IP address, no user agent, no identifier); bots that run no JavaScript never
// call this, obvious crawlers that do are skipped.
import { NextResponse } from "next/server";
import { countView } from "@/data/leads";

export const dynamic = "force-dynamic";
const PATHS = new Set(["/"]);

export async function POST(request: Request) {
  if (/bot|crawl|spider|preview|headless/i.test(request.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  let body: { path?: unknown; source?: unknown } = {};
  try { body = await request.json(); } catch { /* sendBeacon may send text */ }
  const path = typeof body.path === "string" && PATHS.has(body.path) ? body.path : null;
  if (!path) return new NextResponse(null, { status: 204 });
  const source = typeof body.source === "string" ? body.source.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 100) : "";
  await countView(path, source).catch((e) => console.error("[hit]", e));
  return new NextResponse(null, { status: 204 });
}
