const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const pct = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 });
const qty = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 });

/** Integer cents to "12,34 €". */
export const formatCents = (cents: number) => eur.format(cents / 100 || 0); // || 0: never show "-0,00 €"
/** Basis points to "28,5 %". */
export const formatBp = (bp: number) => pct.format(bp / 10000);
export const formatQty = (n: number) => qty.format(n);
