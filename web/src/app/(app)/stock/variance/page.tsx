import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { PeriodPicker } from "@/components/app/period-picker";
import { StatTile } from "@/components/ui/stat-tile";
import { getStockReport, listOutlets, listStockEvents } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { variance } from "@/domain/stock";
import { cn } from "@/lib/cn";
import { addDays, dayIn, formatDay } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { formatBase } from "@/lib/units-display";

export const metadata = { title: "Soll-Ist-Vergleich" };

const isDay = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;

export default async function VariancePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const today = dayIn(outlet?.timezone);
  let from = isDay(sp.from) ? sp.from! : `${today.slice(0, 8)}01`;
  let to = isDay(sp.to) ? sp.to! : today;
  if (from > to) [from, to] = [to, from];
  const [report, counts] = await Promise.all([getStockReport(s, outletId, from, to), listStockEvents(s, outletId, "count")]);
  const byId = new Map(report.map((r) => [r.ingredientId, r]));
  const rows = variance(report).map((v) => ({ ...v, ...byId.get(v.ingredientId)! }));
  const countsIn = counts.filter((e) => e.status === "closed" && e.occurredAt.slice(0, 10) >= from && e.occurredAt.slice(0, 10) <= to).length;
  const theo = rows.reduce((t, r) => t + r.theoreticalCents, 0);
  const diff = rows.reduce((t, r) => t + r.diffCents, 0);
  const losses = rows.filter((r) => r.diffCents < -0.5);
  return (
    <>
      <PageHeader title="Soll-Ist-Vergleich" back={{ href: "/stock", label: "Lager" }}
        description={`${outlet?.name} · ${formatDay(from)} bis ${formatDay(to)}. Soll: was Verkäufe (über die Rezepte), Schwund und Produktion verbraucht haben. Ist: was laut Inventur wirklich weg ist.`} />
      <div className="flex flex-col gap-6">
        <PeriodPicker from={from} to={to} today={today} presets={[
          { label: "Dieser Monat", from: `${today.slice(0, 8)}01`, to: today },
          { label: "Letzter Monat", from: `${addDays(`${today.slice(0, 8)}01`, -1).slice(0, 8)}01`, to: addDays(`${today.slice(0, 8)}01`, -1) },
          { label: "Letzte 7 Tage", from: addDays(today, -6), to: today },
        ]} />
        {countsIn === 0 && (
          <p role="status" className="flex items-start gap-2 rounded-md border border-warning bg-warning-subtle px-3 py-2 text-sm">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            In diesem Zeitraum wurde keine Inventur abgeschlossen. Ohne Zählung ist „Ist“ gleich „Soll“; der Vergleich wird aussagekräftig, sobald gezählt wurde. <Link href="/stock/count" className="font-semibold text-accent hover:underline">Inventur starten</Link>
          </p>
        )}
        <section aria-label="Summen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Soll-Verbrauch" value={formatCents(Math.round(theo))} />
          <StatTile label="Ist-Verbrauch" value={formatCents(Math.round(theo - diff))} />
          <StatTile label="Abweichung" value={formatCents(Math.round(-diff))} delta={theo > 0 ? { text: `${pct((-diff / theo) * 100)} vom Soll`, direction: diff < 0 ? "up" : "down", good: diff >= 0 } : undefined} />
          <StatTile label="Zutaten mit Fehlmenge" value={String(losses.length)} />
        </section>
        <section aria-labelledby="var" className="rounded-lg border border-border bg-bg p-4">
          <h2 id="var" className="text-lg">Je Zutat, größte Verluste zuerst</h2>
          {rows.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 font-normal">Zutat</th><th scope="col" className="text-right font-normal">Soll</th><th scope="col" className="text-right font-normal">Ist</th><th scope="col" className="text-right font-normal">Differenz</th><th scope="col" className="text-right font-normal">in %</th><th scope="col" className="text-right font-normal">Wert</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.ingredientId} className="border-t border-border">
                      <th scope="row" className="py-2 text-left font-semibold"><Link href={`/ingredients/${r.ingredientId}`} className="hover:underline">{r.name}</Link> <span className="font-normal text-text-muted">· {r.category}</span></th>
                      <td className="num text-right">{formatBase(r.theoreticalBase, r.baseUnit)}</td>
                      <td className="num text-right">{formatBase(r.actualBase, r.baseUnit)}</td>
                      <td className={cn("num text-right", r.diffBase < -1e-9 && "font-semibold text-danger")}>{Math.abs(r.diffBase) < 1e-9 ? "–" : `${r.diffBase > 0 ? "+" : "−"}${formatBase(Math.abs(r.diffBase), r.baseUnit)}`}</td>
                      <td className={cn("num text-right", r.pct !== null && r.pct >= 5 && "font-semibold text-danger")}>{r.pct === null || Math.abs(r.diffBase) < 1e-9 ? "–" : pct(r.pct)}</td>
                      <td className={cn("num text-right", r.diffCents < -0.5 && "font-semibold text-danger")}>{Math.abs(r.diffCents) < 0.5 ? "–" : formatCents(Math.round(r.diffCents))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-text-muted">Keine Bewegungen in diesem Zeitraum.</p>}
          <p className="mt-3 text-xs text-text-muted">Minus heißt: mehr verbraucht als Verkäufe und Schwund erklären (Portionen zu groß, nicht gebuchter Schwund, Diebstahl oder fehlende Kassenzuordnung). Plus heißt: mehr da als erwartet.</p>
        </section>
      </div>
    </>
  );
}
