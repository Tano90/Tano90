import { notFound } from "next/navigation";
import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { getInvoice, getOrder } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { dayIn } from "@/lib/dates";
import { InvoiceForm } from "./invoice-form";

export const metadata = { title: "Rechnung abgleichen" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const found = await getOrder(s, id).catch(() => null);
  if (!found) notFound();
  const { order, supplier, lines, outlet } = found;
  const delivered = order.status === "delivered" || order.status === "partially_delivered";
  const invoice = delivered ? await getInvoice(s, id) : null;
  return (
    <>
      <PageHeader
        title={`Rechnung zu ${order.orderNumber}`}
        description={`${supplier.companyName} · ${outlet.name} · Bestellt, geliefert und berechnet nebeneinander.`}
        back={{ href: `/orders/${id}`, label: `Bestellung ${order.orderNumber}` }}
      />
      {!delivered ? (
        <Notice>Eine Rechnung lässt sich erst nach dem Wareneingang abgleichen.</Notice>
      ) : (
        <InvoiceForm
          orderId={id}
          canEdit={canEditLibrary(s.role)}
          today={dayIn(outlet.timezone)}
          lines={lines.map((l) => ({ ...l, receivedPacks: l.receivedPacks }))}
          invoice={invoice}
        />
      )}
    </>
  );
}
