import { db, expect, expectNoHorizontalScroll, reseed, sid, stockQuantity, test } from "./fixtures";

test.describe("F10 Umbuchung", () => {
  test.beforeEach(() => reseed());

  test("F10-H1 Ware wandert mit Wert ins Ziel-Outlet", async ({ page, login, axe }) => {
    await login("owner");
    const [mitte, zentral] = [await stockQuantity("Butter"), await stockQuantity("Butter", "out-zentral")];
    const [{ avg }] = await db()`select avg_cost_cents as avg from stock_levels where outlet_id = ${sid("out-mitte")} and ingredient_id = ${sid("ing-butter")}`;
    await page.goto("/stock/transfer");
    await axe();
    await page.getByLabel("Ziel-Outlet").selectOption({ label: "Zentralküche" });
    await page.getByRole("combobox", { name: "Zutat" }).click();
    await page.getByRole("option", { name: /^Butter/ }).click();
    await page.getByRole("textbox", { name: "Menge" }).fill("1,5");
    await page.getByRole("button", { name: "Umbuchen" }).click();
    await expect(page.getByText("Umgebucht", { exact: true })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "An Zentralküche" })).toContainText("1,5 kg Butter");
    expect(await stockQuantity("Butter")).toBe(mitte - 1500);
    expect(await stockQuantity("Butter", "out-zentral")).toBe(zentral + 1500);
    const [{ zavg }] = await db()`select avg_cost_cents as zavg from stock_levels where outlet_id = ${sid("out-zentral")} and ingredient_id = ${sid("ing-butter")}`;
    expect(Number(zavg)).toBeCloseTo(Number(avg), 6); // empty receiver: takes the sender's average
  });

  test("F10-E1 Empfänger sieht die eingegangene Umbuchung und im Bericht", async ({ page, login }) => {
    await login("owner");
    await page.goto("/stock/transfer");
    await page.getByLabel("Ziel-Outlet").selectOption({ label: "Zentralküche" });
    await page.getByRole("combobox", { name: "Zutat" }).click();
    await page.getByRole("option", { name: /^Zucker/ }).click();
    await page.getByRole("textbox", { name: "Menge" }).fill("2");
    await page.getByRole("button", { name: "Umbuchen" }).click();
    await expect(page.getByText("Umgebucht", { exact: true })).toBeVisible();
    // Staff assigned only to the central kitchen.
    await db()`update membership_outlets set outlet_id = ${sid("out-zentral")} where membership_id = ${sid("mem-3")}`;
    await login("staff");
    await page.goto("/stock/transfer");
    await expect(page.getByText(/kein anderes Outlet/)).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Von Küche Mitte" })).toContainText("2 kg Zucker");
    await page.goto("/stock/report");
    await expect(page.getByRole("row").filter({ hasText: "Zucker" })).toContainText("+2 kg");
  });

  test("F10-N1 ohne Ziel und ohne Menge", async ({ page, login }) => {
    await login("owner");
    await page.goto("/stock/transfer");
    await expect(page.getByLabel("Ziel-Outlet")).toHaveValue(sid("out-zentral")); // the only other outlet is preselected
    await page.getByRole("button", { name: "Umbuchen" }).click();
    await expect(page.getByText("Mindestens eine Position angeben.")).toBeVisible();
    await page.getByRole("combobox", { name: "Zutat" }).click();
    await page.getByRole("option", { name: /^Zucker/ }).click();
    await page.getByRole("button", { name: "Umbuchen" }).click();
    await expect(page.getByText("Die Menge muss größer als 0 sein.")).toBeVisible();
    const [{ n }] = await db()`select count(*)::int as n from stock_events where type = 'transfer'`;
    expect(n).toBe(0);
  });

  test("F10-E2 mehr als im Bestand wird angezeigt, 390 px", async ({ page, login }) => {
    await login("owner");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/stock/transfer");
    await page.getByRole("combobox", { name: "Zutat" }).click();
    await page.getByRole("option", { name: /^Zucker/ }).click();
    await page.getByRole("textbox", { name: "Menge" }).fill("999");
    await expect(page.getByText(/Mehr als im Bestand/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("S20 Lagerbericht", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("S20-H1 Bewegungen der letzten 7 Tage, Summen, CSV", async ({ page, axe }) => {
    await page.goto("/stock/report");
    await page.getByRole("button", { name: "Letzte 7 Tage" }).click();
    await page.waitForURL(/from=/);
    await expect(page.getByRole("button", { name: "Letzte 7 Tage" })).toHaveAttribute("aria-pressed", "true");
    // Seed: opening stock 10 days ago, a delivery 2 days ago (onions among it), waste yesterday.
    const onions = page.getByRole("row").filter({ hasText: "Zwiebeln" });
    await expect(onions.getByRole("cell").nth(2)).toHaveText(/^\+/);
    await expect(page.getByRole("region", { name: "Summen" }).or(page.getByLabel("Summen"))).toContainText("Schwund");
    await axe();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Als CSV exportieren" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^lagerbericht-kueche-mitte-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = (await (await file.createReadStream()).toArray()).join("");
    expect(text).toContain("Zutat;Kategorie;Einheit;Anfang;Eingang");
    expect(text).toMatch(/Zwiebeln;Gemüse;g;/);
  });

  test("S20-E1 Zeitraum ohne Bewegungen, vertauschte Daten", async ({ page }) => {
    await page.goto("/stock/report?from=2020-01-31&to=2020-01-01");
    await expect(page.getByText(/01\.01\.2020 bis 31\.01\.2020/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Summen" })).not.toContainText("-0,00");
    await expect(page.getByText("Keine Bewegungen")).toBeVisible();
    await expect(page.getByRole("button", { name: "Als CSV exportieren" })).toBeDisabled();
  });

  test("S20-E2 Unsinn in der URL und 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/stock/report?from=gestern&to=2026-99-99");
    await expect(page.getByRole("heading", { name: "Lagerbericht", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
