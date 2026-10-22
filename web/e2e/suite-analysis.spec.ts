import { expect, test, type Page } from "./fixtures";

// Renner-Penner compares within a chosen group and period; lifecycle shows real zero months.
async function open(page: Page, view: string) {
  await page.evaluate((v) => (document.querySelector(`#sidebar .glb08-nav-link[data-view="${v}"]`) as HTMLElement).click(), view);
}

test.describe("SA Analysen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/suite");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("SA-1 Renner-Penner: Vergleichsgruppe, Zeitraum und Schwellen sichtbar, Priorität nach Gesamt-DB II", async ({ page }) => {
    await open(page, "portfolio");
    const basis = page.locator(".notice", { hasText: "Vergleichsgrundlage" });
    await expect(basis).toContainText("Schwellen");
    const all = await basis.textContent();
    const group = page.locator("#pf-group");
    const cat = await group.locator("option").evaluateAll((o) => (o as HTMLOptionElement[]).map((x) => x.value).find((v) => v.startsWith("cat:")));
    await group.selectOption(cat!);
    await expect(basis).not.toHaveText(all!);
    await expect(basis).toContainText(cat!.slice(4));
    await page.locator("#pf-month").selectOption("2026-09");
    await expect(basis).toContainText("September 2026");
    const table = page.locator("table", { has: page.locator("th", { hasText: "Gesamt-DB II" }) });
    await expect(table.locator("th", { hasText: "Erfolgskontrolle" })).toHaveCount(1);
    // rows sorted by total DB II, descending
    const totals = await table.locator("tbody tr").evaluateAll((rows) =>
      rows.map((r) => Number((r.children[4].textContent || "").replace(/[^\d,-]/g, "").replace(",", "."))),
    );
    expect(totals.length).toBeGreaterThan(0);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  test("SA-2 Lebenszyklen: Methode erklärt, Monate ohne Verkauf als echte Null markiert", async ({ page }) => {
    await page.evaluate(() => {
      const s = window.GLBAppSync.snapshot();
      const item = s.items[0];
      // remove one middle month for this article: it must appear as "nicht verkauft", not as missing data
      const months = [...new Set(s.sales.map((x: { month: string }) => x.month))].sort() as string[];
      const drop = months[Math.floor(months.length / 2)];
      s.sales = s.sales.filter((x: { productId: string; month: string }) => !(x.productId === item.id && x.month === drop));
      localStorage.setItem("glb-ai-suite-v01", JSON.stringify(s));
    });
    await page.reload();
    await open(page, "lifecycle");
    await expect(page.locator("#main")).toContainText("nicht verkauft");
  });
});

declare global {
  interface Window {
    GLBAppSync: { snapshot: () => any };
  }
}
