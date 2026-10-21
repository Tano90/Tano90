import { mkdirSync } from "node:fs";
import { db, expect, expectNoHorizontalScroll, outbox, reseed, sid, test } from "./fixtures";

const LIB = sid("lib-demo");
const OUT = sid("out-mitte");
const day = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
};

test.describe("Housekeeping: Wäsche, Belegung, Dienstplan, Übersicht", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await login("owner");
  });

  test("HW-H1 Artikel mit Set, Belegung, Vorschlag, Bestellung senden, Lieferung buchen", async ({ page, axe }) => {
    await page.goto("/housekeeping/waesche");
    await page.getByRole("button", { name: "Artikel anlegen" }).click();
    const dialog = page.getByRole("dialog", { name: "Wäscheartikel anlegen" });
    await dialog.getByLabel("Name").fill("Bettbezug 135×200");
    await dialog.getByLabel("Preis pro Stück (€)").fill("0,45");
    await dialog.getByLabel("Pro Zimmer").fill("2");
    await dialog.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Artikel angelegt")).toBeVisible();
    await expect(page.getByText("Pro Zimmer: 2")).toBeVisible();

    await page.getByRole("link", { name: "Belegung" }).click();
    await expect(page).toHaveURL(/\/housekeeping\/belegung$/);
    await page.getByRole("textbox", { name: /^Abreisen / }).nth(1).fill("5");
    await page.getByRole("textbox", { name: /^Bleiber / }).nth(1).fill("9");
    await axe();
    await page.getByRole("button", { name: "Belegung speichern" }).click();
    await expect(page.getByText(/Belegung gespeichert \(1 Tag\)/)).toBeVisible();

    // 5 departures + 9 stayovers / 3 = 8 changes × 2 = 16, + 10 % reserve = 17,6 → 18.
    await page.getByRole("link", { name: "Wäsche" }).click();
    const proposal = page.getByRole("region", { name: "Bestellvorschlag" });
    await expect(proposal.getByLabel("Bestellmenge Bettbezug 135×200")).toHaveValue("18");
    await expect(proposal).toContainText("8,10 €");
    await proposal.getByLabel("Wäscherei / Lieferant").selectOption({ label: "Frischehof Lindner" });
    await axe();
    await proposal.getByRole("button", { name: "Als Entwurf anlegen" }).click();
    await expect(page.getByText("Bestellung als Entwurf angelegt")).toBeVisible();

    const orders = page.getByRole("region", { name: "Bestellungen" });
    await orders.getByRole("button", { name: "Senden" }).click();
    await expect(page.getByText("Bestellung gesendet")).toBeVisible();
    const mail = outbox().filter((m) => m.subject.startsWith("Wäschebestellung")).at(-1)!;
    expect(mail.to).toBe("bestellung@frischehof.example");
    expect(mail.text).toContain("- 18 × Bettbezug 135×200");
    // Already on its way: the proposal drops to 0.
    await expect(proposal.getByLabel("Bestellmenge Bettbezug 135×200")).toHaveValue("");

    await orders.getByRole("button", { name: "Lieferung buchen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Buchen" }).click();
    await expect(page.getByText("Lieferung gebucht")).toBeVisible();
    await expect(page.getByRole("region", { name: "Zählung" }).getByRole("row", { name: /Bettbezug/ })).toContainText("18");
    const [m] = await db()`select qty, price_cents from linen_movements where kind = 'received'`;
    expect(m).toMatchObject({ qty: 18, price_cents: 45 });
  });

  test("HW-H2 Zählung durch das Team ergibt Verbrauch und Kosten", async ({ page, login }) => {
    const [{ id }] = await db()`insert into linen_items (library_id, outlet_id, name, kind, price_cents, stock_clean) values (${LIB}, ${OUT}, 'Handtuch groß', 'bath', 60, 100) returning id`;
    await db()`insert into linen_set_items (item_id, room_type, qty) values (${id}, '', 2)`;
    await login("staff");
    await page.goto("/housekeeping/waesche");
    await expect(page.getByRole("navigation", { name: "Housekeeping" }).getByRole("link", { name: "Übersicht" })).toHaveCount(0);
    await expect(page.getByLabel("Ausgesondert Handtuch groß")).toHaveCount(0);
    await page.getByLabel("Gezählt Handtuch groß").fill("70");
    await page.getByRole("button", { name: "Zählung speichern" }).click();
    await expect(page.getByText(/Zählung gespeichert/)).toBeVisible();
    const [c] = await db()`select qty, before from linen_movements where item_id = ${id} and kind = 'count'`;
    expect(c).toMatchObject({ qty: 70, before: 100 });

    await login("owner");
    await page.goto("/housekeeping/waesche");
    const usage = page.getByRole("region", { name: "Verbrauch und Kosten, letzte 30 Tage" });
    await expect(usage.getByRole("row", { name: /Handtuch groß/ })).toContainText("30");
    await expect(usage.getByRole("row", { name: /Handtuch groß/ })).toContainText("18,00 €");
    await page.goto("/housekeeping/belegung");
    await expect(page.getByText("Die Belegung pflegt die Leitung.")).toHaveCount(0);
  });

  test("HW-N1 Team-Konto: keine Übersicht, keine Belegung", async ({ page, login }) => {
    await login("staff");
    await page.goto("/housekeeping/dashboard");
    await expect(page.getByText(/Die Übersicht sieht die Leitung/)).toBeVisible();
    await page.goto("/housekeeping/belegung");
    await expect(page.getByText(/Die Belegung pflegt die Leitung/)).toBeVisible();
  });

  test("HW-E1 CSV aus dem Hotelprogramm: Fehler übernehmen nichts, gültige Datei schon", async ({ page }) => {
    await page.goto("/housekeeping/belegung");
    const upload = page.getByLabel("Belegungsbericht");
    await upload.setInputFiles({ name: "bericht.csv", mimeType: "text/csv", buffer: Buffer.from(`Datum;Zimmertyp;Anreisen;Abreisen;Bleiber\n${day(1)};;3;4;20\n31.02.2026;;x;1;1`) });
    await expect(page.getByText(/Zeile 3: Datum „31\.02\.2026“ nicht lesbar/)).toBeVisible();
    expect(await db()`select 1 from occupancy_plan`).toHaveLength(0);
    await upload.setInputFiles({ name: "bericht.csv", mimeType: "text/csv", buffer: Buffer.from(`Datum;Zimmertyp;Anreisen;Abreisen;Bleiber\n${day(1)};;3;4;20\n${day(2)};;1;2;18`) });
    await expect(page.getByText("2 Zeilen übernommen")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^Bleiber / }).nth(2)).toHaveValue("18");
  });

  test("HW-H3 Dienstplan: Schicht anlegen, Stunden gegen Bedarf, Vorwoche übernehmen", async ({ page, axe }) => {
    await db()`insert into occupancy_plan (outlet_id, library_id, day, room_type, arrivals, departures, stayovers) values (${OUT}, ${LIB}, ${day(0)}, '', 2, 10, 20)`;
    await page.goto("/housekeeping/dienstplan");
    // 10 × 30 + 20 × 15 + 2 × 5 = 610 min ≈ 10,2 h
    const todayCard = page.getByRole("listitem").filter({ hasText: "Heute" });
    await expect(todayCard).toContainText("0 / 10,2 Std. · 10,2 Std. fehlen");
    await todayCard.getByRole("button", { name: /Schicht am .* hinzufügen/ }).click();
    const dialog = page.getByRole("dialog", { name: "Schicht anlegen" });
    await dialog.getByLabel("Person").selectOption({ label: "Andere Person (ohne Konto)" });
    await dialog.getByLabel("Name").fill("Maria Kowalska");
    await axe();
    await dialog.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Schicht angelegt")).toBeVisible();
    await expect(todayCard).toContainText("Maria Kowalska");
    await expect(todayCard).toContainText("8 / 10,2 Std. · 2,2 Std. fehlen");
    await expect(page.getByRole("region", { name: "Stunden pro Person" })).toContainText("8 Std.");

    await page.getByRole("link", { name: "Nächste Woche" }).click();
    await page.getByRole("button", { name: "Vorwoche übernehmen" }).click();
    await expect(page.getByText("Vorwoche übernommen")).toBeVisible();
    await expect(page.getByRole("region", { name: "Stunden pro Person" })).toContainText("Maria Kowalska");
    expect(await db()`select 1 from hk_shifts`).toHaveLength(2);
  });

  test("HW-H4 Übersicht: Kennzahlen, Hinweise, Diagramme, Wäschetabelle", async ({ page, axe }) => {
    await db()`insert into rooms (library_id, outlet_id, number, room_type, status, occupancy) select ${LIB}, ${OUT}, (100 + g)::text, case when g % 3 = 0 then 'Einzelzimmer' else 'Doppelzimmer' end,
      case when g <= 12 then 'inspected' when g <= 20 then 'clean' else 'dirty' end, case when g <= 18 then 'occupied' when g <= 24 then 'departure' when g <= 27 then 'arrival' else 'vacant' end from generate_series(1, 30) g`;
    const items = [["Bettbezug", "bed", 45, 40, 2, 1], ["Kissenbezug", "bed", 25, 120, 4, 2], ["Laken", "bed", 40, 60, 2, 1], ["Handtuch groß", "bath", 60, 50, 2, 1], ["Handtuch klein", "bath", 40, 140, 2, 1], ["Badvorleger", "other", 35, 30, 1, 1]] as const;
    for (const [name, kind, price, stock, dz, ez] of items) {
      const [{ id }] = await db()`insert into linen_items (library_id, outlet_id, name, kind, price_cents, stock_clean) values (${LIB}, ${OUT}, ${name}, ${kind}, ${price}, ${stock}) returning id`;
      await db()`insert into linen_set_items (item_id, room_type, qty) values (${id}, 'Doppelzimmer', ${dz}), (${id}, 'Einzelzimmer', ${ez})`;
      await db()`insert into linen_movements (library_id, outlet_id, item_id, kind, qty, before, price_cents, at) values (${LIB}, ${OUT}, ${id}, 'count', ${stock + 20}, ${stock + 20}, ${price}, now() - interval '20 days'), (${LIB}, ${OUT}, ${id}, 'count', ${stock}, ${stock + 260}, ${price}, now() - interval '1 hour')`;
    }
    for (let i = -25; i < 14; i++) {
      const w = (i + 30) % 7;
      await db()`insert into occupancy_plan (outlet_id, library_id, day, room_type, arrivals, departures, stayovers) values
        (${OUT}, ${LIB}, ${day(i)}, 'Doppelzimmer', ${4 + (w % 3)}, ${5 + (w % 4)}, ${12 + w}), (${OUT}, ${LIB}, ${day(i)}, 'Einzelzimmer', ${2}, ${1 + (w % 2)}, ${5})`;
    }
    for (let i = 0; i < 7; i++) for (const [p, a, b] of [["Maria Kowalska", "07:00", "15:30"], ["Jonas Berg", "08:00", "14:00"]]) {
      if (i === 3 && p === "Jonas Berg") continue;
      await db()`insert into hk_shifts (library_id, outlet_id, day, person, starts, ends, break_minutes) values (${LIB}, ${OUT}, ${day(i)}, ${p}, ${a}, ${b}, 30)`;
    }
    await page.goto("/housekeeping/dashboard");
    const today = page.getByRole("region", { name: "Heute" });
    await expect(today).toContainText("Belegung heute");
    await expect(page.getByRole("region", { name: "Was jetzt wichtig ist" })).toContainText(/Anreise-Zimmer noch nicht freigegeben/);
    await expect(page.getByRole("region", { name: "Was jetzt wichtig ist" })).toContainText(/Bettbezug: Lager reicht nur noch/);
    await expect(page.getByRole("region", { name: "Was jetzt wichtig ist" })).toContainText(/Std\. Personal fehlen/);
    await expect(page.getByRole("img", { name: /Abreisen \d+, Bleiber \d+, Anreisen \d+/ }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Wäsche" }).getByRole("row", { name: /Kissenbezug/ })).toBeVisible();
    await axe();
    mkdirSync("../replica/clone-screens", { recursive: true });
    await page.screenshot({ path: "../replica/clone-screens/HK-dashboard.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: "../replica/clone-screens/HK-dashboard-mobile.png", fullPage: true });
    for (const path of ["/housekeeping/waesche", "/housekeeping/dienstplan", "/housekeeping/belegung"]) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/housekeeping/waesche");
    await axe();
    await page.screenshot({ path: "../replica/clone-screens/HK-waesche.png", fullPage: true });
    await page.goto("/housekeeping/dienstplan");
    await axe();
    await page.screenshot({ path: "../replica/clone-screens/HK-dienstplan.png", fullPage: true });
  });
});
