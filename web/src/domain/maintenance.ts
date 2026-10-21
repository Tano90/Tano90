// Maintenance plans: when a task is due again and how urgent it is. Pure, so the list, the dashboard and the tests agree.
import { addDays } from "@/lib/dates";

export type DueState = "overdue" | "today" | "soon" | "ok";
export const DUE_LABEL: Record<DueState, string> = { overdue: "überfällig", today: "heute fällig", soon: "bald fällig", ok: "geplant" };

/** Next due day after doing the task on `day`. */
export const nextDue = (day: string, intervalDays: number) => addDays(day, intervalDays);

/** overdue: before today; today; soon: within 7 days; ok: later. */
export function dueState(next: string, today: string): DueState {
  if (next < today) return "overdue";
  if (next === today) return "today";
  return next <= addDays(today, 7) ? "soon" : "ok";
}

/** "every 1 day" … "every 2 weeks" … "every 3 months" … "every year", in German. */
export function intervalLabel(days: number): string {
  if (days === 1) return "täglich";
  if (days === 7) return "wöchentlich";
  if (days % 365 === 0) return days === 365 ? "jährlich" : `alle ${days / 365} Jahre`;
  if (days % 30 === 0) return days === 30 ? "monatlich" : `alle ${days / 30} Monate`;
  if (days % 7 === 0) return `alle ${days / 7} Wochen`;
  return `alle ${days} Tage`;
}
