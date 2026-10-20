// Edge and negative cases for the third build pass: transfers, stock report, levels, POS.
import { db, expect, reseed, sid, stockQuantity, test } from "./fixtures";
import type { Page } from "@playwright/test";

const createKey = async (page: Page) => {
  await page.goto("/analytics/pos");
  await page.getByRole("button", { name: "API-Schlüssel erstellen" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Test");
  await page.getByRole("dialog").getByRole("button", { name: "Erstellen" }).click();
  return page.getByLabel("Neuer API-Schlüssel").inputValue();
};

test.describe("Randfälle 3. Durchgang", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("F10-E3 Doppelklick bucht genau einmal um", async ({ page }) => {
    const zucker = await stockQuantity("Zucker");
    await page.goto("/stock/transfer");
    await page.getByRole("combobox", { name: "Zutat" }).click();
    await page.getByRole("option", { name: /^Zucker/ }).click();
    await page.getByRole("textbox", { name: "Menge" }).fill("1");
    await page.getByRole("button", { name: "Umbuchen" }).dblclick();
    await expect(page.getByText("Umgebucht")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await stockQuantity("Zucker")).toBe(zucker - 1000);
  });

  test("S20-N1 CSV-Export entschärft Formeln in Namen", async ({ page }) => {
    await db()`update ingredients set name = '=HYPERLINK("http://example.com","x")' where id = ${sid("ing-zucker")}`;
    await page.goto("/stock/report");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Als CSV exportieren" }).click();
    const text = (await (await (await download).createReadStream()).toArray()).join("");
    const line = text.split("\r\n").find((l) => l.includes("HYPERLINK"))!;
    expect(line.startsWith("=")).toBe(false);
    expect(line.startsWith("\"=")).toBe(false);
  });

  test("F11-E4 großer Export (1,5 MB) wird importiert", async ({ page }) => {
    test.setTimeout(120_000);
    const lines = ["Belegposition;PLU;Artikel;Menge;Umsatz netto;Zeitpunkt"];
    for (let i = 0; i < 24000; i++) lines.push(`BIG-${String(i).padStart(6, "0")};${9100 + (i % 40)};Artikel mit einem etwas längeren Namen ${i % 40};1;3,50;20.10.2026 12:${String(i % 60).padStart(2, "0")}`);
    const csv = lines.join("\n");
    expect(csv.length).toBeGreaterThan(1_500_000);
    await page.goto("/analytics/pos");
    await page.getByLabel("Verkäufe als CSV hochladen").setInputFiles({ name: "gross.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
    await expect(page.getByRole("status").filter({ hasText: "24000 Verkäufe übernommen" })).toBeVisible({ timeout: 90_000 });
  });

  test("F11-N2 API: kaputtes JSON, Ratenlimit, Schlüssel bucht nur ins eigene Outlet", async ({ page }) => {
    const key = await createKey(page);
    const post = (data: unknown, raw?: string) =>
      page.request.post("/api/pos/sales", { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, data: raw ?? data });
    expect((await post(null, "{kaputt")).status()).toBe(400);
    const ok = await post({ sales: [{ id: "R-1", plu: "7777", quantity: 1, soldAt: "2026-10-20T10:00:00Z" }] });
    expect(ok.status()).toBe(200);
    const [row] = await db()`select outlet_id from pos_items where plu = '7777'`;
    expect(row.outlet_id).toBe(sid("out-mitte"));
    let limited = false;
    for (let i = 0; i < 65 && !limited; i++) limited = (await post({ sales: [{ id: `R-${i + 2}`, plu: "7777", quantity: 1, soldAt: "2026-10-20T10:00:00Z" }] })).status() === 429;
    expect(limited).toBe(true);
  });

  test("S16-N2 Unsinn in den Bestandsfeldern", async ({ page }) => {
    await page.goto("/stock");
    await page.getByRole("button", { name: "Butter: Mindest- und Zielbestand" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel(/Mindestbestand/).fill("1,2,3");
    await d.getByRole("button", { name: "Speichern" }).click();
    await expect(d.getByRole("alert")).toHaveText("Bitte eine Zahl angeben.");
  });

  test("S20-E3 Bericht als Team-Konto zeigt nur das eigene Outlet", async ({ page, login }) => {
    await login("staff");
    await page.goto("/stock/report");
    await expect(page.getByText(/^Küche Mitte ·/)).toBeVisible();
    await expect(page.getByRole("option", { name: "Zentralküche" })).toHaveCount(0);
  });
});
