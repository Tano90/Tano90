// Readable detail crops of real suite views (demo data) for the start page: article hint, recipe calculation,
// order proposal. Run against a local demo server: BASE_URL=http://localhost:3300 node scripts/suite-details.mjs
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3300";
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2, locale: "de-DE", timezoneId: "Europe/Berlin" });
await p.goto(BASE + "/suite");
await p.evaluate(() => localStorage.clear());
const open = async (view) => {
  await p.goto(BASE + "/suite#" + view);
  await p.waitForFunction(() => window.GLBSuite && window.GLBV11);
  await p.waitForTimeout(600);
};
const shot = async (locator, file, pad = 0) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await p.screenshot({ path: `public/landing/${file}`, clip: { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad } });
};
// 1 article hint: the first hint of the overview
await open("overview");
await shot(p.locator(".v6-action").first(), "detail-hint.png", 4);
// 2 recipe calculation: input panel and result side by side
await open("calculator");
const panels = p.locator("#main .panel");
const a = await panels.nth(0).boundingBox(), c = await panels.nth(1).boundingBox();
await p.screenshot({ path: "public/landing/detail-recipe.png", clip: { x: a.x - 12, y: a.y - 12, width: c.x + c.width - a.x + 24, height: Math.min(Math.max(a.height, c.height), 760) + 24 } });
// 3 order proposal: the forecast table
await open("purchasing");
await p.setViewportSize({ width: 1500, height: 1000 });
await open("purchasing");
const table = p.locator("#main table.data-table").first();
await table.scrollIntoViewIfNeeded();
const t = await table.boundingBox();
await p.screenshot({ path: "public/landing/detail-order.png", clip: { x: t.x - 12, y: t.y - 12, width: t.width + 24, height: Math.min(t.height, 560) + 24 } });
await b.close();
console.log("ok");
