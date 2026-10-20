import { NextResponse } from "next/server";
import { handleStripeEvent, stripe } from "@/lib/billing";

// Stripe retries failed deliveries; handleStripeEvent stores the event id so repeats are no-ops.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "not configured or unsigned" }, { status: 400 });
  const body = await request.text(); // the raw body is what Stripe signed
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (e) {
    console.error("[stripe webhook]", event.type, event.id, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "handler failed" }, { status: 500 }); // Stripe will retry
  }
}
