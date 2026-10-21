// Contribution margin accounting (Deckungsbeitragsrechnung) per item and for the outlet. Pure, so the report, the
// target price calculator and the tests agree. All amounts are net cents.
//
// DB I  = net revenue − cost of goods (recipe cost × quantity)
// DB II = DB I − variable costs (card fees, platform commission: a share of revenue; packaging: per item)
// Operating result = Σ DB II − fixed costs of the period. Break-even revenue = fixed costs ÷ DB II ratio.

export type VariableCosts = { revenuePct: number; perItemCents: number };
export type ItemSales = { id: string; name: string; quantity: number; revenueNetCents: number; costPerPortionCents: number | null };
export type ItemContribution = ItemSales & {
  cogsCents: number; db1Cents: number; variableCents: number; db2Cents: number;
  /** DB II per portion, and as a share of net revenue (basis points). */
  db2PerPortionCents: number; db2RatioBp: number | null; foodCostBp: number | null; unknownCost: boolean;
};

export function itemContribution(s: ItemSales, v: VariableCosts): ItemContribution {
  const cogsCents = Math.round((s.costPerPortionCents ?? 0) * s.quantity);
  const db1Cents = s.revenueNetCents - cogsCents;
  const variableCents = Math.round((s.revenueNetCents * v.revenuePct) / 100 + v.perItemCents * s.quantity);
  const db2Cents = db1Cents - variableCents;
  return {
    ...s, cogsCents, db1Cents, variableCents, db2Cents,
    db2PerPortionCents: s.quantity ? Math.round(db2Cents / s.quantity) : 0,
    db2RatioBp: s.revenueNetCents ? Math.round((db2Cents / s.revenueNetCents) * 10000) : null,
    foodCostBp: s.revenueNetCents && s.costPerPortionCents !== null ? Math.round((cogsCents / s.revenueNetCents) * 10000) : null,
    unknownCost: s.costPerPortionCents === null,
  };
}

/** Fixed costs of a period from monthly amounts, pro rata by days (a 30-day period of a 31-day month counts 30/31). */
export function fixedCostsForPeriod(monthlyCents: number, from: string, to: string): number {
  let total = 0;
  const end = new Date(`${to}T12:00:00Z`);
  for (let d = new Date(`${from}T12:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    total += monthlyCents / daysInMonth;
  }
  return Math.round(total);
}

export function contributionSummary(items: ItemContribution[], fixedCents: number) {
  const sum = (k: "revenueNetCents" | "cogsCents" | "db1Cents" | "variableCents" | "db2Cents") => items.reduce((t, i) => t + i[k], 0);
  const revenue = sum("revenueNetCents");
  const db2 = sum("db2Cents");
  const ratio = revenue ? db2 / revenue : 0;
  return {
    revenueNetCents: revenue, cogsCents: sum("cogsCents"), db1Cents: sum("db1Cents"), variableCents: sum("variableCents"), db2Cents: db2,
    fixedCents, resultCents: db2 - fixedCents,
    /** Net revenue at which DB II covers the fixed costs; null when nothing contributes. */
    breakEvenRevenueCents: ratio > 0 ? Math.round(fixedCents / ratio) : null,
  };
}

/**
 * Gross menu price for a target: either a food cost share (e.g. 28 %) or a DB II per portion, including variable
 * costs and VAT, rounded up to the next 10 cents (menu prices end in ,X0).
 */
export function targetPrice(input: { costPerPortionCents: number; vatBp: number; variable: VariableCosts } & ({ foodCostBp: number } | { db2Cents: number })): number {
  const share = 1 - input.variable.revenuePct / 100;
  let net: number;
  if ("foodCostBp" in input) {
    if (input.foodCostBp <= 0) throw new Error("Der Ziel-Wareneinsatz muss über 0 % liegen.");
    // Food cost share of net revenue, then variable costs on top.
    net = input.costPerPortionCents / (input.foodCostBp / 10000) + input.variable.perItemCents / share;
  } else {
    if (share <= 0) throw new Error("Die variablen Kosten liegen bei 100 % des Umsatzes oder darüber.");
    net = (input.costPerPortionCents + input.variable.perItemCents + input.db2Cents) / share;
  }
  const gross = net * (1 + input.vatBp / 10000);
  return Math.ceil(gross / 10 - 1e-9) * 10;
}
