import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { listCategories, listRecipes } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { RecipeTable } from "./recipe-table";

export const metadata = { title: "Rezepte · Kitchen Ledger" };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const [rows, categories] = await Promise.all([listRecipes(s, { q: sp.q, categoryId: sp.cat }), listCategories(s, "recipe")]);
  return (
    <>
      <PageHeader
        title="Rezepte"
        description="Was eine Portion kostet und wie viel vom Verkaufspreis beim Wareneinsatz bleibt."
        actions={
          canEditLibrary(s.role) && (
            <Link href="/recipes/new" className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
              <Plus aria-hidden className="size-4" /> Rezept anlegen
            </Link>
          )
        }
      />
      <RecipeTable rows={rows} filtered={!!(sp.q || sp.cat)} categories={categories.map((c) => ({ value: c.id, label: c.name }))} canEdit={canEditLibrary(s.role)} />
    </>
  );
}
