// Housekeeping rules, pure so the server, the board and the tests agree.

export type RoomStatus = "dirty" | "clean" | "inspected" | "out_of_order";
export type Occupancy = "vacant" | "occupied" | "departure" | "arrival";
export type HkRole = "owner" | "admin" | "chef" | "outlet_staff";

export const STATUS_LABEL: Record<RoomStatus, string> = { dirty: "schmutzig", clean: "gereinigt", inspected: "kontrolliert", out_of_order: "gesperrt" };
export const OCCUPANCY_LABEL: Record<Occupancy, string> = { vacant: "frei", occupied: "belegt", departure: "Abreise", arrival: "Anreise" };

const MAX_ROOMS = 500;

/**
 * "101-120, 201-210, Suite 1" → the room numbers, in order, without duplicates. Ranges keep leading zeros ("01-03").
 * Throws with a message for the person typing when a part cannot be read or the list is too long.
 */
export function parseRoomNumbers(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[,;\n]/)) {
    const part = raw.trim();
    if (!part) continue;
    const range = part.match(/^(\d{1,6})\s*[-–]\s*(\d{1,6})$/);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      if (b < a) throw new Error(`„${part}“: Der Bereich muss aufsteigen.`);
      if (b - a + 1 > MAX_ROOMS) throw new Error(`„${part}“: Höchstens ${MAX_ROOMS} Zimmer auf einmal.`);
      const width = range[1].length;
      for (let n = a; n <= b; n++) out.push(String(n).padStart(width, "0"));
    } else {
      if (part.length > 20) throw new Error(`„${part.slice(0, 20)}…“: Höchstens 20 Zeichen pro Zimmernummer.`);
      out.push(part);
    }
  }
  const unique = [...new Map(out.map((n) => [n.toLowerCase(), n])).values()];
  if (!unique.length) throw new Error("Bitte mindestens eine Zimmernummer angeben, z. B. 101-120.");
  if (unique.length > MAX_ROOMS) throw new Error(`Höchstens ${MAX_ROOMS} Zimmer auf einmal.`);
  return unique;
}

/** Cleaning staff report a room cleaned (or back to dirty); everything else is the head of housekeeping's call. */
export function canSetStatus(role: HkRole, from: RoomStatus, to: RoomStatus): boolean {
  if (from === to) return false;
  if (role !== "outlet_staff") return true;
  return (from === "dirty" && to === "clean") || (from === "clean" && to === "dirty");
}

/** Start of the day: rooms with guests or departures need service; blocked rooms stay blocked. */
export function needsServiceToday(r: { status: RoomStatus; occupancy: Occupancy }): boolean {
  return r.status !== "out_of_order" && r.status !== "dirty" && (r.occupancy === "occupied" || r.occupancy === "departure");
}

export function summary(rooms: { status: RoomStatus; occupancy: Occupancy }[]) {
  const count = (f: (r: { status: RoomStatus; occupancy: Occupancy }) => boolean) => rooms.filter(f).length;
  return {
    dirty: count((r) => r.status === "dirty"), clean: count((r) => r.status === "clean"),
    inspected: count((r) => r.status === "inspected"), outOfOrder: count((r) => r.status === "out_of_order"),
    departures: count((r) => r.occupancy === "departure"), arrivals: count((r) => r.occupancy === "arrival"),
    /** Arrivals whose room is not yet released by the head of housekeeping. */
    arrivalsNotReady: count((r) => r.occupancy === "arrival" && r.status !== "inspected"),
  };
}

export type PlannableRoom = { id: string; number: string; floor: string | null; status: RoomStatus; occupancy: Occupancy; dnd: boolean; vip: boolean; arrivalTime: string | null };

/** Rooms that need cleaning now: dirty, not blocked, not "do not disturb". */
export const toClean = (r: PlannableRoom) => r.status === "dirty" && !r.dnd;

/**
 * Order of work: arrivals by arrival time (VIP first at the same time), then other VIPs, departures, stayovers;
 * "do not disturb" last. Lower is earlier.
 */
export function urgency(r: PlannableRoom): [number, string, string] {
  const group = r.dnd ? 9 : r.occupancy === "arrival" ? (r.vip ? 0 : 1) : r.vip ? 2 : r.occupancy === "departure" ? 3 : r.occupancy === "occupied" ? 4 : 5;
  return [group, r.occupancy === "arrival" ? r.arrivalTime ?? "99:99" : "", `${(r.floor ?? "").padStart(4, "0")}|${r.number.padStart(8, "0")}`];
}
export const byUrgency = (a: PlannableRoom, b: PlannableRoom) => {
  const [x, y] = [urgency(a), urgency(b)];
  return x[0] - y[0] || x[1].localeCompare(y[1]) || x[2].localeCompare(y[2]);
};

/** Minutes a room takes: a departure is a full clean, an occupied room a stayover service. */
export const roomMinutes = (r: Pick<PlannableRoom, "occupancy">, m: { departure: number; stayover: number }) => (r.occupancy === "occupied" ? m.stayover : m.departure);

/**
 * Splits the rooms to clean among the people so everyone gets about the same minutes, in blocks along the floors
 * (less walking). Returns room id → person id. Each person's rooms are later worked in urgency order.
 */
export function autoAssign(rooms: PlannableRoom[], people: string[], minutes: { departure: number; stayover: number }): Map<string, string> {
  const out = new Map<string, string>();
  const list = rooms.filter(toClean).sort((a, b) => urgency(a)[2].localeCompare(urgency(b)[2]));
  if (!people.length || !list.length) return out;
  const total = list.reduce((m, r) => m + roomMinutes(r, minutes), 0);
  let person = 0;
  let done = 0;
  for (const r of list) {
    const m = roomMinutes(r, minutes);
    // Move on when this person's share is full, taking the room to whoever ends closer to the target.
    const target = (total * (person + 1)) / people.length;
    if (person < people.length - 1 && done + m / 2 > target) person++;
    out.set(r.id, people[person]);
    done += m;
  }
  return out;
}
