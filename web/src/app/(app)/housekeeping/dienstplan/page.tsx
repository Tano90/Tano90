import { getHkSetup, getOccupancyPlan, listOutlets, listRooms, listShifts } from "@/data/repo";
import { canEditLibrary, currentOutletId, requireSession } from "@/data/session";
import { shiftMinutes, workloadMinutes } from "@/domain/linen";
import { addDays, dayIn } from "@/lib/dates";
import { Roster } from "./roster";

export const metadata = { title: "Housekeeping: Dienstplan" };
export const dynamic = "force-dynamic";

/** Monday of the week that contains `day`. */
const monday = (day: string) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const today = dayIn(outlet?.timezone);
  const { week } = await searchParams;
  const start = monday(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);
  const end = addDays(start, 6);
  const [setup, shifts, plan, board] = await Promise.all([getHkSetup(s, outletId), listShifts(s, outletId, start, end), getOccupancyPlan(s, outletId, start, end), listRooms(s, outletId)]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((day) => ({
    day,
    requiredMin: workloadMinutes(plan.filter((r) => r.day === day), setup.settings),
    hasPlan: plan.some((r) => r.day === day),
    plannedMin: shifts.filter((x) => x.day === day).reduce((m, x) => m + shiftMinutes(x.starts, x.ends, x.breakMinutes), 0),
  }));
  return (
    <>
      <p className="-mt-2 mb-4 max-w-3xl text-text-muted">Schichten der Reinigung. „Benötigt“ kommt aus der Belegung und den Minuten pro Zimmer (Wäsche → Einstellungen).</p>
      <Roster start={start} today={today} days={days} shifts={shifts} people={setup.people} me={board.me} manager={canEditLibrary(s.role)} />
    </>
  );
}
