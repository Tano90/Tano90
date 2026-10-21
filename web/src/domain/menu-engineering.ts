// Menu engineering: how often a dish sells against what each portion earns, split into four groups.
// Popularity counts as high from 70 % of an even share (1/n); the margin line is the sales-weighted average.

export type DishInput = { id: string; name: string; sold: number; netPerPortionCents: number; costPerPortionCents: number };
export type Group = "star" | "workhorse" | "puzzle" | "dog";
export type Dish = DishInput & { sharePct: number; marginCents: number; group: Group };

export function classifyDishes(input: DishInput[]): { dishes: Dish[]; shareLinePct: number; marginLineCents: number } {
  const sold = input.filter((d) => d.sold > 0);
  const total = sold.reduce((t, d) => t + d.sold, 0);
  if (!sold.length || total <= 0) return { dishes: [], shareLinePct: 0, marginLineCents: 0 };
  const shareLinePct = (100 / sold.length) * 0.7;
  const marginLineCents = sold.reduce((t, d) => t + (d.netPerPortionCents - d.costPerPortionCents) * d.sold, 0) / total;
  const dishes = sold.map((d) => {
    const sharePct = (d.sold / total) * 100;
    const marginCents = d.netPerPortionCents - d.costPerPortionCents;
    const popular = sharePct >= shareLinePct;
    const earns = marginCents >= marginLineCents;
    const group: Group = popular ? (earns ? "star" : "workhorse") : earns ? "puzzle" : "dog";
    return { ...d, sharePct, marginCents, group };
  });
  return { dishes: dishes.sort((a, b) => b.sold - a.sold), shareLinePct, marginLineCents };
}
