import Link from "next/link";
import { NoPermission } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { PeriodPicker } from "@/components/app/period-picker";
import { StatTile } from "@/components/ui/stat-tile";
import { getCostSetup, getLibrary, getMenuEngineering, listOutlets } from "@/data/repo";
import { canEditLibrary, currentOutletId, requireSession } from "@/data/session";
import { contributionSummary, fixedCostsForPeriod, itemContribution } from "@/domain/contribution";
import { cn } from "@/lib/cn";
import { addDays, dayIn, formatDay } from "@/lib/dates";
import { formatBp, formatCents } from "@/lib/format";
import { CostSettings, TargetPrice } from "./cost-settings";

export const metadata = { title: "Deckungsbeitrag" };

const isDay = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const eur = (c: number) => formatCents(Math.round(c));

export default async function ContributionPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const back = { href: "/analytics/menu-engineering", label: "Menu Engineering" };
  if (!canEditLibrary(s.role)) return (<><PageHeader title="Deckungsbeitrag" back={back} /><NoPermission what="Den Deckungsbeitrag sehen Inhaber, Admins und die Leitung." /></>);
  const outletId = await currentOutletId(s);
  const outlets = await listOutlets(s);
  const outlet = outlets.find((o) => o.id === outletId);
  const today = dayIn(outlet?.timezone);
  let from = isDay(sp.from) ? sp.from! : `${today.slice(0, 8)}01`;
  let to = isDay(sp.to) ? sp.to! : today;
  if (from > to) [from, to] = [to, from];
  const [me, costs, lib] = await Promise.all([getMenuEngineering(s, outletId, from, to), getCostSetup(s), getLibrary(s)]);
  const variable = { revenuePct: costs.variableRevenuePct, perItemCents: costs.perItemCents };
  const items = me.dishes
    .map((d) => itemContribution({ id: d.id, name: d.name, quantity: d.sold, revenueNetCents: d.netPerPortionCents * d.sold, costPerPortionCents: d.costPerPortionCents }, variable))
    .sort((a, b) => b.db2Cents - a.db2Cents);
  const monthly = costs.fixed.filter((f) => f.outletId === null || f.outletId === outletId).reduce((t, f) => t + f.monthlyCents, 0);
  const fixed = fixedCostsForPeriod(monthly, from, to);
  const sum = contributionSummary(items, fixed);
  const pct = (c: number) => (sum.revenueNetCents ? formatBp(Math.round((c / sum.revenueNetCents) * 10000)) : "–");
  return (
    <>
      <PageHeader title="Deckungsbeitrag" back={back}
        description={`${outlet?.name} · ${formatDay(from)} bis ${formatDay(to)}. Aus den Kassenverkäufen, den Rezeptkosten, deinen variablen Kosten und Fixkosten.`} />
      <div className="flex flex-col gap-6">
        <PeriodPicker from={from} to={to} today={today} presets={[
          { label: "Dieser Monat", from: `${today.slice(0, 8)}01`, to: today },
          { label: "Letzter Monat", from: `${addDays(`${today.slice(0, 8)}01`, -1).slice(0, 8)}01`, to: addDays(`${today.slice(0, 8)}01`, -1) },
          { label: "Letzte 7 Tage", from: addDays(today, -6), to: today },
        ]} />
        <section aria-label="Ergebnis" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Umsatz netto" value={eur(sum.revenueNetCents)} />
          <StatTile label={`Wareneinsatz (${pct(sum.cogsCents)})`} value={eur(sum.cogsCents)} />
          <StatTile label={`DB I (${pct(sum.db1Cents)})`} value={eur(sum.db1Cents)} />
          <StatTile label={`DB II nach variablen Kosten (${pct(sum.db2Cents)})`} value={eur(sum.db2Cents)} />
          <StatTile label="Fixkosten im Zeitraum" value={eur(sum.fixedCents)} />
          <StatTile label="Betriebsergebnis" value={eur(sum.resultCents)} delta={sum.revenueNetCents ? { text: sum.resultCents >= 0 ? "Fixkosten gedeckt" : "Fixkosten nicht gedeckt", direction: sum.resultCents >= 0 ? "up" : "down", good: sum.resultCents >= 0 } : undefined} />
          <StatTile label="Break-even-Umsatz" value={sum.breakEvenRevenueCents === null ? "–" : eur(sum.breakEvenRevenueCents)} />
          <StatTile label="Variable Kosten" value={eur(sum.variableCents)} />
        </section>
        {!items.length && <p className="text-text-muted">Keine Verkäufe mit Rezept in diesem Zeitraum. <Link href="/analytics/pos" className="font-semibold text-accent hover:underline">Kassenverkäufe importieren</Link></p>}
        {me.unlinked > 0 && <p className="text-sm text-warning">{me.unlinked.toLocaleString("de-DE")} verkaufte Artikel ohne Rezept fehlen hier. <Link href="/analytics/pos?open=1" className="font-semibold text-accent hover:underline">Verknüpfen</Link></p>}
        {items.length > 0 && (
          <section aria-labelledby="items" className="rounded-lg border border-border bg-bg p-4">
            <h2 id="items" className="text-lg">Je Artikel, höchster Deckungsbeitrag zuerst</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[48rem] text-sm">
                <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 font-normal">Artikel</th><th scope="col" className="text-right font-normal">Menge</th><th scope="col" className="text-right font-normal">Umsatz netto</th><th scope="col" className="text-right font-normal">Wareneinsatz</th><th scope="col" className="text-right font-normal">DB I</th><th scope="col" className="text-right font-normal">DB II</th><th scope="col" className="text-right font-normal">DB II / Portion</th><th scope="col" className="text-right font-normal">DB-Quote</th></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t border-border">
                      <th scope="row" className="py-2 text-left font-semibold"><Link href={`/recipes/${i.id}`} className="hover:underline">{i.name}</Link>{i.unknownCost && <span className="ml-1 text-xs font-normal text-warning">Kosten unvollständig</span>}</th>
                      <td className="num text-right">{i.quantity.toLocaleString("de-DE")}</td>
                      <td className="num text-right">{eur(i.revenueNetCents)}</td>
                      <td className="num text-right">{i.foodCostBp === null ? "–" : formatBp(i.foodCostBp)}</td>
                      <td className="num text-right">{eur(i.db1Cents)}</td>
                      <td className={cn("num text-right font-semibold", i.db2Cents < 0 && "text-danger")}>{eur(i.db2Cents)}</td>
                      <td className="num text-right">{eur(i.db2PerPortionCents)}</td>
                      <td className="num text-right">{i.db2RatioBp === null ? "–" : formatBp(i.db2RatioBp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <TargetPrice items={items.filter((i) => !i.unknownCost).map((i) => ({ id: i.id, name: i.name, costPerPortionCents: i.costPerPortionCents ?? 0 }))} variable={variable} defaultVatBp={lib.defaultVatBp} />
        <CostSettings variableRevenuePct={costs.variableRevenuePct} perItemCents={costs.perItemCents} fixed={costs.fixed} outlets={outlets.map((o) => ({ id: o.id, name: o.name }))} />
      </div>
    </>
  );
}
