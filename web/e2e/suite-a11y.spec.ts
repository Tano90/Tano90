import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

// Accessibility scan of every suite module (WCAG 2 A/AA rules from axe).
test("SX-1 jedes Modul ohne schwere Barrierefreiheitsfehler", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/suite");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const views = await page
    .locator("#sidebar .glb08-nav-link[data-view]")
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.view!));
  const report: string[] = [];
  for (const v of views) {
    await page.evaluate(
      (v) =>
        (
          document.querySelector(
            `#sidebar .glb08-nav-link[data-view="${v}"]`,
          ) as HTMLElement
        ).click(),
      v,
    );
    await page.waitForTimeout(150);
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    for (const x of r.violations.filter(
      (x) => x.impact === "serious" || x.impact === "critical",
    ))
      report.push(
        `${v}: ${x.id} (${x.nodes.length}) ${x.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ")}`,
      );
  }
  expect(report, report.join("\n")).toEqual([]);
});
