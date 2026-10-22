import { expect, test } from "./fixtures";

// Usability checks for the GLB AI Suite: search, keyboard, labels.
test.describe("SB Bedienung", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/suite");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("SB-1 Suche: findet jedes Navigationsziel, „Report“ findet Report Studio, Tastatur bis zum Öffnen", async ({
    page,
  }) => {
    const nav = await page
      .locator("#sidebar .glb08-nav-link[data-view]")
      .evaluateAll((els) =>
        els.map((e) => [
          (e as HTMLElement).dataset.view!,
          (e.textContent || "").replace(/\s+/g, " ").trim(),
        ]),
      );
    expect(nav.length).toBeGreaterThanOrEqual(23);
    await page.keyboard.press("Control+k");
    const input = page.getByRole("textbox", {
      name: "Modul oder Aufgabe suchen",
    });
    await expect(input).toBeFocused();
    for (const [view, label] of nav) {
      await input.fill(label);
      await expect(
        page.locator(`#v5-command-results [data-view="${view}"]`),
        label,
      ).toHaveCount(1);
    }
    for (const [q, view] of [
      ["Report", "reports"],
      ["excel", "reports"],
      ["wareneingang", "stockledger"],
      ["speisekarte", "menuimport"],
      ["ust", "settings"],
    ]) {
      await input.fill(q);
      await expect(
        page.locator(`#v5-command-results [data-view="${view}"]`),
        q,
      ).toHaveCount(1);
    }
    await input.fill("Report");
    await expect(
      page.locator("#v5-command-results button").first(),
    ).toHaveAttribute("data-view", "reports");
    await page.keyboard.press("ArrowDown");
    await expect(
      page.locator("#v5-command-results button").first(),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".v5-command-overlay")).toHaveCount(0);
    await expect(page.locator("#main")).toContainText("Report");
    await expect(
      page.locator('#sidebar .glb08-nav-link[data-view="reports"]'),
    ).toHaveClass(/active/);
  });

  test("SB-2 Arbeitsplatz, Mission Control, Dashboard: eigene Aufgabe, Aufgaben aus echten Daten", async ({
    page,
  }) => {
    await page.evaluate(() =>
      (
        document.querySelector('#sidebar [data-view="myday"]') as HTMLElement
      ).click(),
    );
    await expect(
      page.getByRole("heading", { name: "Was heute ansteht" }),
    ).toBeVisible();
    const task = page.locator(".v08-task", {
      hasText: "laut Forecast zu bestellen",
    });
    await expect(task).toHaveCount(1);
    const n = Number((await task.locator("b").textContent())!.match(/\d+/)![0]);
    await task.click();
    await expect(
      page.locator('#sidebar .glb08-nav-link[data-view="purchasing"]'),
    ).toHaveClass(/active/);
    // same number as forecast rows that ask for an order
    await expect(
      page.locator("#main").getByText("Bestellen: Menge prüfen"),
    ).toHaveCount(n);
    expect(n).toBeGreaterThan(0);
    await page.evaluate(() =>
      (
        document.querySelector('#sidebar [data-view="overview"]') as HTMLElement
      ).click(),
    );
    await expect(
      page.getByRole("heading", { name: "Wie läuft das Geschäft?" }),
    ).toBeVisible();
    await expect(page.locator(".topbar")).toContainText("Dashboard");
    await page.evaluate(() =>
      (
        document.querySelector(
          '#sidebar [data-view="operations"]',
        ) as HTMLElement
      ).click(),
    );
    await expect(page.locator("#main")).toContainText(
      "sind die Zahlen belastbar",
    );
  });
});
