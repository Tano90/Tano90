import { db, expect, outbox, reseed, sid, test } from "./fixtures";

test.describe("A01 Anmelden, Sitzung, fremde Daten", () => {
  test.beforeAll(() => reseed());

  test("A01-H1 anmelden und abmelden", async ({ page, axe }) => {
    await page.goto("/login");
    await axe();
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page.getByRole("heading", { name: "Guten Tag, Demo" })).toBeVisible();
    await page.getByRole("button", { name: "Abmelden" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("A01-N1 unbekannte E-Mail", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill("niemand@example.com");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page.getByText("E-Mail oder Passwort stimmt nicht.")).toBeVisible();
  });

  test("A01-E1 abgelaufene Sitzung: zurück zur Anmeldung, nichts gespeichert", async ({ page, login, context }) => {
    await login("owner");
    await page.goto("/ingredients/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Nach Ablauf");
    await context.clearCookies();
    await page.getByRole("button", { name: /Anlegen und weiter/ }).click();
    await expect(page).toHaveURL(/\/login/);
    const rows = await db()`select 1 from ingredients where name = 'Nach Ablauf'`;
    expect(rows).toHaveLength(0);
  });

  test("A01-N2 zweiter Nutzer sieht nur eigene Daten", async ({ page, login }) => {
    await login("stranger");
    for (const path of [`/recipes/${sid("rec-linsensuppe")}`, `/orders/${sid("po-2")}`, `/suppliers/${sid("sup-frische")}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Nicht gefunden" })).toBeVisible();
    }
    await page.goto("/recipes");
    await expect(page.getByText("Noch keine Rezepte")).toBeVisible();
    await page.goto("/suppliers");
    await expect(page.getByText("Noch keine Lieferanten")).toBeVisible();
    await expect(page.getByLabel("Outlet")).toHaveText("Fremde Küche");
  });

  test("A01-N3 Team-Konto: kein Zugriff auf Team, nur eigenes Outlet", async ({ page, login }) => {
    await login("staff");
    await page.goto("/settings/team");
    await expect(page.getByText("Kein Zugriff")).toBeVisible();
    await expect(page.getByLabel("Outlet").locator("option")).toHaveText(["Küche Mitte"]);
  });
});

test.describe("A03 Einladen", () => {
  test.beforeAll(() => reseed());

  test("A03-H1 einladen, Mail, Link, annehmen", async ({ page, login, context, baseURL }) => {
    const newUser = "00000000-0000-4000-8000-00000000a003";
    await db()`delete from memberships where user_id = ${newUser}`;
    await db()`delete from auth.users where id = ${newUser}`;
    await login("owner");
    await page.goto("/settings/team");
    await page.getByRole("button", { name: "Einladen" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Robin Neu");
    await dialog.getByLabel("E-Mail").fill("neu@example.com");
    await dialog.getByRole("checkbox", { name: "Küche Mitte" }).check();
    await dialog.getByRole("button", { name: "Einladen" }).click();
    await expect(page.getByText("Einladung gesendet")).toBeVisible();
    const mail = outbox().filter((m) => m.to === "neu@example.com").at(-1)!;
    const link = mail.text.match(/https?:\/\/\S+\/invite\/\S+/)![0];
    expect(link.startsWith(baseURL!)).toBe(true);

    await db()`insert into auth.users (id, email) values (${newUser}, 'neu@example.com')`;
    await context.clearCookies();
    await context.addCookies([{ name: "kl_session", value: newUser, url: baseURL! }]);
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Einladung zu Demo Bistro" })).toBeVisible();
    await page.getByLabel("Dein Name").fill("Robin Neu");
    await page.getByRole("button", { name: "Einladung annehmen" }).click();
    await expect(page.getByRole("heading", { name: "Guten Tag, Robin" })).toBeVisible();
    const [m] = await db()`select role from memberships where user_id = ${newUser}`;
    expect(m.role).toBe("outlet_staff");
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Einladung ungültig" })).toBeVisible();
  });
});
