// Weighted average cost, the same rule as the apply_stock_movement trigger in schema.sql.
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
