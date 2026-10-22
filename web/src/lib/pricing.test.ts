import { describe, expect, it } from "vitest";
import { formatEur, INDIVIDUAL, monthlyPrice, parseUsers, PLANS } from "./pricing";

describe("published plan prices", () => {
  it("are the amounts the operator set", () => {
    expect(PLANS.map((p) => [p.id, p.baseMonthly, p.perUserMonthly])).toEqual([
      ["standard", 8900, 299],
      ["premium", 10999, 299],
    ]);
    expect(INDIVIDUAL.serviceMonthly).toBe(2999);
  });

  it("5 users: Standard 89,00 + 14,95 = 103,95 €; Premium 109,99 + 14,95 = 124,94 €", () => {
    const eur = (c: number) => formatEur(c).replace(/\s/g, " "); // Intl puts a no-break space before €
    const s = monthlyPrice("standard", 5);
    const p = monthlyPrice("premium", 5);
    expect([eur(s.base), eur(s.userFee), eur(s.total)]).toEqual(["89,00 €", "14,95 €", "103,95 €"]);
    expect([eur(p.base), eur(p.userFee), eur(p.total)]).toEqual(["109,99 €", "14,95 €", "124,94 €"]);
    expect(p.total - s.total).toBe(2099); // the Premium difference is the base price only
  });

  it("accepts only whole user counts from 1 to 500", () => {
    expect(parseUsers("5")).toBe(5);
    expect(parseUsers(" 12 ")).toBe(12);
    for (const bad of ["", "0", "-1", "2,5", "abc", "501"]) expect(parseUsers(bad), bad).toBeNull();
  });
});
