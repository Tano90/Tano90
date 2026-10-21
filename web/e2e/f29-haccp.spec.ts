import { db, expect, expectNoHorizontalScroll, reseed, sid, test } from "./fixtures";

test.describe("S27 HACCP", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("staff");
  });

  test("H-H1 Tageskontrolle im Soll eintragen", async ({ page, axe }) => {
    await page.goto("/haccp");
    const list = page.getByRole("region", { name: "Tägliche Kontrollen" });
    await expect(list).toContainText("0 von 3 erledigt");
    await list.getByLabel(/^Kühlraum/).fill("3.5");
    await expect(list.getByLabel(/^Kühlraum/)).toHaveValue("3,5");
    await expect(list).toContainText("im Soll");
    await list.getByLabel(/^Tiefkühler/).fill("-19");
    await list.getByRole("radio", { name: "in Ordnung", exact: true }).check();
    await axe();
    await list.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("3 Einträge gespeichert")).toBeVisible();
    await expect(list).toContainText("3 von 3 erledigt");
    await expect(list).toContainText(/Eingetragen .* von Alex Wolf/);
  });

  test("H-E1 Abweichung nur mit Maßnahme, erscheint im Protokoll und in der CSV", async ({ page }) => {
    await page.goto("/haccp");
    const list = page.getByRole("region", { name: "Tägliche Kontrollen" });
    await list.getByLabel(/^Kühlraum/).fill("7");
    await expect(list).toContainText("Über 4 °C.");
    await list.getByRole("button", { name: "Speichern" }).click();
    await expect(list.getByText(/Bitte die Korrekturmaßnahme eintragen/)).toBeVisible();
    await list.getByLabel("Korrekturmaßnahme für „Kühlraum“").fill("=Tür geschlossen, Ware umgelagert");
    await list.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("1 Eintrag gespeichert")).toBeVisible();
    const audit = page.getByRole("region", { name: "Abweichungen der letzten 30 Tage" });
    await expect(audit).toContainText("Kühlraum (Tägliche Kontrollen): 7 °C");
    await expect(audit).toContainText("Tür stand offen"); // the seed's deviation from two days ago
    const download = page.waitForEvent("download");
    await audit.getByRole("button", { name: "Als CSV exportieren" }).click();
    const text = (await (await (await download).createReadStream()).toArray()).join("");
    expect(text).toContain(";'=Tür geschlossen, Ware umgelagert;"); // a leading = never runs as a formula
  });

  test("H-E2 Vortag nachtragen, kein künftiger Tag, 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/haccp");
    await page.getByRole("link", { name: "← Vortag" }).click();
    await expect(page.getByRole("region", { name: "Tägliche Kontrollen" })).toContainText("3 von 3 erledigt"); // seed filled yesterday
    await expectNoHorizontalScroll(page);
    await page.goto("/haccp?day=2099-01-01");
    await expect(page.getByRole("link", { name: "Heute" })).toHaveCount(0); // falls back to today
  });

  test("H-H2 Checkliste anlegen und bearbeiten (Küchenleitung)", async ({ page, login }) => {
    await login("chef");
    await page.goto("/haccp");
    await page.getByRole("button", { name: "Neue Checkliste" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Name").fill("Warenannahme");
    await d.getByLabel("Kontrollpunkt 1", { exact: true }).fill("Kühlware bei Anlieferung");
    await d.getByLabel("Art").selectOption("temperature");
    await d.getByLabel("bis °C").fill("7");
    await d.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Checkliste gespeichert")).toBeVisible();
    const list = page.getByRole("region", { name: "Warenannahme" });
    await expect(list).toContainText("Soll höchstens 7 °C");
  });

  test("H-N1 Kontrollpunkt mit Einträgen lässt sich nicht löschen; Team-Konto verwaltet nicht", async ({ page, login }) => {
    await page.goto("/haccp");
    await expect(page.getByRole("region", { name: "Tägliche Kontrollen" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Checklisten verwalten" })).toHaveCount(0);
    await login("owner");
    await page.goto("/haccp");
    await page.getByRole("button", { name: "Tägliche Kontrollen bearbeiten" }).click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Kontrollpunkt 1 entfernen" }).click();
    await d.getByRole("button", { name: "Speichern" }).click();
    await expect(d.getByRole("alert")).toContainText("hat schon Einträge");
    const [{ n }] = await db()`select count(*)::int as n from haccp_items where checklist_id = ${sid("hc-daily")}`;
    expect(n).toBe(4);
  });
});
