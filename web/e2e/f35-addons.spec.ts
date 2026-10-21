import { db, expect, reseed, sid, test } from "./fixtures";

const setLib = (sql: string) => db().unsafe(`update libraries set ${sql} where id = '${sid("lib-demo")}'`);

test.describe("Add-ons: Housekeeping und F&B-Controlling", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("AO-H1 Testphase: beide offen, mit Hinweis auf den Preis", async ({ page, axe }) => {
    await page.goto("/housekeeping");
    await expect(page.getByText(/Housekeeping ist ein Add-on und in der Testphase enthalten/)).toBeVisible();
    await page.goto("/analytics/controlling");
    await expect(page.getByText(/F&B-Controlling ist ein Add-on und in der Testphase enthalten/)).toBeVisible();
    await page.goto("/settings/billing");
    const addons = page.getByRole("region", { name: "Add-ons" });
    await expect(addons.getByText("In der Testphase enthalten")).toHaveCount(2);
    await expect(addons.getByRole("checkbox", { name: "Beim Abschluss mitbuchen" })).toHaveCount(2);
    await axe();
  });

  test("AO-N1 bezahlt ohne Add-on: Seite gesperrt mit Weg zum Buchen, Daten bleiben", async ({ page, axe }) => {
    await db()`insert into rooms (library_id, outlet_id, number) values (${sid("lib-demo")}, ${sid("out-mitte")}, '701')`;
    await setLib("plan = 'active', trial_ends_at = now() - interval '1 day', addons = '{}'");
    await page.goto("/housekeeping");
    await expect(page.getByRole("heading", { name: "Housekeeping ist ein Add-on" })).toBeVisible();
    await expect(page.getByText("701")).toHaveCount(0);
    await axe();
    await page.getByRole("link", { name: "Add-on buchen" }).click();
    await expect(page).toHaveURL(/\/settings\/billing#addons$/);
    await page.goto("/analytics/controlling");
    await expect(page.getByRole("heading", { name: "F&B-Controlling ist ein Add-on" })).toBeVisible();
    expect(await db()`select 1 from rooms where number = '701'`).toHaveLength(1);
  });

  test("AO-N2 Aktion auf offener Seite nach Ablauf wird abgelehnt", async ({ page }) => {
    await page.goto("/housekeeping");
    await setLib("plan = 'active', trial_ends_at = now() - interval '1 day', addons = '{}'");
    await page.getByLabel("Zimmernummern").fill("801");
    await page.getByRole("button", { name: "Anlegen" }).click();
    await expect(page.getByText(/Housekeeping ist ein Add-on\. Die Inhaberin oder der Inhaber kann es/)).toBeVisible();
    expect(await db()`select 1 from rooms where number = '801'`).toHaveLength(0);
  });

  test("AO-H2 gebucht: Housekeeping offen ohne Hinweis, Controlling weiter gesperrt", async ({ page }) => {
    await setLib("plan = 'active', trial_ends_at = now() - interval '1 day', addons = '{housekeeping}'");
    await page.goto("/housekeeping");
    await expect(page.getByLabel("Zimmernummern")).toBeVisible();
    await expect(page.getByText(/in der Testphase enthalten/)).toHaveCount(0);
    await page.goto("/analytics/controlling");
    await expect(page.getByRole("heading", { name: "F&B-Controlling ist ein Add-on" })).toBeVisible();
    await page.goto("/settings/billing");
    await expect(page.getByRole("region", { name: "Add-ons" }).getByText("Gebucht", { exact: true })).toHaveCount(1);
  });
});
