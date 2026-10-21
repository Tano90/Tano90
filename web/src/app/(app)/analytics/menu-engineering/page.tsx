import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { PeriodPicker } from "@/components/app/period-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { getMenuEngineering, listOutlets } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { addDays, dayIn, formatDay } from "@/lib/dates";
import { formatQty } from "@/lib/format";
import { GROUPS } from "@/lib/menu-groups";
import { DishTable, Matrix } from "./matrix";

export const metadata = { title: "Menu Engineering" };

const isDay = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export default async function MenuEngineeringPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const today = dayIn(outlet?.timezone);
  let from = isDay(sp.from) ? sp.from! : addDays(today, -29);
  let to = isDay(sp.to) ? sp.to! : today;
  if (from > to) [from, to] = [to, from];
  const r = await getMenuEngineering(s, outletId, from, to);
  return (
    <>
      <PageHeader
        title="Menu Engineering"
        back={{ href: "/analytics/pos", label: "Kassen-Anbindung" }}
        description={`${outlet?.name} · ${formatDay(from)} bis ${formatDay(to)} · Welche Gerichte oft verkauft werden und wie viel jede Portion übrig lässt.`}
      />
      <div className="flex flex-col gap-6">
        <PeriodPicker from={from} to={to} today={today} presets={[
          { label: "Letzte 30 Tage", from: addDays(today, -29), to: today },
          { label: "Letzte 7 Tage", from: addDays(today, -6), to: today },
          { label: "Dieser Monat", from: `${today.slice(0, 8)}01`, to: today },
        ]} />
        {r.unlinked > 0 && (
          <Notice tone="warning">
            {formatQty(r.unlinked)} verkaufte Portionen gehören zu Kassenartikeln ohne Rezept und zählen hier nicht mit.{" "}
            <Link href="/analytics/pos?open=1" className="font-semibold underline">Jetzt verknüpfen</Link>
          </Notice>
        )}
        {r.dishes.length === 0 ? (
          <div className="rounded-md border border-border bg-bg">
            <EmptyState
              icon={BarChart3}
              title="Keine Verkäufe in diesem Zeitraum"
              body="Die Matrix entsteht aus den Kassenverkäufen verknüpfter Gerichte. Verkäufe importieren oder die Kasse anbinden, dann Kassenartikel mit Rezepten verknüpfen."
              action={<Link href="/analytics/pos" className="font-semibold text-accent underline">Zur Kassen-Anbindung</Link>}
            />
          </div>
        ) : (
          <>
            <Matrix dishes={r.dishes} shareLinePct={r.shareLinePct} marginLineCents={r.marginLineCents} />
            <DishTable dishes={r.dishes} />
            <section aria-labelledby="what-now" className="grid gap-3 sm:grid-cols-2">
              <h2 id="what-now" className="text-lg sm:col-span-2">Was tun?</h2>
              {GROUPS.map((g) => (
                <div key={g.key} className="rounded-md border border-border bg-bg p-4">
                  <p className="font-semibold">{g.label} <span className="font-normal text-text-muted">· {g.rule}</span></p>
                  <p className="mt-1 text-text-muted">{g.advice}</p>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </>
  );
}
