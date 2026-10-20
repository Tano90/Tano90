// Screenshots /design and runs axe-core on it. Needs a running server (npm run build && npm start).
//   BASE_URL=http://localhost:3000 node scripts/screenshot-design.mjs
// Writes replica/design/screens/*.png and exits 1 on serious or critical accessibility violations.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../replica/design/screens");
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:3000";
const axe = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-proxy-server"], // localhost must not go through an HTTP proxy
});
let failed = false;

for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${base}/design`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/design-${name}.png`, fullPage: true });

  if (name === "desktop") {
    await page.getByRole("button", { name: "Dialog öffnen" }).click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({ path: `${out}/design-dialog.png` });
    await page.keyboard.press("Escape");
    await page.getByRole("combobox", { name: "Lieferant" }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}/design-combobox.png` });
    await page.keyboard.press("Escape");
  }

  await page.addScriptTag({ content: axe });
  const result = await page.evaluate(async () => {
    // @ts-expect-error injected
    const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, target: v.nodes[0]?.target }));
  });
  console.log(`${name}: ${result.length} axe violations`);
  for (const v of result) {
    console.log(`  [${v.impact}] ${v.id} (${v.nodes}x) ${v.help} ${JSON.stringify(v.target)}`);
    if (v.impact === "serious" || v.impact === "critical") failed = true;
  }
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
