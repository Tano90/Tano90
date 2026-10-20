// Test-only database helpers: reseed, stable seed ids, direct checks.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import postgres from "postgres";

export const sid = (x: string) => {
  const h = createHash("md5").update(`kitchen-ledger:${x}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

export const STRANGER = { id: "00000000-0000-4000-8000-00000000f00d", email: "fremd@example.com" };

let client: postgres.Sql | undefined;
export const db = () => (client ??= postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} }));

export function reseed() {
  execSync("npm run -s db:seed", { env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL }, stdio: "pipe" });
}

/** A second, unrelated library with its own user and one ingredient. */
export async function ensureStranger() {
  const sql = db();
  await sql`insert into auth.users (id, email) values (${STRANGER.id}, ${STRANGER.email}) on conflict do nothing`;
  const [has] = await sql`select 1 from memberships where user_id = ${STRANGER.id}`;
  if (has) return;
  await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${STRANGER.id}, true)`;
    await tx`set local role authenticated`;
    const [{ create_library: lib }] = await tx`select create_library('Fremder Betrieb', 'Fremde Küche', 'Fremd')`;
    await tx`insert into ingredients (library_id, name) values (${lib}, 'Geheime Zutat')`;
  });
}
