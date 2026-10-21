// Linen and staffing forecast for housekeeping. Pure, so the dashboard, the order proposal and the tests agree.
//
// A room is fully changed (bed and bath) after every departure. Stayover rooms change bed linen every
// `bedEveryDays` and bath linen every `bathEveryDays` days, so on an average day stayovers / every rooms get it.
// Arrivals need no extra linen (the room was made up after the departure), but they cost minutes for the check.

export type LinenKind = "bed" | "bath" | "other";
export type HkSettings = {
  bedEveryDays: number; bathEveryDays: number;
  minutesDeparture: number; minutesStayover: number; minutesArrival: number;
  safetyPct: number; coverDays: number;
};
export const DEFAULT_SETTINGS: HkSettings = { bedEveryDays: 3, bathEveryDays: 1, minutesDeparture: 30, minutesStayover: 15, minutesArrival: 5, safetyPct: 10, coverDays: 7 };

export type PlanRow = { day: string; roomType: string; arrivals: number; departures: number; stayovers: number };
export type LinenItem = { id: string; name: string; kind: LinenKind; priceCents: number; packSize: number; stockClean: number };
/** Pieces of an item one full change of a room type uses ('' = rooms without a type). */
export type SetLine = { itemId: string; roomType: string; qty: number };

export const KIND_LABEL: Record<LinenKind, string> = { bed: "Bettwäsche", bath: "Frottee", other: "Sonstiges" };

/** Rooms getting this kind of linen on a plan row (fractional for stayovers: it is an expectation). */
export function changes(row: PlanRow, kind: LinenKind, s: HkSettings): number {
  if (kind === "other") return row.departures;
  return row.departures + row.stayovers / (kind === "bed" ? s.bedEveryDays : s.bathEveryDays);
}

/** Expected pieces per item over the given plan rows, and per day (for the chart and the range). */
export function linenNeed(plan: PlanRow[], items: LinenItem[], sets: SetLine[], s: HkSettings) {
  const byItem = new Map<string, number>();
  const byDay = new Map<string, Map<string, number>>();
  for (const item of items) {
    const lines = sets.filter((l) => l.itemId === item.id);
    if (!lines.length) continue;
    for (const row of plan) {
      const qty = lines.find((l) => l.roomType === row.roomType)?.qty ?? lines.find((l) => l.roomType === "")?.qty ?? 0;
      if (!qty) continue;
      const n = changes(row, item.kind, s) * qty;
      byItem.set(item.id, (byItem.get(item.id) ?? 0) + n);
      const day = byDay.get(row.day) ?? new Map<string, number>();
      day.set(item.id, (day.get(item.id) ?? 0) + n);
      byDay.set(row.day, day);
    }
  }
  return { byItem, byDay };
}

/**
 * What to order so the clean stock covers the expected need plus the safety margin: need × (1 + safety) − stock −
 * what is already on its way, rounded up to whole packs. Never negative.
 */
export function proposeQty(need: number, stock: number, incoming: number, safetyPct: number, packSize: number): number {
  const missing = Math.ceil(need * (1 + safetyPct / 100) - 1e-9) - stock - incoming;
  if (missing <= 0) return 0;
  return Math.ceil(missing / Math.max(1, packSize)) * Math.max(1, packSize);
}

/** Whole days the clean stock lasts at the expected daily use; null when nothing is expected. */
export function coverageDays(stock: number, needOverDays: number, days: number): number | null {
  if (needOverDays <= 0 || days <= 0) return null;
  return Math.floor(stock / (needOverDays / days));
}

/** Housekeeping minutes a plan day needs. */
export function workloadMinutes(rows: Pick<PlanRow, "arrivals" | "departures" | "stayovers">[], s: HkSettings): number {
  return rows.reduce((m, r) => m + r.departures * s.minutesDeparture + r.stayovers * s.minutesStayover + r.arrivals * s.minutesArrival, 0);
}

/** "07:00" to "15:30" with 30 minutes' break → 480. */
export function shiftMinutes(starts: string, ends: string, breakMinutes: number): number {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return Math.max(0, m(ends) - m(starts) - breakMinutes);
}

/** Occupied room nights of a plan day: guests staying plus guests arriving. */
export const roomNights = (rows: Pick<PlanRow, "arrivals" | "stayovers">[]) => rows.reduce((n, r) => n + r.arrivals + r.stayovers, 0);

/**
 * Used pieces from counts: each count stores the stock the system expected (`before`: last count + received −
 * discarded) and what was found (`qty`); the difference is what went into rooms and the laundry since.
 */
export function usedFromCounts(counts: { before: number | null; qty: number }[]): number {
  return counts.reduce((n, c) => n + Math.max(0, (c.before ?? c.qty) - c.qty), 0);
}

/**
 * Actual use against what the occupancy plan expected for the same period, in percent (positive = more used than
 * expected: loss, extra changes or a plan that was not kept up to date). Null without an expectation.
 */
export function deviationPct(used: number, expected: number): number | null {
  if (expected <= 0) return null;
  return Math.round(((used - expected) / expected) * 100);
}

/**
 * A PMS report as CSV: Datum;Zimmertyp;Anreisen;Abreisen;Bleiber (header names in German or English, `;` or `,`,
 * dates as 2026-10-21 or 21.10.2026). Rows with errors are returned with their line number, nothing is guessed.
 */
export function parsePlanCsv(text: string): { rows: PlanRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], errors: ["Die Datei ist leer."] };
  const sep = lines[0].includes(";") ? ";" : ",";
  const head = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const c = { day: col("datum", "date", "tag"), type: col("zimmertyp", "room type", "roomtype", "kategorie", "typ"), arr: col("anreisen", "arrivals", "anreise"), dep: col("abreisen", "departures", "abreise"), stay: col("bleiber", "stayovers", "stayover", "bleibe") };
  const missing = Object.entries({ Datum: c.day, Anreisen: c.arr, Abreisen: c.dep, Bleiber: c.stay }).filter(([, i]) => i < 0).map(([n]) => n);
  if (missing.length) return { rows: [], errors: [`Spalten fehlen: ${missing.join(", ")}. Erwartet: Datum;Zimmertyp;Anreisen;Abreisen;Bleiber`] };
  const rows: PlanRow[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, i) => {
    const f = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ""));
    const n = i + 2;
    const raw = f[c.day] ?? "";
    const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    const day = de ? `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}` : raw;
    const parsed = new Date(`${day}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return void errors.push(`Zeile ${n}: Datum „${raw}“ nicht lesbar.`);
    const nums = [c.arr, c.dep, c.stay].map((k) => f[k] ?? "");
    if (nums.some((v) => !/^\d{1,4}$/.test(v))) return void errors.push(`Zeile ${n}: Anreisen, Abreisen und Bleiber müssen ganze Zahlen sein.`);
    const roomType = (c.type >= 0 ? f[c.type] ?? "" : "").slice(0, 60);
    const [arrivals, departures, stayovers] = nums.map(Number);
    rows.push({ day, roomType, arrivals, departures, stayovers });
  });
  return { rows, errors };
}
