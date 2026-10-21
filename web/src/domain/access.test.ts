import { describe, expect, it } from "vitest";
import { accessOf } from "./access";

const now = new Date("2026-10-21T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

describe("accessOf", () => {
  it("trial counts whole days left, at least one", () => {
    expect(accessOf({ plan: "trial", trialEndsAt: inDays(14) }, now)).toEqual({ kind: "trial", daysLeft: 14, readOnly: false });
    expect(accessOf({ plan: "trial", trialEndsAt: inDays(0.2) }, now)).toMatchObject({ kind: "trial", daysLeft: 1 });
  });
  it("trial over is read-only, to the second", () => {
    expect(accessOf({ plan: "trial", trialEndsAt: inDays(0) }, now)).toEqual({ kind: "trial_over", readOnly: true });
    expect(accessOf({ plan: "trial", trialEndsAt: inDays(-30) }, now).readOnly).toBe(true);
  });
  it("paying, late paying and cancelled", () => {
    expect(accessOf({ plan: "active", trialEndsAt: inDays(-30) }, now).readOnly).toBe(false);
    expect(accessOf({ plan: "past_due", trialEndsAt: inDays(-30) }, now).readOnly).toBe(false);
    expect(accessOf({ plan: "cancelled", trialEndsAt: null }, now)).toEqual({ kind: "cancelled", readOnly: true });
  });
});
