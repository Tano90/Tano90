import { FileUp, Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { listSuppliers } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { SupplierTable } from "./supplier-table";

export const metadata = { title: "Lieferanten" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const s = await requireSession();
  const all = await listSuppliers(s);
  const rows = q ? all.filter((x) => x.companyName.toLowerCase().includes(q.toLowerCase())) : all;
  return (
    <>
      <PageHeader
        title="Lieferanten"
        description="Bei wem du bestellst und wohin die Bestellungen gehen."
        actions={canEditLibrary(s.role) && (
          <>
          <Link href="/imports" className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm border border-border-input bg-bg px-4 font-semibold hover:bg-row-hover">
            <FileUp aria-hidden className="size-4" /> Preisliste importieren
          </Link>
          <Link href="/suppliers/new" className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
            <Plus aria-hidden className="size-4" /> Lieferant anlegen
          </Link>
          </>
        )}
      />
      <SupplierTable rows={rows} filtered={!!q} canEdit={canEditLibrary(s.role)} />
    </>
  );
}
