import { db, expect, reseed, sid, test } from "./fixtures";

// The outlets are in Europe/Berlin; the server runs in UTC. Just after midnight in Berlin it is still
// the previous day in UTC, and every date must still show the Berlin day.
test.describe("X-TZ Zeitzonen", () => {
  test.beforeAll(() => reseed());
  test.beforeEach(async ({ login }) => login("owner"));

  test("X-TZ1 Bestelldatum um 00:30 Berliner Zeit", async ({ page }) => {
    await db()`update purchase_orders set ordered_at = '2026-10-20T22:30:00Z' where id = ${sid("po-1")}`; // 21.10. 00:30 in Berlin
    await page.goto(`/orders/${sid("po-1")}`);
    await expect(page.getByRole("definition").first()).toHaveText("21.10.2026");
  });

  // The midnight case itself is covered by src/lib/dates.test.ts (the server clock cannot be faked here).
  test("X-TZ2 frühester Liefertermin ist der heutige Berliner Tag", async ({ page }) => {
    const berlin = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(d);
    await page.goto("/orders/new");
    await page.getByRole("combobox", { name: "Lieferant", exact: true }).selectOption({ label: "Molkerei Talblick" });
    const date = page.getByLabel("Gewünschter Liefertermin");
    await expect(date).toHaveAttribute("min", berlin(new Date()));
  });
});
