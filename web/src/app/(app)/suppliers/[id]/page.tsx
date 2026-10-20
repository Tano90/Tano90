import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { getSupplier } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { SupplierEditor } from "../supplier-editor";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const found = id === "new" ? null : await getSupplier(s, id);
  if (id !== "new" && !found) notFound();
  return (
    <>
      <PageHeader title={found?.supplier.companyName ?? "Neuer Lieferant"} back={{ href: "/suppliers", label: "Lieferanten" }} />
      <SupplierEditor supplier={found?.supplier ?? null} items={found?.items ?? []} canEdit={canEditLibrary(s.role)} />
    </>
  );
}
