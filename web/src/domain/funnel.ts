// Service funnel: how often guests take the extras service can sell (aperitif, water, upgrade, side, dessert,
// coffee), against a target rate, and what reaching the target would add. A scenario, never revenue: nothing here
// is booked as sales or touches stock. Pure, so the page, the import and the tests agree. Money in cents.
import { csvTable } from "./csv";
import { parseNumber } from "./pos";

export const FUNNEL_STEPS = [
  { id: "aperitif", label: "Aperitif" },
  { id: "water", label: "Wasser" },
  { id: "upgrades", label: "Upgrades" },
  { id: "sides", label: "Beilagen" },
  { id: "desserts", label: "Desserts" },
  { id: "coffee", label: "Kaffee" },
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number]["id"];
export type FunnelCounts = Record<FunnelStep, number>;
export type FunnelDay = FunnelCounts & { outletId: string; day: string; covers: number };
export type StepSetting = { step: FunnelStep; priceGrossCents: number; vatBp: number; variableCents: number; goalPct: number };

export const defaultSteps = (): StepSetting[] => FUNNEL_STEPS.map(({ id }) => ({ step: id, priceGrossCents: 0, vatBp: 1900, variableCents: 0, goalPct: 0 }));

export type StepResult = {
  id: FunnelStep; label: string; sold: number;
  /** Sold per 100 guests; null without guests. */
  currentPct: number | null; goalPct: number;
  /** What the target would sell at the projected number of guests, and the difference to what was sold. */
  projectedSold: number; deltaUnits: number;
  netRevenueCents: number; db2Cents: number; revenueDeltaCents: number; db2DeltaCents: number;
};

export function funnelSummary(days: FunnelDay[], steps: StepSetting[], opts: { goals?: Partial<Record<FunnelStep, number>>; trafficLiftPct?: number; projectedDays?: number } = {}) {
  const covers = days.reduce((t, d) => t + Math.max(0, d.covers), 0);
  const lift = Math.max(-100, opts.trafficLiftPct ?? 0);
  const projectedCovers = covers * (1 + lift / 100);
  const byStep = FUNNEL_STEPS.map(({ id, label }): StepResult => {
    const st = steps.find((s) => s.step === id) ?? defaultSteps().find((s) => s.step === id)!;
    const sold = days.reduce((t, d) => t + Math.max(0, d[id]), 0);
    const goalPct = Math.max(0, Math.min(200, opts.goals?.[id] ?? st.goalPct));
    const net = st.priceGrossCents / (1 + st.vatBp / 10000);
    const margin = net - st.variableCents;
    const projectedSold = (projectedCovers * goalPct) / 100;
    const deltaUnits = covers ? projectedSold - sold : 0;
    return {
      id, label, sold, currentPct: covers ? (sold / covers) * 100 : null, goalPct, projectedSold, deltaUnits,
      netRevenueCents: Math.round(sold * net), db2Cents: Math.round(sold * margin),
      revenueDeltaCents: Math.round(deltaUnits * net), db2DeltaCents: Math.round(deltaUnits * margin),
    };
  });
  const sum = (k: "netRevenueCents" | "db2Cents" | "revenueDeltaCents" | "db2DeltaCents") => byStep.reduce((t, s) => t + s[k], 0);
  // Monthly projection: the average observed outlet-day times the planned outlet-days per month.
  const factor = days.length ? (opts.projectedDays ?? 26) / days.length : 0;
  return {
    covers, outletDays: days.length, steps: byStep,
    extras: byStep.reduce((t, s) => t + s.sold, 0),
    netRevenueCents: sum("netRevenueCents"), db2Cents: sum("db2Cents"),
    revenueDeltaCents: sum("revenueDeltaCents"), db2DeltaCents: sum("db2DeltaCents"),
    monthlyRevenueDeltaCents: Math.round(sum("revenueDeltaCents") * factor), monthlyDb2DeltaCents: Math.round(sum("db2DeltaCents") * factor),
  };
}

/** The step with the most DB II left on the table at its target, for the dashboard hint. */
export function biggestGap(summary: ReturnType<typeof funnelSummary>): StepResult | null {
  const best = [...summary.steps].filter((s) => s.db2DeltaCents > 0).sort((a, b) => b.db2DeltaCents - a.db2DeltaCents)[0];
  return best ?? null;
}

const HEAD: Record<string, "day" | "covers" | FunnelStep> = {
  datum: "day", date: "day", tag: "day",
  covers: "covers", gaeste: "covers", gast: "covers", gedecke: "covers", guests: "covers",
  aperitif: "aperitif", aperitifs: "aperitif", aperol: "aperitif",
  wasser: "water", water: "water",
  upgrades: "upgrades", upgrade: "upgrades",
  beilagen: "sides", beilage: "sides", sides: "sides",
  desserts: "desserts", dessert: "desserts", nachtisch: "desserts",
  kaffee: "coffee", coffee: "coffee", espresso: "coffee",
};
const norm = (h: string) => h.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z]/g, "");

/** A day as 2026-10-21 or 21.10.2026 (also 21.10.26); null when it is not a real date. */
export function parseDay(raw: string): string | null {
  const t = raw.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(t);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (de) [d, m, y] = [Number(de[1]), Number(de[2]), de[3].length === 2 ? 2000 + Number(de[3]) : Number(de[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export type FunnelImportRow = FunnelCounts & { row: number; day: string; covers: number };

/** Funnel days from a CSV: Datum; Covers; then any of the six steps. A day twice in the file: the last row wins. */
export function parseFunnelCsv(text: string): { rows: FunnelImportRow[]; errors: { row: number; message: string }[] } {
  const table = csvTable(text).filter((r) => r.some((c) => c !== ""));
  const head = (table[0] ?? []).map((h) => HEAD[norm(h)]);
  if (!head.includes("day") || !head.includes("covers")) return { rows: [], errors: [{ row: 1, message: "Spalten „Datum“ und „Covers“ (oder „Gäste“) fehlen." }] };
  const byDay = new Map<string, FunnelImportRow>();
  const errors: { row: number; message: string }[] = [];
  table.slice(1).forEach((cells, i) => {
    const row = i + 2;
    const out: FunnelImportRow = { row, day: "", covers: 0, aperitif: 0, water: 0, upgrades: 0, sides: 0, desserts: 0, coffee: 0 };
    for (let c = 0; c < head.length; c++) {
      const k = head[c];
      if (!k) continue;
      const raw = cells[c] ?? "";
      if (k === "day") {
        const day = parseDay(raw);
        if (!day) return void errors.push({ row, message: `Datum „${raw}“ ist kein gültiges Datum.` });
        out.day = day;
      } else {
        const n = raw.trim() === "" ? 0 : parseNumber(raw);
        if (n === null || n < 0 || !Number.isInteger(n) || n > 100000) return void errors.push({ row, message: `„${raw}“ ist keine ganze Zahl ab 0.` });
        out[k] = n;
      }
    }
    byDay.set(out.day, out);
  });
  return { rows: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)), errors };
}
