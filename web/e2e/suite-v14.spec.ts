import { expect, expectNoHorizontalScroll, test, type Page } from "./fixtures";

// Oct 2026 device revision: detail links keep their context, two separate price goals, phone as its own workplace.
async function fresh(page: Page, hash = "") {
  await page.goto("/suite");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/suite" + hash);
  await page.waitForFunction(() => (window as any).GLBV11 && (window as any).GLBSuite);
}
async function barFilter(page: Page) {
  const bar = await page.locator("#v6-filter-outlet option", { hasText: "Bar" }).first().getAttribute("value");
  await page.selectOption("#v6-filter-outlet", bar!);
  return bar!;
}

test.describe("S19 Detail-Links behalten ihren Kontext", () => {
  test("S19-1 Bar-Filter → Limonade „Verlauf ansehen“ → Lebenszyklus mit Bar; Zurück behält den Filter", async ({ page }) => {
    await fresh(page, "#overview");
    const bar = await barFilter(page);
    const hint = page.locator(".v6-action", { hasText: "Hausgemachte Limonade" });
    await expect(hint).toContainText("Bar");
    await hint.getByRole("button", { name: /Verlauf ansehen/ }).click();
    await expect(page).toHaveURL(/#lifecycle$/);
    await expect(page.locator("#lc-outlet")).toHaveValue(bar);
    await expect(page.locator("#life-product option:checked")).toHaveText("Hausgemachte Limonade");
    await expect(page.locator(".lc-origin")).toContainText("Bar");
    await page.goBack();
    await expect(page).toHaveURL(/#overview$/);
    await expect(page.locator("#v6-filter-outlet")).toHaveValue(bar);
  });

  test("S19-2 Bestellhinweis ist betriebsweit und sagt das beim Outlet-Filter", async ({ page }) => {
    await fresh(page, "#overview");
    const order = () => page.locator(".v6-action", { hasText: "laut Forecast bestellen" });
    await expect(order()).not.toContainText("unabhängig vom Berichtsfilter");
    await barFilter(page);
    await expect(order()).toContainText("Gesamter Betrieb – unabhängig vom Berichtsfilter");
    await expect(order()).toContainText("aller Outlets");
  });

  test("S19-3 „Zielpreis ansehen“ öffnet genau diesen Artikel, markiert und sichtbar", async ({ page }) => {
    await fresh(page, "#overview");
    const btn = page.locator("[data-cost-focus]").first();
    const id = await btn.getAttribute("data-cost-focus");
    const name = (await btn.locator("xpath=ancestor::li").locator("b").first().innerText()).split(":")[0];
    await btn.click();
    await expect(page).toHaveURL(/#costs$/);
    const row = page.locator(`#cost-row-${id}`);
    await expect(row).toHaveClass(/row-focus/);
    await expect(row).toContainText(name);
    await expect(row).toBeInViewport();
    await expect(row).toBeFocused();
  });

  test("S19-4 Zwei Preisziele getrennt erklärt; Untergrenze nie als Senkung", async ({ page }) => {
    await fresh(page, "#costs");
    const goals = page.locator(".price-goals");
    await expect(goals).toContainText("Preis für die Ziel-Warenquote");
    await expect(goals).toContainText("Kalkulatorische Untergrenze");
    await expect(goals).toContainText("keine Preisempfehlung");
    const table = page.locator("#cost-targets table");
    await expect(table.locator("th")).toContainText(["Preis für Ziel-Warenquote", "Kalkulatorische Untergrenze"]);
    await expect(page.locator("#main")).not.toContainText("−0,00 €");
    await expect(page.locator("#main")).not.toContainText("-0,00 €");
    await expect(page.locator("#main")).not.toContainText(/senken|Preissenkung empfohlen/);
  });
});

test.describe("S20 Handy", () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });

  test("S20-1 Zielpreis-Link öffnet auf dem Handy die passende Artikelkarte ohne Querscrollen", async ({ page }) => {
    await fresh(page, "#overview");
    await expectNoHorizontalScroll(page);
    const btn = page.locator("[data-cost-focus]").first();
    const id = await btn.getAttribute("data-cost-focus");
    await btn.click();
    const row = page.locator(`#cost-row-${id}`);
    await expect(row).toBeInViewport();
    expect(await row.evaluate((r) => getComputedStyle(r).display)).toBe("block"); // card, not a table row
    await expect(row.locator('td[data-label="Preis für Ziel-Warenquote"]')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("S21 Handy-Arbeitsplatz", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("S21-1 Filter als Panel mit Zusammenfassung; Zeitraum und Outlet bleiben beim Scrollen sichtbar", async ({ page }) => {
    await fresh(page, "#overview");
    const toggle = page.locator("[data-v6-filter-toggle]");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toContainText("Alle Monate · Alle Outlets");
    await expect(page.locator("#v6-filter-outlet")).toBeHidden();
    await toggle.click();
    await expect(page.locator("#v6-filter-outlet")).toBeVisible();
    await page.selectOption("#v6-filter-outlet", { label: "Bar" });
    await page.locator("[data-v6-filter-toggle]").click();
    await expect(page.locator("[data-v6-filter-toggle]")).toContainText("Alle Monate · Bar");
    await page.evaluate(() => window.scrollTo(0, 1600));
    await expect(page.locator("[data-v6-filter-toggle]")).toBeInViewport();
    await expectNoHorizontalScroll(page);
  });

  test("S21-2 untere Leiste: höchstens fünf Einträge; Touch-Ziele mindestens 44 px", async ({ page }) => {
    await fresh(page, "#overview");
    await expect(page.locator(".glb08-bottom-button")).toHaveCount(5);
    await expect(page.locator(".glb08-bottom-button").last()).toContainText("Mehr");
    for (const view of ["overview", "v11tasks", "inventory", "costs"]) {
      await page.evaluate((v) => (window as any).GLBSuite.navigate(v), view);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("#main .btn, #main select, #main [role=tab], .glb08-bottom-button, .v11-task-check")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.height < 44 || r.width < 44);
          })
          .map((el) => (el as HTMLElement).innerText.slice(0, 30)),
      );
      expect(small, view).toEqual([]);
      await expectNoHorizontalScroll(page);
    }
  });
});

