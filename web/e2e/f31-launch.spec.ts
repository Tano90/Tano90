import { db, expect, reseed, sid, test } from "./fixtures";

const setTrial = (sql: string) => db().unsafe(`update libraries set ${sql} where id = '${sid("lib-demo")}'`);

test.describe("Start: Testphase, Outlets archivieren, Export", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("T-H1 drei Tage vor Ende: Hinweis mit Weg zum Abo", async ({ page, axe }) => {
    await setTrial("trial_ends_at = now() + interval '47 hours'");
    await page.goto("/app");
    await expect(page.getByText("Die Testphase endet in 2 Tagen.")).toBeVisible();
    await axe();
    await page.getByRole("link", { name: "Abo abschließen" }).click();
    await expect(page).toHaveURL(/\/settings\/billing$/);
  });

  test("T-N1 nach der Testphase: lesen, rechnen und exportieren ja, ändern nein", async ({ page }) => {
    await setTrial("trial_ends_at = now() - interval '1 hour'");
    await page.goto("/ingredients/new");
    await expect(page.getByRole("alert").filter({ hasText: "Die Testphase ist vorbei." })).toBeVisible();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Nach der Testphase");
    await page.getByRole("button", { name: /Anlegen und weiter/ }).click();
    await expect(page.getByText(/ändern geht wieder mit einem Abo/).nth(1)).toBeVisible();
    expect(await db()`select 1 from ingredients where name = 'Nach der Testphase'`).toHaveLength(0);
    await page.goto(`/recipes/${sid("rec-linsensuppe")}`);
    await expect(page.getByRole("complementary", { name: "Kalkulation" })).toContainText("0,63 €"); // live costing still works
    await page.goto("/settings/billing");
    await expect(page.getByText("Testphase vorbei")).toBeVisible();
    const res = await page.request.get("/api/export");
    expect(res.status()).toBe(200);
  });

  test("O-H1 Outlet archivieren: verschwindet aus Liste und Auswahl; mit offener Arbeit abgelehnt", async ({ page }) => {
    await page.goto("/settings/team");
    await page.getByRole("button", { name: "Zentralküche archivieren" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivieren" }).click();
    await expect(page.getByRole("dialog")).toContainText("2 Anforderungen der Zentralküche sind noch offen.");
    await page.getByRole("dialog").getByRole("button", { name: "Abbrechen" }).click();
    await page.getByRole("button", { name: /Outlet/ }).first().click();
    await page.getByRole("dialog").getByLabel("Name").fill("Pop-up Sommer");
    await page.getByRole("dialog").getByRole("button", { name: "Anlegen" }).click();
    await expect(page.getByText("Outlet angelegt")).toBeVisible();
    await page.getByRole("button", { name: "Pop-up Sommer archivieren" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivieren" }).click();
    await expect(page.getByText("Pop-up Sommer archiviert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Outlets (2)" })).toBeVisible();
    await expect(page.getByLabel("Outlet").locator("option", { hasText: "Pop-up Sommer" })).toHaveCount(0);
  });

  test("E-H1 Export: eine JSON-Datei mit allem, ohne Geheimnisse; Team-Konto darf nicht", async ({ page, login }) => {
    await page.goto("/settings");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Alle Daten herunterladen" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^glb-export-\d{4}-\d{2}-\d{2}\.json$/);
    const json = JSON.parse((await (await file.createReadStream()).toArray()).join(""));
    expect(json.data.recipes.map((r: { name: string }) => r.name)).toContain("Linsensuppe mit Kreuzkümmel");
    expect(JSON.stringify(json)).not.toMatch(/keyHash|tokenHash|stripeCustomerId/);
    await login("staff");
    expect((await page.request.get("/api/export")).status()).toBe(403);
  });
});
