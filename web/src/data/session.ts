// Fake auth: the session is a cookie holding a seeded user id. /replica-backend swaps this
// for Supabase Auth; getSession keeps its signature.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./store";
import type { Role, Session } from "./types";

export const SESSION_COOKIE = "kl_session";
export const OUTLET_COOKIE = "kl_outlet";

export async function getSession(): Promise<Session | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  const m = db().members.find((x) => x.userId === id);
  if (!m) return null;
  return { userId: m.userId, name: m.name, email: m.email, role: m.role, libraryId: db().library.id, outletIds: m.allOutlets || m.role === "owner" || m.role === "admin" ? "all" : m.outletIds };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export const canEditLibrary = (role: Role) => role === "owner" || role === "admin" || role === "chef";
export const canManageTeam = (role: Role) => role === "owner" || role === "admin";

export function canAccessOutlet(s: Session, outletId: string): boolean {
  return s.outletIds === "all" || s.outletIds.includes(outletId);
}

/** The outlet picked in the header, falling back to the first one the user may see. */
export async function currentOutletId(s: Session): Promise<string> {
  const picked = (await cookies()).get(OUTLET_COOKIE)?.value;
  const visible = db().outlets.filter((o) => !o.archivedAt && canAccessOutlet(s, o.id));
  return visible.find((o) => o.id === picked)?.id ?? visible[0]?.id ?? "";
}

export class Forbidden extends Error {
  constructor(message = "Dafür fehlt dir die Berechtigung.") {
    super(message);
  }
}
