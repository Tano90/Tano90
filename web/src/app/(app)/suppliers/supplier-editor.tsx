"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveSupplier, saveSupplier } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { MoneyInput, parseCents } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toast";
import type { StockItem, Supplier } from "@/data/types";
import { formatCents } from "@/lib/format";

type Item = StockItem & { packageLabel: string };

export function SupplierEditor({ supplier, items, canEdit }: { supplier: Supplier | null; items: Item[]; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({
    companyName: supplier?.companyName ?? "",
    orderEmail: supplier?.orderEmail ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    customerNumber: supplier?.customerNumber ?? "",
    leadTimeDays: String(supplier?.leadTimeDays ?? 1),
    minOrder: supplier?.minOrderCents ? String(supplier.minOrderCents / 100).replace(".", ",") : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveSupplier({
        id: supplier?.id,
        companyName: f.companyName,
        orderEmail: f.orderEmail,
        email: f.email,
        phone: f.phone,
        customerNumber: f.customerNumber,
        leadTimeDays: Number.parseInt(f.leadTimeDays, 10) || 0,
        minOrderCents: parseCents(f.minOrder),
      });
      if (!res.ok) return setError(res.error);
      setError(null);
      toast.success("Lieferant gespeichert");
      if (!supplier) router.push(`/suppliers/${res.data}`);
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {!canEdit && <Notice tone="locked">Du kannst Lieferanten ansehen, aber nicht ändern.</Notice>}
      <form onSubmit={submit} noValidate className="flex max-w-(--size-form-max) flex-col gap-4">
        {error && <Notice tone="warning">{error}</Notice>}
        <fieldset disabled={!canEdit} className="grid gap-4 md:grid-cols-2">
          <legend className="sr-only">Kontakt</legend>
          <Field label="Firma" required className="md:col-span-2"><Input value={f.companyName} onChange={set("companyName")} maxLength={120} autoFocus={!supplier} /></Field>
          <Field label="E-Mail für Bestellungen" hint="Hierhin gehen gesendete Bestellungen."><Input type="email" value={f.orderEmail} onChange={set("orderEmail")} /></Field>
          <Field label="Allgemeine E-Mail"><Input type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Telefon"><Input type="tel" value={f.phone} onChange={set("phone")} /></Field>
          <Field label="Deine Kundennummer"><Input value={f.customerNumber} onChange={set("customerNumber")} /></Field>
          <Field label="Lieferzeit (Tage)"><Input inputMode="numeric" className="num text-right" value={f.leadTimeDays} onChange={set("leadTimeDays")} /></Field>
          <Field label="Mindestbestellwert (netto)"><MoneyInput value={f.minOrder} onValueChange={(v) => setF({ ...f, minOrder: v })} /></Field>
        </fieldset>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={pending}>{supplier ? "Speichern" : "Lieferant anlegen"}</Button>
            {supplier && <ArchiveSupplier id={supplier.id} name={supplier.companyName} prices={items.length} />}
          </div>
        )}
      </form>

      {supplier && (
        <section aria-labelledby="sortiment">
          <h2 id="sortiment" className="mb-1 text-lg">Sortiment ({items.length})</h2>
          <p className="mb-3 text-text-muted">Preise pflegst du bei der jeweiligen Zutat unter „Gebinde & Preise“.</p>
          {items.length === 0 ? (
            <p className="text-text-muted">Diesem Lieferanten ist noch kein Artikel zugeordnet.</p>
          ) : (
            <div className="relative overflow-x-auto rounded-md border border-border bg-bg">
              <table className="w-full text-sm">
                <caption className="sr-only">Sortiment</caption>
                <thead className="bg-surface text-xs text-text-muted">
                  <tr className="h-(--size-table-row)"><th scope="col" className="px-3 text-left">Artikel</th><th scope="col" className="px-3 text-left">Gebinde</th><th scope="col" className="px-3 text-right">Preis netto</th></tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="h-(--size-table-row) border-t border-border">
                      <td className="px-3"><Link href={`/ingredients/${i.ingredientId}?tab=packages`} className="hover:underline">{i.name}</Link> {i.isPreferred && <Badge tone="accent">bevorzugt</Badge>}</td>
                      <td className="px-3">{i.packageLabel}</td>
                      <td className="num px-3 text-right">{formatCents(i.priceCents)}{i.priceType === "per_unit" ? ` / ${i.priceUnit === "ml" ? "l" : i.priceUnit === "piece" ? "Stk." : "kg"}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ArchiveSupplier({ id, name, prices }: { id: string; name: string; prices: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="ghost">Archivieren</Button>}
      title={`„${name}“ archivieren?`}
      description={
        prices
          ? `Die ${prices} Preise dieses Lieferanten werden mitarchiviert. Zutaten ohne anderen Lieferanten haben danach keinen Preis mehr, und ihre Rezepte zeigen das an. Bestellungen und Lagerbewegungen bleiben erhalten.`
          : "Der Lieferant verschwindet aus Listen und Auswahlfeldern. Bestellungen und Lagerbewegungen bleiben erhalten."
      }
      confirmLabel="Archivieren"
      danger
      loading={pending}
      onConfirm={() =>
        start(async () => {
          const res = await archiveSupplier(id);
          setOpen(false);
          if (!res.ok) {
            toast.error("Archivieren nicht möglich", { description: res.error });
            return;
          }
          toast.success("Lieferant archiviert", res.data.pricesRemoved ? { description: `${res.data.pricesRemoved} Preise entfernt.` } : undefined);
          router.push("/suppliers");
        })
      }
    />
  );
}
