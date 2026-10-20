// Edge and negative cases for the flows added in the second build pass: team, package counts, menus.
import { db, expect, expectNoHorizontalScroll, reseed, sid, stockQuantity, test } from "./fixtures";

test.describe("S25 Team: Randfälle", () => {
  test.beforeEach(() => reseed());

  test("S25-E1 herabgestufte Küchenleitung sieht nur noch ihr Outlet", async ({ page, login }) => {
    await db()`update memberships set role = 'outlet_staff', all_outlets = false where id = ${sid("mem-2")}`;
    await db()`insert into membership_outlets (membership_id, outlet_id) values (${sid("mem-2")}, ${sid("out-zentral")})`;
    await login("chef");
    await page.goto("/stock");
    await expect(page.getByLabel("Outlet")).toHaveValue(sid("out-zentral"));
    await expect(page.getByRole("option", { name: "Küche Mitte" })).toHaveCount(0);
    await expect(page.getByText("Bestand in Zentralküche")).toBeVisible();
    const [{ n }] = await db()`select count(*)::int as n from stock_levels where outlet_id = ${sid("out-mitte")}`;
    expect(n).toBeGreaterThan(0); // data is there, just not visible to Sam
  });

  test("S25-E2 entferntes Mitglied kommt nicht mehr in den Betrieb", async ({ page, login }) => {
    await db()`delete from memberships where id = ${sid("mem-3")}`;
    await login("staff");
    await page.goto("/ingredients");
    await expect(page.getByText("Zwiebeln")).toHaveCount(0);
  });

  test("S25-E3 neue Inhaberin aus dem Team sieht alle Outlets", async ({ page, login }) => {
    await login("owner");
    await page.goto("/settings/team");
    await page.getByRole("button", { name: "Alex Wolf bearbeiten" }).click();
    await page.getByRole("button", { name: "Inhaberschaft übertragen" }).click();
    await page.getByRole("dialog", { name: /zur Inhaberin/ }).getByRole("button", { name: "Übertragen" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: "Alex Wolf" })).toContainText("Inhaber");
    await login("staff");
    await page.goto("/stock");
    await expect(page.getByRole("option", { name: "Zentralküche" })).toHaveCount(1);
    await page.goto("/settings/billing");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/keine Berechtigung|nicht berechtigt/i)).toHaveCount(0);
  });

  test("S25-N3 Team-Konto sieht keine Bearbeiten-Knöpfe", async ({ page, login }) => {
    await login("staff");
    await page.goto("/settings/team");
    await expect(page.getByRole("button", { name: /bearbeiten$/ })).toHaveCount(0);
  });
});

test.describe("S17 Gebinde: Randfälle", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("staff");
  });

  test("S17-E2 Gebinde leeren nimmt den Artikel aus der Zählung", async ({ page }) => {
    const butter = await stockQuantity("Butter");
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await page.getByRole("button", { name: "Butter in Gebinden zählen" }).click();
    await page.getByLabel("Butter: Karton 10 × 250 g").fill("2");
    await expect(page.getByText("Zwischenstand gespeichert")).toBeVisible();
    await page.getByLabel("Butter: Karton 10 × 250 g").fill("");
    await page.getByLabel("Butter: Karton 10 × 250 g").press("Tab");
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByRole("textbox", { name: /^Butter/ }).first()).toHaveValue("");
    await page.getByRole("button", { name: "Inventur abschließen" }).click();
    await expect(page.getByRole("dialog")).toContainText("0 Artikel gezählt");
    await page.getByRole("dialog").getByRole("button", { name: "Abschließen" }).click();
    await page.waitForURL("/stock");
    expect(await stockQuantity("Butter")).toBe(butter);
  });

  test("S17-E3 Gebinde nur mit Tastatur, 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await page.getByRole("button", { name: "Butter in Gebinden zählen" }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.type("1");
    await expect(page.getByLabel("Butter: Stück 250 g")).toHaveValue("1"); // smallest package first
    await expectNoHorizontalScroll(page);
  });

  test("S17-N1 fremdes Gebinde wird abgelehnt", async ({ page }) => {
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await expect(page.getByRole("button", { name: "Butter in Gebinden zählen" })).toBeVisible();
    const [ev] = await db()`select id from stock_events where type = 'count' and status = 'open'`;
    // A package of another ingredient must not count toward butter.
    await expect(db()`insert into stock_count_lines (stock_event_id, ingredient_id, counted_base, breakdown) values (${ev.id}, ${sid("ing-butter")}, 1, '{"packs": 1}')`).rejects.toThrow();
  });
});

