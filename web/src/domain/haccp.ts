// HACCP control points: whether a recorded value is within limits, and what must be written when it is not.

export type ControlPoint = { kind: "check" | "temperature" | "text"; minValue: number | null; maxValue: number | null };
export type Reading = { ok: true } | { ok: false; reason: string };

/** `value`: "ok" / "not_ok" for checks, a number (°C) for temperatures, any text for notes. */
export function evaluate(point: ControlPoint, value: string): Reading | null {
  if (!value.trim()) return null;
  if (point.kind === "text") return { ok: true };
  if (point.kind === "check") return value === "ok" ? { ok: true } : { ok: false, reason: "Nicht in Ordnung." };
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n)) return { ok: false, reason: "Keine gültige Temperatur." };
  const fmt = (v: number) => `${String(v).replace(".", ",")} °C`;
  if (point.minValue !== null && n < point.minValue) return { ok: false, reason: `Unter ${fmt(point.minValue)}.` };
  if (point.maxValue !== null && n > point.maxValue) return { ok: false, reason: `Über ${fmt(point.maxValue)}.` };
  return { ok: true };
}
