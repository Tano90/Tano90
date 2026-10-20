import { PageHeader } from "@/components/app/page-header";
import { listOutlets, listSuppliers } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { OrderForm } from "../order-form";

export const metadata = { title: "Neue Bestellung · Kitchen Ledger" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  const { supplier } = await searchParams;
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const suppliers = await listSuppliers(s);
  return (
    <>
      <PageHeader title="Neue Bestellung" description={`Für ${outlet?.name ?? "–"}`} back={{ href: "/orders", label: "Bestellungen" }} />
      <OrderForm order={null} suppliers={suppliers.map((x) => ({ value: x.id, label: x.companyName, orderEmail: x.orderEmail, minOrderCents: x.minOrderCents, leadTimeDays: x.leadTimeDays }))} initialSupplierId={supplier ?? null} />
    </>
  );
}
