import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { canEditLibrary, requireSession } from "@/data/session";
import { RecipeImport } from "./recipe-import";

export const metadata = { title: "Rezepte importieren" };

export default async function RecipeImportPage() {
  const s = await requireSession();
  return (
    <>
      <PageHeader title="Rezepte importieren" back={{ href: "/recipes", label: "Rezepte" }}
        description="Deine Rezepte aus Excel oder CSV übernehmen, statt jedes einzeln einzutippen. Grundrezepte in derselben Datei werden erkannt." />
      {canEditLibrary(s.role) ? <RecipeImport /> : <Notice tone="locked">Rezepte importieren dürfen Inhaber, Admins und die Küchenleitung.</Notice>}
    </>
  );
}
