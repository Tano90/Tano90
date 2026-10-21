// How an order line's quantity reads: weighed items by weight ("2,5 kg"), everything else by package ("3 × Sack 10 kg").
import type { BaseUnit } from "@/domain/units";
import { formatQty } from "./format";
import { formatBase, formatUnitPrice } from "./units-display";

export type QuantityLine = { quantityPacks: number; packageLabel: string; weighted: boolean; packBase: number; baseUnit: BaseUnit; unitPriceCents: number };

export const orderQuantity = (l: QuantityLine) =>
  l.weighted ? formatBase(l.quantityPacks * l.packBase, l.baseUnit) : `${formatQty(l.quantityPacks)} × ${l.packageLabel}`;

/** Price per package, or per kg / l for weighed items. */
export const orderPrice = (l: QuantityLine) => (l.weighted ? formatUnitPrice(l.unitPriceCents / l.packBase, l.baseUnit) : null);
