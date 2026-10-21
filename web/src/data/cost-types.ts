// Fixed and variable costs for the contribution margin accounting, shared by both data backends.
import type { FunnelDay, StepSetting } from "@/domain/funnel";
export type FixedCostCategory = "rent" | "staff" | "energy" | "insurance" | "leasing" | "marketing" | "other";
export type FixedCost = { id: string; outletId: string | null; name: string; category: FixedCostCategory; monthlyCents: number };
export type FixedCostInput = Omit<FixedCost, "id"> & { id?: string };
export type CostSetup = { variableRevenuePct: number; perItemCents: number; fixed: FixedCost[] };

// Service funnel, see domain/funnel. Variable costs per step are hidden (0) for roles that may not see costs.
export type FunnelEntry = FunnelDay & { id: string; note: string | null };
export type FunnelSetup = { days: FunnelEntry[]; steps: StepSetting[]; projectedDays: number; costsVisible: boolean };
export type FunnelDayInput = Omit<FunnelDay, "outletId"> & { note: string | null };
