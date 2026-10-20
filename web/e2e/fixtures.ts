// Shared test setup: every page fails the test on console errors and 5xx responses,
// `login` signs in as a seeded user, `axe` checks the current screen against WCAG 2.2 AA.
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { STRANGER, db, reseed, sid } from "./db";

type User = "owner" | "chef" | "staff" | "stranger";
const USER_ID: Record<User, string> = { owner: sid("usr-owner"), chef: sid("usr-chef"), staff: sid("usr-staff"), stranger: STRANGER.id };

// Wait for the page's scripts after every navigation: typing into a controlled input before its component
// has hydrated gets reset (page content hydrates after the layout, behind the loading boundary).
function waitForHydration(page: Page) {
  for (const name of ["goto", "reload"] as const) {
    const original = page[name].bind(page) as (...a: unknown[]) => Promise<unknown>;
    (page as unknown as Record<string, unknown>)[name] = async (...args: unknown[]) => {
      const res = await original(...args);
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      return res;
    };
  }
}

export const test = base.extend<{ login: (u: User) => Promise<void>; axe: () => Promise<void>; problems: string[]; hydration: void }>({
  hydration: [
    async ({ page, context }, use) => {
      waitForHydration(page);
      context.on("page", waitForHydration);
      await use();
    },
    { auto: true },
  ],
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      // ERR_INTERNET_DISCONNECTED only appears when a test switches the network off on purpose.
      page.on("console", (m) => m.type() === "error" && !m.text().includes("ERR_INTERNET_DISCONNECTED") && problems.push(`console: ${m.text()}`));
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
      page.on("response", (r) => r.status() >= 500 && problems.push(`${r.status()} ${r.request().method()} ${r.url()}`));
      await use(problems);
      expect(problems, "console errors or 5xx during the test").toEqual([]);
    },
    { auto: true },
  ],
  login: async ({ context, baseURL }, use) => {
    await use(async (u) => {
      await context.clearCookies();
      await context.addCookies([{ name: "kl_session", value: USER_ID[u], url: baseURL! }]);
    });
  },
  axe: async ({ page }, use) => {
    await use(async () => {
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  },
});

export { expect, sid, reseed, db };

/** Mails written to the dev outbox (no RESEND_API_KEY in tests). */
export function outbox(): { to: string; subject: string; idempotencyKey?: string; text: string }[] {
  const dir = fileURLToPath(new URL("../.outbox", import.meta.url));
  try {
    return readdirSync(dir).sort().map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  } catch {
    return [];
  }
}

/** Stock row text for an ingredient on /stock, e.g. "Speisequark 20 % … 2 kg …". */
export async function stockRow(page: Page, name: string) {
  await page.goto(`/stock?q=${encodeURIComponent(name)}`);
  return (await page.getByRole("row").filter({ hasText: name }).first().innerText()).replace(/\s+/g, " ");
}

export async function stockQuantity(name: string, outlet = "out-mitte") {
  const [r] = await db()`select sl.quantity_base::float as q from stock_levels sl join ingredients i on i.id = sl.ingredient_id where i.name = ${name} and sl.outlet_id = ${sid(outlet)}`;
  return r?.q ?? 0;
}

export async function expectNoHorizontalScroll(page: Page) {
  const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(sw, "page wider than the viewport").toBeLessThanOrEqual(vw);
}