test.describe("S07/S08 Menüs: Randfälle", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("S08-E2 Doppelklick legt genau ein Menü an", async ({ page }) => {
    await page.goto("/menus/new");
    await page.getByLabel("Name").fill("Doppelt");
    await page.getByRole("button", { name: "Menü anlegen" }).dblclick();
    await page.waitForURL(/\/menus\/[0-9a-f-]{36}$/);
    const [{ n }] = await db()`select count(*)::int as n from menus where name = 'Doppelt'`;
    expect(n).toBe(1);
  });

  test("S08-E3 langer Name mit Emoji und Akzenten", async ({ page }) => {
    const name = ("Menü Crème brûlée 🍮 ").repeat(6).slice(0, 118).trim();
    await page.goto("/menus/new");
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Menü anlegen" }).click();
    await page.waitForURL(/\/menus\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/menus");
    await expectNoHorizontalScroll(page);
  });

  test("S08-E4 Gültig bis vor gültig ab", async ({ page }) => {
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await page.getByLabel("Gültig ab").fill("2026-12-01");
    await page.getByLabel("Gültig bis").fill("2026-11-01");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "„Gültig bis“ liegt vor „gültig ab“." })).toBeVisible();
  });

  test("S08-E5 Portionen 0 werden abgelehnt", async ({ page }) => {
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await page.getByLabel("Portionen für Gericht 1 in Vorspeise").fill("0");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "größer als 0" })).toBeVisible();
  });

  test("S08-E6 Gang umsortieren bleibt nach dem Speichern", async ({ page }) => {
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await page.getByRole("button", { name: "Dessert nach oben" }).click();
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Menü gespeichert")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Gang 2", { exact: true })).toHaveValue("Dessert");
  });

  test("S08-E7 Neuladen mit ungespeicherten Änderungen fragt nach", async ({ page }) => {
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await page.getByLabel("Name").fill("Geändert");
    await expect(page.getByText("Ungespeicherte Änderungen")).toBeVisible();
    const dialog = page.waitForEvent("dialog");
    void page.reload().catch(() => {});
    const d = await dialog;
    expect(d.type()).toBe("beforeunload");
    await d.dismiss();
    await expect(page.getByLabel("Name")).toHaveValue("Geändert");
  });

  test("S08-N3 fremder Betrieb sieht das Menü nicht", async ({ page, login }) => {
    await login("stranger");
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await expect(page.getByRole("heading", { name: "Nicht gefunden" })).toBeVisible();
    await page.goto("/menus");
    await expect(page.getByText("Mittagsmenü")).toHaveCount(0);
  });

  test("S08-N4 archiviertes Menü ist nicht mehr erreichbar", async ({ page }) => {
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await page.getByRole("button", { name: "Archivieren" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archivieren" }).click();
    await page.waitForURL("/menus");
    await expect(page.getByText("Noch keine Menüs")).toBeVisible();
    await page.goto(`/menus/${sid("menu-mittag")}`);
    await expect(page.getByRole("heading", { name: "Nicht gefunden" })).toBeVisible();
  });

  test("S08-N5 Gäste-Parameter mit Unsinn", async ({ page }) => {
    await page.goto(`/menus/${sid("menu-mittag")}?servings=-5`);
    await expect(page.getByText("für 1 Gast")).toBeVisible();
    await page.goto(`/menus/${sid("menu-mittag")}?servings=abc`);
    await expect(page.getByText("für 1 Gast")).toBeVisible();
  });
});

test.describe("S10 Lieferant archivieren: Randfälle", () => {
  test("S10-N2 Team-Konto kann nicht archivieren", async ({ page, login }) => {
    reseed();
    await login("staff");
    await page.goto(`/suppliers/${sid("sup-gross")}`);
    await expect(page.getByRole("button", { name: "Archivieren" })).toHaveCount(0);
  });
});
