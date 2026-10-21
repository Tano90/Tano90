import "server-only";
import { getHkSetup, getOccupancyPlan, listCleaningTimes, listLinenMovements, listLinenOrders, listOutlets, listRooms, listShifts, listTickets } from "@/data/repo";
import type { Session } from "@/data/types";
import { summary } from "@/domain/housekeeping";
import { type PlanRow, coverageDays, deviationPct, linenNeed, proposeQty, roomNights, shiftMinutes, usedFromCounts, workloadMinutes } from "@/domain/linen";
import { addDays, dayIn } from "@/lib/dates";

export type Forecast = Awaited<ReturnType<typeof hkForecast>>;

/**
 * Everything the housekeeping overview and the linen order need, for one hotel (outlet): the plan of the next
 * `horizon` days, linen need and order proposal per item, staffing need against the roster, and the last 30 days'
 * linen use and cost against what the plan expected.
 */
export async function hkForecast(s: Session, outletId: string, horizon = 14) {
  const outlet = (await listOutlets(s)).find((o) => o.id === outletId);
  const today = dayIn(outlet?.timezone);
  const days = Array.from({ length: horizon }, (_, i) => addDays(today, i));
  const end = days[days.length - 1];
  const back = addDays(today, -30);
  const [setup, plan, pastPlan, shifts, movements, orders, board, tickets, cleaning] = await Promise.all([
    getHkSetup(s, outletId), getOccupancyPlan(s, outletId, today, end), getOccupancyPlan(s, outletId, back, addDays(today, -1)),
    listShifts(s, outletId, today, end), listLinenMovements(s, outletId, `${back}T00:00:00Z`), listLinenOrders(s, outletId), listRooms(s, outletId),
    listTickets(s, outletId), listCleaningTimes(s, outletId, `${back}T00:00:00Z`),
  ]);
  const st = setup.settings;

  // Today falls back to the room board when nobody entered a plan for it.
  const boardSummary = summary(board.rooms);
  const occupiedToday = board.rooms.filter((r) => r.occupancy === "occupied").length;
  const planToday = plan.filter((r) => r.day === today);
  const todayFromBoard = !planToday.length && board.rooms.length > 0;
  const fullPlan: PlanRow[] = todayFromBoard
    ? [...plan, { day: today, roomType: "", arrivals: boardSummary.arrivals, departures: boardSummary.departures, stayovers: occupiedToday }]
    : plan;

  const daily = days.map((day) => {
    const rows = fullPlan.filter((r) => r.day === day);
    const planned = shifts.filter((x) => x.day === day).reduce((m, x) => m + shiftMinutes(x.starts, x.ends, x.breakMinutes), 0);
    const sum = (k: "arrivals" | "departures" | "stayovers") => rows.reduce((n, r) => n + r[k], 0);
    return { day, arrivals: sum("arrivals"), departures: sum("departures"), stayovers: sum("stayovers"), hasPlan: rows.length > 0, requiredMin: workloadMinutes(rows, st), plannedMin: planned, people: new Set(shifts.filter((x) => x.day === day).map((x) => x.person)).size };
  });

  // Linen: the order covers `coverDays` from tomorrow (today's linen is already in the rooms or the cupboard).
  const coverPlan = fullPlan.filter((r) => r.day > today && r.day <= addDays(today, st.coverDays));
  const sets = setup.items.flatMap((i) => i.sets.map((l) => ({ itemId: i.id, ...l })));
  const cover = linenNeed(coverPlan, setup.items, sets, st);
  const week = linenNeed(fullPlan.filter((r) => r.day >= today && r.day < addDays(today, 7)), setup.items, sets, st);
  const incoming = new Map<string, number>();
  for (const o of orders.filter((x) => x.status !== "received")) for (const l of o.lines) incoming.set(l.itemId, (incoming.get(l.itemId) ?? 0) + l.qty);

  // Use and cost of the last 30 days from counts, expectation from the plan of the same days.
  const past = linenNeed(pastPlan, setup.items, sets, st);
  const linen = setup.items.map((item) => {
    const need = cover.byItem.get(item.id) ?? 0;
    const counts = movements.filter((m) => m.itemId === item.id && m.kind === "count");
    const used = usedFromCounts(counts);
    const firstCount = counts[0]?.at.slice(0, 10);
    return {
      ...item,
      hasSet: item.sets.length > 0,
      need: Math.ceil(need),
      weekNeed: Math.ceil(week.byItem.get(item.id) ?? 0),
      incoming: incoming.get(item.id) ?? 0,
      proposal: proposeQty(need, item.stockClean, incoming.get(item.id) ?? 0, st.safetyPct, item.packSize),
      coverage: coverageDays(item.stockClean, week.byItem.get(item.id) ?? 0, 7),
      used, usedCostCents: used * item.priceCents,
      // Use measured between the first and the last count of the window, against the plan for the same days.
      deviation: counts.length > 1 ? deviationPct(usedFromCounts(counts.slice(1)), linenNeed(pastPlan.filter((r) => r.day > firstCount! && r.day <= counts.at(-1)!.at.slice(0, 10)), [item], sets, st).byItem.get(item.id) ?? 0) : null,
      discarded: movements.filter((m) => m.itemId === item.id && m.kind === "discard").reduce((n, m) => n + m.qty, 0),
      receivedCostCents: movements.filter((m) => m.itemId === item.id && m.kind === "received").reduce((n, m) => n + m.qty * m.priceCents, 0),
      lastCount: counts.at(-1)?.at ?? null,
      plannedWeekCostCents: Math.ceil(week.byItem.get(item.id) ?? 0) * item.priceCents,
      pastExpected: Math.round(past.byItem.get(item.id) ?? 0),
    };
  });

  const nights30 = roomNights(pastPlan);
  const usedCost = linen.reduce((n, l) => n + l.usedCostCents, 0);
  return {
    outletName: outlet?.name ?? "", today, days, settings: st, roomTypes: setup.roomTypes, people: setup.people,
    daily, todayFromBoard, board: { ...boardSummary, total: board.rooms.length, occupied: occupiedToday, rooms: board.rooms.length },
    linen, orders,
    cost: { usedCents: usedCost, nights: nights30, perNightCents: nights30 ? Math.round(usedCost / nights30) : null, receivedCents: linen.reduce((n, l) => n + l.receivedCostCents, 0), weekPlannedCents: linen.reduce((n, l) => n + l.plannedWeekCostCents, 0) },
    planMissingDays: daily.filter((d) => !d.hasPlan).length,
    tickets: tickets.filter((t) => t.status === "open"), cleaning, dnd: board.rooms.filter((r) => r.dnd).length,
  };
}
