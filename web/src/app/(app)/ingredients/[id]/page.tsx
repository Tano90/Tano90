import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { getIngredient, listCategories, listSuppliers } from "@/data/repo";
import { canEditLibrary, requireSession } from "@/data/session";
import { IngredientEditor } from "../ingredient-editor";

export default async function IngredientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const s = await requireSession();
  const categories = (await listCategories(s, "ingredient")).map((c) => ({ value: c.id, label: c.name }));
  if (id === "new") {
    return (
      <>
        <PageHeader title="Neue Zutat" back={{ href: "/ingredients", label: "Zutaten" }} />
        <IngredientEditor detail={null} categories={categories} suppliers={[]} canEdit={canEditLibrary(s.role)} initialTab="general" />
      </>
    );
  }
  const detail = await getIngredient(s, id);
  if (!detail || detail.ingredient.archivedAt) notFound();
  const suppliers = (await listSuppliers(s)).map((x) => ({ value: x.id, label: x.companyName }));
  return (
    <>
      <PageHeader title={detail.ingredient.name} back={{ href: "/ingredients", label: "Zutaten" }} />
      <IngredientEditor detail={detail} categories={categories} suppliers={suppliers} canEdit={canEditLibrary(s.role)} initialTab={tab ?? "general"} />
    </>
  );
}
