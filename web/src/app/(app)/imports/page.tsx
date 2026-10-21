import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { listSuppliers } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { PriceListImport } from "./price-list-import";

export const metadata = { title: "Preisliste importieren" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const suppliers = (await listSuppliers(s)).map((x) => ({ value: x.id, label: x.companyName }));
  return (
    <>
      <PageHeader
        title="Preisliste importieren"
        description="Gebinde und Einkaufspreise eines Lieferanten aus einer Excel- oder CSV-Datei übernehmen, statt sie einzeln einzutippen."
        back={{ href: "/suppliers", label: "Lieferanten" }}
      />
      {!canEditLibrary(s.role) ? (
        <Notice tone="locked">Preise importieren dürfen Inhaber, Admins und die Küchenleitung.</Notice>
      ) : suppliers.length === 0 ? (
        <Notice>Lege zuerst einen Lieferanten an. Die Preisliste gehört immer zu genau einem Lieferanten.</Notice>
      ) : (
        <PriceListImport suppliers={suppliers} initialSupplierId={suppliers.some((x) => x.value === sp.supplier) ? sp.supplier! : suppliers[0].value} />
      )}
    </>
  );
}
