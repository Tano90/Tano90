import { db, expect, reseed, sid, test } from "./fixtures";

const LIB = sid("lib-demo");
const OUT = sid("out-mitte");

async function seedRooms() {
  // 101 stayover, 102 departure DND, 103 arrival 15:00, 104 arrival 12:00, 105 VIP stayover, 106 departure, 107 VIP arrival 15:00
  const rooms: [string, string, boolean, boolean, string | null][] = [
    ["101", "occupied", false, false, null], ["102", "departure", true, false, null], ["103", "arrival", false, false, "15:00"],
    ["104", "arrival", false, false, "12:00"], ["105", "occupied", false, true, null], ["106", "departure", false, false, null], ["107", "arrival", false, true, "15:00"],
  ];
  for (const [n, occ, dnd, vip, at] of rooms) {
    await db()`insert into rooms (library_id, outlet_id, number, floor, status, occupancy, dnd, vip, arrival_time) values (${LIB}, ${OUT}, ${n}, '1', 'dirty', ${occ}, ${dnd}, ${vip}, ${at})`;
  }
}

test.describe("Housekeeping: Dringlichkeit, Verteilung, Zeiten, Meldungen", () => {
  test.beforeEach(async ({ login }) => {
    reseed();
    await seedRooms();
    await login("owner");
  });

  test("HO-H1 Dringlichkeit und automatische Verteilung", async ({ page, axe }) => {
    await page.goto("/housekeeping");
    await page.getByLabel("Reihenfolge").selectOption("urgency");
    const tiles = page.getByRole("list").filter({ has: page.getByRole("checkbox", { name: /Zimmer 101 auswählen/ }) }).getByRole("listitem");
    const numbers = await tiles.evaluateAll((els) => els.map((e) => e.querySelector(".num")?.textContent));
    expect(numbers).toEqual(["107", "104", "103", "105", "106", "101", "102"]);
    await expect(tiles.filter({ hasText: "107" })).toContainText("Anreise 15:00");
    await expect(tiles.filter({ hasText: "102" })).toContainText("Nicht stören");
    await axe();

    await page.getByRole("button", { name: "Automatisch verteilen" }).click();
    const dialog = page.getByRole("dialog", { name: "Zimmer automatisch verteilen" });
    await dialog.getByLabel("Alex Wolf").check();
    await dialog.getByLabel("Sam Berger").check();
    await axe();
    await dialog.getByRole("button", { name: "Verteilen" }).click();
    await expect(page.getByText("6 Zimmer auf 2 Personen verteilt")).toBeVisible();
    const per = await db()`select m.display_name as name, count(*)::int as n from rooms r join memberships m on m.id = r.assigned_to where r.outlet_id = ${OUT} group by 1 order by 1`;
    expect(per.map((r) => r.name)).toEqual(["Alex Wolf", "Sam Berger"]);
    expect(per.reduce((n, r) => n + r.n, 0)).toBe(6);
    expect(await db()`select 1 from rooms where number = '102' and assigned_to is not null`).toHaveLength(0);
  });

  test("HO-H2 Team: Bitte nicht stören, Reinigung starten, Minuten pro Zimmer in der Übersicht", async ({ page, login }) => {
    await db()`update rooms set assigned_to = ${sid("mem-3")} where number in ('105', '106')`;
    await login("staff");
    await page.goto("/housekeeping");
    await page.getByRole("button", { name: /^106/ }).click();
    let dialog = page.getByRole("dialog", { name: "Zimmer 106" });
    await dialog.getByRole("button", { name: "Bitte nicht stören" }).click();
    await expect(page.getByText("Zimmer 106: bitte nicht stören")).toBeVisible();
    await page.getByRole("button", { name: /^106/ }).click();
    dialog = page.getByRole("dialog", { name: "Zimmer 106" });
    await dialog.getByRole("button", { name: "„Nicht stören“ aufheben" }).click();
    await page.getByRole("button", { name: /^106/ }).click();
    await page.getByRole("dialog", { name: "Zimmer 106" }).getByRole("button", { name: "Reinigung starten" }).click();
    await expect(page.getByText("Zimmer 106: Reinigung läuft")).toBeVisible();
    await db()`update rooms set cleaning_started_at = now() - interval '25 minutes' where number = '106'`;
    await page.reload();
    await page.getByRole("button", { name: /^106/ }).click();
    dialog = page.getByRole("dialog", { name: "Zimmer 106" });
    await expect(dialog).toContainText("Reinigung läuft seit");
    await dialog.getByRole("button", { name: "Als gereinigt melden" }).click();
    await expect(page.getByText("Zimmer 106 gereinigt")).toBeVisible();
    const [e] = await db()`select e.minutes from room_events e join rooms r on r.id = e.room_id where r.number = '106' and e.to_status = 'clean'`;
    expect(e.minutes).toBe(25);
    // VIP is the head of housekeeping's call.
    await page.getByRole("button", { name: /^105/ }).click();
    await expect(page.getByRole("dialog", { name: "Zimmer 105" }).getByLabel(/VIP-Gast/)).toHaveCount(0);

    await login("owner");
    await page.goto("/housekeeping/dashboard");
    await expect(page.getByRole("region", { name: "Reinigungszeiten, letzte 30 Tage" }).getByRole("row", { name: /Alex Wolf/ })).toContainText("25");
  });

  test("HO-H3 Schaden mit Foto melden, in Meldungen und Übersicht sehen, erledigen", async ({ page, axe }) => {
    await page.goto("/housekeeping");
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 40, height: 30 } });
    await page.getByRole("button", { name: /^101/ }).click();
    await page.getByRole("dialog", { name: "Zimmer 101" }).getByRole("button", { name: "Schaden melden" }).click();
    const report = page.getByRole("dialog", { name: "Schaden melden: Zimmer 101" });
    await report.getByLabel("Was ist kaputt?").fill("Duschabfluss verstopft");
    await report.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
    await expect(report.getByRole("img", { name: "Vorschau des Fotos" })).toBeVisible();
    await axe();
    await report.getByRole("button", { name: "Melden" }).click();
    await expect(page.getByText("Schaden gemeldet")).toBeVisible();

    await page.goto("/housekeeping/dashboard");
    await expect(page.getByRole("region", { name: "Was jetzt wichtig ist" })).toContainText("1 Schaden offen");
    await page.goto("/housekeeping/meldungen");
    const card = page.getByRole("listitem").filter({ hasText: "Duschabfluss verstopft" });
    await expect(card).toContainText("Zimmer 101");
    const img = card.getByRole("img", { name: "Foto: Duschabfluss verstopft" });
    await expect(img).toBeVisible();
    const res = await page.request.get((await img.getAttribute("src"))!);
    expect(res.headers()["content-type"]).toBe("image/jpeg");
    await axe();
    await card.getByRole("button", { name: "Erledigt" }).click();
    await page.getByRole("dialog").getByLabel(/Was wurde gemacht/).fill("Abfluss gereinigt");
    await page.getByRole("dialog").getByRole("button", { name: "Abschließen" }).click();
    await expect(page.getByText("Meldung erledigt")).toBeVisible();
    await expect(page.getByRole("region", { name: "Erledigt, letzte 30 Tage" })).toContainText("Abfluss gereinigt");
  });

  test("HO-E1 Fundsache ohne Zimmer vom Team", async ({ page, login }) => {
    await login("staff");
    await page.goto("/housekeeping/meldungen");
    await page.getByRole("button", { name: "Fundsache erfassen" }).click();
    const d = page.getByRole("dialog", { name: "Fundsache erfassen" });
    await d.getByLabel("Was wurde gefunden?").fill("Ladekabel, schwarz");
    await d.getByLabel(/Fundort/).fill("Lobby, liegt an der Rezeption");
    await d.getByRole("button", { name: "Melden" }).click();
    await expect(page.getByText("Fundsache gemeldet")).toBeVisible();
    await expect(page.getByRole("region", { name: /Offen/ })).toContainText("Ladekabel, schwarz");
  });
});
