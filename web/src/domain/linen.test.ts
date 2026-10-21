import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS as S, type LinenItem, changes, coverageDays, deviationPct, linenNeed, parsePlanCsv, proposeQty, shiftMinutes, usedFromCounts, workloadMinutes } from "./linen";

const item = (id: string, kind: LinenItem["kind"], stockClean = 0): LinenItem => ({ id, name: id, kind, priceCents: 50, packSize: 1, stockClean });
const day = (d: string, arrivals: number, departures: number, stayovers: number, roomType = "") => ({ day: d, roomType, arrivals, departures, stayovers });

describe("linen forecast", () => {
  it("changes everything after a departure and stayovers by their rhythm", () => {
    const r = day("2026-10-22", 4, 6, 30);
    expect(changes(r, "bed", S)).toBe(6 + 10); // bed every 3 days
    expect(changes(r, "bath", S)).toBe(6 + 30); // towels daily
    expect(changes(r, "other", S)).toBe(6);
  });

  it("multiplies by the set of each room type, falls back to the default set", () => {
    const items = [item("bezug", "bed"), item("handtuch", "bath")];
    const sets = [{ itemId: "bezug", roomType: "", qty: 1 }, { itemId: "bezug", roomType: "Doppel", qty: 2 }, { itemId: "handtuch", roomType: "", qty: 2 }];
    const plan = [day("2026-10-22", 0, 3, 0, "Doppel"), day("2026-10-22", 0, 1, 3, "Einzel")];
    const { byItem, byDay } = linenNeed(plan, items, sets, S);
    expect(byItem.get("bezug")).toBe(3 * 2 + (1 + 1) * 1);
    expect(byItem.get("handtuch")).toBe(3 * 2 + (1 + 3) * 2);
    expect(byDay.get("2026-10-22")?.get("bezug")).toBe(8);
  });

  it("proposes whole packs above stock, incoming and safety margin", () => {
    expect(proposeQty(100, 40, 0, 10, 1)).toBe(70);
    expect(proposeQty(100, 40, 20, 10, 25)).toBe(50);
    expect(proposeQty(100, 200, 0, 10, 1)).toBe(0);
    expect(proposeQty(33.4, 0, 0, 0, 1)).toBe(34);
  });

  it("coverage in whole days, none without need", () => {
    expect(coverageDays(50, 70, 7)).toBe(5);
    expect(coverageDays(50, 0, 7)).toBeNull();
  });

  it("workload and shifts in minutes", () => {
    expect(workloadMinutes([day("x", 4, 6, 30)], S)).toBe(6 * 30 + 30 * 15 + 4 * 5);
    expect(shiftMinutes("07:00", "15:30", 30)).toBe(480);
  });

  it("use from counts and deviation from the plan", () => {
    expect(usedFromCounts([{ before: 120, qty: 80 }, { before: 90, qty: 95 }, { before: null, qty: 40 }])).toBe(40);
    expect(deviationPct(110, 100)).toBe(10);
    expect(deviationPct(5, 0)).toBeNull();
  });
});

describe("parsePlanCsv", () => {
  it("reads German reports with ; and dd.mm.yyyy", () => {
    const { rows, errors } = parsePlanCsv("Datum;Zimmertyp;Anreisen;Abreisen;Bleiber\n22.10.2026;Doppelzimmer;4;6;30\n2026-10-23;;1;2;3");
    expect(errors).toEqual([]);
    expect(rows).toEqual([day("2026-10-22", 4, 6, 30, "Doppelzimmer"), day("2026-10-23", 1, 2, 3)]);
  });
  it("names missing columns and bad rows", () => {
    expect(parsePlanCsv("Datum;Anreisen\n1.1.2026;3").errors[0]).toMatch(/Spalten fehlen: Abreisen, Bleiber/);
    const r = parsePlanCsv("date,arrivals,departures,stayovers\n2026-13-01,1,1,1\n2026-10-22,x,1,1\n2026-10-22,1,1,1");
    expect(r.errors).toEqual(["Zeile 2: Datum „2026-13-01“ nicht lesbar.", "Zeile 3: Anreisen, Abreisen und Bleiber müssen ganze Zahlen sein."]);
    expect(r.rows).toHaveLength(1);
    expect(parsePlanCsv("Datum;Anreisen;Abreisen;Bleiber\n31.02.2026;1;1;1").errors).toEqual(["Zeile 2: Datum „31.02.2026“ nicht lesbar."]);
  });
});
