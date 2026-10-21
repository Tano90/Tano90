import { describe, expect, it } from "vitest";
import { dueState, intervalLabel, nextDue } from "./maintenance";

describe("maintenance", () => {
  it("due state and next due", () => {
    expect(dueState("2026-10-20", "2026-10-21")).toBe("overdue");
    expect(dueState("2026-10-21", "2026-10-21")).toBe("today");
    expect(dueState("2026-10-28", "2026-10-21")).toBe("soon");
    expect(dueState("2026-10-29", "2026-10-21")).toBe("ok");
    expect(nextDue("2026-10-21", 90)).toBe("2027-01-19");
  });
  it("interval in words", () => {
    expect([1, 7, 14, 30, 90, 365, 730, 10].map(intervalLabel)).toEqual(["täglich", "wöchentlich", "alle 2 Wochen", "monatlich", "alle 3 Monate", "jährlich", "alle 2 Jahre", "alle 10 Tage"]);
  });
});
