import { db, expect, outbox, test } from "./fixtures";

const cleanup = async () => {
  await db()`delete from leads where email like '%@anfrage.example'`;
  await db()`delete from rate_limit_events where key like 'lead:%'`; // all test runs share one address
};

test.describe("Nachfrage vor dem Start", () => {
  test.beforeEach(async () => { await cleanup(); });
  test.afterAll(async () => { await cleanup(); });

  test("D-H1 Anfrage über die Startseite: gespeichert mit Herkunft, Mail an Vertrieb und Bestätigung", async ({ page, axe }) => {
    await page.goto("/?utm_source=linkedin&utm_medium=social&utm_campaign=vorstart");
    const form = page.getByRole("region", { name: "Deine Zahlen im Board" });
    await form.getByLabel("Dein Name").fill("Jana Köhler");
    await form.getByLabel("Betrieb").fill("Café Morgenrot & Söhne");
    await form.getByLabel("E-Mail").fill("jana@anfrage.example");
    await form.getByLabel("Wie viele Standorte?").fill("3");
    await form.getByLabel(/Was soll die Suite/).fill("=Kalkulation für drei Filialen 🍰");
    await axe();
    await form.getByRole("button", { name: "Vorführung anfragen" }).click();
    await expect(page.getByText("Danke, Jana Köhler!")).toBeVisible();
    const [lead] = await db()`select * from leads where email = 'jana@anfrage.example'`;
    expect([lead.source, lead.medium, lead.campaign, lead.outlets, lead.status]).toEqual(["linkedin", "social", "vorstart", 3, "new"]);
    await expect.poll(() => outbox().filter((m) => m.to === "vertrieb@example.com" && m.subject.includes("Café Morgenrot")).length).toBe(1);
    const notify = outbox().filter((m) => m.to === "vertrieb@example.com").at(-1)!;
    expect(notify.subject).toBe("Neue Anfrage: Café Morgenrot & Söhne (3 Standorte)");
    expect(notify.replyTo).toBe("jana@anfrage.example");
    expect(outbox().some((m) => m.to === "jana@anfrage.example" && m.subject.startsWith("Danke für deine Anfrage"))).toBe(true);
  });

  test("D-N1 Pflichtfelder, ungültige E-Mail und Bot-Falle", async ({ page }) => {
    await page.goto("/");
    const form = page.getByRole("region", { name: "Deine Zahlen im Board" });
    const valid = (label: string) => form.getByLabel(label).evaluate((el: HTMLInputElement) => el.validity.valid);
    await form.getByRole("button", { name: "Vorführung anfragen" }).click();
    expect(await valid("Dein Name")).toBe(false); // the browser stops it before anything is sent
    await form.getByLabel("Dein Name").fill("Bot");
    await form.getByLabel("Betrieb").fill("Bot GmbH");
    await form.getByLabel("E-Mail").fill("keine-adresse");
    await form.getByRole("button", { name: "Vorführung anfragen" }).click();
    expect(await valid("E-Mail")).toBe(false);
    await form.getByLabel("E-Mail").fill("bot@anfrage.example");
    await page.locator('input[tabindex="-1"]').fill("http://spam.example", { force: true });
    await form.getByRole("button", { name: "Vorführung anfragen" }).click();
    await expect(form.getByText("Bitte das Feld „Website“ leer lassen.")).toBeVisible();
    expect(await db()`select 1 from leads where email = 'bot@anfrage.example'`).toHaveLength(0);
  });

  test("D-E1 Zähler: Aufruf ohne Cookie gezählt, Bots nicht", async ({ request }) => {
    const views = async () => Number((await db()`select coalesce(sum(views), 0)::int as n from page_views where source = 'e2etest'`)[0].n);
    const before = await views();
    const browser = { "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0" };
    expect((await request.post("/api/hit", { data: { path: "/", source: "e2etest" }, headers: browser })).status()).toBe(204);
    await request.post("/api/hit", { data: { path: "/", source: "e2etest" }, headers: { "user-agent": "Googlebot/2.1" } });
    await request.post("/api/hit", { data: { path: "/admin", source: "e2etest" }, headers: browser });
    expect(await views()).toBe(before + 1);
    await db()`delete from page_views where source = 'e2etest'`;
  });

  test("D-H2 Übersicht für den Betreiber: Zahlen, Status, Notiz; für Küchen nicht vorhanden", async ({ page, login, axe }) => {
    await db()`insert into leads (name, company, email, outlets, source, campaign) values ('Tom Weber', 'Gasthaus Linde', 'tom@anfrage.example', 2, 'flyer', 'messe')`;
    await login("owner");
    await page.goto("/settings");
    await page.getByRole("link", { name: "Anfragen" }).click();
    await expect(page.getByRole("heading", { name: "Anfragen und Nachfrage" })).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: "Gasthaus Linde" });
    await expect(row).toContainText("Quelle: flyer / messe");
    await expect(page.getByRole("region", { name: "Nach Quelle" })).toContainText("flyer");
    await axe();
    await row.getByLabel("Status").selectOption("demo");
    await row.getByLabel("Notizen").fill("Vorführung Do 10 Uhr");
    await row.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Gespeichert")).toBeVisible();
    expect((await db()`select status, notes from leads where email = 'tom@anfrage.example'`)[0]).toEqual({ status: "demo", notes: "Vorführung Do 10 Uhr" });
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Als CSV exportieren" }).click();
    expect((await download).suggestedFilename()).toBe("anfragen.csv");
    await login("chef");
    await page.goto("/admin/leads");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/nicht gefunden/i);
    await expect(page.getByText("Gasthaus Linde")).toHaveCount(0);
  });
});
