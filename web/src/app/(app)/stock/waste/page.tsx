import { PageHeader } from "@/components/app/page-header";
import { getStock, listOutlets, listStockEvents } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { WasteForm, WasteOverview } from "./waste-form";

export const metadata = { title: "Schwund · Kitchen Ledger" };

export default async function WastePage() {
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const [stock, events] = await Promise.all([getStock(s, outletId), listStockEvents(s, outletId, "waste")]);
  return (
    <>
      <PageHeader title="Schwund buchen" description={`Was in ${outlet?.name} verdorben, heruntergefallen oder abgelaufen ist.`} back={{ href: "/stock", label: "Lager" }} />
      <WasteForm items={stock.map((r) => ({ value: r.id, label: r.name, hint: r.category, baseUnit: r.baseUnit }))} />
      <WasteOverview events={events.map((e) => ({ id: e.id, occurredAt: e.occurredAt, by: e.createdByName, valueCents: -e.valueCents, lines: e.lines.map((l) => ({ id: l.id, ingredient: l.ingredient, deltaBase: l.deltaBase, baseUnit: l.baseUnit, reason: l.reason })) }))} />
    </>
  );
}
