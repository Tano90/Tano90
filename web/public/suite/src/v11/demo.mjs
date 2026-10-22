/** Example data for the v1.1 modules (demo mode only, clearly marked in the UI).
 *  Based on the v1.1 RC1 demo (store.mjs, intelligence-ui.mjs): same checks, guests, prices and the deliberately missing
 *  cost on one dessert. Integration: articles and outlets are the suite's example master data, and a second evening adds
 *  water, upgrade, coffee and after-glow lines so that all six topics have example values. */
import { norm } from "./core.mjs";

// intelligence: finance data of the v1.1 modules (as in RC1). tasks/parStock are separate top-level keys because
// kitchen and service roles may read and write them (RC1: glb_v1_tasks, glb_v1_inventory).
export const EMPTY_INTELLIGENCE = () => ({ pos: [], tags: [], targets: [], markets: [], training: [] });

// [day, check, guests, article, quantity, gross price, net cost or null, vat, topic]
const CHECKS = [
  ["2026-10-20", "T001", 2, "Classic Cheeseburger", 2, 17.9, 4.55, 7, "none"],
  ["2026-10-20", "T001", 2, "Signature Cocktail", 2, 9.5, 2.45, 19, "aperitif"],
  ["2026-10-20", "T002", 1, "Rumpsteak 250 g", 1, 29.5, 11.65, 7, "none"],
  ["2026-10-20", "T002", 1, "Tagesdessert", 1, 8.9, null, 7, "dessert"],
  ["2026-10-20", "T003", 3, "Classic Cheeseburger", 3, 17.9, 4.55, 7, "none"],
  ["2026-10-20", "T003", 3, "Signature Cocktail", 1, 9.5, 2.45, 19, "aperitif"],
  ["2026-10-20", "T004", 2, "Caesar Salad", 2, 15.9, 4.2, 7, "none"],
  ["2026-10-21", "T005", 2, "Rumpsteak 250 g", 2, 29.5, 11.65, 7, "none"],
  ["2026-10-21", "T005", 2, "Signature Cocktail", 2, 9.5, 2.45, 19, "aperitif"],
  ["2026-10-21", "T006", 2, "Classic Cheeseburger", 2, 17.9, 4.55, 7, "none"],
  ["2026-10-21", "T007", 4, "Caesar Salad", 4, 15.9, 4.2, 7, "none"],
  ["2026-10-21", "T008", 2, "Rumpsteak 250 g", 2, 29.5, 11.65, 7, "none"],
  ["2026-10-22", "T009", 2, "Chicken Bowl", 2, 18.5, 5.85, 7, "none"],
  ["2026-10-22", "T009", 2, "Mineralwasser 0,75 l", 1, 6.5, 1.1, 19, "water"],
  ["2026-10-22", "T009", 2, "Trüffel Fries", 1, 8.9, 2.35, 7, "upgrade"],
  ["2026-10-22", "T010", 3, "Classic Cheeseburger", 3, 17.9, 4.55, 7, "none"],
  ["2026-10-22", "T010", 3, "Mineralwasser 0,75 l", 2, 6.5, 1.1, 19, "water"],
  ["2026-10-22", "T010", 3, "Apfelstrudel", 2, 10.2, 2.1, 7, "dessert"],
  ["2026-10-22", "T010", 3, "Espresso", 3, 2.9, 0.35, 19, "coffee"],
  ["2026-10-22", "T011", 2, "Dry Aged Steak", 2, 46.8, 19.5, 7, "none"],
  ["2026-10-22", "T011", 2, "Espresso", 2, 2.9, 0.35, 19, "coffee"],
  ["2026-10-22", "T011", 2, "Limoncello", 2, 5.5, 0.9, 19, "afterglow"],
  ["2026-10-22", "T012", 1, "Veggie Burger", 1, 16.8, 5.1, 7, "none"],
];
const STOCK = [
  ["Rinderhüfte", "kg", 9, 12, 30, "Lieferant hinterlegen"],
  ["Burger Buns", "Stück", 68, 30, 90, ""],
  ["Gin", "Flaschen", 3, 5, 12, ""],
];
// due dates relative to the day the demo opens (days from today), so no example task turns overdue by itself
const TASKS = [
  ["Wareneinsatz Tagesdessert hinterlegen", "high", "open", 1, "restaurant"],
  ["Rinderhüfte nachbestellen", "high", "open", 0, "restaurant"],
  ["Wochenreport prüfen", "medium", "done", -1, null],
];
// same day definition as the task list (calendar day in Berlin), so the offsets mean what they say
const localDay = (offset) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(Date.now() + offset * 86400000));

