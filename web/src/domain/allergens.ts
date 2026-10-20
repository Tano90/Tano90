export const ALLERGENS = [
  "gluten", "crustaceans", "eggs", "fish", "peanuts", "soybeans", "milk", "nuts",
  "celery", "mustard", "sesame", "sulphites", "lupin", "molluscs",
] as const;
export type Allergen = (typeof ALLERGENS)[number];

// Rank for roll-up, same order as the database enum: the higher one wins.
// unknown ranks above free: one unchecked ingredient makes the dish "unknown", never "free".
export const STATUS_RANK = ["free", "unknown", "may_contain", "contains"] as const;
export type AllergenStatus = (typeof STATUS_RANK)[number];
export type AllergenMap = Partial<Record<Allergen, AllergenStatus>>;

const rank = (s: AllergenStatus) => STATUS_RANK.indexOf(s);

export function stronger(a: AllergenStatus, b: AllergenStatus): AllergenStatus {
  return rank(a) >= rank(b) ? a : b;
}

/** Missing entries count as unknown. */
export function complete(map: AllergenMap): Record<Allergen, AllergenStatus> {
  return Object.fromEntries(ALLERGENS.map((a) => [a, map[a] ?? "unknown"])) as Record<Allergen, AllergenStatus>;
}

/** Combine the allergens of every part of a dish, plus the dish's own additions. */
export function rollUp(parts: AllergenMap[], extra: AllergenMap = {}): Record<Allergen, AllergenStatus> {
  const result = Object.fromEntries(ALLERGENS.map((a) => [a, "free"])) as Record<Allergen, AllergenStatus>;
  const all = parts.length ? parts : [{}];
  for (const part of all) {
    const full = complete(part);
    for (const a of ALLERGENS) result[a] = stronger(result[a], full[a]);
  }
  for (const [a, s] of Object.entries(extra) as [Allergen, AllergenStatus][]) result[a] = stronger(result[a], s);
  return result;
}
