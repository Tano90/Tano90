import { db, expect, reseed, sid, test } from "./fixtures";
import type { Page } from "@playwright/test";

const edit = async (page: Page, name: string) => {
  await page.goto("/settings/team");
  await page.getByRole("button", { name: `${name} bearbeiten` }).click();
  return page.getByRole("dialog", { name });
};

test.describe("S25 Team verwalten", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("S25-H1 Rolle und Outlets ändern", async ({ page, axe }) => {
    const d = await edit(page, "Sam Berger");
    await axe();
    await d.getByLabel("Rolle").selectOption("outlet_staff");
    await d.getByRole("checkbox", { name: "Zentralküche" }).check();
    await d.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Änderungen gespeichert")).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "Sam Berger" });
    await expect(row).toContainText("Team");
    await expect(row).toContainText("Zentralküche");
    const [m] = await db()`select role from memberships where id = ${sid("mem-2")}`;
    expect(m.role).toBe("outlet_staff");
  });

  test("S25-H2 Mitglied entfernen", async ({ page }) => {
    const d = await edit(page, "Alex Wolf");
    await d.getByRole("button", { name: "Entfernen" }).click();
    await page.getByRole("alertdialog").or(page.getByRole("dialog", { name: /entfernen\?/ })).getByRole("button", { name: "Entfernen" }).click();
    await expect(page.getByText("Teammitglied entfernt")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Alex Wolf" })).toHaveCount(0);
  });

  test("S25-H3 Inhaberschaft übertragen: neue Inhaberin, ich werde Admin", async ({ page }) => {
    const d = await edit(page, "Sam Berger");
    await d.getByRole("button", { name: "Inhaberschaft übertragen" }).click();
    await page.getByRole("dialog", { name: /zur Inhaberin oder zum Inhaber/ }).getByRole("button", { name: "Übertragen" }).click();
    await expect(page.getByText("Inhaberschaft übertragen")).toBeVisible();
    const rows = await db()`select display_name, role from memberships where library_id = ${sid("lib-demo")} order by display_name`;
    expect(rows.map((r) => `${r.display_name}:${r.role}`)).toEqual(["Alex Wolf:outlet_staff", "Demo Nutzer:admin", "Sam Berger:owner"]);
  });

  test("S25-N1 Admin kann den Inhaber nicht ändern", async ({ page, login }) => {
    await db()`update memberships set role = 'admin' where id = ${sid("mem-2")}`;
    await login("chef"); // Sam Berger, now admin
    await page.goto("/settings/team");
    await expect(page.getByRole("button", { name: "Demo Nutzer bearbeiten" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Alex Wolf bearbeiten" })).toBeVisible();
  });

  test("S25-N2 Team ohne Outlet wird abgelehnt", async ({ page }) => {
    const d = await edit(page, "Alex Wolf");
    await d.getByRole("checkbox", { name: "Küche Mitte" }).uncheck();
    await d.getByRole("button", { name: "Speichern" }).click();
    await expect(d.getByText("Bitte mindestens ein Outlet wählen.")).toBeVisible();
  });
});
