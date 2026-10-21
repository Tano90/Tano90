"use client";

import { useTransition } from "react";
import { openBillingPortal, startCheckout } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function BillingButtons({ hasCustomer, configured, yearly }: { hasCustomer: boolean; configured: boolean; yearly: boolean }) {
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
          <Button onClick={() => go(() => startCheckout("month"))} loading={pending} disabled={!configured}>Monatlich abschließen</Button>
          {yearly && <Button variant="secondary" onClick={() => go(() => startCheckout("year"))} loading={pending} disabled={!configured}>Jährlich abschließen (2 Monate geschenkt)</Button>}
        </>
      )}
    </div>
  );
}
