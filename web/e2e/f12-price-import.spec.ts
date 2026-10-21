import { db, expect, reseed, sid, test } from "./fixtures";
import { xlsx } from "./xlsx";
import type { Page } from "@playwright/test";

const HEAD = ["Zutat", "Gebinde", "Inhalt", "Einheit", "Preis", "Preis je", "Artikelnummer", "Kategorie"];
const upload = (page: Page, name: string, buffer: Buffer, mimeType: string) =>
  page.getByLabel("Preisliste hochladen").setInputFiles({ name, mimeType, buffer });

test.describe("S26 Preisliste importieren", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("I-H1 Excel: Vorschau, übernehmen, Preis-Historie, erneut unverändert", async ({ page, axe }) => {
    await page.goto(`/imports?supplier=${sid("sup-molkerei")}`);
    await expect(page.getByLabel("Lieferant")).toHaveValue(sid("sup-molkerei"));
    await upload(page, "talblick.xlsx", xlsx([
      HEAD,
      ["Butter", "10x250 g", 2.5, "kg", 24.9, "Gebinde", "B-1", null],
      ["Speisequark 20 %", "Eimer 5 kg", 5, "kg", 10.9, null, null, null],
      ["Hafermilch Barista", "Packung 1 l", 1, "l", "2,10", null, "H-7", "Molkereiprodukte"],
    ]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await expect(page.getByRole("status").filter({ hasText: "1 neu (davon 1 neue Zutat)" })).toContainText("1 Preis ändert sich, 1 unverändert, 0 mit Fehlern");
    const butter = page.getByRole("row").filter({ hasText: "Butter" });
    await expect(butter).toContainText("22,90");
    await expect(butter).toContainText("24,90");
    await expect(butter).toContainText("Preis geändert");
    await axe();
    await page.getByRole("button", { name: "2 Zeilen übernehmen" }).click();
    await expect(page.getByRole("status").filter({ hasText: "1 neuer Preis (davon 1 neue Zutat), 1 Preis geändert, 1 unverändert" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "0 neu" })).toContainText("3 unverändert");

    const [b] = await db()`select price_cents, supplier_sku from stock_items where id = ${sid("ing-butter-si")}`;
    expect([b.price_cents, b.supplier_sku]).toEqual([2490, "B-1"]);
    const hist = await db()`select 1 from stock_item_price_history where stock_item_id = ${sid("ing-butter-si")}`;
    expect(hist.length).toBeGreaterThan(0);
    const [h] = await db()`select i.base_unit, c.name as cat, p.quantity_base, si.price_cents, si.is_preferred from ingredients i
      join categories c on c.id = i.category_id join packages p on p.ingredient_id = i.id join stock_items si on si.ingredient_id = i.id where i.name = 'Hafermilch Barista'`;
    expect([h.base_unit, h.cat, Number(h.quantity_base), h.price_cents, h.is_preferred]).toEqual(["ml", "Molkereiprodukte", 1000, 210, true]);
  });

  test("I-E1 CSV mit Fehlern: Einheit unbekannt, falsche Einheit für die Zutat, doppelt", async ({ page }) => {
    await page.goto("/imports");
    await page.getByLabel("Lieferant").selectOption({ label: "Molkerei Talblick" });
    const csv = ["Zutat;Inhalt;Einheit;Preis", "Butter;2,5;Fass;24,90", "Butter;1;l;9,00", "Speisequark 20 %;5;kg;10,90", "Speisequark 20 %;5;kg;11,90"].join("\n");
    await upload(page, "liste.csv", Buffer.from(csv), "text/csv");
    await expect(page.getByText("3 Zeilen konnten nicht übernommen werden")).toBeVisible();
    await expect(page.getByText(/Zeile 2:.*Einheit „Fass“ unbekannt/)).toBeVisible();
    await expect(page.getByText(/Zeile 3:.*„Butter“ wird in g\/kg geführt/)).toBeVisible();
    await expect(page.getByText(/Zeile 5:.*Doppelt in der Datei \(wie Zeile 4\)/)).toBeVisible();
    await expect(page.getByRole("button", { name: "0 Zeilen übernehmen" })).toBeDisabled();
  });

  test("I-E2 Vorlage, falsches Format, Lieferant wechseln plant neu", async ({ page }) => {
    await page.goto("/imports");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Vorlage herunterladen" }).click();
    expect((await download).suggestedFilename()).toBe("preisliste-vorlage.csv");
    await upload(page, "kaputt.xlsx", Buffer.from("kein zip"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await expect(page.getByText(/lässt sich nicht lesen/)).toBeVisible();
    await page.getByLabel("Lieferant").selectOption({ label: "Molkerei Talblick" });
    await upload(page, "liste.csv", Buffer.from("Zutat;Inhalt;Einheit;Preis\nSpeisequark 20 %;5;kg;10,90\n"), "text/csv");
    await expect(page.getByRole("status").filter({ hasText: "unverändert" })).toContainText("1 unverändert");
    await page.getByLabel("Lieferant").selectOption({ label: "Frischehof Lindner" });
    await expect(page.getByRole("status").filter({ hasText: "neu" })).toContainText("1 neu (davon 0 neue Zutaten)");
  });

  test("I-E3 viele Zeilen gehen in Teilen", async ({ page }) => {
    test.setTimeout(120_000);
    const rows = Array.from({ length: 420 }, (_, i) => `Testartikel ${String(i).padStart(3, "0")};1;kg;${(i % 50) + 1},00`);
    await page.goto("/imports");
    await upload(page, "gross.csv", Buffer.from(["Zutat;Inhalt;Einheit;Preis", ...rows].join("\n")), "text/csv");
    await expect(page.getByRole("status").filter({ hasText: "420 neu" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "420 Zeilen übernehmen" }).click();
    await expect(page.getByRole("status").filter({ hasText: "420 neue Preise (davon 420 neue Zutaten)" })).toBeVisible({ timeout: 100_000 });
  });

  test("I-N1 Team-Konto darf nicht importieren", async ({ page, login }) => {
    await login("staff");
    await page.goto("/imports");
    await expect(page.getByText(/Preise importieren dürfen Inhaber/)).toBeVisible();
    await expect(page.getByLabel("Preisliste hochladen")).toHaveCount(0);
  });
});
