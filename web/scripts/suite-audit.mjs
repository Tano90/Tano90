// Layout check for the GLB AI Suite: lists text that sticks out of its box (buttons, cells, headings) on every
// module. Run against a started server: BASE=http://localhost:3300 W=390 node scripts/suite-audit.mjs (exit 1 if any).
import { chromium } from "playwright-core";
const W = Number(process.env.W || 390);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-proxy-server"] });
const p = await b.newPage({ viewport: { width: W, height: 844 }, isMobile: W < 800, hasTouch: W < 800 });
await p.goto((process.env.BASE || "http://localhost:3300") + "/suite"); await p.waitForTimeout(1200);
const views = [...new Set(await p.$$eval("#sidebar [data-view]", bs => bs.map(b => b.dataset.view)))];
let total = 0;
for (const v of views) {
  await p.evaluate(v => document.querySelector('#sidebar [data-view="' + v + '"]').click(), v); await p.waitForTimeout(350);
  const bad = await p.evaluate(() => {
    const out = [];
    const sel = 'button, .btn, a, select, label, th, td, h1, h2, h3, h4, p, span, strong, b, small, .badge, .pill, .kpi-value, li';
    for (const e of document.querySelectorAll('#main ' + sel.split(', ').join(', #main ') + ', .topbar button, .glb08-bottomnav button')) {
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || !e.offsetParent) continue;
      if (e.closest('.table-scroll, .glbm-scroll, .v6-tabbar, .v6-metric-tabs, .v4-pills')) { if (!['BUTTON','A','SELECT'].includes(e.tagName) && !e.classList.contains('btn')) continue; }
      const clipsX = ['hidden','clip','auto','scroll'].includes(cs.overflowX) && cs.textOverflow === 'ellipsis';
      if (clipsX) continue;
      const over = e.scrollWidth - e.clientWidth;
      if (e.clientWidth > 0 && over > 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') out.push(`${e.tagName}.${String(e.className).slice(0,30)} +${over}px "${(e.textContent||'').trim().slice(0,30)}"`);
      // text overflowing parent box
      const r = e.getBoundingClientRect(), pr = e.parentElement?.getBoundingClientRect();
      if (pr && ['BUTTON','A'].includes(e.parentElement.tagName) && (r.left < pr.left - 2 || r.right > pr.right + 2)) out.push(`child-of-${e.parentElement.tagName} "${(e.textContent||'').trim().slice(0,30)}"`);
    }
    return [...new Set(out)];
  });
  if (bad.length) { total += bad.length; console.log(v + ':\n  ' + bad.slice(0, 12).join('\n  ')); }
}
console.log('TOTAL', total);
await b.close();
process.exit(total ? 1 : 0);
