import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { OrderStatusBadge } from "@/components/ui/badge";
import { getOrder, listSuppliers } from "@/data/repo";
import { requireSession } from "@/data/session";
import { dayIn, formatDate, formatDay } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { OrderForm } from "../order-form";
import { ReceiveForm } from "../receive-form";


export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const found = await getOrder(s, id).catch(() => null);
  if (!found) notFound();
  const { order, supplier, lines, totalCents, outlet } = found;

  if (order.status === "draft") {
    const suppliers = await listSuppliers(s);
    return (
      <>
        <PageHeader title={`Entwurf ${order.orderNumber}`} description={`Für ${outlet.name}`} back={{ href: "/orders?tab=draft", label: "Bestellungen" }} />
        <OrderForm
          order={{ id: order.id, supplierId: order.supplierId, expectedDeliveryDate: order.expectedDeliveryDate, note: order.note, lines: order.lines }}
          suppliers={suppliers.map((x) => ({ value: x.id, label: x.companyName, orderEmail: x.orderEmail, minOrderCents: x.minOrderCents, leadTimeDays: x.leadTimeDays }))}
          initialSupplierId={null}
          today={dayIn(outlet.timezone)}
        />
      </>
    );
  }

  const receivable = order.status === "ordered" || order.status === "partially_delivered";
  return (
    <>
      <PageHeader
        title={`Bestellung ${order.orderNumber}`}
        back={{ href: `/orders?tab=${receivable ? "open" : "delivered"}`, label: "Bestellungen" }}
        description={<span className="inline-flex flex-wrap items-center gap-2"><OrderStatusBadge status={order.status} /> {supplier.companyName} · {outlet.name}</span>}
      />
      <dl className="mb-6 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        <div><dt className="text-xs text-text-muted">Bestellt am</dt><dd>{formatDate(order.orderedAt, outlet.timezone)}</dd></div>
        <div><dt className="text-xs text-text-muted">Erwartet</dt><dd>{formatDay(order.expectedDeliveryDate)}</dd></div>
        <div><dt className="text-xs text-text-muted">Summe netto</dt><dd className="num">{formatCents(totalCents)}</dd></div>
        <div><dt className="text-xs text-text-muted">Gesendet an</dt><dd className="break-all">{supplier.orderEmail ?? "–"}</dd></div>
        {order.note && <div className="col-span-full"><dt className="text-xs text-text-muted">Hinweis</dt><dd>{order.note}</dd></div>}
      </dl>
      {/* keyed by what was received, so the form resets to the new outstanding amounts after each delivery */}
      <ReceiveForm key={JSON.stringify(order.received)} orderId={order.id} lines={lines} receivable={receivable} />
      {(order.status === "delivered" || order.status === "partially_delivered") && (
        <p className="mt-6">
          <Link href={`/orders/${order.id}/invoice`} className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm border border-border-input bg-bg px-4 font-semibold hover:bg-row-hover">
            <ReceiptText aria-hidden className="size-4" /> Rechnung abgleichen
          </Link>
        </p>
      )}
    </>
  );
}
