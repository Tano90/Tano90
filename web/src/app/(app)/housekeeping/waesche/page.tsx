import { getHkSetup, listSuppliers } from "@/data/repo";
import { canEditLibrary, currentOutletId, requireSession } from "@/data/session";
import { KIND_LABEL } from "@/domain/linen";
import { addDays, formatDateTime } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/cn";
import { hkForecast } from "../forecast";
import { CountForm, ItemsPanel, OrderProposal, OrdersList, SettingsForm } from "./linen-client";

export const metadata = { title: "Housekeeping: Wäsche" };
export const dynamic = "force-dynamic";

export default async function LinenPage() {
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const manager = canEditLibrary(s.role);
  if (!manager) {
    const setup = await getHkSetup(s, outletId);
    return (
      <>
        <p className="-mt-2 mb-4 text-text-muted">Saubere Wäsche im Lager zählen. Die Leitung bestellt aus den Zahlen nach.</p>
        <CountForm items={setup.items} manager={false} />
      </>
    );
  }
  const [f, suppliers] = await Promise.all([hkForecast(s, outletId), listSuppliers(s)]);
  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-2 text-text-muted">Wäschelager, Zählung und Bestellung. Der Vorschlag deckt die nächsten {f.settings.coverDays} Tage laut Belegung, plus {f.settings.safetyPct} % Reserve.</p>
      <CountForm items={f.linen} manager />
      <OrderProposal
        lines={f.linen.filter((l) => l.hasSet).map((l) => ({ itemId: l.id, name: l.name, proposal: l.proposal, need: l.need, stock: l.stockClean, incoming: l.incoming, priceCents: l.priceCents, packSize: l.packSize }))}
        suppliers={suppliers.map((x) => ({ id: x.id, name: x.companyName, hasEmail: !!x.orderEmail }))}
        tomorrow={addDays(f.today, 1)}
        coverDays={f.settings.coverDays}
      />
      <OrdersList orders={f.orders} />

      <section aria-labelledby="usage" className="rounded-lg border border-border bg-bg p-4">
        <h2 id="usage" className="text-lg">Verbrauch und Kosten, letzte 30 Tage</h2>
        <p className="mt-1 text-sm text-text-muted">Verbrauch aus den Zählungen. „Abweichung“ vergleicht ihn mit dem, was die Belegung zwischen der ersten und letzten Zählung erwarten ließ; viel mehr deutet auf Schwund oder eine unvollständige Belegung.</p>
        {f.linen.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 font-normal">Artikel</th><th scope="col" className="text-right font-normal">Verbraucht</th><th scope="col" className="text-right font-normal">Wert</th><th scope="col" className="text-right font-normal">Abweichung</th><th scope="col" className="text-right font-normal">Ausgesondert</th><th scope="col" className="text-right font-normal">Geliefert (Wert)</th><th scope="col" className="text-right font-normal">Letzte Zählung</th></tr></thead>
              <tbody>
                {f.linen.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <th scope="row" className="py-2 text-left font-semibold">{l.name}</th>
                    <td className="num text-right">{l.used}</td>
                    <td className="num text-right">{formatCents(l.usedCostCents)}</td>
                    <td className={cn("num text-right", l.deviation !== null && l.deviation >= 15 ? "font-semibold text-danger" : "")}>{l.deviation === null ? "–" : `${l.deviation > 0 ? "+" : ""}${l.deviation} %`}</td>
                    <td className="num text-right">{l.discarded || "–"}</td>
                    <td className="num text-right">{formatCents(l.receivedCostCents)}</td>
                    <td className="text-right text-text-muted">{l.lastCount ? formatDateTime(l.lastCount) : "noch nie"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border font-semibold"><th scope="row" className="py-2 text-left">Summe</th><td /><td className="num text-right">{formatCents(f.cost.usedCents)}</td><td colSpan={2} /><td className="num text-right">{formatCents(f.cost.receivedCents)}</td><td /></tr></tfoot>
            </table>
          </div>
        ) : <p className="mt-2 text-text-muted">Noch keine Wäscheartikel.</p>}
      </section>

      <ItemsPanel items={f.linen.map(({ id, name, kind, priceCents, packSize, sets }) => ({ id, name, kind, priceCents, packSize, sets }))} roomTypes={f.roomTypes} kindLabels={KIND_LABEL} />
      <SettingsForm settings={f.settings} />
    </div>
  );
}
