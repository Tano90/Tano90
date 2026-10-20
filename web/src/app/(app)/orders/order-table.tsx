"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderStatusBadge } from "@/components/ui/badge";
import { type Column, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCents } from "@/lib/format";

type Row = { id: string; orderNumber: string; supplier: string; status: string; orderedAt: string | null; expectedDeliveryDate: string | null; createdAt: string; totalCents: number };

const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(iso)) : "–");

const COLUMNS: Column<Row>[] = [
  { key: "no", header: "Nummer", sortValue: (r) => r.orderNumber, cell: (r) => <Link href={`/orders/${r.id}`} className="num font-semibold hover:underline">{r.orderNumber}</Link> },
  { key: "sup", header: "Lieferant", sortValue: (r) => r.supplier, cell: (r) => r.supplier },
  { key: "status", header: "Status", cell: (r) => <OrderStatusBadge status={r.status} /> },
  { key: "date", header: "Bestellt", sortValue: (r) => r.orderedAt ?? r.createdAt, cell: (r) => date(r.orderedAt) },
  { key: "exp", header: "Erwartet", sortValue: (r) => r.expectedDeliveryDate ?? "", cell: (r) => date(r.expectedDeliveryDate) },
  { key: "total", header: "Summe netto", align: "right", sortValue: (r) => r.totalCents, cell: (r) => formatCents(r.totalCents) },
];

const EMPTY = {
  open: "Keine offenen Bestellungen. Alles, was bestellt wurde, ist angekommen.",
  draft: "Keine Entwürfe.",
  delivered: "Noch keine gelieferten Bestellungen.",
};

export function OrderTable({ rows, tab }: { rows: Row[]; tab: keyof typeof EMPTY }) {
  const router = useRouter();
  return (
    <DataTable
      caption="Bestellungen"
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      onRowClick={(r) => router.push(`/orders/${r.id}`)}
      empty={<EmptyState icon={ShoppingCart} title={EMPTY[tab]} action={<Link href="/orders/new" className="font-semibold text-accent underline">Neue Bestellung</Link>} />}
    />
  );
}
