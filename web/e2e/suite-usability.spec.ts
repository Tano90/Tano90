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

  test("SB-3 Inventur: Einheit am Feld, Gebinde und lose Menge getrennt, Summe vor dem Buchen", async ({
    page,
  }) => {
    await page.evaluate(() =>
      (
        document.querySelector(
          '#sidebar [data-view="inventory"]',
        ) as HTMLElement
      ).click(),
    );
    const form = page.locator("#v4-count-form");
    const ing = await page.evaluate(() =>
      (window as any).GLBAppSync.snapshot().ingredients.find(
        (x: { packUnit: string }) => x.packUnit === "kg",
      ),
    );
    await form.getByLabel("Welche Rohware?").selectOption(ing.id);
    await expect(
      form.getByText(`je ${String(ing.packQty).replace(".", ",")} kg`),
    ).toBeVisible();
    await expect(form.locator("[data-count-unit]")).toHaveText("in g");
    await form.getByLabel(/Volle Gebinde/).fill("2");
    await form.getByLabel(/Lose Menge/).fill("250");
    const total = 2 * ing.packQty * 1000 + 250;
    await expect(form.locator("[data-count-total]")).toContainText(
      `${total.toLocaleString("de-DE")} g gesamt`,
    );
    await form.getByRole("button", { name: /Bestand buchen/ }).click();
    const last = await page.evaluate(() =>
      (window as any).GLBAppSync.snapshot().inventoryCounts.at(-1),
    );
    expect(last.ingredientId).toBe(ing.id);
    expect(last.baseQty).toBe(total);
  });

  test("SB-4 Warenbewegung: Formular folgt der Art, Schwund mit Grund, Klartext vor dem Buchen", async ({
    page,
  }) => {
    await page.evaluate(() =>
      (
        document.querySelector(
          '#sidebar [data-view="stockledger"]',
        ) as HTMLElement
      ).click(),
    );
    await page.locator('[data-v5="movement-new"]').first().click();
    const dlg = page.getByRole("dialog", { name: "Warenbewegung buchen" });
    await expect(dlg.getByLabel("Eingang in Lager")).toBeVisible();
    await expect(dlg.getByLabel("Von Lager")).toBeHidden();
    await expect(dlg.getByLabel("Grund")).toBeHidden();
    await dlg.getByLabel("Vorgang").selectOption("transfer");
    await expect(dlg.getByLabel("Von Lager")).toBeVisible();
    await expect(dlg.getByLabel("Nach Lager")).toBeVisible();
    await dlg.getByLabel("Vorgang").selectOption("waste");
    await expect(dlg.getByLabel("Aus Lager")).toBeVisible();
    await expect(dlg.getByLabel("Nach Lager")).toBeHidden();
    await dlg.getByLabel("Grund").selectOption("Bruch / beschädigt");
    await dlg.getByLabel(/Menge/).fill("3");
    await expect(dlg.locator("[data-move-summary]")).toContainText(
      "als Abgang aus",
    );
    await expect(dlg.locator("[data-move-summary]")).toContainText(
      "Bruch / beschädigt",
    );
    await expect(
      dlg.getByRole("button", { name: "Fenster schließen" }),
    ).toBeVisible();
  });

  test("SB-5 Lange Detailtabellen eingeklappt mit Anzahl, Beispieldaten ohne Ersatz-Kostenbasis", async ({
    page,
  }) => {
    await page.evaluate(() =>
      (
        document.querySelector('#sidebar [data-view="outlets"]') as HTMLElement
      ).click(),
    );
    const lines = page.locator('details[data-collapse="sales-lines"]');
    await expect(lines).not.toHaveAttribute("open", "");
    await expect(lines.locator("summary")).toContainText(
      /\d+ Zeilen in der Auswahl/,
    );
    await expect(page.locator("[data-sale-edit]").first()).toBeHidden();
    await lines.locator("summary").click();
    await expect(page.locator("[data-sale-edit]").first()).toBeVisible();
    // stays open after a filter change (re-render)
    await page.locator("#month-filter").selectOption({ index: 1 });
    await expect(
      page.locator('details[data-collapse="sales-lines"]'),
    ).toHaveAttribute("open", "");
    await page.evaluate(() =>
      (
        document.querySelector('#sidebar [data-view="overview"]') as HTMLElement
      ).click(),
    );
    await expect(page.locator(".v6-cost-note").first()).toHaveText(
      "Kosten je Verkaufsmonat aus den Kostenständen der Artikel.",
    );
  });

  for (const width of [768, 1024]) {
    test(`SB-6 Tablet ${width} px: Kopfzeile passt, Speicherstatus, Suche, Konto und Backup sichtbar`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.reload();
      const bar = await page.locator(".topbar").boundingBox();
      for (const sel of [
        "#v5-open-command",
        "#cloud-sync-status",
        "#cloud-account",
        '.topbar [data-action="export-json"]',
      ]) {
        const box = await page.locator(sel).boundingBox();
        expect(box, sel).not.toBeNull();
        expect(box!.x + box!.width, sel).toBeLessThanOrEqual(
          bar!.x + bar!.width + 1,
        );
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    });
  }

  test("SB-7 App installieren: auf dem iPhone mit Anleitung sichtbar, sonst nur wenn der Browser es anbietet", async ({
    browser,
    page,
  }) => {
    await expect(page.locator("#glb08-install")).toBeHidden();
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
    });
    const p2 = await ctx.newPage();
    await p2.goto("/suite");
    await p2.locator("#glbm-more").click();
    await expect(p2.locator("#glbm-sheet")).toContainText("App installieren");
    await ctx.close();
  });
});
