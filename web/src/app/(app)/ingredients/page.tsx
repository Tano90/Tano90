import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { listCategories, listIngredients, listSuppliers } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { IngredientTable } from "./ingredient-table";

export const metadata = { title: "Zutaten" };

type Search = Promise<{ q?: string; cat?: string; sup?: string; unverified?: string }>;

export default async function IngredientsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const s = await requireSession();
  const [rows, categories, suppliers] = await Promise.all([
    listIngredients(s, { q: sp.q, categoryId: sp.cat, supplierId: sp.sup, unverified: sp.unverified === "1" }),
    listCategories(s, "ingredient"),
    listSuppliers(s),
  ]);
  const filtered = !!(sp.q || sp.cat || sp.sup || sp.unverified);
  return (
    <>
      <PageHeader
        title="Zutaten"
        description="Alles, was du einkaufst – mit Gebinden, Preisen und Allergenen."
        actions={
          canEditLibrary(s.role) && (
            <Link href="/ingredients/new" className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
              <Plus aria-hidden className="size-4" /> Zutat anlegen
            </Link>
          )
        }
      />
      <IngredientTable
        rows={rows}
        filtered={filtered}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        suppliers={suppliers.map((x) => ({ value: x.id, label: x.companyName }))}
        canEdit={canEditLibrary(s.role)}
      />
    </>
  );
}
