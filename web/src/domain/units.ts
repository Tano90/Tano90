// Unit conversion. Every quantity is converted to the item's base unit (g, ml or piece).
// Grams are the hub: ml and pieces convert through grams when the item knows its
// density (mlPerGram) or its weight per piece (gramsPerPiece).

export const UNITS = ["g", "kg", "mg", "ml", "cl", "l", "piece"] as const;
export type Unit = (typeof UNITS)[number];
export type BaseUnit = "g" | "ml" | "piece";

const FACTOR: Record<Unit, { dim: BaseUnit; f: number }> = {
  g: { dim: "g", f: 1 },
  kg: { dim: "g", f: 1000 },
  mg: { dim: "g", f: 0.001 },
  ml: { dim: "ml", f: 1 },
  cl: { dim: "ml", f: 10 },
  l: { dim: "ml", f: 1000 },
  piece: { dim: "piece", f: 1 },
};

export type Convertible = {
  baseUnit: BaseUnit;
  gramsPerPiece: number | null;
  mlPerGram: number | null;
};

function toGrams(amount: number, dim: BaseUnit, item: Convertible): number | null {
  if (dim === "g") return amount;
  if (dim === "ml") return item.mlPerGram ? amount / item.mlPerGram : null;
  return item.gramsPerPiece ? amount * item.gramsPerPiece : null;
}

function fromGrams(grams: number, base: BaseUnit, item: Convertible): number | null {
  if (base === "g") return grams;
  if (base === "ml") return item.mlPerGram ? grams * item.mlPerGram : null;
  return item.gramsPerPiece ? grams / item.gramsPerPiece : null;
}

/** qty in unit -> amount in the item's base unit, or null when the item lacks the data to convert. */
export function toBase(qty: number, unit: Unit, item: Convertible): number | null {
  const { dim, f } = FACTOR[unit];
  const amount = qty * f;
  if (dim === item.baseUnit) return amount;
  const grams = toGrams(amount, dim, item);
  return grams === null ? null : fromGrams(grams, item.baseUnit, item);
}

export function unitDimension(unit: Unit): BaseUnit {
  return FACTOR[unit].dim;
}

/** Why a conversion failed, in words a chef understands. */
export function conversionHint(unit: Unit, item: Convertible & { name: string }): string {
  const dim = FACTOR[unit].dim;
  if (dim === "piece" || item.baseUnit === "piece") return `Für „${item.name}“ fehlt das Gewicht pro Stück.`;
  return `Für „${item.name}“ fehlt die Dichte (ml pro g), um zwischen Gewicht und Volumen umzurechnen.`;
}
