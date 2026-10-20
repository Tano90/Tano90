import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { db, ensureStranger, reseed } from "./db";

export default async function globalSetup() {
  // Apply new migrations first, so the suite never runs against a stale schema.
  execSync("npm run -s db:migrate", { env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL }, stdio: "pipe" });
  reseed();
  await ensureStranger();
  await db().end();
  rmSync(fileURLToPath(new URL("../.outbox", import.meta.url)), { recursive: true, force: true });
}
