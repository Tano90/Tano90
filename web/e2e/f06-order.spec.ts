import { db, expect, outbox, reseed, sid, test } from "./fixtures";
import type { Page } from "@playwright/test";

const newOrder = async (page: Page, supplier: string) => {
  await page.goto("/orders/new");
  await page.getByRole("combobox", { name: "Lieferant", exact: true }).selectOption({ label: supplier });
  await expect(page.getByRole("table", { name: "Artikel dieses Lieferanten" })).toBeVisible();
};
const mailsTo = (to: string) => outbox().filter((m) => m.to === to);

test.describe("F06 Bestellen", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("staff");
  });

  test("F06-H1 Vorschlag nach Mindestbestand, senden, eine Mail", async ({ page, axe }) => {
    const before = mailsTo("order@talblick.example").length;
    await newOrder(page, "Molkerei Talblick");
    await page.getByRole("button", { name: /Vorschlag übernehmen/ }).click();
    await expect(page.getByLabel(/Anzahl .*Speisequark/)).toHaveValue("1");
    await axe();
    await page.getByRole("button", { name: "Bestellung senden" }).click();
    await expect(page.getByRole("dialog")).toContainText("order@talblick.example");
    await page.getByRole("dialog").getByRole("button", { name: "Senden" }).click();
    await page.waitForURL(/orders\/(?!new)[^/?]+$/);
    await expect(page.locator("header").getByText("Bestellt", { exact: true })).toBeVisible();
    const number = (await page.getByRole("heading", { level: 1 }).innerText()).replace("Bestellung ", "");
    const mails = mailsTo("order@talblick.example");
    expect(mails.length).toBe(before + 1);
    expect(mails.at(-1)!.subject).toContain(number);
    expect(mails.at(-1)!.text).toContain("Speisequark");
  });

  test("F06-H2 Vorschlag aus den Verkäufen der letzten Wochen", async ({ page }) => {
    // 1 l cream sold every day for four weeks; Molkerei delivers next day → covers 1 + 7 days: 8 l + 10 % reserve.
    const [{ id: ing }] = await db()`select id from ingredients where name = 'Schlagsahne 30 %'`;
    for (let i = 1; i <= 28; i++) {
      const [{ id }] = await db()`insert into stock_events (library_id, outlet_id, type, status, occurred_at) values (${sid("lib-demo")}, ${sid("out-mitte")}, 'sale', 'closed', now() - ${`${i} days`}::interval) returning id`;
      await db()`insert into stock_movements (stock_event_id, outlet_id, ingredient_id, delta_base, unit_cost_cents) values (${id}, ${sid("out-mitte")}, ${ing}, -1000, 0.35)`;
    }
    await newOrder(page, "Molkerei Talblick");
    await expect(page.getByRole("row", { name: /Schlagsahne/ })).toContainText("Bedarf 8 Tage laut Verkauf");
    await page.getByRole("button", { name: /Vorschlag übernehmen/ }).click();
    await expect(page.getByLabel(/Anzahl .*Schlagsahne/)).toHaveValue("9");
  });

  test("F06-E1 Doppelklick auf Senden verschickt eine Mail", async ({ page }) => {
    const before = mailsTo("order@talblick.example").length;
    await newOrder(page, "Molkerei Talblick");
    await page.getByLabel(/Anzahl .*Butter/).fill("1");
    await page.getByRole("button", { name: "Bestellung senden" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Senden" }).dblclick({ force: true }).catch(() => {});
    await page.waitForURL(/orders\/(?!new)[^/?]+$/);
    await expect(page.locator("header").getByText("Bestellt", { exact: true })).toBeVisible();
    expect(mailsTo("order@talblick.example").length).toBe(before + 1);
  });

  test("F06-E2 zwei Tabs senden denselben Entwurf: eine Mail, klare Meldung", async ({ page, context }) => {
    await newOrder(page, "Molkerei Talblick");
    await page.getByLabel(/Anzahl .*Butter/).fill("2");
    await page.getByRole("button", { name: "Als Entwurf speichern" }).click();
    await page.waitForURL(/orders\/(?!new)[^/?]+$/);
    const url = page.url();
    const second = await context.newPage();
    await second.goto(url);
    const before = mailsTo("order@talblick.example").length;
    for (const p of [page, second]) {
      await p.getByRole("button", { name: "Bestellung senden" }).click();
      await p.getByRole("dialog").getByRole("button", { name: "Senden" }).click();
    }
    await expect(second.getByText("Nur Entwürfe können geändert werden.")).toBeVisible();
    expect(mailsTo("order@talblick.example").length).toBe(before + 1);
  });

  test("F06-E3 Lieferant ohne Bestell-Adresse: Hinweis, keine Mail", async ({ page }) => {
    await db()`update suppliers set order_email = null where company_name = 'Großhandel Ostring'`;
    const before = outbox().length;
    await newOrder(page, "Großhandel Ostring");
    await page.getByLabel(/Anzahl .*Zucker/).fill("1");
    await page.getByRole("button", { name: "Bestellung senden" }).click();
    await expect(page.getByRole("dialog")).toContainText("keine Bestell-Adresse");
    await page.getByRole("dialog").getByRole("button", { name: "Senden" }).click();
    await expect(page.getByText(/telefonisch bestellen/)).toBeVisible();
    await page.waitForURL(/orders\/(?!new)[^/?]+$/);
    await expect(page.locator("header").getByText("Bestellt", { exact: true })).toBeVisible();
    expect(outbox().length).toBe(before);
  });

  test("F06-N1 ohne Mengen lässt sich nichts speichern oder senden", async ({ page }) => {
    await newOrder(page, "Molkerei Talblick");
    await expect(page.getByRole("button", { name: "Als Entwurf speichern" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Bestellung senden" })).toBeDisabled();
  });
});
