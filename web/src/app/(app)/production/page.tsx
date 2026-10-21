import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { listOutlets, listProduction, listRecipes } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { addDays, dayIn } from "@/lib/dates";
import { KitchenPlan, MyRequests, RequestForm } from "./production-forms";

export const metadata = { title: "Zentralküche" };

export default async function ProductionPage() {
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const [p, recipes] = await Promise.all([listProduction(s, outletId), listRecipes(s)]);
  const today = dayIn(outlet?.timezone);
  const mine = p.requests.filter((r) => r.fromOutletId === outletId);
  return (
    <>
      <PageHeader
        title="Zentralküche"
        description={p.isKitchen ? `${outlet?.name}: was die Outlets anfordern, was dafür an Rohware gebraucht wird, und was produziert ist.` : `Bei ${p.kitchen?.name ?? "der Zentralküche"} anfordern und sehen, was kommt.`}
      />
      {!p.kitchen ? (
        <Notice>Kein Outlet ist als Zentralküche markiert. Das legt der Inhaber unter Einstellungen → Outlets fest.</Notice>
      ) : (
        <div className="flex flex-col gap-10">
          {p.isKitchen && <KitchenPlan requests={p.requests.filter((r) => r.kitchenOutletId === outletId)} needs={p.needs} />}
          <RequestForm kitchenName={p.kitchen.name} recipes={recipes.map((r) => ({ value: r.id, label: r.name }))} minDay={today} defaultDay={addDays(today, 1)} />
          <MyRequests requests={mine} />
        </div>
      )}
    </>
  );
}
