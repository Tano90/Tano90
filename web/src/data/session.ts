// Who is signed in. With Supabase configured: Supabase Auth. Without (local development only):
// a demo cookie naming a seeded user. getSession/requireSession keep their signatures either way.
import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { getMembership, listOutlets } from "./repo";
import { canAccessOutlet } from "./session-rules";
import type { Session } from "./types";

export { Forbidden, canAccessOutlet, canEditLibrary, canManageBilling, canManageTeam } from "./session-rules";

export const SESSION_COOKIE = "kl_session";
export const OUTLET_COOKIE = "kl_outlet";

export const authMode = (): "supabase" | "demo" => (supabaseConfigured() ? "supabase" : "demo");
export const demoAllowed = () => process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO === "1";

/** The signed-in user's id, or null. */
export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  // Always per request. Without this, a build without auth config prerenders "redirect to /login" for good.
  await connection();
  if (authMode() === "supabase") {
    const { data } = await (await supabaseServer()).auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  }
  if (!demoAllowed()) return null;
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return id ? { id, email: null } : null;
}

export async function getSession(): Promise<Session | null> {
  const user = await currentUser();
  return user ? getMembership(user.id) : null;
}

/** Signed in and member of a library, else redirect to login or onboarding. */
export async function requireSession(): Promise<Session> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const s = await getMembership(user.id);
  if (!s) redirect("/onboarding");
  return s;
}

/** The outlet picked in the header, falling back to the first one the user may see. */
export async function currentOutletId(s: Session): Promise<string> {
  const picked = (await cookies()).get(OUTLET_COOKIE)?.value;
  const visible = (await listOutlets(s)).filter((o) => canAccessOutlet(s, o.id));
  return visible.find((o) => o.id === picked)?.id ?? visible[0]?.id ?? "";
}
