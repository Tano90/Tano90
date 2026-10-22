import { expect, test, type Page } from "./fixtures";

// The purchasing chain in the GLB AI Suite demo: forecast → draft → ordered → goods receipt → movements → stock
// → updated forecast. Nothing is sent to a supplier: "bestellt" only records that it was ordered elsewhere.
async function open(page: Page, view: string) {
  await page.evaluate((v) => (document.querySelector(`#sidebar .glb08-nav-link[data-view="${v}"]`) as HTMLElement).click(), view);
}
const euroValue = (t: string) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
const forecastRow = (page: Page, name: string) => page.locator("table.data-table tr", { has: page.locator("strong", { hasText: new RegExp(`^${name}$`) }) }).first();

test("SF-1 Forecast → Entwurf → bestellt → Wareneingang → Bestand → Forecast", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.accept();
  });
  await page.goto("/suite");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await open(page, "purchasing");

  // Coffee beans are in no recipe: not "covered", but not determinable, and they do not block the rest.
  await expect(forecastRow(page, "Kaffeebohnen")).toContainText("Verbrauch nicht ermittelbar: in keinem Rezept verwendet");
  await expect(page.locator(".v4-forecast-note")).toContainText("Datenbasis (letzte 28 Tage");
  await expect(page.locator(".v4-footnote")).toContainText("Wareneingänge");
  await expect(page.locator(".v4-footnote")).not.toContainText("berücksichtigt keine Wareneingänge");

  const value = euroValue(await page.locator(".v4-grid3 > *").nth(1).locator("b, strong").first().innerText());
  expect(value).toBe(641.2);
  const patty = forecastRow(page, "Rindfleisch Burger Patty");
  const packs = Number(await patty.locator("td").nth(4).innerText());
  const stockBefore = await patty.locator("td").nth(2).innerText(); // "22 stk"
  expect(packs).toBe(4);

  await page.locator('[data-v5="order-from-forecast"]').click();
  await expect(page.locator("#main")).toContainText("Entwurf");
  const orderCard = page.locator(".v5-order").first();
  await expect(orderCard).toContainText("641,20");

  // a second draft for the same need asks first (declined here)
  page.removeAllListeners("dialog");
  page.once("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await open(page, "purchasing");
  await page.locator('[data-v5="order-from-forecast"]').click();
  expect(dialogs.at(-1)).toMatch(/schon einen offenen Entwurf/);
  await expect(page.locator(".v5-order")).toHaveCount(1);
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.accept();
  });

  await orderCard.getByRole("button", { name: /bestellt/i }).click();
  expect(dialogs.at(-1)).toMatch(/Die Software versendet nichts/);
  await expect(orderCard).toContainText(/Bestellt/i);

  // while ordered, the forecast counts the order and does not suggest the same packs again
  await open(page, "purchasing");
  await expect(forecastRow(page, "Rindfleisch Burger Patty")).toContainText("4 Gebinde");
  await expect(forecastRow(page, "Rindfleisch Burger Patty")).toContainText("Durch offene Bestellung gedeckt");

  await open(page, "orders");
  await page.locator(".v5-order").first().getByRole("button", { name: /Wareneingang/i }).click();
  await expect(page.locator(".v5-order").first()).toContainText(/Eingebucht/i);
  // a second receipt is refused
  const receiveAgain = page.locator(".v5-order").first().getByRole("button", { name: /Wareneingang/i });
  expect(await receiveAgain.count()).toBe(0);

  await open(page, "stockledger");
  await expect(page.locator("#main")).toContainText("Wareneingang Bestellung");

  await open(page, "purchasing");
  const after = forecastRow(page, "Rindfleisch Burger Patty");
  await expect(after.locator("td").nth(2)).not.toHaveText(stockBefore);
  // 22 + 4 × 20 = 102 stk
  await expect(after.locator("td").nth(2)).toHaveText("102 Stk."); // forecast shows whole pieces as "Stk." (Oct 2026)
  expect(euroValue(await page.locator(".v4-grid3 > *").nth(1).locator("b, strong").first().innerText())).toBe(0);
});
