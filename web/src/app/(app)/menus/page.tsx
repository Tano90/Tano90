import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { listMenus } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { MenuTable } from "./menu-table";

export const metadata = { title: "Menüs" };

export default async function MenusPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const rows = await listMenus(s, { q: sp.q });
  return (
    <>
      <PageHeader
        title="Menüs"
        description="Gänge aus deinen Rezepten, mit Wareneinsatz und Marge. Ändert sich ein Einkaufspreis, rechnen die Menüs sofort neu."
        actions={
          canEditLibrary(s.role) && (
            <Link href="/menus/new" className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
              <Plus aria-hidden className="size-4" /> Menü anlegen
            </Link>
          )
        }
      />
      <MenuTable rows={rows} filtered={!!sp.q} canEdit={canEditLibrary(s.role)} />
    </>
  );
}
