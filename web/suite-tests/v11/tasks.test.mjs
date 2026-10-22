// Team & Aufgaben nach Outlet (Oct 2026): filter, sort, group, counts, form validation.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as T from "../../public/suite/src/v11/tasks.mjs";

const OUTLETS = [
  { id: "restaurant", name: "Restaurant" },
  { id: "bar", name: "Bar" },
];
const DAY = "2026-10-22";
const TASKS = [
  { id: "a", title: "Alt ohne Outlet", status: "open", priority: "high", due_on: "2026-10-20" }, // no outlet_id key at all
  { id: "b", title: "Bar-Inventur", status: "open", priority: "normal", due_on: "2026-10-25", outlet_id: "bar" },
  { id: "c", title: "Tische", status: "done", priority: "medium", due_on: "2026-10-01", outlet_id: "restaurant" },
  { id: "d", title: "Fenster", status: "open", priority: "medium", due_on: "2026-10-21", outlet_id: "restaurant" },
  { id: "e", title: "Allgemein neu", status: "open", priority: "normal", outlet_id: null },
  { id: "f", title: "Weggefallen", status: "open", priority: "normal", outlet_id: "terrasse" },
];
const ids = (l) => l.map((t) => t.id);

test("Aufgaben ohne Zuordnung gelten als Allgemein, nichts wird geraten", () => {
  assert.equal(T.taskOutlet(TASKS[0]), null);
  assert.equal(T.outletLabel(null, OUTLETS), "Betriebsübergreifend / Allgemein");
  assert.equal(T.outletLabel("terrasse", OUTLETS), "Outlet nicht mehr vorhanden");
  assert.deepEqual(ids(T.filterTasks(TASKS, { outlet: "general" }, DAY)), ["a", "e"]);
});

test("Filter: Outlet, Status, überfällig, Priorität – kombiniert", () => {
  assert.deepEqual(ids(T.filterTasks(TASKS, { outlet: "all" }, DAY)), ids(TASKS));
  assert.deepEqual(ids(T.filterTasks(TASKS, { outlet: "restaurant" }, DAY)), ["c", "d"]);
  assert.deepEqual(ids(T.filterTasks(TASKS, { outlet: "restaurant", status: "open" }, DAY)), ["d"]);
  assert.deepEqual(ids(T.filterTasks(TASKS, { outlet: "all", status: "overdue" }, DAY)), ["a", "d"]);
  assert.deepEqual(ids(T.filterTasks(TASKS, { outlet: "all", status: "done" }, DAY)), ["c"]);
  assert.deepEqual(ids(T.filterTasks(TASKS, { outlet: "restaurant", priority: "medium", status: "all" }, DAY)), ["c", "d"]);
  assert.equal(T.isOverdue({ status: "done", due_on: "2026-01-01" }, DAY), false, "erledigt ist nie überfällig");
  assert.equal(T.isOverdue({ status: "open" }, DAY), false, "ohne Termin nicht überfällig");
});

test("Sortierung innerhalb der Liste: Fälligkeit, Priorität, Outlet", () => {
  assert.deepEqual(ids(T.sortTasks(TASKS, "due", OUTLETS)), ["a", "d", "b", "e", "f", "c"]);
  // priority: open first, then high > medium > normal, then due date
  assert.deepEqual(ids(T.sortTasks(TASKS, "priority", OUTLETS)), ["a", "d", "b", "e", "f", "c"]);
  const p = T.sortTasks([{ id: "x", priority: "normal", status: "open", due_on: "2026-10-01" }, { id: "y", priority: "high", status: "open", due_on: "2026-12-01" }], "priority", OUTLETS);
  assert.deepEqual(ids(p), ["y", "x"]);
  assert.deepEqual(ids(T.sortTasks(p, "due", OUTLETS)), ["x", "y"]);
  const byOutlet = T.sortTasks(TASKS, "outlet", OUTLETS).map((t) => T.outletLabel(T.taskOutlet(t), OUTLETS));
  assert.deepEqual(byOutlet, [...byOutlet].sort((a, b) => a.localeCompare(b, "de")));
});

test("Gruppierung: Allgemein zuerst, dann Outlets in Stammdaten-Reihenfolge, unbekannte IDs eigene Gruppe", () => {
  const g = T.groupByOutlet(TASKS, OUTLETS);
  assert.deepEqual(g.map((x) => [x.id, ids(x.tasks)]), [
    [null, ["a", "e"]],
    ["restaurant", ["c", "d"]],
    ["bar", ["b"]],
    ["terrasse", ["f"]],
  ]);
});

test("Offen und überfällig je Outlet", () => {
  const s = T.outletStats(TASKS, OUTLETS, DAY);
  assert.deepEqual(s.map((x) => [x.id, x.open, x.overdue]), [
    [null, 2, 1],
    ["restaurant", 1, 1],
    ["bar", 1, 0],
  ]);
});

test("Formular: nur eigene Outlets oder Allgemein; fremde oder erfundene IDs abgelehnt", () => {
  assert.equal(T.resolveOutletChoice("general", OUTLETS), null);
  assert.equal(T.resolveOutletChoice("bar", OUTLETS), "bar");
  for (const bad of ["nord-b", "", undefined, "all", "__proto__"]) assert.throws(() => T.resolveOutletChoice(bad, OUTLETS), /Outlet dieses Betriebs/);
});
