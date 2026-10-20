// Runs last (file order): deletes the second user's library.
import { db, expect, reseed, test } from "./fixtures";
import { ensureStranger, STRANGER } from "./db";

test.describe("A04 Konto löschen", () => {
  test.beforeAll(async () => {
    reseed();
    await ensureStranger();
  });

  test("A04-N1 Inhaber mit Team muss erst übergeben", async ({ page, login }) => {
    await login("owner");
    await page.goto("/settings/account");
    await page.getByLabel("Zur Bestätigung LÖSCHEN eintippen").fill("LÖSCHEN");
    await page.getByRole("button", { name: "Konto endgültig löschen" }).click();
    await expect(page.getByText(/Übertrage die Inhaberschaft zuerst/)).toBeVisible();
    await expect(page).toHaveURL(/settings\/account/);
  });

  test("A04-H1 Alleinnutzer löscht Konto samt Betrieb", async ({ page, login }) => {
    await login("stranger");
    await page.goto("/settings/account");
    await page.getByLabel("Zur Bestätigung LÖSCHEN eintippen").fill("LÖSCHEN");
    await page.getByRole("button", { name: "Konto endgültig löschen" }).click();
    await expect(page.getByText("Dein Konto wurde gelöscht.")).toBeVisible();
    const libs = await db()`select 1 from libraries where name = 'Fremder Betrieb'`;
    expect(libs).toHaveLength(0);
    const mem = await db()`select 1 from memberships where user_id = ${STRANGER.id}`;
    expect(mem).toHaveLength(0);
    await ensureStranger();
  });
});
