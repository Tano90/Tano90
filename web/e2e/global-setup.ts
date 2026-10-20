import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { db, ensureStranger, reseed } from "./db";

export default async function globalSetup() {
  reseed();
  await ensureStranger();
  await db().end();
  rmSync(fileURLToPath(new URL("../.outbox", import.meta.url)), { recursive: true, force: true });
}
