// Dates are shown in the outlet's time zone, the same on the server and in the browser
// (the server runs in UTC; formatting without a zone would show yesterday after midnight
// and break hydration). Date-only values (YYYY-MM-DD) are never shifted.
export const DEFAULT_TZ = "Europe/Berlin";

type Style = "medium" | "long" | "full";

export function formatDate(iso: string | null | undefined, tz = DEFAULT_TZ, style: Style = "medium"): string {
  return iso ? new Intl.DateTimeFormat("de-DE", { dateStyle: style, timeZone: tz }).format(new Date(iso)) : "–";
}

export function formatDateTime(iso: string | null | undefined, tz = DEFAULT_TZ): string {
  return iso ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(new Date(iso)) : "–";
}

/** A calendar day like 2026-10-21, formatted without any time-zone shift. */
export function formatDay(day: string | null | undefined, style: Style = "medium"): string {
  return day ? new Intl.DateTimeFormat("de-DE", { dateStyle: style, timeZone: "UTC" }).format(new Date(`${day.slice(0, 10)}T00:00:00Z`)) : "–";
}

/** Today (plus `addDays`) as YYYY-MM-DD in the given zone. */
export function dayIn(tz = DEFAULT_TZ, now = new Date(), addDays = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (!addDays) return today;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10);
}

/** Calendar arithmetic on YYYY-MM-DD, no time zone involved. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
