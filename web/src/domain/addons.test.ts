import { describe, expect, it } from "vitest";
import { accessOf } from "./access";
import { addonOpen } from "./addons";

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

describe("addonOpen", () => {
  it("is open for everything during the trial", () => {
    expect(addonOpen(accessOf({ plan: "trial", trialEndsAt: future }), [], "housekeeping")).toBe(true);
  });
  it("needs a booking once the trial is over or paid", () => {
    expect(addonOpen(accessOf({ plan: "trial", trialEndsAt: past }), [], "controlling")).toBe(false);
    expect(addonOpen(accessOf({ plan: "active", trialEndsAt: past }), [], "controlling")).toBe(false);
    expect(addonOpen(accessOf({ plan: "active", trialEndsAt: past }), ["controlling"], "controlling")).toBe(true);
    expect(addonOpen(accessOf({ plan: "active", trialEndsAt: past }), ["controlling"], "housekeeping")).toBe(false);
    expect(addonOpen(accessOf({ plan: "past_due", trialEndsAt: past }), ["housekeeping"], "housekeeping")).toBe(true);
  });
});
