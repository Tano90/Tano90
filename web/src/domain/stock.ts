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
