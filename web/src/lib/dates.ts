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

/** The instant a calendar day starts in the given zone, as an ISO string (for range queries). */
export function startOfDay(day: string, tz = DEFAULT_TZ): string {
  const guess = new Date(`${day}T00:00:00Z`);
  // Offset of the zone at that moment: format the UTC instant as local wall time and compare.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(guess).filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]),
  );
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offset = wall - guess.getTime();
  const first = new Date(guess.getTime() - offset);
  // Around a DST switch the offset at local midnight can differ from the one at UTC midnight: correct once.
  const check = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(first);
  const hour = Number(check.find((p) => p.type === "hour")!.value);
  return new Date(first.getTime() - (hour === 23 ? -3600_000 : hour === 1 ? 3600_000 : 0)).toISOString();
}

/** Minutes the zone is ahead of UTC at a given instant (Berlin: 60 in winter, 120 in summer). */
export function zoneOffsetMinutes(utcMs: number, tz = DEFAULT_TZ): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(utcMs)).filter((x) => x.type !== "literal").map((x) => [x.type, Number(x.value)]),
  );
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000) / 60_000);
}
