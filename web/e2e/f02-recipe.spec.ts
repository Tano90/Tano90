import { db, expect, expectNoHorizontalScroll, reseed, sid, test } from "./fixtures";
import type { Page } from "@playwright/test";

const addLine = async (page: Page, item: string, qty: string, unit?: string) => {
  await page.getByRole("button", { name: "Zeile hinzufügen" }).click();
  const row = page.getByRole("listitem").last();
  await row.getByRole("combobox", { name: "Artikel" }).click();
  await page.getByPlaceholder("Suchen …").fill(item);
  await page.getByRole("option", { name: new RegExp(item) }).first().click();
  await row.getByRole("textbox", { name: "Menge" }).fill(qty);
  if (unit) await row.getByLabel("Einheit").selectOption(unit);
};
const summary = (page: Page) => page.getByRole("complementary", { name: "Kalkulation" });

test.describe("F02 Rezept anlegen und kalkulieren", () => {
  test.beforeAll(() => reseed());
  test.beforeEach(async ({ login }) => login("chef"));

  test("F02-H1 Kosten pro Portion und Wareneinsatz", async ({ page, axe }) => {
    await page.goto("/recipes/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Linsensalat");
    await page.getByRole("textbox", { name: "Portionen" }).fill("4");
    await addLine(page, "Rote Linsen", "500");
    await page.getByRole("tab", { name: "Kalkulation" }).click();
    await page.getByLabel("Verkaufspreis pro Portion").fill("6,90");
    await expect(summary(page)).toContainText("0,30 €");
    await expect(summary(page)).toContainText(/Wareneinsatz\s*4,6\s?%/);
    await axe();
    await page.getByRole("button", { name: "Rezept anlegen" }).click();
    await page.waitForURL(/recipes\/(?!new)[^/?]+$/);
    await page.goto("/recipes?q=Linsensalat");
    await expect(page.getByRole("row").filter({ hasText: "Linsensalat" })).toContainText("0,30 €");
  });

  test("F02-E1 Zutat ohne Preis wird markiert", async ({ page }) => {
    await page.goto(`/recipes/${sid("rec-quark")}`);
    await expect(page.getByText("Für „Meersalz fein“ ist kein Preis hinterlegt.")).toBeVisible();
    await expect(summary(page)).toContainText("1 Zeile(n) ohne Preis");
  });

  test("F02-E2 Stück ohne Stückgewicht wird erklärt, nicht mit 0 € gerechnet", async ({ page }) => {
    await page.goto("/recipes/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Karottensticks");
    await addLine(page, "Karotten", "2", "piece");
    await expect(page.getByText("Für „Karotten“ fehlt das Gewicht pro Stück.")).toBeVisible();
    await expect(summary(page)).toContainText("ohne Preis");
  });

  test("F02-E3 Doppelklick legt genau ein Rezept an", async ({ page }) => {
    await page.goto("/recipes/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Doppelt gespeichert");
    await addLine(page, "Zucker", "100");
    await page.getByRole("button", { name: "Rezept anlegen" }).dblclick();
    await page.waitForURL(/recipes\/(?!new)[^/?]+$/);
    const [{ n }] = await db()`select count(*)::int as n from recipes where name = 'Doppelt gespeichert'`;
    expect(n).toBe(1);
  });

  test("F02-E4 nur mit der Tastatur", async ({ page }) => {
    await page.goto("/recipes/new");
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
    await page.keyboard.type("Tastaturrezept");
    const add = page.getByRole("button", { name: "Zeile hinzufügen" });
    for (let i = 0; i < 25 && !(await add.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("combobox", { name: "Artikel" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.type("Linsen");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.type("200");
    await expect(summary(page)).toContainText("0,47 €");
    const save = page.getByRole("button", { name: "Rezept anlegen" });
    for (let i = 0; i < 40 && !(await save.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForURL(/recipes\/(?!new)[^/?]+$/);
  });

  test("F02-E5 Neuladen mit ungespeicherten Änderungen fragt nach", async ({ page }) => {
    await page.goto(`/recipes/${sid("rec-apfelkuchen")}`);
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Apfelkuchen geändert");
    await expect(page.getByText("Ungespeicherte Änderungen")).toBeVisible();
    const dialog = page.waitForEvent("dialog");
    void page.reload().catch(() => {});
    const d = await dialog;
    expect(d.type()).toBe("beforeunload");
    await d.dismiss(); // stay on the page: the change is still there
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Apfelkuchen geändert");
  });

  test("F02-E6 Rezept-Editor bei 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/recipes/${sid("rec-linsensuppe")}`);
    await expect(summary(page)).toContainText("0,63 €");
    await expectNoHorizontalScroll(page);
  });

  test("F02-N1 archiviertes Rezept ist nicht mehr erreichbar", async ({ page }) => {
    await page.goto(`/recipes/${sid("rec-apfelkuchen")}`);
    await page.getByRole("button", { name: "Archivieren" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivieren" }).click();
    await page.waitForURL("/recipes");
    await page.goto(`/recipes/${sid("rec-apfelkuchen")}`);
    await expect(page.getByRole("heading", { name: "Nicht gefunden" })).toBeVisible();
  });

  test("F02-N2 Team-Konto sieht Rezepte nur lesend", async ({ page, login }) => {
    await login("staff");
    await page.goto(`/recipes/${sid("rec-linsensuppe")}`);
    await expect(page.getByText("Du kannst Rezepte ansehen, aber nicht ändern.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Speichern" })).toHaveCount(0);
  });
});

test.describe("F03 Unterrezept", () => {
  test.beforeAll(() => reseed());
  test.beforeEach(async ({ login }) => login("chef"));

  test("F03-H1 eine Portion Gemüsefond kostet so viel wie der ganze Fond", async ({ page }) => {
    await page.goto("/recipes/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Fond-Test");
    await addLine(page, "Gemüsefond", "1", "portion");
    await expect(summary(page)).toContainText("3,72 €");
  });

  test("F03-N1 Zyklus wird verständlich abgelehnt", async ({ page }) => {
    await page.goto("/recipes/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Doppelfond");
    await page.getByLabel("Art").selectOption("semi_finished");
    await addLine(page, "Gemüsefond", "1", "l");
    await page.getByRole("button", { name: "Rezept anlegen" }).click();
    await page.waitForURL(/recipes\/(?!new)[^/?]+$/);
    await page.goto(`/recipes/${sid("rec-fond")}`);
    await addLine(page, "Doppelfond", "1", "l");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText(/Endlosschleife/)).toBeVisible();
    const lines = await db()`select count(*)::int as n from recipe_lines where recipe_id = ${sid("rec-fond")}`;
    expect(lines[0].n).toBe(4);
  });
});

test.describe("F04 Preisänderung", () => {
  test.beforeAll(() => reseed());

  test("F04-H1 doppelter Linsenpreis erhöht die Kosten der Suppe", async ({ page, login }) => {
    await login("chef");
    const cost = async () => {
      await page.goto("/recipes?q=Linsensuppe");
      return page.getByRole("row").filter({ hasText: "Linsensuppe" }).getByRole("cell").nth(2).innerText();
    };
    expect(await cost()).toMatch(/0,63\s€/);
    await page.goto(`/ingredients/${sid("ing-linsen")}?tab=packages`);
    await page.getByRole("button", { name: /Preis von Großhandel Ostring bearbeiten/ }).click();
    await page.getByLabel(/Preis pro Gebinde/).fill("23,60");
    await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("4,72 €/kg")).toBeVisible();
    expect(await cost()).toMatch(/0,81\s€/); // 62,59 ct + 18,88 ct (800 g Linsen at twice the price, per portion)
  });
});
