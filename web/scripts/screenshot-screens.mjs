// Screenshots every built screen at 1440 and 390 px into replica/clone-screens/ for /replica-diff,
// and checks each one: axe-core (WCAG 2.2 AA), console errors, horizontal overflow on mobile.
//   npm run build && npm start, then: BASE_URL=http://localhost:3000 node scripts/screenshot-screens.mjs
// Exits 1 if any check fails.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../replica/clone-screens");
mkdirSync(out, { recursive: true });
const base = process.env.BASE_URL ?? "http://localhost:3000";
const axe = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

// Kept in sync with src/lib/screens.ts (built screens only).
const SCREENS = [
  ["S01", "/login", null],
  ["S02", "/app", "usr-owner"],
  ["S03", "/ingredients", "usr-owner"],
  ["S04", "/ingredients/ing-olivenoel?tab=packages", "usr-owner"],
  ["S05", "/recipes", "usr-owner"],
  ["S06", "/recipes/rec-linsensuppe", "usr-owner"],
  ["S07", "/menus", "usr-owner"],
  ["S09", "/recipes/rec-linsensuppe/label", "usr-owner"],
  ["S08", "/menus/menu-mittag", "usr-owner"],
  ["S10", "/suppliers", "usr-owner"],
  ["S11", "/suppliers/sup-frische", "usr-owner"],
  ["S12", "/orders", "usr-owner"],
  ["S13", "/orders/new", "usr-owner"],
  ["S14", "/orders/po-2", "usr-owner"],
  ["S16", "/stock", "usr-owner"],
  ["S17", "/stock/count", "usr-owner"],
  ["S18", "/stock/transfer", "usr-owner"],
  ["S20", "/stock/report", "usr-owner"],
  ["S21", "/analytics/pos", "usr-owner"],
  ["S19", "/stock/waste", "usr-owner"],
  ["S24", "/settings", "usr-owner"],
  ["S25", "/settings/team", "usr-owner"],
  // States: no permission, read-only, filtered empty
  ["S25-no-permission", "/settings/team", "usr-staff"],
  ["S06-read-only", "/recipes/rec-linsensuppe", "usr-staff"],
  ["S03-no-results", "/ingredients?q=zzzz", "usr-owner"],
];

// With SEED_UUIDS=1 (app running on Postgres with scripts/seed.ts) seed ids become the seed's stable UUIDs.
const sid = (x) => {
  if (!process.env.SEED_UUIDS) return x;
  const h = createHash("md5").update(`kitchen-ledger:${x}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const mapPath = (p) => p.replace(/\b(ing|rec|sup|po|menu)-[a-z0-9-]+?(?=[/?]|$)/g, (m) => sid(m));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-proxy-server"] });
let failures = 0;

for (const [id, path, user] of SCREENS) {
  for (const [suffix, viewport] of [["", { width: 1440, height: 900 }], ["-mobile", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport });
    if (user) await ctx.addCookies([{ name: "kl_session", value: sid(user), url: base }]);
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base + mapPath(path), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600); // client fetches (live costing, order items)
    await page.screenshot({ path: `${out}/${id}${suffix}.png`, fullPage: true });

    const problems = [];
    if (errors.length) problems.push(`console: ${errors.join(" | ")}`);
    if (suffix) {
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > viewport.width) problems.push(`horizontal overflow: ${sw}px`);
    } else {
      await page.addScriptTag({ content: axe });
      const v = await page.evaluate(async () => {
        // @ts-expect-error injected
        const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] });
        return r.violations.map((x) => `${x.impact} ${x.id} (${x.nodes.length}x) ${JSON.stringify(x.nodes[0]?.target)}`);
      });
      problems.push(...v.map((x) => `axe: ${x}`));
    }
    console.log(`${problems.length ? "✗" : "✓"} ${id}${suffix}${problems.length ? "\n    " + problems.join("\n    ") : ""}`);
    failures += problems.length ? 1 : 0;
    await ctx.close();
  }
}
await browser.close();
console.log(failures ? `${failures} checks failed` : "all checks passed");
process.exit(failures ? 1 : 0);
