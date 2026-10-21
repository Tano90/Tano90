// Weighted average cost, the same rule as the apply_stock_movement trigger in supabase/migrations/0001_schema.sql.
export type Level = { quantityBase: number; avgCostCents: number };

/** Returns the new level and the unit cost the movement is booked at. */
export function applyMovement(level: Level, deltaBase: number, unitCostCents: number): { level: Level; bookedCost: number } {
  if (deltaBase > 0 && level.quantityBase + deltaBase > 0) {
    const onHand = Math.max(level.quantityBase, 0);
    const avg = (onHand * level.avgCostCents + deltaBase * unitCostCents) / (onHand + deltaBase);
    return { level: { quantityBase: level.quantityBase + deltaBase, avgCostCents: avg }, bookedCost: unitCostCents };
  }
  return { level: { quantityBase: level.quantityBase + deltaBase, avgCostCents: level.avgCostCents }, bookedCost: level.avgCostCents };
}

/** Order suggestion: enough to reach par, minus stock and what is already on order, rounded up to whole packs. */
export function suggestPacks(parBase: number | null, onHandBase: number, onOrderBase: number, packBase: number): number {
  if (!parBase || packBase <= 0) return 0;
  const need = parBase - Math.max(onHandBase, 0) - onOrderBase;
  return need > 0 ? Math.ceil(need / packBase) : 0;
}

/** What was counted for one item when counting in packages: number of each package plus a loose rest. */
export type CountBreakdown = { packs: Record<string, number>; looseBase: number };

/** Total base quantity of a package count. Unknown packages are refused, so a stale sheet cannot book nonsense. */
export function countTotal(b: CountBreakdown, packages: { id: string; quantityBase: number }[]): number {
  let total = b.looseBase;
  for (const [id, n] of Object.entries(b.packs)) {
    const p = packages.find((x) => x.id === id);
    if (!p) throw new Error("Dieses Gebinde gibt es nicht mehr. Bitte die Seite neu laden.");
    total += n * p.quantityBase;
  }
  return total;
}

/** How a movement shows up in the stock report. */
export type ReportColumn = "delivered" | "transfer" | "sold" | "waste" | "countDiff" | "other";
const COLUMN: Record<string, ReportColumn> = { delivery: "delivered", transfer: "transfer", sale: "sold", waste: "waste", count: "countDiff" };

export type ReportMovement = { ingredientId: string; eventType: string; occurredAt: string; deltaBase: number; unitCostCents: number };
export type ReportRow = {
  ingredientId: string;
  openingBase: number;
  closingBase: number;
  /** Quantity and value per column within the period; outgoing quantities are negative. */
  columns: Record<ReportColumn, { base: number; cents: number }>;
  /** Book value at the end of the period. With a weighted average cost this is the sum of all booked values. */
  closingCents: number;
};

/** Movements in [fromIso, toIso) per ingredient, with the stock before and after. Movements after toIso are ignored. */
export function stockReport(moves: ReportMovement[], fromIso: string, toIso: string): ReportRow[] {
  const rows = new Map<string, ReportRow>();
  const empty = () => Object.fromEntries((["delivered", "transfer", "sold", "waste", "countDiff", "other"] as const).map((c) => [c, { base: 0, cents: 0 }])) as ReportRow["columns"];
  for (const m of moves) {
    if (m.occurredAt >= toIso) continue;
    const row = rows.get(m.ingredientId) ?? { ingredientId: m.ingredientId, openingBase: 0, closingBase: 0, columns: empty(), closingCents: 0 };
    rows.set(m.ingredientId, row);
    row.closingBase += m.deltaBase;
    row.closingCents += m.deltaBase * m.unitCostCents;
    if (m.occurredAt < fromIso) row.openingBase += m.deltaBase;
    else {
      const col = row.columns[COLUMN[m.eventType] ?? "other"];
      col.base += m.deltaBase;
      col.cents += m.deltaBase * m.unitCostCents;
    }
  }
  return [...rows.values()];
}

/** Weighed items are ordered by weight: what is missing up to the target, rounded up to 100 g / 100 ml (whole pieces). */
export function suggestWeight(parBase: number | null, onHandBase: number, onOrderBase: number, unit: "g" | "ml" | "piece"): number {
  if (parBase === null) return 0;
  const missing = parBase - onHandBase - onOrderBase;
  if (missing <= 0) return 0;
  const step = unit === "piece" ? 1 : 100;
  return Math.ceil(missing / step - 1e-9) * step;
}
