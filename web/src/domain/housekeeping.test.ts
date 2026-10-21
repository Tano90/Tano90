import { describe, expect, it } from "vitest";
import { canSetStatus, needsServiceToday, parseRoomNumbers, summary } from "./housekeeping";

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
