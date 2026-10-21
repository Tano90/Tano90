"use client";

import { AlertTriangle, Download, FileCheck2, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { previewPriceList, saveEInvoice } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, controlClass } from "@/components/ui/field";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "@/components/ui/toast";
import { type EInvoice, einvoicePriceRows, parseEInvoice, priceChangePct } from "@/domain/einvoice";
import type { PlanRow } from "@/domain/price-list";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { invoiceXmlFromFile } from "@/lib/zugferd";

type Supplier = { id: string; name: string };
const words = (s: string) => s.toLocaleLowerCase("de").replace(/gmbh|kg|ag|ug|e\.k\.|co\.?|&/g, " ").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
/** The supplier whose name shares the most words with the seller on the invoice. */
function guessSupplier(seller: string, suppliers: Supplier[]): string {
  const want = new Set(words(seller));
  const scored = suppliers.map((x) => ({ id: x.id, n: words(x.name).filter((w) => want.has(w)).length })).sort((a, b) => b.n - a.n);
  return scored[0]?.n ? scored[0].id : "";
}
const KIND: Record<PlanRow["kind"], { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  new_ingredient: { label: "unbekannt", tone: "neutral" }, new_price: { label: "neuer Preis", tone: "success" },
  changed: { label: "Preis geändert", tone: "warning" }, same: { label: "unverändert", tone: "neutral" }, error: { label: "passt nicht", tone: "danger" },
};
const unitPrice = (r: PlanRow, cents: number, per: number | null | undefined) => (per ? `${formatCents(cents)} / ${r.baseUnit === "g" ? "kg" : r.baseUnit === "ml" ? "l" : "Stk."}` : formatCents(cents));

