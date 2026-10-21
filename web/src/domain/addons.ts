// Paid add-ons. In the trial everything is open; afterwards only what is booked.
import type { Access } from "./access";

export type AddonKey = "housekeeping" | "controlling";
export const ADDON_KEYS: AddonKey[] = ["housekeeping", "controlling"];

export const ADDONS: Record<AddonKey, { name: string; pitch: string; path: string }> = {
  housekeeping: { name: "Housekeeping", pitch: "Zimmerstatus, Belegung, Zuteilung an Reinigungskräfte und Checkliste vor „gereinigt“.", path: "/housekeeping" },
  controlling: { name: "F&B-Controlling", pitch: "Wareneinsatz je Kostenstelle und Monat, mit Schwund, Inventurdifferenz, Quote und CSV für die Buchhaltung.", path: "/analytics/controlling" },
};

export const isAddonKey = (v: unknown): v is AddonKey => typeof v === "string" && (ADDON_KEYS as string[]).includes(v);

export function addonOpen(access: Access, booked: readonly string[], key: AddonKey): boolean {
  return access.kind === "trial" || booked.includes(key);
}

export const addonLockedMessage = (key: AddonKey) =>
  `${ADDONS[key].name} ist ein Add-on. Die Inhaberin oder der Inhaber kann es unter Einstellungen → Abo dazubuchen; deine Daten bleiben erhalten.`;
