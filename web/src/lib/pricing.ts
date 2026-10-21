// The one source for prices shown on the landing page and the billing page. Stripe prices must match
// (see replica/launch/pricing.md). Net prices in cents, VAT added at checkout.
export const PRICING = {
  firstOutletMonthly: 4900,
  extraOutletMonthly: 3900,
  firstOutletYearly: 49000, // 2 months free
  extraOutletYearly: 39000,
  trialDays: 14,
} as const;
