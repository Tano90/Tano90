// Who may do what. Pure functions, shared by both data backends and the UI.
import type { Role, Session } from "./types";

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
