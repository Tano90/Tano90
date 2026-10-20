"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteOrderDraft, orderableItems, saveOrderDraft, sendOrder } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { BaseUnit } from "@/domain/units";
import { formatCents } from "@/lib/format";
import { formatBase } from "@/lib/units-display";

type SupplierOpt = { value: string; label: string; orderEmail: string | null; minOrderCents: number | null; leadTimeDays: number };
type Item = { stockItemId: string; name: string; baseUnit: BaseUnit; packageLabel: string; packPriceCents: number; onHandBase: number; parLevelBase: number | null; suggestedPacks: number };
type Existing = { id: string; supplierId: string; expectedDeliveryDate: string | null; note: string | null; lines: { stockItemId: string; quantityPacks: number }[] };

const isoDay = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export function OrderForm({ order, suppliers, initialSupplierId }: { order: Existing | null; suppliers: SupplierOpt[]; initialSupplierId: string | null }) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(order?.supplierId ?? initialSupplierId ?? suppliers[0]?.value ?? "");
  const supplier = suppliers.find((x) => x.value === supplierId);
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries((order?.lines ?? []).map((l) => [l.stockItemId, String(l.quantityPacks)])));
  const [date, setDate] = useState(order?.expectedDeliveryDate ?? isoDay(supplier?.leadTimeDays ?? 1));
  const [note, setNote] = useState(order?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setLoadError(null);
    if (!supplierId) return;
    orderableItems(supplierId).then((res) => {
      if (!alive) return;
      if (res.ok) setItems(res.data);
      else setLoadError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [supplierId]);

  const packs = (id: string) => Math.max(0, Number((qty[id] ?? "").replace(",", ".")) || 0);
  const total = (items ?? []).reduce((sum, i) => sum + packs(i.stockItemId) * i.packPriceCents, 0);
  const lines = (items ?? []).filter((i) => packs(i.stockItemId) > 0).map((i) => ({ stockItemId: i.stockItemId, quantityPacks: packs(i.stockItemId) }));
  const belowMin = supplier?.minOrderCents != null && total > 0 && total < supplier.minOrderCents;

  const applySuggestion = () => {
    if (!items) return;
    const next = { ...qty };
    let n = 0;
    for (const i of items) if (i.suggestedPacks > 0) { next[i.stockItemId] = String(i.suggestedPacks); n++; }
    setQty(next);
    toast(n ? `${n} Artikel nach Mindestbestand vorgeschlagen` : "Alles über Mindestbestand – kein Vorschlag nötig");
  };

  const save = (andSend: boolean) =>
    start(async () => {
      setError(null);
      const res = await saveOrderDraft({ id: order?.id, supplierId, expectedDeliveryDate: date || null, note, lines });
      if (!res.ok) return setError(res.error);
      if (andSend) {
        const sent = await sendOrder(res.data);
        if (!sent.ok) return setError(sent.error);
        toast.success("Bestellung gesendet", { description: sent.data.to ? `An ${sent.data.to}` : "Der Lieferant hat keine Bestell-Adresse – bitte telefonisch bestellen." });
      } else toast.success("Entwurf gespeichert");
      router.push(`/orders/${res.data}`);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      {error && <Notice tone="warning">{error}</Notice>}
      <div className="grid max-w-(--size-form-max) gap-4 md:grid-cols-2">
        <Field label="Lieferant" required>
          <Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setQty({}); }} disabled={!!order}>
            {suppliers.length === 0 && <option value="">Keine Lieferanten</option>}
            {suppliers.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </Select>
        </Field>
        <Field label="Gewünschter Liefertermin">
          <Input type="date" value={date} min={isoDay(0)} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hinweis an den Lieferanten" className="md:col-span-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      </div>

      <section aria-labelledby="art" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="art" className="text-lg">Artikel</h2>
          <Button variant="secondary" size="sm" onClick={applySuggestion} disabled={!items?.length}>
            <Sparkles aria-hidden className="size-4" /> Nach Mindestbestand auffüllen
          </Button>
        </div>
        {loadError && <Notice tone="warning">{loadError}</Notice>}
        {!items && !loadError && <div aria-busy="true" className="h-32 animate-pulse rounded-md bg-surface-sunken" />}
        {items && items.length === 0 && <Notice>Dieser Lieferant hat noch keine Artikel, die dein Outlet bestellen darf. Preise hinterlegst du bei den Zutaten.</Notice>}
        {items && items.length > 0 && (
          <div className="relative overflow-x-auto rounded-md border border-border bg-bg">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Artikel dieses Lieferanten</caption>
              <thead className="bg-surface text-xs text-text-muted">
                <tr className="h-(--size-table-row)">
                  <th scope="col" className="px-3 text-left">Artikel</th>
                  <th scope="col" className="px-3 text-right">Bestand</th>
                  <th scope="col" className="px-3 text-right">Ziel</th>
                  <th scope="col" className="px-3 text-right">Preis/Gebinde</th>
                  <th scope="col" className="px-3 text-right">Anzahl</th>
                  <th scope="col" className="px-3 text-right">Summe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.stockItemId} className="h-(--size-table-row) border-t border-border">
                    <th scope="row" className="px-3 text-left font-normal">
                      {i.name}
                      {i.suggestedPacks > 0 && <span className="ml-2 text-xs text-warning">Vorschlag: {i.suggestedPacks}</span>}
                    </th>
                    <td className="num px-3 text-right">{formatBase(i.onHandBase, i.baseUnit)}</td>
                    <td className="num px-3 text-right">{i.parLevelBase ? formatBase(i.parLevelBase, i.baseUnit) : "–"}</td>
                    <td className="num px-3 text-right">{formatCents(i.packPriceCents)}</td>
                    <td className="px-3 py-1 text-right">
                      <input
                        aria-label={`Anzahl ${i.packageLabel} ${i.name}`}
                        inputMode="decimal"
                        className="num h-(--size-control-sm) w-20 rounded-sm border border-border-input bg-bg px-2 text-right"
                        value={qty[i.stockItemId] ?? ""}
                        onChange={(e) => setQty({ ...qty, [i.stockItemId]: e.target.value.replace(/[^\d,]/g, "") })}
                      />
                    </td>
                    <td className="num px-3 text-right">{packs(i.stockItemId) ? formatCents(Math.round(packs(i.stockItemId) * i.packPriceCents)) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="h-(--size-table-row) border-t border-border bg-surface font-semibold">
                  <td className="px-3" colSpan={5}>Summe netto</td>
                  <td className="num px-3 text-right">{formatCents(Math.round(total))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {belowMin && <Notice tone="warning">Mindestbestellwert von {formatCents(supplier!.minOrderCents!)} noch nicht erreicht.</Notice>}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => save(false)} loading={pending} disabled={!lines.length}>Als Entwurf speichern</Button>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          trigger={<Button disabled={!lines.length || pending}>Bestellung senden</Button>}
          title="Bestellung senden?"
          description={supplier?.orderEmail ? `${lines.length} Artikel für ${formatCents(Math.round(total))} gehen per E-Mail an ${supplier.orderEmail}.` : "Für diesen Lieferanten ist keine Bestell-Adresse hinterlegt. Die Bestellung wird als bestellt markiert; gib sie bitte telefonisch durch."}
          confirmLabel="Senden"
          loading={pending}
          onConfirm={() => { setConfirm(false); save(true); }}
        />
        {order && <DeleteDraft id={order.id} />}
      </div>
    </div>
  );
}

function DeleteDraft({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost">Entwurf löschen</Button>}
      title="Entwurf löschen?"
      description="Der Entwurf wird endgültig entfernt."
      confirmLabel="Löschen"
      danger
      loading={pending}
      onConfirm={() =>
        start(async () => {
          const res = await deleteOrderDraft(id);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          router.push("/orders?tab=draft");
        })
      }
    />
  );
}
