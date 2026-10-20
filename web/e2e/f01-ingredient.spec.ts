import { db, expect, expectNoHorizontalScroll, reseed, sid, test } from "./fixtures";

test.describe("F01 Zutat mit Lieferantenpreis anlegen", () => {
  test.beforeAll(() => reseed());
  test.beforeEach(async ({ login }) => login("owner"));

  const create = async (page: import("@playwright/test").Page, name: string) => {
    await page.goto("/ingredients/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
    await page.getByRole("button", { name: /Anlegen und weiter/ }).click();
    await page.waitForURL(/tab=packages/);
  };

  test("F01-H1 Zutat, Gebinde und Preis ergeben den kg-Preis", async ({ page, axe }) => {
    await create(page, "Brokkoli");
    await page.getByRole("button", { name: "Gebinde", exact: true }).click();
    await page.getByLabel("Menge in kg").fill("5");
    await page.getByRole("dialog").getByRole("button", { name: "Hinzufügen" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "5 kg" })).toBeVisible();
    await page.getByRole("button", { name: "Preis", exact: true }).click();
    await page.getByLabel(/Preis pro Gebinde/).fill("12,50");
    await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("2,50 €/kg")).toBeVisible();
    await axe();
    await page.goto("/ingredients?q=Brokkoli");
    const row = page.getByRole("row").filter({ hasText: "Brokkoli" });
    await expect(row).toContainText("2,50 €/kg");
    await expect(row).toContainText("ungeprüft");
  });

  test("F01-E1 leerer Name wird abgelehnt", async ({ page }) => {
    await page.goto("/ingredients/new");
    await page.getByRole("button", { name: /Anlegen und weiter/ }).click();
    await expect(page.getByText("Bitte einen Namen angeben.")).toBeVisible();
    await expect(page).toHaveURL(/ingredients\/new/);
  });

  test("F01-E2 langer Name mit Emoji und Akzenten", async ({ page }) => {
    const name = ("Crème brûlée Füllung mit Ährenmehl 🍮 " + "x".repeat(120)).slice(0, 120);
    await create(page, name);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ingredients?q=" + encodeURIComponent("Crème brûlée"));
    await expect(page.getByRole("link", { name })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("F01-E3 doppelter Name wird abgelehnt", async ({ page }) => {
    await page.goto("/ingredients/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("zwiebeln");
    await page.getByRole("button", { name: /Anlegen und weiter/ }).click();
    await expect(page.getByText(/Es gibt schon eine Zutat „Zwiebeln“/)).toBeVisible();
    const [{ n }] = await db()`select count(*)::int as n from ingredients where lower(name) = 'zwiebeln' and archived_at is null`;
    expect(n).toBe(1);
  });

  test("F01-E4 Preis pro kg auf einem 5-kg-Gebinde", async ({ page }) => {
    await create(page, "Blumenkohl");
    await page.getByRole("button", { name: "Gebinde", exact: true }).click();
    await page.getByLabel("Menge in kg").fill("5");
    await page.getByRole("dialog").getByRole("button", { name: "Hinzufügen" }).click();
    await page.getByRole("button", { name: "Preis", exact: true }).click();
    await page.getByRole("radio", { name: "pro kg" }).check();
    await page.getByLabel(/Preis pro kg/).fill("3,20");
    await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByRole("table", { name: "Lieferantenpreise" })).toContainText("3,20 €/kg");
  });

  test("F01-E5 Doppelklick legt genau eine Zutat an", async ({ page }) => {
    await page.goto("/ingredients/new");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Doppelklick-Zutat");
    await page.getByRole("button", { name: /Anlegen und weiter/ }).dblclick();
    await page.waitForURL(/tab=packages/);
    const [{ n }] = await db()`select count(*)::int as n from ingredients where name = 'Doppelklick-Zutat'`;
    expect(n).toBe(1);
  });

  test("F01-N1 Team-Konto sieht Zutaten nur lesend", async ({ page, login }) => {
    await login("staff");
    await page.goto(`/ingredients/${sid("ing-zwiebeln")}`);
    await expect(page.getByText("Du kannst Zutaten ansehen, aber nicht ändern.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Speichern" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeDisabled();
  });

  test("F01-N2 fremder Betrieb sieht die Zutat nicht", async ({ page, login }) => {
    await login("stranger");
    await page.goto(`/ingredients/${sid("ing-zwiebeln")}`);
    await expect(page.getByRole("heading", { name: "Nicht gefunden" })).toBeVisible();
    await page.goto("/ingredients");
    await expect(page.getByRole("link", { name: "Geheime Zutat" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zwiebeln" })).toHaveCount(0);
  });
});
