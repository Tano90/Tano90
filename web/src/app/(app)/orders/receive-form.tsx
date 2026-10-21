"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { receiveDelivery } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cleanDecimal } from "@/components/ui/money-input";
import { formatCents, formatQty } from "@/lib/format";
import { type QuantityLine, orderQuantity } from "@/lib/order-quantity";

type Line = QuantityLine & { id: string; name: string; receivedPacks: number };

export function ReceiveForm({ orderId, lines, receivable }: { orderId: string; lines: Line[]; receivable: boolean }) {
  const router = useRouter();
  const outstanding = (l: Line) => Math.max(l.quantityPacks - l.receivedPacks, 0);
  // Prefill with what is still outstanding: the usual case is "everything arrived".
  const [got, setGot] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.id, formatQty(outstanding(l))])));
  const [weight, setWeight] = useState<Record<string, string>>({});
  const [addToStock, setAddToStock] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = (v: string | undefined) => Math.max(0, Number((v ?? "").replace(",", ".")) || 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await receiveDelivery(orderId, {
        addToStock,
        lines: lines.map((l) => ({ lineId: l.id, packs: n(got[l.id]), weightBase: l.weighted && weight[l.id] ? n(weight[l.id]) * 1000 : null })),
      });
      if (!res.ok) return setError(res.error);
      toast.success(res.data.status === "delivered" ? "Lieferung vollständig erfasst" : "Teillieferung erfasst – die Bestellung bleibt offen");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="text-lg">{receivable ? "Wareneingang" : "Positionen"}</h2>
      {error && <Notice tone="warning">{error}</Notice>}
      <div className="relative overflow-x-auto rounded-md border border-border bg-bg">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Positionen der Bestellung</caption>
          <thead className="bg-surface text-xs text-text-muted">
            <tr className="h-(--size-table-row)">
              <th scope="col" className="px-3 text-left">Artikel</th>
              <th scope="col" className="px-3 text-right">Bestellt</th>
              <th scope="col" className="px-3 text-right">Erhalten</th>
              <th scope="col" className="px-3 text-right">Preis</th>
              {receivable && <th scope="col" className="px-3 text-right">Jetzt geliefert</th>}
              {receivable && lines.some((l) => l.weighted) && <th scope="col" className="px-3 text-right">Gewicht (kg)</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="h-(--size-table-row) border-t border-border">
                <th scope="row" className="px-3 text-left font-normal">{l.name}</th>
                <td className="num px-3 text-right">{orderQuantity(l)}</td>
                <td className="num px-3 text-right">{l.weighted ? orderQuantity({ ...l, quantityPacks: l.receivedPacks }) : formatQty(l.receivedPacks)}</td>
                <td className="num px-3 text-right">{formatCents(l.unitPriceCents)}</td>
                {receivable && (
                  <td className="px-3 py-1 text-right">
                    <input
                      aria-label={`Jetzt geliefert: ${l.name}`}
                      inputMode="decimal"
                      className="num h-(--size-control-sm) w-20 rounded-sm border border-border-input bg-bg px-2 text-right"
                      value={got[l.id] ?? ""}
                      onChange={(e) => setGot({ ...got, [l.id]: cleanDecimal(e.target.value) })}
                    />
                  </td>
                )}
                {receivable && lines.some((x) => x.weighted) && (
                  <td className="px-3 py-1 text-right">
                    {l.weighted && (
                      <input
                        aria-label={`Gewicht in kg: ${l.name}`}
                        inputMode="decimal"
                        className="num h-(--size-control-sm) w-24 rounded-sm border border-border-input bg-bg px-2 text-right"
                        value={weight[l.id] ?? ""}
                        onChange={(e) => setWeight({ ...weight, [l.id]: cleanDecimal(e.target.value) })}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {receivable && (
        <>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={addToStock} onChange={(e) => setAddToStock(e.target.checked)} />
            <span>
              Ware ins Lager buchen
              <span className="block text-xs font-normal text-text-muted">Abwählen, wenn die Ware schon in einer Inventur gezählt wurde – sonst steht sie doppelt im Bestand.</span>
            </span>
          </label>
          <div><Button type="submit" loading={pending}>Lieferung erfassen</Button></div>
        </>
      )}
    </form>
  );
}
