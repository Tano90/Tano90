"use client";

import { useState, useTransition } from "react";
import { openBillingPortal, setAddon, startCheckout } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import type { AddonKey } from "@/domain/addons";

export type AddonRow = { key: AddonKey; name: string; pitch: string; booked: boolean; configured: boolean };

export function BillingButtons({ hasCustomer, subscribed, configured, yearly, inTrial, price, addons }: {
  hasCustomer: boolean; subscribed: boolean; configured: boolean; yearly: boolean; inTrial: boolean; price: string; addons: AddonRow[];
}) {
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<AddonKey[]>([]);
  const go = (fn: () => ReturnType<typeof startCheckout>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.location.assign(res.data); // Stripe-hosted page
    });
  const toggle = (key: AddonKey, on: boolean, name: string) =>
    start(async () => {
      const res = await setAddon(key, on);
      if (res.ok) toast.success(on ? `${name} ist gebucht.` : `${name} ist abbestellt.`);
      else toast.error(res.error);
    });
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {hasCustomer ? (
          <Button onClick={() => go(openBillingPortal)} loading={pending} disabled={!configured}>Abo verwalten oder kündigen</Button>
        ) : (
          <>
            <Button onClick={() => go(() => startCheckout("month", chosen))} loading={pending} disabled={!configured}>Monatlich abschließen</Button>
            {yearly && <Button variant="secondary" onClick={() => go(() => startCheckout("year", chosen))} loading={pending} disabled={!configured}>Jährlich abschließen (2 Monate geschenkt)</Button>}
          </>
        )}
      </div>

      <section id="addons" aria-labelledby="addons-h" className="mt-4 flex flex-col gap-3">
        <div>
          <h2 id="addons-h" className="text-lg">Add-ons</h2>
          <p className="text-sm text-text-muted">Je {price}, unabhängig von der Zahl der Outlets.{inTrial ? " In der Testphase sind beide enthalten." : ""}</p>
        </div>
        <ul className="flex flex-col gap-3">
          {addons.map((a) => (
            <li key={a.key} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-bg p-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">{a.name} {a.booked ? <Badge tone="success">Gebucht</Badge> : inTrial ? <Badge tone="info">In der Testphase enthalten</Badge> : <Badge>Nicht gebucht</Badge>}</p>
                <p className="mt-1 text-sm text-text-muted">{a.pitch}</p>
              </div>
              {subscribed ? (
                a.booked ? (
                  <ConfirmDialog
                    trigger={<Button variant="secondary" size="sm" disabled={pending}>Abbestellen</Button>}
                    title={`${a.name} abbestellen?`}
                    description="Die Seite ist danach gesperrt; deine Daten bleiben gespeichert und im Export. Den nicht genutzten Rest schreibt Stripe anteilig gut."
                    confirmLabel="Abbestellen"
                    danger
                    loading={pending}
                    onConfirm={() => toggle(a.key, false, a.name)}
                  />
                ) : (
                  <Button size="sm" onClick={() => toggle(a.key, true, a.name)} loading={pending} disabled={!a.configured}>Dazubuchen</Button>
                )
              ) : !hasCustomer && (
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" className="size-6 accent-accent" disabled={!a.configured} checked={chosen.includes(a.key)}
                    onChange={(e) => setChosen((c) => (e.target.checked ? [...c, a.key] : c.filter((k) => k !== a.key)))} />
                  Beim Abschluss mitbuchen
                </label>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
