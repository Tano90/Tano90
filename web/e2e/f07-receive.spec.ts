import { expect, reseed, sid, stockQuantity, test } from "./fixtures";

const LINSEN = "Jetzt geliefert: Rote Linsen, Sack 5 kg";
const OEL = "Jetzt geliefert: Olivenöl nativ extra, Karton 6 × 1 l";

test.describe("F07 Ware annehmen", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("staff");
  });

  test("F07-H1 + E1 Teillieferung, Neuladen zeigt Rest, dann vollständig", async ({ page, axe }) => {
    const before = await stockQuantity("Rote Linsen");
    await page.goto(`/orders/${sid("po-2")}`);
    await axe();
    await page.getByLabel(LINSEN).fill("1");
    await page.getByRole("button", { name: "Lieferung erfassen" }).click();
    await expect(page.locator("header").getByText("Teilweise geliefert")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(LINSEN)).toHaveValue("1");
    await expect(page.getByLabel(OEL)).toHaveValue("0");
    await page.getByRole("button", { name: "Lieferung erfassen" }).click();
    await expect(page.locator("header").getByText("Geliefert", { exact: true })).toBeVisible();
    expect((await stockQuantity("Rote Linsen")) - before).toBe(10000);
  });

  test("F07-E2 ohne Lagerbuchung bleibt der Bestand gleich", async ({ page }) => {
    const before = await stockQuantity("Rote Linsen");
    await page.goto(`/orders/${sid("po-2")}`);
    await page.getByRole("checkbox", { name: /Ware ins Lager buchen/ }).uncheck();
    await page.getByRole("button", { name: "Lieferung erfassen" }).click();
    await expect(page.locator("header").getByText("Geliefert", { exact: true })).toBeVisible();
    expect(await stockQuantity("Rote Linsen")).toBe(before);
  });

  test("F07-N1 Überlieferung wird abgelehnt, nichts gebucht", async ({ page }) => {
    const before = await stockQuantity("Rote Linsen");
    await page.goto(`/orders/${sid("po-2")}`);
    await page.getByLabel(LINSEN).fill("5");
    await page.getByRole("button", { name: "Lieferung erfassen" }).click();
    await expect(page.getByText(/offen sind nur 2/)).toBeVisible();
    expect(await stockQuantity("Rote Linsen")).toBe(before);
  });
});
