import { NoPermission } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { getControlling } from "@/data/repo";
import { canEditLibrary, canManageTeam, requireSession } from "@/data/session";
import { dayIn } from "@/lib/dates";
import { ControllingTable } from "./controlling-table";

export const metadata = { title: "F&B-Controlling" };

const MONTH = /^\d{4}-\d{2}$/;
const monthName = (m: string) => new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`));
// Day 0 of the next month is the last day of this one (UTC, so no time zone can shift it).
const lastDay = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 0)).toISOString().slice(0, 10);

export default async function ControllingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const s = await requireSession();
  if (!canEditLibrary(s.role)) {
    return (<><PageHeader title="F&B-Controlling" back={{ href: "/analytics/pos", label: "Auswertungen" }} /><NoPermission what="Das Controlling sehen Inhaber, Admins und die Leitung." /></>);
  }
  const today = dayIn();
  const current = today.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${current}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    return d.toISOString().slice(0, 7);
  });
  const { month: picked } = await searchParams;
  const month = picked && MONTH.test(picked) && months.includes(picked) ? picked : current;
  const to = month === current ? today : lastDay(month);
  const rows = await getControlling(s, `${month}-01`, to);
  return (
    <>
      <PageHeader
        title="F&B-Controlling"
        description="Wareneinsatz je Outlet bzw. Kostenstelle, wie die Buchhaltung ihn rechnet: Anfangsbestand + Einkauf ± Umbuchungen − Endbestand. Bewertet zum gleitenden Durchschnittspreis."
        back={{ href: "/analytics/pos", label: "Auswertungen" }}
      />
      <ControllingTable
        rows={rows}
        month={month}
        monthLabel={`${monthName(month)}${month === current ? ` (bis heute)` : ""}`}
        months={months.map((m) => ({ value: m, label: monthName(m) }))}
        canEditCostCenters={canManageTeam(s.role)}
      />
    </>
  );
}
