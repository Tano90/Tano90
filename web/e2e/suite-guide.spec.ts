import { expect, test } from "./fixtures";

// The compact way into the demo on the overview: three steps that only link existing views, skippable, remembered in
// this browser. Example data stay marked.
test("SG-1 Einstieg in drei Schritten: verlinkt vorhandene Ansichten, ausblendbar, Beispieldaten markiert", async ({ page }) => {
  await page.goto("/suite");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/suite#overview");
  const guide = page.getByRole("region", { name: "Einstieg in drei Schritten" });
  await expect(guide).toBeVisible();
  for (const t of ["Daten importieren", "Auffälligkeiten prüfen", "Nächste Maßnahme umsetzen"]) await expect(guide.getByText(t, { exact: true })).toBeVisible();
  await expect(page.getByText("Beispieldaten", { exact: false }).first()).toBeVisible();

  // a step leads to the existing view, keyboard reachable
  await guide.getByRole("button", { name: "Datenqualität" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#operations$/);

  await page.goto("/suite#overview");
  await page.getByRole("region", { name: "Einstieg in drei Schritten" }).getByRole("button", { name: "Ausblenden" }).click();
  await expect(page.getByRole("region", { name: "Einstieg in drei Schritten" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Einstieg in drei Schritten" })).toHaveCount(0);
  await page.getByRole("button", { name: "Einstieg in drei Schritten anzeigen" }).click();
  await expect(page.getByRole("region", { name: "Einstieg in drei Schritten" })).toBeVisible();
});