export function EInvoiceInbox({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "uploading" | "done">("idle");
  const [xml, setXml] = useState("");
  const [inv, setInv] = useState<EInvoice | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [apply, setApply] = useState(true);
  const [createNew, setCreateNew] = useState(false);

  const preview = (sid: string, invoice: EInvoice) => {
    setSupplierId(sid);
    setPlan(null);
    if (!sid) return;
    start(async () => {
      const res = await previewPriceList(sid, einvoicePriceRows(invoice).slice(0, 500));
      if (res.ok) setPlan(res.data); else toast.error(res.error);
    });
  };
  const onFile = async (file: File) => {
    setState("uploading");
    setInv(null);
    try {
      const text = await invoiceXmlFromFile(file);
      const parsed = parseEInvoice(text);
      setXml(text);
      setInv(parsed);
      setState("done");
      preview(guessSupplier(parsed.seller.name, suppliers), parsed);
    } catch (e) {
      setState("idle");
      toast.error(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden.");
    }
  };
  const save = () => start(async () => {
    const res = await saveEInvoice(xml, supplierId, apply, createNew);
    if (!res.ok) { toast.error(res.error); return; }
    const p = res.data.prices;
    toast.success(p ? `Rechnung gespeichert · ${p.changed} Preise geändert, ${p.prices} neue Preise${p.errors.length ? `, ${p.errors.length} Zeilen nicht übernommen` : ""}` : "Rechnung gespeichert");
    setInv(null); setPlan(null); setXml(""); setState("idle");
    router.refresh();
  });

  const jumps = plan?.filter((r) => r.kind === "changed" && r.oldPriceCents !== undefined && r.oldPerUnitBase === r.perUnitBase && (priceChangePct(r.oldPriceCents, r.priceCents) ?? 0) >= 5) ?? [];
  return (
    <section aria-labelledby="inbox" className="rounded-lg border border-border bg-bg p-4">
      <h2 id="inbox" className="flex items-center gap-2 text-lg"><FileCheck2 aria-hidden className="size-5 text-accent" /> E-Rechnung einlesen</h2>
      <p className="mt-1 max-w-3xl text-sm text-text-muted">XRechnung (XML) oder ZUGFeRD/Factur-X (PDF mit eingebetteter XML). Die Suite liest Lieferant, Beträge, Steuersätze und jede Position, vergleicht die Preise mit deinen und übernimmt sie auf Wunsch. Die Datei wird erst beim Speichern hochgeladen.</p>
      <div className="mt-3 max-w-xl"><FileUpload label="E-Rechnung hochladen" accept=".xml,.pdf" formats="XML oder PDF (ZUGFeRD)" state={state} doneText="Gelesen. Bitte unten prüfen." onFile={onFile} /></div>

      {inv && (
        <div className="mt-4 flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 rounded-md bg-surface p-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-text-muted">Rechnung</dt><dd className="font-semibold">{inv.number}</dd></div>
            <div><dt className="text-xs text-text-muted">Datum</dt><dd>{formatDay(inv.date, "medium")}</dd></div>
            <div><dt className="text-xs text-text-muted">Aussteller</dt><dd>{inv.seller.name || "–"}</dd></div>
            <div><dt className="text-xs text-text-muted">Netto / Brutto</dt><dd className="num">{formatCents(inv.netCents)} / {formatCents(inv.grossCents)}</dd></div>
            {inv.taxes.map((t) => <div key={t.rateBp}><dt className="text-xs text-text-muted">{t.rateBp / 100} % USt.</dt><dd className="num">{formatCents(t.taxCents)} auf {formatCents(t.netCents)}</dd></div>)}
          </dl>
          <Field label="Lieferant in der Suite" hint={supplierId ? undefined : "Kein Lieferant mit passendem Namen gefunden, bitte wählen."}>
            <select className={cn(controlClass, "max-w-md")} value={supplierId} onChange={(e) => preview(e.target.value, inv)}>
              <option value="">Bitte wählen</option>
              {suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>

          {jumps.length > 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-warning bg-warning-subtle px-3 py-2 text-sm">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              <span><strong>Preissprung:</strong> {jumps.map((r) => `${r.ingredient} +${priceChangePct(r.oldPriceCents!, r.priceCents)!.toLocaleString("de-DE")} %`).join(", ")}. Betroffene Rezepte und Menüs rechnen nach dem Übernehmen mit dem neuen Preis.</span>
            </div>
          )}

          {plan && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">Positionen der Rechnung</caption>
                <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 font-normal">Position</th><th scope="col" className="font-normal">Art.-Nr.</th><th scope="col" className="text-right font-normal">Bisher</th><th scope="col" className="text-right font-normal">Laut Rechnung</th><th scope="col" className="text-right font-normal">Änderung</th><th scope="col" className="pl-3 font-normal">Ergebnis</th></tr></thead>
                <tbody>
                  {plan.map((r) => {
                    const pct = r.oldPriceCents !== undefined && r.oldPerUnitBase === r.perUnitBase ? priceChangePct(r.oldPriceCents, r.priceCents) : null;
                    return (
                      <tr key={r.row} className="border-t border-border">
                        <th scope="row" className="py-2 text-left font-normal">{r.ingredient}{r.kind === "error" && <span className="block text-xs text-danger">{r.message}</span>}</th>
                        <td className="text-text-muted">{r.sku ?? "–"}</td>
                        <td className="num text-right">{r.oldPriceCents === undefined ? "–" : unitPrice(r, r.oldPriceCents, r.oldPerUnitBase)}</td>
                        <td className="num text-right">{unitPrice(r, r.priceCents, r.perUnitBase)}</td>
                        <td className={cn("num text-right", pct !== null && pct >= 5 ? "font-semibold text-danger" : pct !== null && pct < 0 ? "text-success" : "")}>{pct === null ? "–" : `${pct > 0 ? "+" : ""}${pct.toLocaleString("de-DE")} %`}</td>
                        <td className="pl-3"><Badge tone={KIND[r.kind].tone}>{KIND[r.kind].label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="size-6 accent-accent" checked={apply} onChange={(e) => setApply(e.target.checked)} /> Preise bekannter Zutaten übernehmen</label>
            <label className={cn("flex items-center gap-2", !apply && "opacity-50")}><input type="checkbox" className="size-6 accent-accent" disabled={!apply} checked={createNew} onChange={(e) => setCreateNew(e.target.checked)} /> Unbekannte Positionen als neue Zutaten anlegen</label>
          </div>
          <div className="flex gap-2">
            <Button disabled={!supplierId} loading={pending} onClick={save}>Rechnung speichern</Button>
            <Button variant="secondary" onClick={() => { setInv(null); setPlan(null); setState("idle"); }}>Verwerfen</Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function DatevExport({ from, to, configured, count, withoutSplit, defaultVatBp }: { from: string; to: string; configured: boolean; count: number; withoutSplit: number; defaultVatBp: number }) {
  return (
    <section aria-labelledby="datev" className="rounded-lg border border-border bg-bg p-4">
      <h2 id="datev" className="text-lg">DATEV-Export</h2>
      <p className="mt-1 max-w-3xl text-sm text-text-muted">
        Die Rechnungen von {formatDay(from, "medium")} bis {formatDay(to, "medium")} als DATEV-Buchungsstapel (Wareneingang an Kreditor, je Steuersatz eine Buchung) für den Import beim Steuerberater.
        Bitte die erste Datei gemeinsam mit dem Steuerberater prüfen.
      </p>
      {withoutSplit > 0 && <p className="mt-2 flex items-start gap-2 text-sm text-warning"><AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />{withoutSplit} von Hand erfasste {withoutSplit === 1 ? "Rechnung hat" : "Rechnungen haben"} keine Steueraufteilung und {withoutSplit === 1 ? "wird" : "werden"} mit {defaultVatBp / 100} % gebucht.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {configured ? (
          count ? <a href={`/api/datev?from=${from}&to=${to}`} className="inline-flex h-(--size-control-md) items-center gap-2 rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover"><Download aria-hidden className="size-4" /> DATEV-Datei herunterladen</a>
            : <span className="text-sm text-text-muted">Keine Rechnungen im Zeitraum.</span>
        ) : <p className="text-sm">Erst Berater- und Mandantennummer und die Konten eintragen.</p>}
        <Link href="/settings/datev" className="inline-flex h-(--size-control-md) items-center gap-2 rounded-md border border-border-input px-4 font-semibold hover:bg-row-hover"><Settings aria-hidden className="size-4" /> DATEV-Einstellungen</Link>
      </div>
    </section>
  );
}
