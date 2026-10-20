// Who may do what. Pure functions, shared by both data backends and the UI.
import type { Member, Role, Session } from "./types";

export const canEditLibrary = (role: Role) => role === "owner" || role === "admin" || role === "chef";
export const canManageTeam = (role: Role) => role === "owner" || role === "admin";
export const canManageBilling = (role: Role) => role === "owner";

export function canAccessOutlet(s: Session, outletId: string): boolean {
  return s.outletIds === "all" || s.outletIds.includes(outletId);
}

export class Forbidden extends Error {
  constructor(message = "Dafür fehlt dir die Berechtigung.") {
    super(message);
  }
}

/** Rules for changing or removing a team member. Both data backends call this before writing. */
export function assertCanChangeMember(actor: Session, target: Member, next: { role?: Role; remove?: boolean }, ownerCount: number) {
  if (!canManageTeam(actor.role)) throw new Forbidden();
  if (target.role === "owner" && actor.role !== "owner") throw new Forbidden("Inhaber kann nur ein Inhaber ändern.");
  if (next.role === "owner") throw new Error("Die Inhaberschaft wird übertragen, nicht als Rolle vergeben.");
  const losesOwner = target.role === "owner" && (next.remove || next.role !== undefined);
  if (losesOwner && ownerCount <= 1) throw new Error("Der Betrieb braucht mindestens einen Inhaber. Übertrage die Inhaberschaft zuerst.");
}
