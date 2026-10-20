import { Tag } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { getLibrary, getRecipe, lineOptions, listCategories, listOutlets } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { RecipeEditor } from "../recipe-editor";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const isNew = id === "new";
  const found = isNew ? null : await getRecipe(s, id);
  if (!isNew && (!found || found.recipe.archivedAt)) notFound();
  const [options, categories, library, outlets] = await Promise.all([lineOptions(s, isNew ? undefined : id), listCategories(s, "recipe"), getLibrary(s), listOutlets(s)]);
  return (
    <>
      <PageHeader
        title={found?.recipe.name ?? "Neues Rezept"}
        back={{ href: "/recipes", label: "Rezepte" }}
        actions={found && (
          <Link href={`/recipes/${id}/label`} className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm border border-border-input bg-bg px-4 font-semibold hover:bg-row-hover">
            <Tag aria-hidden className="size-4" /> Etikett
          </Link>
        )}
      />
      <RecipeEditor
        recipe={found?.recipe ?? null}
        usedIn={found?.usedIn ?? []}
        options={options}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        defaultVatBp={library.defaultVatBp}
        canEdit={canEditLibrary(s.role)}
        outlets={outlets.filter((o) => !o.archivedAt).map((o) => ({ id: o.id, name: o.name }))}
        outletPrices={found?.outletPrices ?? []}
      />
    </>
  );
}
