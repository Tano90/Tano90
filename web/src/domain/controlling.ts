// F&B controlling per outlet (cost centre) for a period, the way accounting reads it:
//   food cost (Wareneinsatz) = opening stock value + purchases ± transfers − closing stock value
// Values are book values at the weighted average cost recorded on each movement. Waste and count differences are
// part of the food cost and shown separately so the kitchen sees where it went.
import type { ReportMovement } from "./stock";

export type ControllingRow = {
  openingCents: number; purchasesCents: number; transfersCents: number; closingCents: number;
  foodCostCents: number; soldCents: number; wasteCents: number; countDiffCents: number; productionCents: number;
  revenueCents: number; foodCostShare: number | null;
};

export function controlling(moves: ReportMovement[], fromIso: string, toIso: string, revenueCents: number): ControllingRow {
  let opening = 0, closing = 0, purchases = 0, transfers = 0, sold = 0, waste = 0, countDiff = 0, production = 0;
  for (const m of moves) {
    const v = m.deltaBase * m.unitCostCents;
    if (m.occurredAt < fromIso) opening += v;
    if (m.occurredAt >= toIso) continue;
    closing += v;
    if (m.occurredAt < fromIso) continue;
    if (m.eventType === "delivery") purchases += v;
    else if (m.eventType === "transfer") transfers += v;
    else if (m.eventType === "sale") sold -= v;
    else if (m.eventType === "waste") waste -= v;
    else if (m.eventType === "count") countDiff -= v;
    else if (m.eventType === "production") production -= v;
  }
  const r = (n: number) => Math.round(n);
  const foodCost = opening + purchases + transfers - closing;
  return {
    openingCents: r(opening), purchasesCents: r(purchases), transfersCents: r(transfers), closingCents: r(closing),
    foodCostCents: r(foodCost), soldCents: r(sold), wasteCents: r(waste), countDiffCents: r(countDiff), productionCents: r(production),
    revenueCents: r(revenueCents), foodCostShare: revenueCents > 0 ? foodCost / revenueCents : null,
  };
}
