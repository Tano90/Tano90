import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { listOrders, orderCounts } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { OrderTable } from "./order-table";

export const metadata = { title: "Bestellungen" };

const TABS = [
  { key: "open", label: "Offen" },
  { key: "draft", label: "Entwürfe" },
  { key: "delivered", label: "Geliefert" },
] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "open") as (typeof TABS)[number]["key"];
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const [rows, counts] = await Promise.all([listOrders(s, outletId, tab), orderCounts(s, outletId)]);
  return (
    <>
      <PageHeader
        title="Bestellungen"
        description="Bestellen, Lieferungen annehmen und den Überblick behalten."
        actions={
          <Link href="/orders/new" className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
            <Plus aria-hidden className="size-4" /> Neue Bestellung
          </Link>
        }
      />
      <nav aria-label="Status" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/orders?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px inline-flex h-(--size-control-md) items-center gap-1.5 border-b-2 px-3 whitespace-nowrap ${t.key === tab ? "border-accent font-semibold text-text" : "border-transparent text-text-muted hover:text-text"}`}
          >
            {t.label} <span className="num rounded-pill bg-surface-sunken px-1.5 text-xs">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>
      <OrderTable rows={rows} tab={tab} />
    </>
  );
}
