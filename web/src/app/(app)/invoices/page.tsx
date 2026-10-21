import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { listInvoices, listSuppliers } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { dayIn, formatDay } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { EInvoiceInbox } from "./invoices-client";

export const metadata = { title: "Rechnungen" };
export const dynamic = "force-dynamic";

const STATUS = { unmatched: { label: "nicht abgeglichen", tone: "neutral" }, matched: { label: "stimmt", tone: "success" }, mismatch: { label: "Abweichung", tone: "warning" }, approved: { label: "freigegeben", tone: "success" } } as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const s = await requireSession();
  const today = dayIn();
  const sp = await searchParams;
  const from = sp.from && DAY.test(sp.from) ? sp.from : `${today.slice(0, 7)}-01`;
  const to = sp.to && DAY.test(sp.to) && sp.to >= from ? sp.to : today < from ? from : today;
  const [invoices, suppliers] = await Promise.all([
    listInvoices(s, from, to),
    canEditLibrary(s.role) ? listSuppliers(s) : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader title="Rechnungen" description="Eingangsrechnungen der Lieferanten: E-Rechnungen einlesen und neue Preise in die Kalkulation übernehmen." />
      <div className="flex flex-col gap-6">
        {canEditLibrary(s.role) && <EInvoiceInbox suppliers={suppliers.map((x) => ({ id: x.id, name: x.companyName }))} />}

        <section aria-labelledby="list" className="rounded-lg border border-border bg-bg p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="list" className="text-lg">Rechnungen im Zeitraum</h2>
            <form className="flex flex-wrap items-end gap-2 text-sm">
              <label className="flex flex-col gap-1">Von<input type="date" name="from" defaultValue={from} className="h-(--size-control-md) rounded-sm border border-border-input bg-bg px-2" /></label>
              <label className="flex flex-col gap-1">Bis<input type="date" name="to" defaultValue={to} className="h-(--size-control-md) rounded-sm border border-border-input bg-bg px-2" /></label>
              <button className="h-(--size-control-md) rounded-md border border-border-input px-3 font-semibold hover:bg-row-hover">Anzeigen</button>
            </form>
          </div>
          {invoices.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 font-normal">Datum</th><th scope="col" className="font-normal">Lieferant</th><th scope="col" className="font-normal">Nummer</th><th scope="col" className="text-right font-normal">Netto</th><th scope="col" className="text-right font-normal">Brutto</th><th scope="col" className="pl-3 font-normal">Status</th><th scope="col" className="font-normal">Herkunft</th></tr></thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="py-2">{formatDay(i.date, "medium")}</td>
                      <td>{i.supplierName}</td>
                      <td>{i.orderId ? <Link className="text-accent hover:underline" href={`/orders/${i.orderId}/invoice`}>{i.number}</Link> : i.number}</td>
                      <td className="num text-right">{formatCents(i.netCents)}</td>
                      <td className="num text-right">{i.grossCents === null ? "–" : formatCents(i.grossCents)}</td>
                      <td className="pl-3"><Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge></td>
                      <td>{i.source === "einvoice" ? "E-Rechnung" : "von Hand"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-text-muted">Keine Rechnungen in diesem Zeitraum.</p>}
        </section>

      </div>
    </>
  );
}
