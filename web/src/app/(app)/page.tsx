import { AlertTriangle, ChefHat, ShoppingCart, TrendingDown } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { dashboard, listOutlets } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { formatBp, formatCents } from "@/lib/format";
import { formatBase } from "@/lib/units-display";

export const metadata = { title: "Übersicht" };

export default async function DashboardPage() {
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const d = await dashboard(s, outletId);
  const todo = [
    ...d.missingPrices.map((r) => ({ key: `p-${r.id}`, href: `/recipes/${r.id}`, icon: AlertTriangle, text: `${r.name}: ${r.missing} Zeile(n) ohne Preis` })),
    ...d.overTarget.map((r) => ({ key: `t-${r.id}`, href: `/recipes/${r.id}`, icon: ChefHat, text: `${r.name}: Wareneinsatz ${formatBp(r.foodCostBp!)} über Ziel ${formatBp(r.targetFoodCostBp!)}` })),
    ...d.belowMin.map((r) => ({ key: `m-${r.id}`, href: "/orders/new", icon: TrendingDown, text: `${r.name}: nur noch ${formatBase(r.quantityBase, r.baseUnit)} auf Lager` })),
    ...(d.draftOrders ? [{ key: "drafts", href: "/orders?tab=draft", icon: ShoppingCart, text: `${d.draftOrders} Bestellentwurf/-entwürfe noch nicht gesendet` }] : []),
  ];
  return (
    <>
      <PageHeader title={`Guten Tag, ${s.name.split(" ")[0]}`} description={outlet ? `Stand für ${outlet.name}.` : "Kein Outlet zugewiesen."} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Ø Wareneinsatz der Gerichte" value={d.avgFoodCostBp === null ? "–" : formatBp(d.avgFoodCostBp)} />
        <StatTile label="Lagerwert" value={formatCents(Math.round(d.stockValueCents))} />
        <StatTile label="Offene Bestellungen" value={String(d.openOrders)} />
        <StatTile label="Schwund (7 Tage)" value={formatCents(Math.round(d.wasteCents))} />
      </div>
      <section aria-labelledby="todo" className="mt-8 rounded-md border border-border bg-bg">
        <h2 id="todo" className="border-b border-border px-4 py-3 text-base font-semibold">Zu erledigen ({todo.length})</h2>
        {todo.length === 0 ? (
          <p className="px-4 py-6 text-text-muted">Nichts offen: Alle Preise sind da, alle Bestände über Minimum.</p>
        ) : (
          <ul className="divide-y divide-border">
            {todo.map(({ key, href, icon: Icon, text }) => (
              <li key={key}>
                <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-row-hover">
                  <Icon aria-hidden className="size-4 shrink-0 text-warning" />
                  <span>{text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
