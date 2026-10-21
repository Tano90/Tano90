import { NoPermission } from "@/components/app/notice";
import { getHkSetup, getOccupancyPlan, listOutlets } from "@/data/repo";
import { canEditLibrary, currentOutletId, requireSession } from "@/data/session";
import { addDays, dayIn } from "@/lib/dates";
import { PlanEditor } from "./plan-editor";

export const metadata = { title: "Housekeeping: Belegung" };
export const dynamic = "force-dynamic";

export default async function OccupancyPage() {
  const s = await requireSession();
  if (!canEditLibrary(s.role)) return <NoPermission what="Die Belegung pflegt die Leitung." />;
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const today = dayIn(outlet?.timezone);
  const days = Array.from({ length: 21 }, (_, i) => addDays(today, i));
  const [setup, plan] = await Promise.all([getHkSetup(s, outletId), getOccupancyPlan(s, outletId, today, days[days.length - 1])]);
  return (
    <>
      <p className="-mt-2 mb-4 max-w-3xl text-text-muted">
        Anreisen, Abreisen und Bleiber pro Tag und Zimmertyp. Daraus rechnet Mirepa den Wäschebedarf und das Personal.
        Eine Anbindung an das Hotelprogramm gibt es noch nicht: eintippen oder den Bericht als CSV laden.
      </p>
      <PlanEditor key={plan.map((r) => `${r.day}${r.roomType}${r.arrivals}-${r.departures}-${r.stayovers}`).join("|")} days={days} roomTypes={setup.roomTypes} plan={plan} />
    </>
  );
}
