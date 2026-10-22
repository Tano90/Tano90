"use client";

import { useId, useState } from "react";
import { formatEur, monthlyPrice, parseUsers, PLANS, PRICE_ASSUMPTIONS } from "@/lib/pricing";

/** Monthly price for a number of users, the same count for both plans; base price and user fee shown separately. */
export function PriceCalculator() {
  const id = useId();
  const [raw, setRaw] = useState("5");
  const users = parseUsers(raw);
  const error = users === null ? "Bitte eine ganze Zahl von 1 bis 500 eingeben." : null;
  return (
    <section aria-labelledby={`${id}-title`} className="mt-10 rounded-md border border-border bg-surface-raised p-6 lg:p-8">
      <h3 id={`${id}-title`} className="text-lg">Monatspreis berechnen</h3>
      <div className="mt-4 flex max-w-xs flex-col gap-1">
        <label htmlFor={`${id}-users`} className="text-sm font-semibold">Anzahl Nutzer</label>
        <input
          id={`${id}-users`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-${error ? "error" : "hint"}`}
          className="h-12 w-full rounded-sm border border-border-input bg-bg px-3 text-base aria-invalid:border-2 aria-invalid:border-danger"
        />
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-sm text-danger">{error}</p>
        ) : (
          <p id={`${id}-hint`} className="text-sm text-text-muted">Gilt für beide Tarife gleich.</p>
        )}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2" aria-live="polite">
        {PLANS.map((p) => {
          const r = users === null ? null : monthlyPrice(p.id, users);
          return (
            <dl key={p.id} data-plan={p.id} className="rounded-md border border-border p-4 text-sm">
              <dt className="text-base font-bold">{p.name}</dt>
              <dd className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                <span>Grundpreis</span><span className="num text-right">{formatEur(p.baseMonthly)}</span>
                <span>{users ?? "–"} Nutzer × {formatEur(p.perUserMonthly)}</span><span className="num text-right">{r ? formatEur(r.userFee) : "–"}</span>
                <span className="border-t border-border pt-1 font-bold">Summe pro Monat</span>
                <span data-total className="num border-t border-border pt-1 text-right font-bold">{r ? formatEur(r.total) : "–"}</span>
              </dd>
            </dl>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-text-muted" role="note">{PRICE_ASSUMPTIONS}</p>
    </section>
  );
}
