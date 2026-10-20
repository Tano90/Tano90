import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/app/notice";
import { getStock, listOutlets, listTransfers } from "@/data/repo";
import { canAccessOutlet, currentOutletId, requireSession } from "@/data/session";
import { TransferForm, TransferList } from "./transfer-form";

export const metadata = { title: "Umbuchung" };

export default async function TransferPage() {
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlets = await listOutlets(s);
  const outlet = outlets.find((o) => o.id === outletId);
  const targets = outlets.filter((o) => o.id !== outletId && !o.archivedAt && canAccessOutlet(s, o.id));
  const [stock, transfers] = await Promise.all([getStock(s, outletId), listTransfers(s, outletId)]);
  return (
    <>
      <PageHeader title="Umbuchen" description={`Ware aus ${outlet?.name} in ein anderes Outlet geben. Der Wert wandert zum Durchschnittspreis mit.`} back={{ href: "/stock", label: "Lager" }} />
      {targets.length === 0 ? (
        <Notice>Es gibt kein anderes Outlet, auf das du Zugriff hast. Umbuchen geht nur zwischen zwei Outlets, die dir beide zugewiesen sind.</Notice>
      ) : (
        <TransferForm
          fromName={outlet?.name ?? ""}
          targets={targets.map((o) => ({ value: o.id, label: o.name }))}
          items={stock.map((r) => ({ value: r.id, label: r.name, hint: r.category, baseUnit: r.baseUnit, onHandBase: r.quantityBase }))}
        />
      )}
      <TransferList transfers={transfers} tz={outlet?.timezone} />
    </>
  );
}
