// Real screens of the suite demo (example data) for the scroll story on the start page.
// Run against a local demo server: BASE_URL=http://localhost:3300 node scripts/story-assets.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3300";
const OUT = "public/story";
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const jpg = (png, q = 82) => execFileSync("python3", ["-c", `from PIL import Image; im=Image.open("${png}").convert("RGB"); im.save("${png.replace(/\.png$/, ".jpg")}", quality=${q}, optimize=True, progressive=True)`]);
async function page(w, h, dpr, mobile = false) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, locale: "de-DE", timezoneId: "Europe/Berlin" });
  await p.goto(BASE + "/suite");
  await p.evaluate(() => localStorage.clear());
  return p;
}
const open = async (p, view) => {
  await p.goto(BASE + "/suite#" + view);
  await p.waitForFunction(() => window.GLBSuite && window.GLBV11);
  await p.waitForTimeout(700);
};
// the whole overview at 1440 px, sharp enough to zoom in (DPR 2), plus the boxes of its parts for the camera
let p = await page(1440, 900, 2);
await open(p, "overview");
const regions = await p.evaluate(() => {
  const box = (sel, i = 0) => { const e = document.querySelectorAll(sel)[i]; const r = e.getBoundingClientRect(); return [r.x, r.y + scrollY, r.width, r.height].map(Math.round); };
  return { sidebar: box("aside.sidebar"), top: box(".v6-executive"), chart: box(".v6-hero-card"), filter: box(".v6-filter-ribbon"), kpis: box(".v6-kpis"), actions: box(".v6-actions"), hints: box(".v6-action-list"), outlets: box(".v6-report-panel", 2) };
});
const H = regions.outlets[1] + regions.outlets[3] + 24;
await p.screenshot({ path: `${OUT}/screen-overview.png`, fullPage: true, clip: { x: 0, y: 0, width: 1440, height: H } });
execFileSync("python3", ["-c", `from PIL import Image; Image.open("${OUT}/screen-overview.png").convert("RGB").save("${OUT}/screen-overview.webp", quality=84, method=6)`]);
writeFileSync(`${OUT}/screen-overview.json`, JSON.stringify({ w: 1440, h: H, dpr: 2, regions }));
// outlet views: filter summary and figures of the overview, one outlet at a time
p = await page(1280, 900, 2);
for (const [id, file] of [["restaurant", "outlet-restaurant"], ["bar", "outlet-bar"], ["banquet", "outlet-bankett"]]) {
  await open(p, "overview");
  const value = await p.locator("#v6-filter-outlet option").evaluateAll((os, id) => (os.find((o) => o.value === id) || os.find((o) => o.textContent.toLowerCase().includes(id === "banquet" ? "bankett" : id)))?.value, id);
  await p.selectOption("#v6-filter-outlet", value);
  await p.waitForTimeout(400);
  const f = await p.locator(".v6-filter-ribbon").boundingBox(), k = await p.locator(".v6-kpis").first().boundingBox();
  await p.screenshot({ path: `${OUT}/${file}.png`, clip: { x: f.x - 8, y: f.y - 8, width: f.width + 16, height: k.y + k.height - f.y + 16 } });
  jpg(`${OUT}/${file}.png`, 85);
}
// phone screen: team tasks per outlet, a real mobile workflow
p = await page(390, 844, 2, true);
await open(p, "v11tasks");
await p.screenshot({ path: `${OUT}/screen-mobile.png` });
jpg(`${OUT}/screen-mobile.png`);
await b.close();
execFileSync("sh", ["-c", `rm -f ${OUT}/*.png`]);
console.log("story assets written");
