// Sliding-window limits for anything that sends email. Postgres-backed when a database is configured
// (works across serverless instances), in-memory otherwise.
import "server-only";
import { asService } from "@/data/pg/client";

const memory = new Map<string, number[]>();

export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (process.env.DATABASE_URL) {
    const [{ hitRateLimit }] = await asService((tx) => tx<{ hitRateLimit: boolean }[]>`select hit_rate_limit(${key}, ${max}, ${windowSeconds})`);
    return hitRateLimit;
  }
  const now = Date.now();
  const hits = (memory.get(key) ?? []).filter((t) => t > now - windowSeconds * 1000);
  if (hits.length >= max) return false;
  memory.set(key, [...hits, now]);
  return true;
}

export class RateLimited extends Error {
  constructor() {
    super("Zu viele Versuche. Bitte warte ein paar Minuten.");
  }
}
