"use client";

import { useTransition } from "react";
import { openBillingPortal, startCheckout } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// configured: Stripe is set up (managing an existing subscription keeps working) · canBuy: a new subscription may be
// taken out, i.e. the plan details are final (PLANS_FINAL) – no checkout at prices that are no longer advertised.
export function BillingButtons({ hasCustomer, configured, canBuy, yearly }: { hasCustomer: boolean; configured: boolean; canBuy: boolean; yearly: boolean }) {
  const [pending, start] = useTransition();
  const go = (fn: () => ReturnType<typeof startCheckout>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.location.assign(res.data); // Stripe-hosted page
    });
  return (
    <div className="flex flex-wrap gap-2">
      {hasCustomer ? (
        <Button onClick={() => go(openBillingPortal)} loading={pending} disabled={!configured}>Abo verwalten oder kündigen</Button>
      ) : (
        <>
          <Button onClick={() => go(() => startCheckout("month"))} loading={pending} disabled={!configured || !canBuy}>Monatlich abschließen</Button>
          {yearly && <Button variant="secondary" onClick={() => go(() => startCheckout("year"))} loading={pending} disabled={!configured || !canBuy}>Jährlich abschließen</Button>}
        </>
      )}
    </div>
  );
}
