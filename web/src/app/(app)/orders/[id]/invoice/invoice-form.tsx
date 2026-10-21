"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveInvoice, saveInvoice } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cleanDecimal, readCents } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toast";
import { matchInvoice } from "@/domain/invoice";
import { formatDateTime } from "@/lib/dates";
import { formatCents, formatQty } from "@/lib/format";
import { type QuantityLine, orderQuantity } from "@/lib/order-quantity";

type Line = QuantityLine & { id: string; name: string; receivedPacks: number };
type Invoice = {
  invoiceNumber: string; invoiceDate: string; status: "matched" | "mismatch" | "approved"; note: string | null;
  approvedAt: string | null; approvedByName: string | null; lines: Record<string, { quantityPacks: number; unitPriceCents: number }>;
};

const num = (v: string) => Number(v.replace(",", ".")) || 0;
const STATUS = { matched: ["stimmt", "success"], mismatch: ["weicht ab", "warning"], approved: ["freigegeben", "success"] } as const;

export function InvoiceForm({ orderId, lines, invoice, canEdit, today }: { orderId: string; lines: Line[]; invoice: Invoice | null; canEdit: boolean; today: string }) {
  const router = useRouter();
  const [number, setNumber] = useState(invoice?.invoiceNumber ?? "");
  const [date, setDate] = useState(invoice?.invoiceDate ?? today);
  // Pre-filled with what arrived at the ordered price: only differences need typing.
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.id, formatQty(invoice?.lines[l.id]?.quantityPacks ?? l.receivedPacks)])));
  const [price, setPrice] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.id, ((invoice?.lines[l.id]?.unitPriceCents ?? l.unitPriceCents) / 100).toFixed(2).replace(".", ",")])));
  const [note, setNote] = useState(invoice?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const priceOf = (id: string) => readCents(price[id] ?? "");
  const m = matchInvoice(lines.map((l) => {
    const p = priceOf(l.id);
    return { lineId: l.id, orderedPacks: l.quantityPacks, receivedPacks: l.receivedPacks, orderPriceCents: l.unitPriceCents, invoicedPacks: num(qty[l.id] ?? ""), invoicePriceCents: p.ok && p.cents !== null ? p.cents : l.unitPriceCents };
  }));
  const byId = new Map(m.lines.map((x) => [x.lineId, x]));

  const save = () =>
    start(async () => {
      const bad = lines.find((l) => {
        const p = priceOf(l.id);
        return !p.ok || p.cents === null;
      });
      if (bad) return setError(`Bitte für „${bad.name}“ einen gültigen Preis angeben.`);
      const res = await saveInvoice(orderId, {
        invoiceNumber: number, invoiceDate: date,
        lines: m.lines.map((x) => ({ lineId: x.lineId, quantityPacks: x.invoicedPacks, unitPriceCents: x.invoicePriceCents })),
      });
      if (!res.ok) return setError(res.error);
      setError(null);
      toast.success(res.data === "matched" ? "Rechnung stimmt mit der Lieferung überein" : "Rechnung gespeichert – sie weicht ab");
      router.refresh();
    });
  const approve = () =>
    start(async () => {
      const res = await approveInvoice(orderId, note || null);
      if (!res.ok) return setError(res.error);
      setError(null);
      toast.success("Rechnung freigegeben");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      {error && <Notice tone="warning">{error}</Notice>}
      {!canEdit && <Notice tone="locked">Rechnungen abgleichen dürfen Inhaber, Admins und die Küchenleitung.</Notice>}
      <fieldset disabled={!canEdit || pending} className="flex min-w-0 flex-col gap-6">
        <legend className="sr-only">Rechnung</legend>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Rechnungsnummer" required className="w-56"><Input value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} /></Field>
          <Field label="Rechnungsdatum" required className="w-48"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          {invoice && <Badge tone={STATUS[invoice.status][1]}>{STATUS[invoice.status][0]}</Badge>}
        </div>
        <div className="overflow-x-auto rounded-md border border-border bg-bg">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Bestellt, geliefert und berechnet je Artikel</caption>
            <thead className="bg-surface text-xs text-text-muted">
              <tr className="h-(--size-table-row)">
                <th scope="col" className="px-3 text-left">Artikel</th>
                <th scope="col" className="px-3 text-right">Bestellt</th>
                <th scope="col" className="px-3 text-right">Geliefert</th>
                <th scope="col" className="px-3 text-right">Berechnet (Gebinde)</th>
                <th scope="col" className="px-3 text-right">Preis bestellt</th>
                <th scope="col" className="px-3 text-right">Preis Rechnung</th>
                <th scope="col" className="px-3 text-right">Abweichung</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const x = byId.get(l.id)!;
                return (
                  <tr key={l.id} className="h-(--size-table-row) border-t border-border">
                    <th scope="row" className="px-3 text-left font-normal">{l.name}</th>
                    <td className="num px-3 text-right">{orderQuantity(l)}</td>
                    <td className="num px-3 text-right">{orderQuantity({ ...l, quantityPacks: l.receivedPacks })}</td>
                    <td className="px-3 py-1 text-right">
                      <input aria-label={`Berechnet: ${l.name}`} inputMode="decimal" className={`num h-(--size-control-sm) w-20 rounded-sm border bg-bg px-2 text-right ${x.qtyOff ? "border-warning" : "border-border-input"}`}
                        value={qty[l.id] ?? ""} onChange={(e) => setQty({ ...qty, [l.id]: cleanDecimal(e.target.value) })} />
                    </td>
                    <td className="num px-3 text-right">{formatCents(l.unitPriceCents)}</td>
                    <td className="px-3 py-1 text-right">
                      <input aria-label={`Preis Rechnung: ${l.name}`} inputMode="decimal" className={`num h-(--size-control-sm) w-24 rounded-sm border bg-bg px-2 text-right ${x.priceOff ? "border-warning" : "border-border-input"}`}
                        value={price[l.id] ?? ""} onChange={(e) => setPrice({ ...price, [l.id]: cleanDecimal(e.target.value) })} />
                    </td>
                    <td className={`num px-3 text-right ${x.diffCents ? "font-semibold text-warning" : "text-text-muted"}`}>
                      {x.diffCents ? `${x.diffCents > 0 ? "+" : "−"}${formatCents(Math.abs(x.diffCents))}` : "–"}
                      {(x.qtyOff || x.priceOff) && <span className="sr-only"> ({[x.qtyOff && "Menge", x.priceOff && "Preis"].filter(Boolean).join(" und ")} weicht ab)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="h-(--size-table-row) border-t border-border bg-surface font-semibold">
                <td className="px-3" colSpan={4}>Erwartet (geliefert × Bestellpreis) {formatCents(m.expectedCents)} · Rechnung {formatCents(m.invoicedCents)}</td>
                <td className="px-3 text-right" colSpan={3}>
                  <span className={m.diffCents ? "text-warning" : "text-success"}>{m.diffCents ? `Differenz ${m.diffCents > 0 ? "+" : "−"}${formatCents(Math.abs(m.diffCents))}` : "keine Differenz"}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {canEdit && <div><Button onClick={save} loading={pending}>{invoice ? "Rechnung aktualisieren" : "Rechnung speichern"}</Button></div>}
      </fieldset>

      {invoice && (
        <section aria-labelledby="approve" className="flex max-w-(--size-form-max) flex-col gap-3">
          <h2 id="approve" className="text-lg">Freigabe</h2>
          {invoice.status === "approved" ? (
            <p className="inline-flex items-center gap-2 text-success"><CheckCircle2 aria-hidden className="size-4" /> Freigegeben am {formatDateTime(invoice.approvedAt)} von {invoice.approvedByName}{invoice.note ? ` – „${invoice.note}“` : ""}</p>
          ) : canEdit ? (
            <>
              <Field label={invoice.status === "mismatch" ? "Begründung (nötig, weil die Rechnung abweicht)" : "Notiz (optional)"}>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
              </Field>
              <div><Button variant="secondary" onClick={approve} loading={pending}>Rechnung freigeben</Button></div>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
