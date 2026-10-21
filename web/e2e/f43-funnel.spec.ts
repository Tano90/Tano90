import { db, expect, reseed, test } from "./fixtures";

test.describe("Service Funnel", () => {
  test.beforeEach(() => reseed());

  test("SF-H1 Szenario, Tag erfassen, CSV-Import, Annahmen", async ({ page, login, axe }) => {
    await login("owner");
    await page.goto("/app");
    await page.getByRole("link", { name: "Service Funnel" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Service Funnel");
    await expect(page.getByRole("link", { name: "Service Funnel" })).toHaveAttribute("aria-current", "page");
    const kpis = page.getByRole("region", { name: "Kennzahlen" });
    await expect(kpis).toContainText("Gäste (28 Tage)");
    const tile = kpis.locator("div", { hasText: "Szenario: DB II im Zeitraum" }).last();
    const before = await tile.textContent();
    await page.getByRole("slider", { name: "Desserts: Ziel je 100 Gäste" }).fill("60");
    await expect(tile).not.toHaveText(before!);
    await axe();

    await page.getByRole("button", { name: "Tag erfassen" }).click();
    const d = page.getByRole("dialog", { name: "Tag erfassen" });
    await d.getByLabel("Gäste (Covers)").fill("100");
    await d.getByLabel("Desserts").fill("30");
    await d.getByLabel("Kaffee").fill("x");
    await expect(d.getByRole("button", { name: "Speichern" })).toBeDisabled();
    await d.getByLabel("Kaffee").fill("50");
    await axe();
    await d.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText(/gespeichert$/)).toBeVisible();
    const [today] = await db()`select covers, desserts, coffee from funnel_days order by day desc limit 1`;
    expect(today).toEqual({ covers: 100, desserts: 30, coffee: 50 });

    await page.getByLabel("Funnel-CSV").setInputFiles({ name: "f.csv", mimeType: "text/csv", buffer: Buffer.from("Datum;Gäste;Desserts\n01.01.2026;80;20\n02.01.2026;70;x\n") });
    await expect(page.getByText("„x“ ist keine ganze Zahl ab 0.")).toBeVisible();
    await page.getByRole("button", { name: "Übernehmen" }).click();
    await expect(page.getByText("1 Tage übernommen")).toBeVisible();
    const [jan] = await db()`select covers, desserts, aperitif from funnel_days where day = '2026-01-01'`;
    expect(jan).toEqual({ covers: 80, desserts: 20, aperitif: 0 });
    // Nothing reaches the real sales.
    const [{ n }] = await db()`select count(*)::int as n from sales where sold_at::date = '2026-01-01'`;
    expect(n).toBe(0);

    const a = page.getByRole("region", { name: "Annahmen je Verkauf" });
    await a.getByLabel("Desserts: gespeicherte Zielquote").fill("45");
    await a.getByRole("button", { name: "Annahmen speichern" }).click();
    await expect(page.getByText("Annahmen gespeichert")).toBeVisible();
    const [goal] = await db()`select goal_pct::float as g from funnel_steps where step = 'desserts'`;
    expect(goal.g).toBe(45);
  });

  test("SF-N1 Service-Team erfasst, sieht aber keine Kosten", async ({ page, login }) => {
    await login("staff");
    await page.goto("/analytics/funnel");
    await expect(page.getByRole("region", { name: "Kennzahlen" })).toContainText("Szenario: Umsatz netto");
    await expect(page.getByRole("region", { name: "Kennzahlen" })).not.toContainText("DB II");
    await expect(page.getByRole("region", { name: "Annahmen je Verkauf" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "DB II" })).toHaveCount(0);
    await page.getByRole("button", { name: "Tag erfassen" }).click();
    await page.getByRole("dialog").getByLabel("Gäste (Covers)").fill("40");
    await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText(/gespeichert$/)).toBeVisible();
  });
});
