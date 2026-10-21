import { db, expect, expectNoHorizontalScroll, reseed, sid, test } from "./fixtures";

test.describe("Housekeeping", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  const setup = async (page: import("@playwright/test").Page) => {
    await page.goto("/housekeeping");
    await expect(page.getByText("Noch keine Zimmer in diesem Outlet.")).toBeVisible();
    await page.getByLabel("Zimmernummern").fill("101-104");
    await page.getByLabel("Etage (optional)").fill("1");
    await page.getByLabel("Zimmertyp (optional)").fill("Doppelzimmer");
    await page.getByRole("button", { name: "Anlegen" }).click();
    await expect(page.getByText("4 Zimmer angelegt")).toBeVisible();
  };

  test("HK-H1 Hausdame: Zimmer anlegen, Checkliste, gereinigt melden, kontrollieren", async ({ page, axe }) => {
    await setup(page);
    await page.getByLabel("Ein Punkt pro Zeile").fill("Bett beziehen\nBad reinigen");
    await page.getByRole("button", { name: "Checkliste speichern" }).click();
    await expect(page.getByText("Checkliste gespeichert")).toBeVisible();
    await axe();
    await page.getByRole("button", { name: /^101/ }).click();
    const dialog = page.getByRole("dialog", { name: "Zimmer 101" });
    await expect(dialog.getByRole("button", { name: "Als gereinigt melden" })).toBeDisabled();
    await dialog.getByLabel("Bett beziehen").check();
    await dialog.getByLabel("Bad reinigen").check();
    await axe();
    await dialog.getByRole("button", { name: "Als gereinigt melden" }).click();
    await expect(page.getByText("Zimmer 101 gereinigt")).toBeVisible();
    await page.getByRole("button", { name: /^101/ }).click();
    await page.getByRole("dialog", { name: "Zimmer 101" }).getByRole("button", { name: "Kontrolliert, freigeben" }).click();
    await expect(page.getByText("Zimmer 101: kontrolliert")).toBeVisible();
    await expect(page.getByRole("region", { name: "Letzte Änderungen" })).toContainText("Zimmer 101: gereinigt → kontrolliert");
  });

  test("HK-H2 Reinigungskraft sieht nur ihre Zimmer und kann nicht freigeben", async ({ page, login }) => {
    await setup(page);
    await page.getByLabel("Zimmer 102 auswählen").check();
    await page.getByLabel("Zimmer 103 auswählen").check();
    await page.getByLabel("Zuteilen an").selectOption({ label: "Alex Wolf" });
    await page.getByRole("button", { name: "Zuteilen", exact: true }).click();
    await expect(page.getByText("2 Zimmer zugeteilt")).toBeVisible();
    await login("staff");
    await page.goto("/housekeeping");
    await expect(page.getByLabel("Nur meine Zimmer")).toBeChecked();
    await expect(page.getByRole("button", { name: /^10\d/ })).toHaveCount(2);
    await expect(page.getByLabel("Zimmernummern")).toHaveCount(0);
    await page.getByRole("button", { name: /^102/ }).click();
    const dialog = page.getByRole("dialog", { name: "Zimmer 102" });
    await dialog.getByRole("button", { name: "Als gereinigt melden" }).click();
    await expect(page.getByText("Zimmer 102 gereinigt")).toBeVisible();
    await page.getByRole("button", { name: /^102/ }).click();
    await expect(page.getByRole("dialog", { name: "Zimmer 102" }).getByRole("button", { name: "Kontrolliert, freigeben" })).toHaveCount(0);
  });

  test("HK-E1 Tagesbeginn: belegte Zimmer werden schmutzig, gesperrte bleiben gesperrt; 390 px", async ({ page }) => {
    await setup(page);
    await db()`update rooms set status = 'inspected', occupancy = 'occupied' where outlet_id = ${sid("out-mitte")} and number in ('101', '102')`;
    await db()`update rooms set status = 'out_of_order', occupancy = 'occupied' where outlet_id = ${sid("out-mitte")} and number = '103'`;
    await page.reload();
    await page.getByRole("button", { name: "Tagesbeginn" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Tag beginnen" }).click();
    await expect(page.getByText("2 Zimmer auf schmutzig")).toBeVisible();
    const rows = await db()`select number, status from rooms where outlet_id = ${sid("out-mitte")} order by number`;
    expect(rows.map((r) => `${r.number}:${r.status}`)).toEqual(["101:dirty", "102:dirty", "103:out_of_order", "104:dirty"]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalScroll(page);
  });

  test("HK-N1 eingabe: falscher Bereich wird erklärt", async ({ page }) => {
    await page.goto("/housekeeping");
    await page.getByLabel("Zimmernummern").fill("120-101");
    await page.getByRole("button", { name: "Anlegen" }).click();
    await expect(page.getByText("„120-101“: Der Bereich muss aufsteigen.")).toBeVisible();
  });
});
