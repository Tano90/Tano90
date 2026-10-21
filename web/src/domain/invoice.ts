// Three-way match: what was ordered, what arrived, what the supplier invoiced. Per line and in total.

export type MatchInput = { lineId: string; orderedPacks: number; receivedPacks: number; orderPriceCents: number; invoicedPacks: number; invoicePriceCents: number };
export type LineMatch = MatchInput & { qtyOff: boolean; priceOff: boolean; diffCents: number };

const EPS = 1e-6;

export function matchInvoice(lines: MatchInput[]) {
  const matched: LineMatch[] = lines.map((l) => {
    const qtyOff = Math.abs(l.invoicedPacks - l.receivedPacks) > EPS;
    const priceOff = l.invoicePriceCents !== l.orderPriceCents;
    // Difference against what should have been billed: received quantity at the ordered price.
    const diffCents = Math.round(l.invoicedPacks * l.invoicePriceCents - l.receivedPacks * l.orderPriceCents);
    return { ...l, qtyOff, priceOff, diffCents };
  });
  const invoicedCents = Math.round(matched.reduce((t, l) => t + l.invoicedPacks * l.invoicePriceCents, 0));
  const expectedCents = Math.round(matched.reduce((t, l) => t + l.receivedPacks * l.orderPriceCents, 0));
  const status: "matched" | "mismatch" = matched.some((l) => l.qtyOff || l.priceOff) ? "mismatch" : "matched";
  return { lines: matched, invoicedCents, expectedCents, diffCents: invoicedCents - expectedCents, status };
}
