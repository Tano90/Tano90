import { db, expect, outbox, reseed, sid, test } from "./fixtures";

test.describe("F06 Bestellen nach Gewicht", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("staff");
  });

  test("W-H1 Sellerie in kg bestellen: Summe, Entwurf, Mail, Wareneingang", async ({ page, axe }) => {
    await page.goto("/orders/new");
    await page.getByRole("combobox", { name: "Lieferant", exact: true }).selectOption({ label: "Frischehof Lindner" });
    const row = page.getByRole("row").filter({ hasText: "Knollensellerie" });
    await expect(row).toContainText("nach Gewicht");
    await expect(row).toContainText("2,20 €/kg");
    await page.getByLabel("Menge in kg Knollensellerie").fill("2,5");
    await expect(row).toContainText("5,50 €");
    await axe();
    await page.getByRole("button", { name: "Entwurf speichern" }).click();
    await page.waitForURL(/orders\/(?!new)[^/?]+$/);
    const [line] = await db()`select quantity_packs from purchase_order_lines pol join stock_items si on si.id = pol.stock_item_id where si.ingredient_id = ${sid("ing-sellerie")}`;
    expect(Number(line.quantity_packs)).toBe(2.5); // stored in packages of 1 kg
    await page.reload();
    await expect(page.getByLabel("Menge in kg Knollensellerie")).toHaveValue("2,5");
    await page.getByRole("button", { name: "Bestellung senden" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Senden" }).click();
    await expect(page.locator("header").getByText("Bestellt", { exact: true })).toBeVisible();
    const mail = outbox().filter((m) => m.to === "bestellung@frischehof.example").at(-1)!;
    expect(mail.text).toMatch(/- 2,5\skg Knollensellerie \(2,20\s€\/kg netto\)/); // Intl puts a no-break space before units
    await expect(page.getByRole("row").filter({ hasText: "Knollensellerie" })).toContainText("2,5 kg");
  });

  test("W-E1 Vorschlag nach Gewicht statt auf volle Gebinde gerundet", async ({ page }) => {
    const [l] = await db()`select coalesce(sl.quantity_base, 0) as q from outlet_ingredients oi left join stock_levels sl on sl.outlet_id = oi.outlet_id and sl.ingredient_id = oi.ingredient_id where oi.outlet_id = ${sid("out-mitte")} and oi.ingredient_id = ${sid("ing-sellerie")}`;
    const expected = Math.ceil((4000 - Number(l.q)) / 100) * 100; // target 4 kg, rounded up to 100 g
    await page.goto("/orders/new");
    await page.getByRole("combobox", { name: "Lieferant", exact: true }).selectOption({ label: "Frischehof Lindner" });
    await page.getByRole("button", { name: /Vorschlag übernehmen/ }).click();
    await expect(page.getByLabel("Menge in kg Knollensellerie")).toHaveValue(String(expected / 1000).replace(".", ","));
  });
});
