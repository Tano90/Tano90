import { db, expect, expectNoHorizontalScroll, reseed, sid, test } from "./fixtures";

// Seed order B-0001 (po-1) was delivered in full: onions, carrots, potatoes, apples, one pack each.
test.describe("F12 Rechnung abgleichen", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("R-H1 stimmt: vorbelegt mit der Lieferung, speichern, freigeben", async ({ page, axe }) => {
    await page.goto(`/orders/${sid("po-1")}`);
    await page.getByRole("link", { name: "Rechnung abgleichen" }).click();
    await expect(page.getByText("keine Differenz")).toBeVisible();
    await axe();
    await page.getByLabel("Rechnungsnummer").fill("RE-2026-0815");
    await page.getByRole("button", { name: "Rechnung speichern" }).click();
    await expect(page.getByText("Rechnung stimmt mit der Lieferung überein")).toBeVisible();
    await page.getByRole("button", { name: "Rechnung freigeben" }).click();
    await expect(page.getByText(/Freigegeben am .* von Demo Nutzer/)).toBeVisible();
    const [inv] = await db()`select match_status, total_net_cents from invoices where purchase_order_id = ${sid("po-1")}`;
    expect(inv.match_status).toBe("approved");
    const lines = await db()`select 1 from invoice_lines il join invoices i on i.id = il.invoice_id where i.purchase_order_id = ${sid("po-1")}`;
    expect(lines).toHaveLength(4);
  });

  test("R-E1 Abweichung: Menge und Preis markiert, Freigabe nur mit Begründung", async ({ page }) => {
    await page.goto(`/orders/${sid("po-1")}/invoice`);
    await page.getByLabel("Rechnungsnummer").fill("RE-77");
    await page.getByLabel("Berechnet: Zwiebeln, Sack 10 kg").fill("2");
    await page.getByLabel("Preis Rechnung: Karotten, Kiste 10 kg").fill("13.90");
    await expect(page.getByRole("row").filter({ hasText: "Zwiebeln" })).toContainText("+14,50");
    await expect(page.getByRole("row").filter({ hasText: "Karotten" })).toContainText("+1,00");
    await expect(page.getByText("Differenz +15,50")).toBeVisible();
    await page.getByRole("button", { name: "Rechnung speichern" }).click();
    await expect(page.getByText("Rechnung gespeichert – sie weicht ab")).toBeVisible();
    await page.getByRole("button", { name: "Rechnung freigeben" }).click();
    await expect(page.getByText(/Bitte kurz begründen/)).toBeVisible();
    await page.getByLabel(/Begründung/).fill("Gutschrift für den zweiten Sack angefordert.");
    await page.getByRole("button", { name: "Rechnung freigeben" }).click();
    await expect(page.getByText(/Gutschrift für den zweiten Sack/)).toBeVisible();
  });

  test("R-E2 Rechnungsnummer doppelt bei einem anderen Auftrag; Ändern hebt die Freigabe auf", async ({ page }) => {
    const [other] = await db()`insert into purchase_orders (library_id, outlet_id, supplier_id, order_number, status, ordered_at) values (${sid("lib-demo")}, ${sid("out-mitte")}, ${sid("sup-frische")}, 'B-0099', 'delivered', now()) returning id`;
    await db()`insert into invoices (library_id, supplier_id, purchase_order_id, invoice_number, invoice_date, total_net_cents) values (${sid("lib-demo")}, ${sid("sup-frische")}, ${other.id}, 'RE-1', '2026-10-01', 100)`;
    await page.goto(`/orders/${sid("po-1")}/invoice`);
    await page.getByLabel("Rechnungsnummer").fill("RE-1");
    await page.getByRole("button", { name: "Rechnung speichern" }).click();
    await expect(page.getByText(/RE-1 dieses Lieferanten ist schon bei einer anderen Bestellung erfasst/)).toBeVisible();
    await page.getByLabel("Rechnungsnummer").fill("RE-2");
    await page.getByRole("button", { name: "Rechnung speichern" }).click();
    await page.getByRole("button", { name: "Rechnung freigeben" }).click();
    await expect(page.getByText(/Freigegeben am/)).toBeVisible();
    await page.getByRole("button", { name: "Rechnung aktualisieren" }).click();
    await expect(page.getByRole("button", { name: "Rechnung freigeben" })).toBeVisible();
  });

  test("R-N1 offene Bestellung und Team-Konto", async ({ page, login }) => {
    await page.goto(`/orders/${sid("po-2")}/invoice`);
    await expect(page.getByText(/erst nach dem Wareneingang/)).toBeVisible();
    await login("staff");
    await page.goto(`/orders/${sid("po-1")}/invoice`);
    await expect(page.getByText(/dürfen Inhaber, Admins und die Küchenleitung/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Rechnung speichern" })).toHaveCount(0);
  });

  test("R-E4 Doppelklick auf Speichern: eine Rechnung, vier Zeilen", async ({ page }) => {
    await page.goto(`/orders/${sid("po-1")}/invoice`);
    await page.getByLabel("Rechnungsnummer").fill("RE-DOPPEL");
    await page.getByRole("button", { name: "Rechnung speichern" }).dblclick();
    await expect(page.getByText("Rechnung stimmt mit der Lieferung überein")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await db()`select 1 from invoices where invoice_number = 'RE-DOPPEL'`).toHaveLength(1);
    expect(await db()`select 1 from invoice_lines il join invoices i on i.id = il.invoice_id where i.invoice_number = 'RE-DOPPEL'`).toHaveLength(4);
  });

  test("R-E3 390 px: die Tabelle scrollt in sich, die Seite nicht", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/orders/${sid("po-1")}/invoice`);
    await expect(page.getByRole("table")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
