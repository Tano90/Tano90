// Fixed and variable costs for the contribution margin accounting, shared by both data backends.
export type FixedCostCategory = "rent" | "staff" | "energy" | "insurance" | "leasing" | "marketing" | "other";
export type FixedCost = { id: string; outletId: string | null; name: string; category: FixedCostCategory; monthlyCents: number };
export type FixedCostInput = Omit<FixedCost, "id"> & { id?: string };
export type CostSetup = { variableRevenuePct: number; perItemCents: number; fixed: FixedCost[] };