// Clearly fictitious competitor observations for the demo price comparison (Oct 2026): invented businesses,
// "example.com" as a reserved non-source, the note says so, and the UI shows "Fiktives Beispiel" instead of a source.
// [competitor, own article, own portion, competitor product, competitor portion, scope, competitor price]
const MARKETS = [
  ["Bistro am Markt (fiktiv)", "Classic Cheeseburger", "Portion", "Cheeseburger mit Pommes", "Portion", "same", 16.5],
  ["Steakhaus Nord (fiktiv)", "Rumpsteak 250 g", "250 g", "Rumpsteak mit zwei Beilagen", "300 g", "different", 32.0],
  ["Café Linde (fiktiv)", "Hausgemachte Limonade", "0,4 l", "Hauslimonade", "0,3 l", "same", 4.5],
  ["Gasthaus Brücke (fiktiv)", "Apfelstrudel", "Portion", "Apfelstrudel mit Eis", "Portion", "unknown", 8.9],
];

/** Adds the v1.1 areas to a data object without touching existing keys. Seeds example data once in demo mode.
 *  `data.products`/`data.items` and `data.outlets` are used to link example lines to existing master data. */
export function initializeIntelligence(data, mode = "demo") {
  data.intelligence ??= EMPTY_INTELLIGENCE();
  for (const [k, v] of Object.entries(EMPTY_INTELLIGENCE())) data.intelligence[k] ??= v;
  if (!Array.isArray(data.tasks)) data.tasks = [];
  if (!Array.isArray(data.parStock)) data.parStock = [];
  if (mode !== "demo" || data.intelligence.demoCreated) return data;
  const products = data.items || data.products || [];
  const byName = new Map(products.map((p) => [norm(p.name), p]));
  const outlet = (data.outlets || []).find((o) => norm(o.name) === "restaurant") || (data.outlets || [])[0];
  const outletId = outlet?.id || "demo-outlet-restaurant";
  if (!data.intelligence.pos.length)
    data.intelligence.pos = CHECKS.map(
      ([service_date, check_id, guests, product_name, quantity, unit_price_gross, unit_cost_net, vat_percent, stage], i) => ({
        id: `demo-pos-${i}`,
        service_date,
        check_id,
        guests,
        product_name,
        product_id: byName.get(norm(product_name))?.id ?? null,
        quantity,
        unit_price_gross,
        unit_cost_net,
        vat_percent,
        stage,
        outlet_id: outletId,
        source_hash: "demo",
        source_system: "demo",
        line_no: i + 2,
        file_name: "DEMO_POS.csv",
        staff_code: "",
        line_type: "sale",
      }),
    );
  if (!data.intelligence.markets.length)
    data.intelligence.markets = MARKETS.map(([competitor_name, own, own_portion, competitor_product, competitor_portion, scope, price], i) => {
      const p = byName.get(norm(own));
      return {
        id: `demo-market-${i}`,
        competitor_name,
        own_product: own,
        own_product_id: p?.id ?? null,
        own_portion,
        competitor_product,
        competitor_portion,
        scope,
        competitor_price_gross: price,
        our_price_gross: Number(p?.grossPrice) || null,
        source_url: "https://example.com/fiktive-beispielkarte",
        checked_on: "2026-10-15",
        note: "Fiktives Beispiel der Demo – keine echte Quelle, kein echter Betrieb.",
        example: true,
        created_at: "2026-10-15T08:00:00.000Z",
      };
    });
  if (!data.parStock.length)
    data.parStock = STOCK.map(([name, unit, stock, reorder_point, par_level, supplier], i) => ({
      id: `demo-stock-${i}`,
      name,
      unit,
      stock,
      reorder_point,
      par_level,
      supplier,
      version: 1,
    }));
  if (!data.tasks.length)
    data.tasks = TASKS.map(([title, priority, status, dueIn, outlet], i) => ({
      id: `demo-task-${i}`,
      title,
      priority,
      status,
      due_on: localDay(dueIn),
      // example outlet only if this example workspace has it; otherwise general (never a guess)
      outlet_id: (data.outlets || []).some((o) => o.id === outlet) ? outlet : null,
      version: 1,
      created_at: "2026-10-20T08:00:00.000Z",
    }));
  data.intelligence.demoCreated = true;
  return data;
}
