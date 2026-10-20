import { db, expect, reseed, sid, stockQuantity, test } from "./fixtures";
import type { Page } from "@playwright/test";

const upload = (page: Page, csv: string) =>
  page.getByLabel("Verkäufe als CSV hochladen").setInputFiles({ name: "kasse.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });

const CSV = "Belegposition;PLU;Artikel;Menge;Umsatz netto;Zeitpunkt\nT1-1;1001;Linsensuppe;2;14,77;20.10.2026 12:30\nT1-2;5555;Tagesdessert;1;4,20;20.10.2026 12:31\n";

test.describe("F11 Kassenverkäufe", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("F11-H1 wartende Verkäufe werden beim Verknüpfen abgebucht", async ({ page, axe }) => {
    const butter = await stockQuantity("Butter");
    await page.goto("/analytics/pos");
    await axe();
    const row = page.getByRole("row").filter({ hasText: "Apfelkuchen Stück" });
    await expect(row).toContainText("8 warten");
    await row.getByLabel("Rezept für Apfelkuchen Stück").selectOption({ label: "Apfelkuchen vom Blech" });
    await expect(page.getByText("8 wartende Verkäufe vom Lager abgebucht.")).toBeVisible();
    await expect(row).toContainText("verknüpft");
    // 8 pieces of a 12-piece tray with 200 g butter.
    expect(await stockQuantity("Butter")).toBeCloseTo(butter - (8 / 12) * 200, 3);
    const [{ n }] = await db()`select count(*)::int as n from sales where pos_item_id = ${sid("pos-1003")} and depleted_event_id is null`;
    expect(n).toBe(0);
    await page.goto("/stock/report");
    await expect(page.getByRole("row").filter({ hasText: "Butter" })).toContainText("−133,333 g");
  });

  test("F11-H2 CSV-Import: Verknüpftes bucht ab, Neues wartet, Wiederholung bucht nichts doppelt", async ({ page }) => {
    const linsen = await stockQuantity("Rote Linsen");
    await page.goto("/analytics/pos");
    await upload(page, CSV);
    await expect(page.getByRole("status").filter({ hasText: "2 Verkäufe übernommen, 0 schon vorhanden, 1 vom Lager abgebucht" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Tagesdessert" })).toContainText("1 warten");
    expect(await stockQuantity("Rote Linsen")).toBeCloseTo(linsen - (2 / 10) * 800, 3);
    await upload(page, CSV);
    await expect(page.getByRole("status").filter({ hasText: "0 Verkäufe übernommen, 2 schon vorhanden, 0 vom Lager abgebucht" })).toBeVisible();
    expect(await stockQuantity("Rote Linsen")).toBeCloseTo(linsen - 160, 3);
  });

  test("F11-E1 fehlerhafte Zeilen werden benannt, gültige übernommen", async ({ page }) => {
    await page.goto("/analytics/pos");
    await upload(page, "Beleg;PLU;Menge;Zeitpunkt\nA;1001;zwei;20.10.2026\nB;1001;1;20.10.2026 10:00\nC;1001;-1;20.10.2026\n");
    await expect(page.getByText("2 Zeilen konnten nicht übernommen werden")).toBeVisible();
    await expect(page.getByText("Zeile 2:")).toBeVisible();
    await expect(page.getByText(/Stornos/)).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "1 Verkäufe übernommen" })).toBeVisible();
  });

  test("F11-E2 falsche Datei: fehlende Spalten", async ({ page }) => {
    await page.goto("/analytics/pos");
    await upload(page, "Name;Preis\nSuppe;7,90\n");
    await expect(page.getByText(/Spalte fehlt: Belegposition, PLU, Menge, Zeitpunkt/)).toBeVisible();
  });

  test("F11-E3 ignorieren und Filter „nur nicht verknüpfte“", async ({ page }) => {
    await page.goto("/analytics/pos");
    await page.getByLabel("Rezept für Espresso").selectOption("__ignore");
    await expect(page.getByText("„Espresso“ wird ignoriert")).toBeVisible();
    await page.getByLabel(/Nur nicht verknüpfte/).click();
    await page.waitForURL(/open=1/);
    await expect(page.getByRole("row").filter({ hasText: "Espresso" })).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: "Apfelkuchen Stück" })).toBeVisible();
  });

  test("F11-H3 API: Schlüssel erstellen, senden, wiederholen, widerrufen", async ({ page }) => {
    await page.goto("/analytics/pos");
    await page.getByRole("button", { name: "API-Schlüssel erstellen" }).click();
    await page.getByRole("dialog").getByLabel("Name").fill("Kasse Theke");
    await page.getByRole("dialog").getByRole("button", { name: "Erstellen" }).click();
    const key = await page.getByLabel("Neuer API-Schlüssel").inputValue();
    expect(key).toMatch(/^pantra_[\w-]{32}$/);
    await page.getByRole("button", { name: "Fertig" }).click();
    const [stored] = await db()`select key_hash from api_keys where name = 'Kasse Theke'`;
    expect(stored.key_hash).not.toContain(key.slice(7, 20)); // only the hash is kept

    const body = { sales: [{ id: "API-1", plu: "1002", name: "Ofengemüse", quantity: 3, netRevenueCents: 4065, soldAt: "2026-10-20T19:00:00+02:00" }] };
    const send = (k: string, data: unknown = body) => page.request.post("/api/pos/sales", { headers: { Authorization: `Bearer ${k}` }, data });
    const first = await send(key);
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ imported: 1, duplicates: 0, depleted: 1 });
    expect(await (await send(key)).json()).toMatchObject({ imported: 0, duplicates: 1, depleted: 0 });
    expect((await send("pantra_falsch")).status()).toBe(401);
    expect((await send(key, { sales: [{ id: "x", plu: "1", quantity: 1, soldAt: "20.10.2026" }] })).status()).toBe(400);

    await page.reload();
    await expect(page.getByText(/zuletzt benutzt/)).toBeVisible();
    await page.getByRole("button", { name: "Widerrufen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Widerrufen" }).click();
    await expect(page.getByText(/widerrufen \d/)).toBeVisible();
    expect((await send(key)).status()).toBe(401);
  });

  test("F11-N1 Team-Konto: Zuordnen ja, Schlüssel nein; API ohne Schlüssel", async ({ page, login }) => {
    await login("staff");
    await page.goto("/analytics/pos");
    await expect(page.getByLabel("Rezept für Espresso")).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Schnittstelle für die Kasse" })).toHaveCount(0);
    const res = await page.request.post("/api/pos/sales", { data: { sales: [] } });
    expect(res.status()).toBe(401);
  });
});
