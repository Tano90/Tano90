// Postgres connection. Requests run as the signed-in user: inside a transaction the role switches to
// `authenticated` and auth.uid() returns the user's id, so the RLS policies in the migrations apply
// exactly as they would through Supabase's API. Only jobs and webhooks use the owner connection.
import "server-only";
import postgres from "postgres";

const g = globalThis as unknown as { __pg?: postgres.Sql };

export function sql(): postgres.Sql {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  g.__pg ??= postgres(process.env.DATABASE_URL, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: !process.env.DATABASE_URL.includes(":6543"),
    onnotice: () => {},
    connection: { TimeZone: "UTC" },
    transform: postgres.camel, // snake_case columns <-> camelCase fields
    types: {
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      // timestamps as ISO strings, dates as YYYY-MM-DD, matching the row types
      timestamp: {
        to: 1184,
        from: [1114, 1184],
        serialize: (x: string | Date) => (x instanceof Date ? x.toISOString() : x),
        parse: (x: string) => new Date(x.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toISOString(),
      },
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      // times of day as HH:MM
      time: { to: 1083, from: [1083], serialize: (x: string) => x, parse: (x: string) => x.slice(0, 5) },
    },
  });
  return g.__pg;
}

export type Tx = postgres.TransactionSql;

export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return sql().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  }) as Promise<T>;
}

/** Owner connection, bypasses RLS. Only for webhooks, jobs, sign-up bookkeeping and seeding. */
export async function asService<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return sql().begin(fn) as Promise<T>;
}

/** Turn database errors into messages a person can act on. */
export function friendly(e: unknown): Error {
  const err = e as { code?: string; message?: string; constraint_name?: string };
  if (err.code === "42501") return new Error("Dafür fehlt dir die Berechtigung.");
  if (err.code === "23505") return new Error("Diesen Eintrag gibt es schon.");
  if (err.code === "23503") return new Error("Der Eintrag wird noch verwendet oder verweist auf etwas, das es nicht gibt.");
  if (err.code === "23514" && err.message?.includes("sub-recipe cycle")) return new Error("Ein Unterrezept enthält dieses Rezept selbst. Das ergäbe eine Endlosschleife.");
  if (err.code === "23514") return new Error("Ein Wert liegt außerhalb des erlaubten Bereichs.");
  return e instanceof Error ? e : new Error(String(e));
}
