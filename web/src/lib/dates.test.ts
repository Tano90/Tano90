import { describe, expect, it } from "vitest";
import { dayIn, formatDate, formatDateTime, formatDay } from "./dates";

// 2026-10-20 22:30 UTC is already 21.10. 00:30 in Berlin (BUG-002, BUG-003).
const lateUtc = "2026-10-20T22:30:00.000Z";

describe("dates in the outlet's time zone", () => {
  it("formats a timestamp as the Berlin day, not the server's UTC day", () => {
    expect(formatDate(lateUtc)).toBe("21.10.2026");
    expect(formatDateTime(lateUtc)).toBe("21.10.2026, 00:30");
  });
  it("leaves date-only values alone in any zone", () => {
    expect(formatDay("2026-10-21")).toBe("21.10.2026");
    expect(formatDay("2026-10-21", "full")).toBe("Mittwoch, 21. Oktober 2026");
  });
  it("knows today and tomorrow in Berlin", () => {
    expect(dayIn("Europe/Berlin", new Date(lateUtc))).toBe("2026-10-21");
    expect(dayIn("Europe/Berlin", new Date(lateUtc), 1)).toBe("2026-10-22");
  });
  it("handles the switch to winter time", () => {
    // 25.10.2026 is the last Sunday of October: 02:59 CEST is followed by 02:00 CET
    expect(dayIn("Europe/Berlin", new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25");
    expect(dayIn("Europe/Berlin", new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-25"); // 23:30 CET
    expect(dayIn("Europe/Berlin", new Date("2026-10-24T22:30:00Z"), 1)).toBe("2026-10-26");
  });
});
