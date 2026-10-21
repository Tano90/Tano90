import { describe, expect, it } from "vitest";
import { canSetStatus, needsServiceToday, parseRoomNumbers, summary, autoAssign, byUrgency } from "./housekeeping";

describe("parseRoomNumbers", () => {
  it("ranges, single names, duplicates, leading zeros", () => {
    expect(parseRoomNumbers("101-103, Suite 1; 102\n01-02")).toEqual(["101", "102", "103", "Suite 1", "01", "02"]);
    expect(parseRoomNumbers("201 – 203")).toEqual(["201", "202", "203"]);
  });
  it("rejects what cannot be meant", () => {
    expect(() => parseRoomNumbers("")).toThrow(/mindestens eine/);
    expect(() => parseRoomNumbers("120-101")).toThrow(/aufsteigen/);
    expect(() => parseRoomNumbers("1-1000")).toThrow(/Höchstens 500/);
    expect(() => parseRoomNumbers("x".repeat(25))).toThrow(/20 Zeichen/);
  });
});

describe("canSetStatus", () => {
  it("staff only between dirty and cleaned, managers anything", () => {
    expect(canSetStatus("outlet_staff", "dirty", "clean")).toBe(true);
    expect(canSetStatus("outlet_staff", "clean", "dirty")).toBe(true);
    expect(canSetStatus("outlet_staff", "clean", "inspected")).toBe(false);
    expect(canSetStatus("outlet_staff", "out_of_order", "dirty")).toBe(false);
    expect(canSetStatus("chef", "clean", "inspected")).toBe(true);
    expect(canSetStatus("owner", "inspected", "out_of_order")).toBe(true);
    expect(canSetStatus("owner", "clean", "clean")).toBe(false);
  });
});

describe("start of day and summary", () => {
  it("occupied and departing rooms need service, blocked rooms stay blocked", () => {
    expect(needsServiceToday({ status: "inspected", occupancy: "occupied" })).toBe(true);
    expect(needsServiceToday({ status: "clean", occupancy: "departure" })).toBe(true);
    expect(needsServiceToday({ status: "inspected", occupancy: "vacant" })).toBe(false);
    expect(needsServiceToday({ status: "out_of_order", occupancy: "occupied" })).toBe(false);
  });
  it("counts, arrivals not ready", () => {
    const s = summary([{ status: "dirty", occupancy: "arrival" }, { status: "inspected", occupancy: "arrival" }, { status: "clean", occupancy: "departure" }]);
    expect(s).toMatchObject({ dirty: 1, clean: 1, inspected: 1, arrivals: 2, departures: 1, arrivalsNotReady: 1 });
  });
});

describe("urgency and autoAssign", () => {
  const room = (id: string, over: Partial<import("./housekeeping").PlannableRoom> = {}): import("./housekeeping").PlannableRoom =>
    ({ id, number: id, floor: id.slice(0, 1), status: "dirty", occupancy: "departure", dnd: false, vip: false, arrivalTime: null, ...over });
  it("works arrivals by time first, VIP before others, do-not-disturb last", () => {
    const rooms = [room("101", { occupancy: "occupied" }), room("102", { dnd: true, occupancy: "arrival", arrivalTime: "10:00" }), room("103", { occupancy: "arrival", arrivalTime: "15:00" }),
      room("104", { occupancy: "arrival", arrivalTime: "12:00" }), room("105", { vip: true, occupancy: "occupied" }), room("106"), room("107", { occupancy: "arrival", arrivalTime: "15:00", vip: true })];
    expect([...rooms].sort(byUrgency).map((r) => r.id)).toEqual(["107", "104", "103", "105", "106", "101", "102"]);
  });
  it("splits minutes evenly in floor blocks and skips clean, blocked and DND rooms", () => {
    const rooms = [...["101", "102", "103", "104"].map((n) => room(n)), ...["201", "202", "203", "204"].map((n) => room(n, { occupancy: "occupied" })), room("205", { status: "clean" }), room("206", { dnd: true })];
    const a = autoAssign(rooms, ["anna", "ben"], { departure: 30, stayover: 15 });
    // 4 × 30 + 4 × 15 = 180 → 90 each: anna 101–103, ben 104 + floor 2.
    expect([...a.entries()]).toEqual([["101", "anna"], ["102", "anna"], ["103", "anna"], ["104", "ben"], ["201", "ben"], ["202", "ben"], ["203", "ben"], ["204", "ben"]]);
    expect(a.has("205")).toBe(false);
    expect(a.has("206")).toBe(false);
    expect(autoAssign(rooms, [], { departure: 30, stayover: 15 }).size).toBe(0);
  });
});
