import { PageHeader } from "@/components/app/page-header";
import { getOpenCount, getStock, listOutlets, listStockEvents } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { formatDateTime } from "@/lib/dates";
import { CountSheet, StartCount } from "./count-sheet";

export const metadata = { title: "Inventur · Kitchen Ledger" };

export default async function CountPage() {
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const open = await getOpenCount(s, outletId);
  if (!open) {
    const past = (await listStockEvents(s, outletId, "count")).slice(0, 5);
    return (
      <>
        <PageHeader title="Inventur" description={`Bestand in ${outlet?.name} zählen.`} back={{ href: "/stock", label: "Lager" }} />
        <StartCount past={past.map((e) => ({ id: e.id, closedAt: e.closedAt, lines: e.lines.length, valueCents: e.valueCents, by: e.createdByName }))} />
      </>
    );
  }
  const stock = await getStock(s, outletId);
  return (
    <>
      <PageHeader title="Inventur läuft" description={`${outlet?.name} · begonnen ${formatDateTime(open.event.occurredAt, outlet?.timezone)}`} back={{ href: "/stock", label: "Lager" }} />
      <CountSheet eventId={open.event.id} draft={open.draft} items={stock.map((r) => ({ id: r.id, name: r.name, category: r.category, baseUnit: r.baseUnit, expectedBase: r.quantityBase }))} />
    </>
  );
}
