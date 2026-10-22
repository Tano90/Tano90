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
