import { PageHeader } from "@/components/app/page-header";
import { PeriodPicker } from "@/components/app/period-picker";
import { getFunnel, listOutlets } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { addDays, dayIn, formatDay } from "@/lib/dates";
import { FunnelDays, FunnelScenario, FunnelSettings } from "./funnel-client";

export const metadata = { title: "Service Funnel" };

const isDay = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const today = dayIn(outlet?.timezone);
  let from = isDay(sp.from) ? sp.from! : addDays(today, -28);
  let to = isDay(sp.to) ? sp.to! : addDays(today, -1);
  if (from > to) [from, to] = [to, from];
  const f = await getFunnel(s, outletId, from, to);
  return (
    <>
      <PageHeader title="Service Funnel"
        description={`${outlet?.name} · ${formatDay(from)} bis ${formatDay(to)}. Wie oft der Service Aperitif, Wasser, Upgrades, Beilagen, Desserts und Kaffee verkauft, und was die Zielquote bringen würde. Ein Szenario, kein Umsatz: Nichts davon wird als Verkauf gebucht.`} />
      <div className="flex flex-col gap-6">
        <PeriodPicker from={from} to={to} today={today} presets={[
          { label: "Letzte 7 Tage", from: addDays(today, -7), to: addDays(today, -1) },
          { label: "Letzte 28 Tage", from: addDays(today, -28), to: addDays(today, -1) },
          { label: "Dieser Monat", from: `${today.slice(0, 8)}01`, to: today },
        ]} />
        <FunnelScenario key={f.steps.map((x) => x.goalPct).join("-")} days={f.days} steps={f.steps} projectedDays={f.projectedDays} costsVisible={f.costsVisible} />
        <FunnelDays days={f.days} today={today} />
        {f.costsVisible && <FunnelSettings steps={f.steps} projectedDays={f.projectedDays} />}
      </div>
    </>
  );
}
