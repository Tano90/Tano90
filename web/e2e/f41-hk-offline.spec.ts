import { db, expect, reseed, sid, test } from "./fixtures";

test.describe("Housekeeping ohne WLAN", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    for (const n of ["301", "302"]) {
      await db()`insert into rooms (library_id, outlet_id, number, status, occupancy, assigned_to) values (${sid("lib-demo")}, ${sid("out-mitte")}, ${n}, 'dirty', 'departure', ${sid("mem-3")})`;
    }
    await login("staff");
  });

  test("HOF-H1 offline melden, Tafel zeigt es sofort, Seite lädt offline, online wird nachgereicht", async ({ page, context }) => {
    await page.goto("/housekeeping");
    // Wait until the offline copy is in place, then load once more so the page itself is cached.
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.getByRole("button", { name: /^301/ }).click();
    await page.getByRole("dialog", { name: "Zimmer 301" }).getByRole("button", { name: "Als gereinigt melden" }).click();
    await expect(page.getByText("Zimmer 301 gereinigt (offline gespeichert)")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Kein Netz" })).toContainText("1 Änderung wartet");
    await page.getByRole("button", { name: /^302/ }).click();
    await page.getByRole("dialog", { name: "Zimmer 302" }).getByRole("button", { name: "Bitte nicht stören" }).click();
    await expect(page.getByRole("button", { name: /^302/ })).toContainText("Nicht stören");
    expect(await db()`select 1 from rooms where number = '301' and status = 'clean'`).toHaveLength(0);

    await page.reload(); // from the device, no network
    await expect(page.getByRole("button", { name: /^301/ })).toContainText("gereinigt");
    await expect(page.getByRole("alert").filter({ hasText: "Kein Netz" })).toContainText("2 Änderungen warten");

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(async () => (await db()`select status, dnd from rooms where number in ('301', '302') order by number`).map((r) => `${r.status}/${r.dnd}`)).toEqual(["clean/false", "dirty/true"]);
    await expect(page.getByText(/Änderungen? warten|Sende \d/)).toHaveCount(0);
  });
});
