// Applies supabase/migrations/*.sql in order, each once, each in a transaction.
//   DATABASE_URL=postgres://... npx tsx scripts/migrate.ts
// On a plain Postgres (local dev, CI) it first creates a stub of Supabase's auth schema.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), "../supabase");
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  const [{ exists }] = await sql<{ exists: boolean }[]>`select exists (select 1 from information_schema.schemata where schema_name = 'auth')`;
  if (!exists) {
    console.log("no auth schema: applying local auth stub");
    await sql.unsafe(readFileSync(join(root, "local/auth_stub.sql"), "utf8"));
  }
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
  const files = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(root, "migrations", f), "utf8"));
      await tx`insert into schema_migrations (name) values (${f})`;
    });
    console.log(`applied ${f}`);
  }
  console.log("migrations up to date");
} finally {
  await sql.end();
}
