// Contrast and naming report for every suite module: BASE defaults to the local demo server.
// Usage: node scripts/suite-axe.mjs  (groups contrast failures by colour pair, lists other serious findings)
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-proxy-server"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto("http://localhost:3300/suite");
const views = await p.locator("#sidebar .glb08-nav-link[data-view]").evaluateAll((els) => els.map((e) => e.dataset.view));
const colors = {}, other = [];
for (const v of views) {
  await p.evaluate((v) => document.querySelector(`#sidebar .glb08-nav-link[data-view="${v}"]`).click(), v);
  await p.waitForTimeout(150);
  const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa"]).analyze();
  for (const x of r.violations) {
    if (x.id === "color-contrast") for (const n of x.nodes) { const d = n.any[0]?.data; if (!d) continue; const k = `${d.fgColor} on ${d.bgColor} (${d.contrastRatio}) ${d.fontSize}`; (colors[k] ||= new Set()).add(n.target.join(" ").slice(0, 60)); }
    else if (x.impact === "serious" || x.impact === "critical") for (const n of x.nodes) other.push(`${v} ${x.id}: ${n.html.slice(0, 160)}`);
  }
}
for (const [k, s] of Object.entries(colors).sort((a, b) => b[1].size - a[1].size)) console.log(s.size, k, [...s].slice(0, 3).join(" | "));
console.log("----");
console.log([...new Set(other)].join("\n"));
await b.close();
