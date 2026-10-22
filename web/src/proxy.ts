// Refreshes the Supabase session cookie on every request (tokens expire after an hour).
// Authorisation is not decided here: every page and action checks the session itself.
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// The dashboard is the GLB AI Suite in public/suite (v0.8). The earlier Next.js app stays in the code but is only
// reachable with LEGACY_APP=1 (its end-to-end tests set it); everyone else lands in the suite.
const SUITE_ENTRIES = ["/app", "/login", "/signup"];

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (process.env.LEGACY_APP !== "1" && SUITE_ENTRIES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL("/suite", request.url));
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|api/webhooks|api/cron|api/health|api/pos|api/suite).*)"],
};
