import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { listApiKeys, listOutlets, listPosItems, listRecipes } from "@/data/repo";
import { canManageTeam, currentOutletId, requireSession } from "@/data/session";
import { ApiKeys } from "./api-keys";
import { PosItems, SalesImport } from "./pos-items";

export const metadata = { title: "Kassen-Anbindung" };

export default async function PosPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const [items, recipes, keys] = await Promise.all([
    listPosItems(s, outletId),
    listRecipes(s),
    canManageTeam(s.role) ? listApiKeys(s, outletId) : Promise.resolve(null),
  ]);
  const shown = sp.open ? items.filter((i) => !i.recipeId && !i.ignored) : items;
  return (
    <>
      <PageHeader
        title="Kassen-Anbindung"
        actions={<Link href="/analytics/menu-engineering" className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm border border-border-input bg-bg px-4 font-semibold hover:bg-row-hover"><BarChart3 aria-hidden className="size-4" /> Menu Engineering</Link>}
        description={`Verkäufe aus der Kasse von ${outlet?.name}. Ist ein Kassenartikel mit einem Rezept verknüpft, bucht jeder Verkauf die Zutaten bis auf die Rohware aus dem Lager.`}
      />
      <div className="flex flex-col gap-10">
        <SalesImport />
        <PosItems
          items={shown}
          openCount={items.filter((i) => !i.recipeId && !i.ignored).length}
          filtered={!!sp.open}
          recipes={recipes.filter((r) => r.productType === "finished").map((r) => ({ value: r.id, label: r.name }))}
        />
        {keys && <ApiKeys keys={keys} outletName={outlet?.name ?? ""} />}
      </div>
    </>
  );
}