test.describe("S22 Menügruppen", () => {
  test("S22-1 Bereiche lassen sich einklappen; der Bereich der offenen Seite bleibt offen", async ({ page }) => {
    await fresh(page, "#overview");
    const area = page.locator("#sidebar button.glb08-nav-title", { hasText: "EINKAUF & LAGER" });
    await expect(area).toHaveAttribute("aria-expanded", "true");
    await area.click();
    await expect(area).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator('#sidebar .glb08-nav-link[data-view="inventory"]')).toBeHidden();
    await page.reload();
    await page.waitForFunction(() => (window as any).GLBSuite);
    await expect(page.locator("#sidebar button.glb08-nav-title", { hasText: "EINKAUF & LAGER" })).toHaveAttribute("aria-expanded", "false");
    await page.evaluate(() => (window as any).GLBSuite.navigate("inventory"));
    await expect(page.locator('#sidebar .glb08-nav-link[data-view="inventory"]')).toBeVisible();
    await expect(page.locator('#sidebar .glb08-nav-link[data-view="inventory"]')).toHaveAttribute("aria-current", "page");
  });
});

test.describe("S23 Tastatur und Fokus", () => {
  test("S23-1 Zielpreis-Link, Menübereich und Filter per Tastatur; Fokus landet auf dem Artikel", async ({ page, axe }) => {
    await fresh(page, "#overview");
    const area = page.locator("#sidebar button.glb08-nav-title", { hasText: "SERVICE & TEAM" });
    await area.focus();
    await page.keyboard.press("Enter");
    await expect(area).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Space");
    await expect(area).toHaveAttribute("aria-expanded", "true");
    const btn = page.locator("[data-cost-focus]").first();
    const id = await btn.getAttribute("data-cost-focus");
    await btn.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`#cost-row-${id}`)).toBeFocused();
    await axe();
  });

  test("S23-2 Handy: Filter-Zusammenfassung per Tastatur öffnen; Kostenkarten barrierefrei", async ({ page, axe }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fresh(page, "#overview");
    const toggle = page.locator("[data-v6-filter-toggle]");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-v6-filter-toggle]")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("[data-v6-filter-toggle]")).toBeFocused();
    await page.evaluate(() => (window as any).GLBSuite.navigate("costs"));
    await expect(page.locator("#cost-targets")).toBeVisible();
    await axe();
  });
});
