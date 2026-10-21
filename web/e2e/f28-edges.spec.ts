// Edge and negative cases for the fifth build pass: cancellations, menu engineering, ordering by weight, price list import.
import { db, expect, reseed, sid, stockQuantity, test } from "./fixtures";
import type { Page } from "@playwright/test";

const importCsv = async (page: Page, csv: string) => {
  await page.goto(`/imports?supplier=${sid("sup-molkerei")}`);
  await page.getByLabel("Preisliste hochladen").setInputFiles({ name: "liste.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
};

test.describe("Randfälle 5. Durchgang", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("W-E2 Dezimalpunkt statt Komma: 2.5 kg bleibt 2,5 kg", async ({ page }) => {
    await page.goto("/orders/new");
    await page.getByRole("combobox", { name: "Lieferant", exact: true }).selectOption({ label: "Frischehof Lindner" });
    await page.getByLabel("Menge in kg Knollensellerie").pressSequentially("2.5");
    await expect(page.getByLabel("Menge in kg Knollensellerie")).toHaveValue("2,5");
    await expect(page.getByRole("row").filter({ hasText: "Knollensellerie" })).toContainText("5,50");
  });

  test("X-DEC Dezimalpunkt in Preis, Inventur und Mindestbestand", async ({ page }) => {
    await page.goto(`/recipes/${sid("rec-linsensuppe")}`);
    await page.getByRole("tab", { name: "Kalkulation" }).click();
    await page.getByLabel("Verkaufspreis pro Portion").fill("");
    await page.getByLabel("Verkaufspreis pro Portion").pressSequentially("8.40");
    await expect(page.getByLabel("Verkaufspreis pro Portion")).toHaveValue("8,40");
    await page.goto("/stock/count");
    await page.getByRole("button", { name: "Inventur starten" }).click();
    await page.getByRole("textbox", { name: /Speisequark/ }).pressSequentially("1.5");
    await expect(page.getByRole("textbox", { name: /Speisequark/ })).toHaveValue("1,5");
  });

  test("I-E4 Doppelklick auf Übernehmen legt keine Zutat doppelt an", async ({ page }) => {
    await importCsv(page, "Zutat;Inhalt;Einheit;Preis\nHafermilch Barista;1;l;2,10\n");
    await page.getByRole("button", { name: "1 Zeile übernehmen" }).dblclick();
    await expect(page.getByRole("status").filter({ hasText: "neuer Preis" })).toBeVisible();
    await page.waitForTimeout(1000);
    const rows = await db()`select id from ingredients where name = 'Hafermilch Barista'`;
    expect(rows).toHaveLength(1);
    const items = await db()`select 1 from stock_items si join ingredients i on i.id = si.ingredient_id where i.name = 'Hafermilch Barista'`;
    expect(items).toHaveLength(1);
  });

  test("I-E5 Groß-/Kleinschreibung und Leerzeichen finden die Zutat", async ({ page }) => {
    await importCsv(page, "Zutat;Inhalt;Einheit;Preis\n  butter  ;2,5;kg;23,50\n");
    await expect(page.getByRole("row").filter({ hasText: "butter" })).toContainText("Preis geändert");
  });

  test("I-E6 Name einer archivierten Zutat: neue Zutat, die alte bleibt archiviert (wie beim Anlegen von Hand)", async ({ page }) => {
    await db()`update ingredients set archived_at = now() where id = ${sid("ing-zucker")}`;
    await importCsv(page, "Zutat;Inhalt;Einheit;Preis\nZucker;1;kg;1,20\n");
    await expect(page.getByRole("row").filter({ hasText: "Zucker" })).toContainText("neue Zutat");
    await page.getByRole("button", { name: "1 Zeile übernehmen" }).click();
    await expect(page.getByRole("status").filter({ hasText: "1 neuer Preis (davon 1 neue Zutat)" })).toBeVisible();
    const rows = await db()`select archived_at is not null as archived from ingredients where name = 'Zucker' order by archived`;
    expect(rows.map((r) => r.archived)).toEqual([false, true]);
  });

  test("ME-E4 Stornos verringern die verkaufte Menge", async ({ page }) => {
    await page.goto("/analytics/pos");
    const now = new Date();
    const d = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()} 08:00`;
    await page.getByLabel("Verkäufe als CSV hochladen").setInputFiles({ name: "s.csv", mimeType: "text/csv", buffer: Buffer.from(`Beleg;PLU;Menge;Umsatz netto;Zeitpunkt\nX1;1001;-4;-29,52;${d}\n`) });
    await expect(page.getByRole("status").filter({ hasText: "1 Verkauf übernommen" })).toBeVisible();
    await page.goto("/analytics/menu-engineering");
    await expect(page.getByRole("table", { name: "Gerichte im Zeitraum" }).getByRole("row").filter({ hasText: "Linsensuppe" }).getByRole("cell").nth(2)).toHaveText("10");
  });

  test("ST-E1 Storno ohne vorherigen Verkauf bucht zurück, Durchschnitt bleibt", async ({ page }) => {
    const linsen = await stockQuantity("Rote Linsen");
    await page.goto("/analytics/pos");
    await page.getByLabel("Verkäufe als CSV hochladen").setInputFiles({ name: "s.csv", mimeType: "text/csv", buffer: Buffer.from("Beleg;PLU;Menge;Zeitpunkt\nY1;1001;-1;20.10.2026 09:00\n") });
    await expect(page.getByRole("status").filter({ hasText: "1 Verkauf übernommen" })).toBeVisible();
    expect(await stockQuantity("Rote Linsen")).toBeCloseTo(linsen + 80, 6);
  });
});
