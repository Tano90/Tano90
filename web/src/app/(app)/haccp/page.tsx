import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { getHaccpDay, haccpDeviations, listOutlets } from "@/data/repo";
import { canEditLibrary, currentOutletId, requireSession } from "@/data/session";
import { addDays, dayIn, formatDay } from "@/lib/dates";
import { ChecklistDay, ChecklistManager, Deviations } from "./haccp-forms";

export const metadata = { title: "HACCP" };

const isDay = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const linkCls = "font-semibold text-accent underline";

export default async function HaccpPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const today = dayIn(outlet?.timezone);
  const day = isDay(sp.day) && sp.day! <= today ? sp.day! : today;
  const [{ checklists, records }, deviations] = await Promise.all([
    getHaccpDay(s, outletId, day),
    haccpDeviations(s, outletId, addDays(today, -29), today),
  ]);
  return (
    <>
      <PageHeader title="HACCP" description={`${outlet?.name} · Kontrollen für ${formatDay(day, "full")}`} />
      <div className="flex flex-col gap-8">
        <nav aria-label="Tag wählen" className="flex flex-wrap gap-4">
          <Link className={linkCls} href={`/haccp?day=${addDays(day, -1)}`}>← Vortag</Link>
          {day !== today && <Link className={linkCls} href="/haccp">Heute</Link>}
          {day < today && <Link className={linkCls} href={`/haccp?day=${addDays(day, 1)}`}>Folgetag →</Link>}
        </nav>
        {checklists.length === 0 ? (
          <p className="text-text-muted">Noch keine Checkliste. {canEditLibrary(s.role) ? "Lege unten die erste an." : "Die Küchenleitung legt sie an."}</p>
        ) : (
          checklists.map((c) => <ChecklistDay key={`${c.id}-${day}`} checklist={c} day={day} records={records} />)
        )}
        <Deviations rows={deviations} outletName={outlet?.name ?? ""} />
        {canEditLibrary(s.role) && <ChecklistManager checklists={checklists} />}
      </div>
    </>
  );
}
