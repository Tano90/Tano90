import { expect, reseed, sid, test } from "./fixtures";

const SCREENS: [string, string][] = [
  ["S02", "/app"], ["S03", "/ingredients"], ["S04", `/ingredients/${sid("ing-olivenoel")}?tab=packages`], ["S05", "/recipes"],
  ["S06", `/recipes/${sid("rec-linsensuppe")}`], ["S07", "/menus"], ["S09", `/recipes/${sid("rec-linsensuppe")}/label`], ["S08", `/menus/${sid("menu-mittag")}`], ["S10", "/suppliers"], ["S11", `/suppliers/${sid("sup-frische")}`],
  ["S12", "/orders"], ["S13", "/orders/new"], ["S14", `/orders/${sid("po-2")}`], ["S15", `/orders/${sid("po-1")}/invoice`], ["S16", "/stock"], ["S17", "/stock/count"], ["S18", "/stock/transfer"], ["S20", "/stock/report"], ["S21", "/analytics/pos"], ["S22", "/analytics/menu-engineering"], ["S23", "/production"], ["S26", "/imports"], ["HK", "/housekeeping"], ["FC", "/analytics/controlling"], ["RE", "/invoices"], ["DV", "/settings/datev"], ["HKD", "/housekeeping/dashboard"], ["HKW", "/housekeeping/waesche"], ["HKB", "/housekeeping/belegung"], ["HKP", "/housekeeping/dienstplan"], ["HKM", "/housekeeping/meldungen"], ["S27", "/haccp"],
  ["S19", "/stock/waste"], ["S24", "/settings"], ["S25", "/settings/team"], ["S24b", "/settings/billing"], ["S24c", "/settings/account"],
];

test.describe("X-A11Y jeder gebaute Screen", () => {
  test.beforeAll(() => reseed());
  for (const [id, path] of SCREENS) {
    test(`X-A11Y ${id} ${path.split("?")[0]}`, async ({ page, login, axe }) => {
      await login("owner");
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await axe();
    });
  }
});
