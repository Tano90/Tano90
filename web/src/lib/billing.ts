// Stripe billing: Checkout to subscribe, the Customer Portal to change or cancel (one click),
// and the webhook that keeps the plan in our database. The app reads the plan from the database only.
import "server-only";
import Stripe from "stripe";
import { asService } from "@/data/pg/client";

export const billingConfigured = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
export const yearlyConfigured = () => !!process.env.STRIPE_PRICE_ID_YEARLY;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set.");
  if (process.env.NODE_ENV !== "production" && process.env.STRIPE_SECRET_KEY.startsWith("sk_live")) {
    throw new Error("Live Stripe key outside production. Use test keys until /replica-deploy.");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

/** Checkout for the per-outlet plan. client_reference_id ties the session to the library. */
/** Checkout for the per-outlet plan (a graduated price: first outlet, then each further one). */
export async function createCheckout(input: { libraryId: string; email: string; outletCount: number; customerId: string | null; interval: "month" | "year" }) {
  const price = input.interval === "year" ? process.env.STRIPE_PRICE_ID_YEARLY : process.env.STRIPE_PRICE_ID;
  if (!price) throw new Error("Für diesen Zahlungsrhythmus ist kein Preis eingerichtet.");
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    client_reference_id: input.libraryId,
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.email,
    line_items: [{ price, quantity: Math.max(1, input.outletCount) }],
    subscription_data: { metadata: { library_id: input.libraryId } },
    allow_promotion_codes: true,
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "1" },
    success_url: `${appUrl()}/settings/billing?checkout=success`,
    cancel_url: `${appUrl()}/settings/billing?checkout=cancelled`,
  });
  return session.url!;
}

export async function createPortal(customerId: string) {
  const session = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${appUrl()}/settings/billing` });
  return session.url;
}

/** Keep the subscription quantity equal to the number of active outlets. */
export async function syncOutletQuantity(subscriptionId: string, outletCount: number) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (item && item.quantity !== outletCount) {
    await stripe().subscriptionItems.update(item.id, { quantity: Math.max(1, outletCount), proration_behavior: "create_prorations" });
  }
}

export function planFromStatus(status: Stripe.Subscription.Status): "trial" | "active" | "past_due" | "cancelled" {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "trial"; // incomplete, paused: no paid access yet
  }
}

/**
 * Applies one Stripe event. Idempotent: the event id is stored first, a repeat delivery does nothing.
 * Returns what happened, for the log and the tests.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<"duplicate" | "ignored" | "applied"> {
  return asService(async (tx) => {
    const fresh = await tx`insert into processed_webhooks (provider, event_id) values ('stripe', ${event.id}) on conflict do nothing returning event_id`;
    if (!fresh.length) return "duplicate";

    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (!s.client_reference_id || typeof s.subscription !== "string") return "ignored";
        await tx`
          update libraries set stripe_customer_id = ${typeof s.customer === "string" ? s.customer : null},
            stripe_subscription_id = ${s.subscription}, plan = 'active', subscription_status = 'active'
          where id = ${s.client_reference_id}`;
        return "applied";
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
        const periodEnd = sub.items.data[0]?.current_period_end;
        const updated = await tx`
          update libraries set plan = ${planFromStatus(status)}, subscription_status = ${status},
            current_period_end = ${periodEnd ? new Date(periodEnd * 1000).toISOString() : null},
            stripe_subscription_id = ${event.type === "customer.subscription.deleted" ? null : sub.id}
          where stripe_subscription_id = ${sub.id} or id = ${sub.metadata?.library_id ?? null}::uuid
          returning id`;
        return updated.length ? "applied" : "ignored";
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const customer = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        if (!customer) return "ignored";
        const updated = await tx`update libraries set plan = 'past_due', subscription_status = 'past_due' where stripe_customer_id = ${customer} returning id`;
        return updated.length ? "applied" : "ignored";
      }
      default:
        return "ignored";
    }
  });
}
