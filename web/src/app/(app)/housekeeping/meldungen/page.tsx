import { listRooms, listTickets } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";
import { TicketList } from "./ticket-list";

export const metadata = { title: "Housekeeping: Meldungen" };
export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const s = await requireSession();
  const outletId = await currentOutletId(s);
  const [tickets, { rooms }] = await Promise.all([listTickets(s, outletId), listRooms(s, outletId)]);
  return (
    <>
      <p className="-mt-2 mb-4 max-w-3xl text-text-muted">Schäden für die Technik und Fundsachen, mit Foto direkt vom Handy. Erledigte bleiben 30 Tage sichtbar.</p>
      <TicketList tickets={tickets} rooms={rooms.map((r) => ({ id: r.id, number: r.number }))} />
    </>
  );
}
