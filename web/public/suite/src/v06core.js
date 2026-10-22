/* GLB AI Suite 0.6 – deterministic, offline reporting engine. */
(function (root, factory) {
  const api = factory(
    root?.GLBCore || (typeof require === "function" ? require("./core.js") : null),
    root?.GLBV04 || (typeof require === "function" ? require("./v04core.js") : null),
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GLBV06 = api;
})(typeof window !== "undefined" ? window : globalThis, function (C, V4) {
  "use strict";
  const round = (x) => Math.round((Number(x) + Number.EPSILON) * 100) / 100;
  const finite = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const add = (map, key, values) => {
    const old = map.get(key) || Object.fromEntries(Object.keys(values).map((k) => [k, 0]));
    for (const [k, v] of Object.entries(values)) old[k] += v;
    map.set(key, old);
  };
  function performance(data, { month = "all", outlet = "all", category = "all" } = {}) {
    const items = data.items || [],
      pids = new Map(items.map((x) => [x.id, x])),
      outlets = new Map((data.outlets || []).map((x) => [x.id, x.name]));
    const rows = [],
      byMonth = new Map(),
      byOutlet = new Map(),
      byCategory = new Map(),
      byProduct = new Map();
    for (const sale of data.sales || []) {
      const p = pids.get(sale.productId);
      if (
        !p ||
        (month !== "all" && sale.month !== month) ||
        (outlet !== "all" && sale.outletId !== outlet) ||
        (category !== "all" && p.category !== category)
      )
        continue;
      const m = C.saleMetrics(sale, p);
      const row = {
        ...m,
        name: p.name,
        category: p.category,
        productId: p.id,
        outletId: sale.outletId,
        outletName: outlets.get(sale.outletId) || "Ohne Zuordnung",
        month: sale.month,
      };
      rows.push(row);
      const values = {
        quantity: row.quantity,
        revenue: row.revenueNet,
        goods: row.goodsTotal,
        db1: row.db1,
        db2: row.db2,
        variable: row.variableTotal,
      };
      add(byMonth, row.month, values);
      add(byOutlet, row.outletId, values);
      add(byCategory, row.category, values);
      add(byProduct, row.productId, values);
    }
    const totals = rows.reduce(
      (a, r) => {
        a.revenue += r.revenueNet;
        a.goods += r.goodsTotal;
        a.variable += r.variableTotal;
        a.db1 += r.db1;
        a.db2 += r.db2;
        a.quantity += r.quantity;
        return a;
      },
      { revenue: 0, goods: 0, variable: 0, db1: 0, db2: 0, quantity: 0 },
    );
    totals.goodsPct = totals.revenue ? (totals.goods / totals.revenue) * 100 : null;
    totals.marginPct = totals.revenue ? (totals.db2 / totals.revenue) * 100 : null;
    const asArray = (map, lookup) =>
      [...map.entries()].map(([id, v]) => ({
        id,
        name: lookup(id),
        ...v,
        marginPct: v.revenue ? (v.db2 / v.revenue) * 100 : null,
        goodsPct: v.revenue ? (v.goods / v.revenue) * 100 : null,
      }));
    const months = asArray(byMonth, (k) => k).sort((a, b) => a.id.localeCompare(b.id));
    const byCategoryRows = asArray(byCategory, (k) => k).sort((a, b) => b.revenue - a.revenue);
    const byOutletRows = asArray(byOutlet, (k) => outlets.get(k) || "Ohne Zuordnung").sort((a, b) => b.revenue - a.revenue);
    const byProductRows = asArray(byProduct, (k) => pids.get(k)?.name || "Unbekannt").sort((a, b) => b.revenue - a.revenue);
    let cumulative = 0;
    const abc = byProductRows.map((r) => {
      cumulative += r.revenue;
      const share = totals.revenue ? (cumulative / totals.revenue) * 100 : 0;
      return {
        ...r,
        share: totals.revenue ? (r.revenue / totals.revenue) * 100 : 0,
        cumulativePct: share,
        abc: share <= 80 ? "A" : share <= 95 ? "B" : "C",
      };
    });
    return {
      rows,
      totals,
      months,
      categories: byCategoryRows,
      outlets: byOutletRows,
      products: byProductRows,
      abc,
      count: rows.length,
      filters: { month, outlet, category },
    };
  }
  function monthlyChange(months) {
    const m = months.filter((x) => /^\d{4}-\d{2}$/.test(x.id));
    if (m.length < 2) return null;
    const last = m.at(-1),
      prev = m.at(-2);
    const y = Number(last.id.slice(0, 4)),
      x = Number(last.id.slice(5)),
      py = Number(prev.id.slice(0, 4)),
      px = Number(prev.id.slice(5));
    if ((y - py) * 12 + (x - px) !== 1 || prev.revenue === 0) return null;
    return (last.revenue / prev.revenue - 1) * 100;
  }
  function funnel(data, { outlet = "all", from = "", to = "" } = {}) {
    const steps = ["aperitif", "water", "upgrades", "sides", "desserts", "coffee"];
    const rows = (data.funnel || [])
      .filter((r) => outlet === "all" || r.outletId === outlet)
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
      .sort((a, b) => a.date.localeCompare(b.date));
    const sums = Object.fromEntries(steps.map((k) => [k, 0]));
    let covers = 0;
    const daily = new Map();
    for (const r of rows) {
      const c = finite(r.covers);
      covers += c;
      const entry = daily.get(r.date) || { id: r.date, name: r.date, covers: 0, extras: 0, revenue: 0, db: 0 };
      entry.covers += c;
      for (const step of steps) {
        const n = Math.max(0, finite(r[step]));
        sums[step] += n;
        entry.extras += n;
        const a = data.funnelAssumptions?.[step] || {};
        const net = finite(a.priceGross) / (1 + finite(a.vat) / 100);
        entry.revenue += n * net;
        entry.db += n * (net - finite(a.variableNet));
      }
      daily.set(r.date, entry);
    }
    const metrics = steps.map((id) => {
      const a = data.funnelAssumptions?.[id] || {};
      const price = finite(a.priceGross) / (1 + finite(a.vat) / 100);
      const margin = price - finite(a.variableNet);
      const goal = finite(data.funnelGoals?.[id]);
      const count = sums[id];
      const rate = covers ? (100 * count) / covers : null;
      return {
        id,
        count,
        rate,
        goal,
        gap: rate === null ? null : goal - rate,
        netRevenue: count * price,
        db: count * margin,
        potentialItems: rate === null ? null : (Math.max(0, goal - rate) * covers) / 100,
        potentialDB: rate === null ? null : ((Math.max(0, goal - rate) * covers) / 100) * margin,
      };
    });
    const dailyRows = [...daily.values()].sort((a, b) => a.id.localeCompare(b.id));
    return {
      rows,
      steps: metrics,
      covers,
      days: dailyRows.length,
      daily: dailyRows,
      extras: Object.values(sums).reduce((a, v) => a + v, 0),
      revenue: metrics.reduce((s, v) => s + v.netRevenue, 0),
      db: metrics.reduce((s, v) => s + v.db, 0),
    };
  }
  function inventorySummary(data, stock) {
    const im = new Map((data.ingredients || []).map((x) => [x.id, x]));
    const wm = new Map((data.warehouses || []).map((x) => [x.id, x.name]));
    const buckets = new Map();
    let uncounted = stock.unknown.length,
      negative = 0,
      belowMinimum = 0,
      knownValue = 0;
    for (const r of stock.rows) {
      const ing = im.get(r.ingredientId);
      if (!ing) continue;
      const unitCost = V4.ingredientBaseCost(ing);
      const value = unitCost === null ? null : r.estimatedBase * unitCost;
      const name = wm.get(r.warehouseId) || "Ohne Lager";
      const x = buckets.get(r.warehouseId) || { id: r.warehouseId, name, count: 0, value: 0, unpriced: 0, risk: 0 };
      x.count++;
      if (value === null) x.unpriced++;
      else {
        x.value += value;
        knownValue += value;
      }
      if (r.estimatedBase < 0) negative++;
      if (Number(ing.minimumBase) > 0 && r.estimatedBase < Number(ing.minimumBase)) {
        belowMinimum++;
        x.risk++;
      }
      buckets.set(r.warehouseId, x);
    }
    return {
      warehouses: [...buckets.values()].sort((a, b) => b.value - a.value),
      knownValue,
      uncounted,
      negative,
      belowMinimum,
      unpriced: [...buckets.values()].reduce((a, x) => a + x.unpriced, 0),
      positions: stock.rows.length,
    };
  }
  function recipeSummary(data) {
    const recipes = data.recipes || [],
      ids = new Map((data.items || []).map((x) => [x.id, x])),
      rows = [];
    for (const r of recipes) {
      const p = ids.get(r.productId),
        calc = V4.recipeCalculation(r, data.ingredients || []);
      const sell = p ? finite(p.grossPrice) / (1 + finite(p.vat) / 100) : null;
      rows.push({
        id: r.productId,
        name: p?.name || "Ohne Artikel",
        cost: calc.costPerPortionNet,
        priceNet: sell,
        foodPct: calc.valid && sell > 0 ? (100 * calc.costPerPortionNet) / sell : null,
        db: calc.valid && sell !== null ? sell - calc.costPerPortionNet : null,
        valid: calc.valid,
      });
    }
    return {
      rows,
      valid: rows.filter((x) => x.valid).length,
      invalid: rows.filter((x) => !x.valid).length,
      unlinked: (data.items || []).filter((p) => !recipes.some((x) => x.productId === p.id)).length,
    };
  }
  function safeCSV(rows, columns) {
    const escape = (v) => {
      if (typeof v === "number" && Number.isFinite(v)) return '"' + String(v) + '"';
      const s = String(v ?? "");
      const guarded = /^[\s]*[=+@\-]/.test(s) ? "'" + s : s;
      return '"' + guarded.replace(/"/g, '""') + '"';
    };
    return (
      "\uFEFF" +
      columns.map((x) => escape(x.label)).join(";") +
      "\r\n" +
      rows.map((row) => columns.map((c) => escape(typeof c.value === "function" ? c.value(row) : row[c.value])).join(";")).join("\r\n")
    );
  }
  return { performance, monthlyChange, funnel, inventorySummary, recipeSummary, safeCSV, round };
});
