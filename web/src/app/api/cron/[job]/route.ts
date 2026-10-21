import { NextResponse } from "next/server";
import { cleanup, lowStockAlerts, trialReminders } from "@/lib/jobs";

const JOBS: Record<string, () => Promise<unknown>> = { "low-stock": () => lowStockAlerts(), trial: () => trialReminders(), cleanup };

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Anything else is rejected.
export async function GET(request: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const run = JOBS[job];
  if (!run) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ skipped: "no database" });
  const result = await run();
  return NextResponse.json({ job, result });
}
