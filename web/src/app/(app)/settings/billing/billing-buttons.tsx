"use client";

import { useTransition } from "react";
import { openBillingPortal, startCheckout } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function BillingButtons({ hasCustomer, configured }: { hasCustomer: boolean; configured: boolean }) {
  const [pending, start] = useTransition();
  const go = (fn: typeof startCheckout) =>
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
        <Button onClick={() => go(startCheckout)} loading={pending} disabled={!configured}>Abo abschließen</Button>
      )}
    </div>
  );
}
