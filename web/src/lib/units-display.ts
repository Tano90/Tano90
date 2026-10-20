import type { BaseUnit } from "@/domain/units";
import { formatQty } from "./format";

const LABEL: Record<BaseUnit, string> = { g: "g", ml: "ml", piece: "Stk." };

/** 12500 g -> "12,5 kg", 750 ml -> "750 ml", 3 piece -> "3 Stk." */
export function formatBase(q: number, unit: BaseUnit): string {
  if (unit === "g" && Math.abs(q) >= 1000) return `${formatQty(q / 1000)} kg`;
  if (unit === "ml" && Math.abs(q) >= 1000) return `${formatQty(q / 1000)} l`;
  return `${formatQty(q)} ${LABEL[unit]}`;
}

/** Price per base unit shown the way kitchens think: per kg, per l or per piece. */
export function formatUnitPrice(centsPerBase: number | null, unit: BaseUnit): string {
  if (centsPerBase === null) return "–";
  const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  if (unit === "g") return `${eur.format((centsPerBase * 1000) / 100)}/kg`;
  if (unit === "ml") return `${eur.format((centsPerBase * 1000) / 100)}/l`;
  return `${eur.format(centsPerBase / 100)}/Stk.`;
}

export const BASE_UNIT_LABEL = LABEL;
