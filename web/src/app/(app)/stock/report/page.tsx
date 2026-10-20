import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { getStockReport, listOutlets } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { addDays, dayIn, formatDay } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { ReportTable } from "./report-table";
import { PeriodPicker } from "./period-picker";

export const metadata = { title: "Lagerbericht" };

const isDay = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const today = dayIn(outlet?.timezone);
  let from = isDay(sp.from) ? sp.from! : `${today.slice(0, 8)}01`;
  let to = isDay(sp.to) ? sp.to! : today;
  if (from > to) [from, to] = [to, from];
  const rows = (await getStockReport(s, outletId, from, to)).filter(
    (r) => Math.abs(r.closingBase) > 1e-9 || Math.abs(r.openingBase) > 1e-9 || Object.values(r.columns).some((c) => Math.abs(c.base) > 1e-9),
  );
  const sum = (k: keyof (typeof rows)[number]["columns"]) => rows.reduce((t, r) => t + r.columns[k].cents, 0);
  const closing = rows.reduce((t, r) => t + r.closingCents, 0);
  return (
    <>
      <PageHeader
        title="Lagerbericht"
        description={`${outlet?.name} · ${formatDay(from)} bis ${formatDay(to)} · Werte zum gleitenden Durchschnittspreis der jeweiligen Buchung.`}
        back={{ href: "/stock", label: "Lager" }}
      />
      <div className="flex flex-col gap-6">
        <PeriodPicker from={from} to={to} today={today} presets={[
          { label: "Dieser Monat", from: `${today.slice(0, 8)}01`, to: today },
          { label: "Letzter Monat", from: `${addDays(`${today.slice(0, 8)}01`, -1).slice(0, 8)}01`, to: addDays(`${today.slice(0, 8)}01`, -1) },
          { label: "Letzte 7 Tage", from: addDays(today, -6), to: today },
        ]} />
        <section aria-label="Summen" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Wareneingang" value={formatCents(Math.round(sum("delivered")))} />
          <StatTile label="Verkauf (Wareneinsatz)" value={formatCents(Math.round(-sum("sold")))} />
          <StatTile label="Schwund" value={formatCents(Math.round(-sum("waste")))} />
          <StatTile label="Inventurdifferenz" value={formatCents(Math.round(sum("countDiff")))} />
          <StatTile label={`Bestandswert am ${formatDay(to)}`} value={formatCents(Math.round(closing))} className="col-span-2 lg:col-span-1" />
        </section>
        <ReportTable rows={rows} from={from} to={to} outletName={outlet?.name ?? ""} />
      </div>
    </>
  );
}
