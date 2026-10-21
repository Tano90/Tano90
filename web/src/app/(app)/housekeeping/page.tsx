import { listOutlets, listRooms } from "@/data/repo";
import { canEditLibrary, currentOutletId, requireSession } from "@/data/session";
import { HousekeepingBoard } from "./board";

export const metadata = { title: "Housekeeping" };
export const dynamic = "force-dynamic";

export default async function HousekeepingPage() {
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const data = await listRooms(s, outletId);
  return (
    <>
      <p className="-mt-2 mb-4 text-text-muted">{outlet?.name}: Zimmerstatus, Zuteilung und Reinigung. Die Leitung kontrolliert und gibt frei.</p>
      <HousekeepingBoard
        rooms={data.rooms.map((r) => ({ ...r, updatedAt: new Date(r.updatedAt).toISOString() }))}
        checklist={data.checklist}
        staff={data.staff}
        recent={data.recent.map((e) => ({ ...e, at: new Date(e.at).toISOString() }))}
        me={data.me}
        manager={canEditLibrary(s.role)}
        timezone={outlet?.timezone}
      />
    </>
  );
}
