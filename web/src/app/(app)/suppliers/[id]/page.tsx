import { FileUp } from "lucide-react";
import Link from "next/link";
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
      <PageHeader
        title={found?.supplier.companyName ?? "Neuer Lieferant"}
        back={{ href: "/suppliers", label: "Lieferanten" }}
        actions={found && canEditLibrary(s.role) && (
          <Link href={`/imports?supplier=${id}`} className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm border border-border-input bg-bg px-4 font-semibold hover:bg-row-hover">
            <FileUp aria-hidden className="size-4" /> Preisliste importieren
          </Link>
        )}
      />
      <SupplierEditor supplier={found?.supplier ?? null} items={found?.items ?? []} canEdit={canEditLibrary(s.role)} />
    </>
  );
}
