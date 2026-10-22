/* GLB AI Suite 0.4: Unit-safe recipes, catalogue parsing, stock snapshots and conservative demand planning. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GLBV04 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const R = (n) => Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
  const N = (v) => {
    if (typeof v === "number") return v;
    let s = String(v ?? "")
      .trim()
      .replace(/[€\s\u00a0]/g, "");
    if (!s) return NaN;
    if (s.includes(",") && s.includes("."))
      s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if (s.includes(",")) s = s.replace(",", ".");
    return Number(s);
  };
  const unitMap = {
    g: ["g", 1, "mass"],
    kg: ["g", 1000, "mass"],
    ml: ["ml", 1, "volume"],
    l: ["ml", 1000, "volume"],
    stk: ["stk", 1, "piece"],
    st: ["stk", 1, "piece"],
    pc: ["stk", 1, "piece"],
  };
  function convert(value, from, to) {
    const a = unitMap[String(from).toLowerCase()],
      b = unitMap[String(to).toLowerCase()],
      q = N(value);
    if (!a || !b || a[2] !== b[2] || !Number.isFinite(q) || q < 0) return null;
    return (q * a[1]) / b[1];
  }
  function baseQuantity(value, unit) {
    const a = unitMap[String(unit).toLowerCase()],
      v = N(value);
    return a && Number.isFinite(v) && v >= 0 ? R(v * a[1]) : null;
  }
  function baseUnit(unit) {
    return unitMap[String(unit).toLowerCase()]?.[0] || null;
  }
  function ingredientBaseCost(ing) {
    const packBase = baseQuantity(ing.packQty, ing.packUnit);
    const price = N(ing.packCostNet);
    return packBase > 0 && Number.isFinite(price) && price >= 0 ? price / packBase : null;
  }
  function recipeCalculation(recipe, ingredients) {
    const lookup = new Map(ingredients.map((x) => [x.id, x]));
    let total = 0;
    const lines = [];
    let valid = true;
    for (const l of recipe.lines || []) {
      const ing = lookup.get(l.ingredientId);
      if (!ing) {
        valid = false;
        lines.push({ name: "Unbekannte Zutat", valid: false });
        continue;
      }
      const amount = convert(l.amount, l.unit, baseUnit(ing.packUnit));
      const perUnit = ingredientBaseCost(ing);
      const loss = Number(l.wastePct ?? ing.wastePct ?? 0);
      if (amount === null || perUnit === null || !(loss >= 0 && loss < 100)) {
        valid = false;
        lines.push({ name: ing.name, valid: false });
        continue;
      }
      const purchase = amount / (1 - loss / 100);
      const cost = purchase * perUnit;
      total += cost;
      lines.push({ name: ing.name, qtyBase: R(purchase), unit: baseUnit(ing.packUnit), costNet: R(cost), valid: true });
    }
    const portions = N(recipe.yieldPortions ?? 1);
    if (!Number.isFinite(portions) || portions <= 0) valid = false;
    return { valid, lines, totalNet: R(total), costPerPortionNet: valid ? R(total / portions) : null };
  }
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  function parseTable(text) {
    const raw = String(text)
      .replace(/^\uFEFF/, "")
      .trim();
    if (!raw) throw Error("Datei ist leer");
    const first = raw.split(/\r?\n/)[0];
    const delimiter = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
    const rows = [];
    let quote = false,
      field = "",
      row = [];
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c === '"') {
        if (quote && raw[i + 1] === '"') {
          field += '"';
          i++;
        } else quote = !quote;
      } else if (c === delimiter && !quote) {
        row.push(field);
        field = "";
      } else if ((c === "\n" || c === "\r") && !quote) {
        if (c === "\r" && raw[i + 1] === "\n") i++;
        row.push(field);
        if (row.some((v) => v.trim())) rows.push(row);
        field = "";
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some((v) => v.trim())) rows.push(row);
    if (quote) throw Error("CSV-Anführungszeichen nicht geschlossen");
    return rows;
  }
  function parseMenuCSV(text) {
    const t = parseTable(text),
      cols = t.shift()?.map(norm) || [];
    const ix = (...names) => cols.findIndex((c) => names.some((n) => c === norm(n)));
    const ni = ix("Produkt", "Artikel", "Gericht", "Name"),
      pi = ix("Bruttopreis", "Preis", "VK brutto", "Verkaufspreis"),
      ci = ix("Kategorie", "Warengruppe", "Rubrik"),
      vi = ix("USt", "MwSt", "Steuer"),
      ui = ix("Einheit", "Portion");
    if (ni < 0 || pi < 0) throw Error("Spalten Produkt und Bruttopreis fehlen.");
    const rows = [],
      errors = [];
    for (const [i, r] of t.entries()) {
      const name = String(r[ni] || "")
          .trim()
          .slice(0, 120),
        price = N(r[pi]),
        vat = vi < 0 || !String(r[vi] || "").trim() ? 19 : N(r[vi]);
      if (!name || !Number.isFinite(price) || price <= 0 || ![0, 7, 19].includes(vat)) {
        errors.push("Zeile " + (i + 2));
        continue;
      }
      rows.push({
        name,
        category: ci < 0 ? "Speisekarte" : String(r[ci] || "Speisekarte").trim() || "Speisekarte",
        grossPrice: price,
        vat,
        unit: ui < 0 ? "Portion" : String(r[ui] || "Portion").trim() || "Portion",
      });
    }
    return { rows, errors };
  }
  function parseMenuText(text) {
    const rows = [],
      errors = [];
    const lines = String(text).split(/\r?\n/);
    let category = "Speisekarte";
    const re = /^(.{3,130}?)\s*(?:[.·•\-]{2,}\s*|\s{2,}|\s+)(\d{1,3}(?:[.,]\d{2}))\s*(?:€|EUR)?\s*$/i;
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) continue;
      const m = l.match(re);
      if (m) {
        const name = m[1].replace(/^[\s\d.)-]+/, "").trim(),
          price = N(m[2]);
        if (name.length >= 3 && price > 0 && price <= 999) rows.push({ name, category, grossPrice: price, vat: 19, unit: "Portion" });
        else errors.push(l.slice(0, 80));
      } else if (l.length >= 3 && l.length < 50 && !/[\d€]/.test(l) && /^[\p{L} &/\-]+$/u.test(l)) {
        category = l;
      }
    }
    return { rows, errors };
  }
  function parseRecipesCSV(text, productLookup, ingredientLookup) {
    const t = parseTable(text),
      cols = t.shift()?.map(norm) || [];
    const ix = (...names) => cols.findIndex((c) => names.some((n) => c === norm(n)));
    const fields = {
      product: ix("Produkt", "Artikel", "Gericht"),
      ingredient: ix("Zutat", "Rohware", "Ingredient"),
      amount: ix("Menge", "Einsatzmenge"),
      unit: ix("Einheit", "ME"),
      yield: ix("Portionen", "Rezeptportionen"),
      waste: ix("Schwund Prozent", "Schwund", "Verlust Prozent"),
    };
    if ([fields.product, fields.ingredient, fields.amount, fields.unit].some((i) => i < 0))
      throw Error("Erforderlich: Produkt, Zutat, Menge, Einheit.");
    const groups = new Map(),
      errors = [];
    for (const [i, r] of t.entries()) {
      const pn = String(r[fields.product] || "").trim(),
        inn = String(r[fields.ingredient] || "").trim();
      const product = productLookup.find((x) => norm(x.name) === norm(pn));
      const ing = ingredientLookup.find((x) => norm(x.name) === norm(inn));
      const qty = N(r[fields.amount]),
        unit = String(r[fields.unit] || "")
          .trim()
          .toLowerCase();
      const yieldPortions = fields.yield < 0 || !r[fields.yield] ? 1 : N(r[fields.yield]);
      const waste = fields.waste < 0 || !r[fields.waste] ? "" : N(r[fields.waste]);
      if (
        !product ||
        !ing ||
        baseQuantity(qty, unit) === null ||
        convert(qty, unit, baseUnit(ing.packUnit)) === null ||
        !(yieldPortions > 0) ||
        !(waste === "" || (Number.isFinite(waste) && waste >= 0 && waste < 100))
      ) {
        errors.push(`Zeile ${i + 2}: ${pn}/${inn} — bitte Produkt, Rohware, Einheit und Menge prüfen`);
        continue;
      }
      if (!groups.has(product.id)) groups.set(product.id, { productId: product.id, yieldPortions, lines: [] });
      const rec = groups.get(product.id);
      if (rec.yieldPortions !== yieldPortions) {
        errors.push(`Zeile ${i + 2}: widersprüchliche Portionsausbeute`);
        continue;
      }
      rec.lines.push({ ingredientId: ing.id, amount: qty, unit, wastePct: waste });
    }
    return { rows: [...groups.values()], errors };
  }
  function latestInventory(counts, asOf) {
    const out = new Map();
    const upto = asOf || "9999-12-31";
    for (const c of [...counts]
      .filter((x) => x.date <= upto)
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.savedAt || "").localeCompare(String(b.savedAt || "")))) {
      const key = c.warehouseId + "|" + c.ingredientId;
      out.set(key, c);
    }
    return out;
  }
  function demandForecast({
    dailySales,
    recipes,
    ingredients,
    inventoryCounts,
    periodDays = 7,
    recentWeight = 0.65,
    wasteSafetyPct = 10,
    referenceDate,
    leadDays = 2,
    coverageDays = 0,
  }) {
    const anchor = referenceDate || new Date().toISOString().slice(0, 10);
    const dayVal = (s) => Date.parse(s + "T00:00:00Z");
    const anchorValue = dayVal(anchor);
    if (!Number.isFinite(anchorValue)) throw Error("Ungültiger Stichtag");
    const byProduct = new Map();
    const uniqueDates = new Set();
    const dayTotals = new Map(); // date -> units, to tell days recorded with zero sales from missing days
    for (const sale of dailySales) {
      const d = dayVal(sale.date);
      if (!Number.isFinite(d) || d > anchorValue || d <= anchorValue - 28 * 86400000) continue;
      const age = Math.round((anchorValue - d) / 86400000),
        qty = N(sale.quantity);
      if (!Number.isFinite(qty)) continue; // negative lines are corrections and reduce the product's sum
      uniqueDates.add(sale.date);
      dayTotals.set(sale.date, (dayTotals.get(sale.date) || 0) + qty);
      const v = byProduct.get(sale.productId) || { w7: 0, w28: 0 };
      v.w28 += qty;
      if (age < 7) v.w7 += qty;
      byProduct.set(sale.productId, v);
    }
    const recipeByProduct = new Map(recipes.filter((x) => (x.lines || []).length).map((x) => [x.productId, x]));
    const demand = new Map();
    const invalidUnit = new Set(); // ingredient ids whose recipe quantity cannot be converted to the pack unit
    const inRecipe = new Set(recipes.flatMap((r) => (r.lines || []).map((l) => l.ingredientId)));
    let missingRecipes = [],
      missingCosts = [],
      unitsTotal = 0,
      unitsWithRecipe = 0;
    for (const [productId, x] of byProduct) {
      x.w7 = Math.max(0, x.w7);
      x.w28 = Math.max(0, x.w28);
      const rec = recipeByProduct.get(productId);
      unitsTotal += x.w28;
      if (rec) unitsWithRecipe += x.w28;
      if (!rec) {
        missingRecipes.push(productId);
        continue;
      }
      const daily = recentWeight * (x.w7 / 7) + (1 - recentWeight) * (x.w28 / 28);
      const servings = daily * (Math.max(1, N(periodDays)) + Math.max(0, N(leadDays)) + Math.max(0, N(coverageDays)));
      const portions = N(rec.yieldPortions) || 1;
      for (const l of rec.lines) {
        const ing = ingredients.find((x) => x.id === l.ingredientId);
        if (!ing) {
          missingCosts.push(l.ingredientId);
          continue;
        }
        const qty = convert(l.amount, l.unit, baseUnit(ing.packUnit));
        const loss = N(l.wastePct === "" || l.wastePct == null ? ing.wastePct : l.wastePct) || 0;
        if (qty === null || loss < 0 || loss >= 100) {
          missingCosts.push(ing.id);
          invalidUnit.add(ing.id);
          continue;
        }
        const total = (servings * qty) / (1 - loss / 100);
        demand.set(ing.id, (demand.get(ing.id) || 0) + total);
      }
    }
    const snapshots = latestInventory(inventoryCounts, anchor);
    const stock = new Map();
    for (const c of snapshots.values()) {
      const a = stock.get(c.ingredientId) || 0;
      stock.set(c.ingredientId, a + Number(c.baseQty || 0));
    }
    const hasStock = new Set([...snapshots.values()].map((x) => x.ingredientId));
    const rows = [];
    const noDays = uniqueDates.size === 0;
    for (const ing of ingredients) {
      // Why the usage is what it is: computed, a real zero, or not determinable (then no order quantity).
      const basis = demand.has(ing.id)
        ? "computed"
        : invalidUnit.has(ing.id)
          ? "invalid-unit"
          : !inRecipe.has(ing.id)
            ? "not-in-recipe"
            : noDays
              ? "no-data"
              : "no-sales";
      const determinable = basis === "computed" || basis === "no-sales";
      const unit = baseUnit(ing.packUnit),
        usage = demand.get(ing.id) || 0,
        withSafety = usage * (1 + Math.max(0, N(wasteSafetyPct)) / 100),
        known = hasStock.has(ing.id),
        available = known ? stock.get(ing.id) : null,
        need = known && determinable ? Math.max(0, withSafety - available) : null,
        packBase = baseQuantity(ing.packQty, ing.packUnit),
        packs = need !== null && packBase > 0 ? Math.ceil(Math.max(0, need - 1e-8) / packBase) : null;
      rows.push({
        id: ing.id,
        name: ing.name,
        unit,
        requiredBase: R(usage),
        requiredWithSafety: R(withSafety),
        stockBase: known ? R(available) : null,
        needBase: need === null ? null : R(need),
        packs,
        orderBase: packs === null ? null : R(packs * packBase),
        estimatedNet: packs === null ? null : R(packs * (N(ing.packCostNet) || 0)),
        validPrice: ingredientBaseCost(ing) !== null,
        basis,
        determinable,
      });
    }
    // Data quality from several sources, not only the number of days: days, recipe coverage of the units sold,
    // counted stock for the ingredients that are needed, and convertible units.
    const needed = rows.filter((r) => r.basis === "computed");
    const zeroDays = [...dayTotals.values()].filter((v) => v === 0).length;
    const recipeShare = unitsTotal > 0 ? unitsWithRecipe / unitsTotal : null;
    const stockShare = needed.length ? needed.filter((r) => r.stockBase !== null).length / needed.length : null;
    const reasons = [];
    if (uniqueDates.size < 21) reasons.push(`${28 - uniqueDates.size} von 28 Tagen ohne Tagesabsatz`);
    if (recipeShare !== null && recipeShare < 0.9)
      reasons.push(`nur ${Math.round(recipeShare * 100)} % der verkauften Einheiten mit Rezept`);
    if (stockShare !== null && stockShare < 0.9)
      reasons.push(`für ${needed.filter((r) => r.stockBase === null).length} benötigte Rohwaren kein gezählter Bestand`);
    if (invalidUnit.size) reasons.push(`${invalidUnit.size} Rohwaren mit nicht umrechenbarer Einheit`);
    const dataQuality = {
      rating:
        uniqueDates.size >= 21 && (recipeShare ?? 0) >= 0.9 && (stockShare ?? 0) >= 0.9 && !invalidUnit.size
          ? "gut"
          : uniqueDates.size >= 7 && (recipeShare ?? 0) >= 0.5
            ? "eingeschränkt"
            : "unzureichend",
      observedDays: uniqueDates.size,
      zeroDays,
      missingDays: 28 - uniqueDates.size,
      recipeShare,
      stockShare,
      reasons,
    };
    return {
      rows,
      uniqueObservedDates: uniqueDates.size,
      dataDays: 28,
      // Day coverage only (kept for compatibility); the overall rating is dataQuality.rating.
      quality: uniqueDates.size >= 21 ? "gut" : uniqueDates.size >= 7 ? "eingeschränkt" : "unzureichend",
      dataQuality,
      missingRecipes: [...new Set(missingRecipes)],
      missingCosts: [...new Set(missingCosts)],
      demandProducts: byProduct.size,
      assumptions: { periodDays, recentWeight, wasteSafetyPct, referenceDate: anchor, leadDays, coverageDays },
    };
  }
  /** One set of definitions for every forecast view (Oct 2026), so cards, tables and reports count the same things.
   *  order: packs to order · covered: enough stock · stockMissing: used in a recipe with demand, but no counted stock ·
   *  stockZero: counted stock is really 0 · noUsage: in no recipe, so no consumption can be derived ·
   *  noDays: no daily sales at all · invalidUnit: recipe unit not convertible · notComputable: order quantity cannot be
   *  computed although the ingredient is needed (stockMissing + invalidUnit + noDays for ingredients in recipes) ·
   *  missingRecipes: sold articles without recipe (article ids). */
  function forecastSummary(f) {
    const rows = f.rows || [],
      by = (fn) => rows.filter(fn);
    const stockMissing = by((r) => r.basis === "computed" && r.stockBase === null),
      invalidUnit = by((r) => r.basis === "invalid-unit"),
      noDays = by((r) => r.basis === "no-data");
    return {
      order: by((r) => r.packs > 0),
      covered: by((r) => r.packs === 0),
      stockMissing,
      stockZero: by((r) => r.stockBase === 0),
      noUsage: by((r) => r.basis === "not-in-recipe"),
      noDays,
      invalidUnit,
      notComputable: [...stockMissing, ...invalidUnit, ...noDays],
      missingRecipes: f.missingRecipes || [],
    };
  }
  /** Forecast quantities for people: kg and l from 1000 g/ml on, whole pieces, no false precision. */
  function displayQuantity(n, unit) {
    const v = Number(n);
    if (!Number.isFinite(v)) return { value: null, unit };
    const u = String(unit || "").toLowerCase();
    const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
    if ((u === "g" || u === "ml") && Math.abs(v) >= 1000) {
      const big = v / 1000;
      return { value: round(big, Math.abs(big) < 10 ? 2 : 1), unit: u === "g" ? "kg" : "l" };
    }
    if (u === "g" || u === "ml") return { value: Math.round(v), unit: u };
    if (u === "stk" || u === "stück") return { value: round(v, Math.abs(v) < 10 ? 1 : 0), unit: "Stk." };
    return { value: round(v, 2), unit };
  }
  return {
    forecastSummary,
    displayQuantity,
    N,
    R,
    norm,
    convert,
    baseQuantity,
    baseUnit,
    ingredientBaseCost,
    recipeCalculation,
    parseTable,
    parseMenuCSV,
    parseMenuText,
    parseRecipesCSV,
    latestInventory,
    demandForecast,
  };
});
