// The one source for prices shown on the landing page, the terms and the billing page (Oct 2026: new plan model).
// Amounts in cents as given by the operator. Still open and therefore NOT stated anywhere: what distinguishes Standard
// from Premium, whether a user is included, whether "Kunde" means company, business or location, what the 29,99 €
// cover, when and how the development fee is billed, and how VAT is shown. Until these are decided the plans are
// published as preliminary and no subscription can be bought online (PLANS_FINAL, see plansFinal()).
export const PLANS = [
  { id: "standard", name: "Standard", baseMonthly: 8900, perUserMonthly: 299 },
  { id: "premium", name: "Premium", baseMonthly: 10999, perUserMonthly: 299 },
] as const;

export const INDIVIDUAL = { serviceMonthly: 2999 } as const;

export const PRICING = {
  trialDays: 14,
} as const;

/** Online checkout only once the plan details are final and Stripe has matching prices (operator sets PLANS_FINAL=1). */
export function plansFinal(): boolean {
  return process.env.PLANS_FINAL === "1";
}

/** Shown wherever the plans appear while their details are open. */
export const PLANS_PRELIMINARY_NOTE =
  "Vorläufige Preise. Leistungsumfang je Tarif, enthaltene Nutzer, Abrechnungseinheit und Umsatzsteuer-Ausweis werden gerade festgelegt und vor einem Abschluss verbindlich genannt.";

export type PlanId = (typeof PLANS)[number]["id"];

/** Exact cents, German format (89,00 € / 109,99 € / 2,99 €). One formatter for landing page, calculator and billing. */
export function formatEur(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/** Valid user count for the calculator: whole number 1–500, otherwise null (the form shows an error). */
export function parseUsers(input: string): number | null {
  const n = Number(String(input).trim());
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : null;
}

/**
 * Monthly price of a plan for a number of users, in cents, as published.
 * ASSUMPTION until the operator confirms it: every user is billed (none included in the base price) and the base price is
 * charged once per customer. No VAT is added or shown separately here – how VAT is shown is still open.
 */
export function monthlyPrice(planId: PlanId, users: number) {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error(`Unknown plan ${planId}`);
  const userFee = plan.perUserMonthly * users;
  return { base: plan.baseMonthly, userFee, total: plan.baseMonthly + userFee };
}

/** Shown next to every calculated amount while the plan details are open. */
export const PRICE_ASSUMPTIONS =
  "Annahmen bis zur Bestätigung: Jeder Nutzer wird berechnet, im Grundpreis ist keiner enthalten. „Pro Kunde“ heißt hier: einmal je Vertragskunde. Ob und wie Umsatzsteuer ausgewiesen wird, ist noch nicht festgelegt.";
