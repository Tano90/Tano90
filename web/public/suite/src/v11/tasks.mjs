/** Team tasks by outlet (Oct 2026). Pure functions, used by ui.mjs and the unit tests.
 *  A task carries outlet_id = an outlet id of the same workspace, or null for "Betriebsübergreifend / Allgemein".
 *  Tasks saved before this change have no outlet_id at all; they count as general – nothing is guessed. */

export const GENERAL = "general";
export const GENERAL_LABEL = "Betriebsübergreifend / Allgemein";
const PRIO_RANK = { high: 0, medium: 1, normal: 2 };

/** null/undefined/"" → null; otherwise the id as text. */
export const taskOutlet = (t) => (t?.outlet_id === undefined || t?.outlet_id === null || t?.outlet_id === "" ? null : String(t.outlet_id));

export function isOverdue(t, today) {
  return t.status !== "done" && /^\d{4}-\d{2}-\d{2}$/.test(String(t.due_on || "")) && t.due_on < today;
}

/** Name shown at a task. An id that is no longer in the outlet list stays visible as such, it is not re-mapped. */
export function outletLabel(id, outlets) {
  if (id === null) return GENERAL_LABEL;
  return outlets.find((o) => o.id === id)?.name || "Outlet nicht mehr vorhanden";
}

/** The outlet chosen in a form: "general" → null, a known id → id, anything else is rejected. */
export function resolveOutletChoice(value, outlets) {
  if (value === GENERAL) return null;
  if (typeof value === "string" && outlets.some((o) => o.id === value)) return value;
  throw new Error("Bitte ein Outlet dieses Betriebs oder „Betriebsübergreifend / Allgemein“ wählen.");
}

/** filter: { outlet: "all" | "general" | id, status: "all" | "open" | "done" | "overdue", priority: "all" | high | medium | normal } */
export function filterTasks(tasks, filter, today) {
  return tasks.filter((t) => {
    const o = taskOutlet(t);
    if (filter.outlet === GENERAL && o !== null) return false;
    if (filter.outlet && filter.outlet !== "all" && filter.outlet !== GENERAL && o !== filter.outlet) return false;
    if (filter.status === "open" && t.status === "done") return false;
    if (filter.status === "done" && t.status !== "done") return false;
    if (filter.status === "overdue" && !isOverdue(t, today)) return false;
    if (filter.priority && filter.priority !== "all" && (t.priority || "normal") !== filter.priority) return false;
    return true;
  });
}

const byDue = (a, b) => String(a.due_on || "9999").localeCompare(String(b.due_on || "9999"));
const byStatus = (a, b) => (a.status === "done") - (b.status === "done");
const byPrio = (a, b) => (PRIO_RANK[a.priority] ?? 2) - (PRIO_RANK[b.priority] ?? 2);
/** sort: "due" (default, open first), "priority", "status", "outlet" */
export function sortTasks(tasks, sort, outlets) {
  const byOutlet = (a, b) => outletLabel(taskOutlet(a), outlets).localeCompare(outletLabel(taskOutlet(b), outlets), "de");
  const order = {
    due: [byStatus, byDue, byPrio],
    priority: [byStatus, byPrio, byDue],
    status: [byStatus, byDue, byPrio],
    outlet: [byOutlet, byStatus, byDue, byPrio],
  }[sort] || [byStatus, byDue, byPrio];
  return [...tasks].sort((a, b) => {
    for (const f of order) {
      const r = f(a, b);
      if (r) return r;
    }
    return String(a.title).localeCompare(String(b.title), "de");
  });
}

/** Groups in the order of the outlet list, general first; unknown ids get their own group at the end. */
export function groupByOutlet(tasks, outlets) {
  const keys = [null, ...outlets.map((o) => o.id)];
  for (const t of tasks) if (!keys.includes(taskOutlet(t))) keys.push(taskOutlet(t));
  return keys
    .map((id) => ({ id, label: outletLabel(id, outlets), tasks: tasks.filter((t) => taskOutlet(t) === id) }))
    .filter((g) => g.tasks.length);
}

/** Open and overdue count per outlet (all tasks, independent of the list filter). */
export function outletStats(tasks, outlets, today) {
  return [null, ...outlets.map((o) => o.id)].map((id) => {
    const own = tasks.filter((t) => taskOutlet(t) === id);
    return {
      id,
      label: outletLabel(id, outlets),
      open: own.filter((t) => t.status !== "done").length,
      overdue: own.filter((t) => isOverdue(t, today)).length,
      total: own.length,
    };
  });
}
