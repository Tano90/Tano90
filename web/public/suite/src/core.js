/* GLB AI Suite: deterministic business calculations. No external dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GLBCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function round(value, places = 2) {
    const factor = 10 ** places;
    return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
  }
  function median(values) {
    if (!values.length) return 0;
    const s = values.map(finite).sort((a, b) => a - b);
    const h = Math.floor(s.length / 2);
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }
  function metrics(item) {
    const quantity = Math.max(0, finite(item.quantity));
    const gross = Math.max(0, finite(item.grossPrice));
    const costs = costBreakdown(item);
    const cost = costs.goodsNet;
    const vat = [0, 7, 19].includes(Number(item.vat)) ? Number(item.vat) : 19;
    const netUnitPrice = gross / (1 + vat / 100);
    const db1Unit = netUnitPrice - cost;
    const contributionUnit = netUnitPrice - costs.variableNet;
    const revenueNet = netUnitPrice * quantity;
    const totalCostNet = cost * quantity;
    const totalVariableNet = costs.variableNet * quantity;
    return {
      ...item,
      quantity,
      grossPrice: gross,
      costNet: cost,
      vat,
      netUnitPrice,
      contributionUnit,
      db1Unit,
      db1: db1Unit * quantity,
      db2: contributionUnit * quantity,
      revenueNet,
      totalCostNet,
      totalVariableNet,
      variableNet: costs.variableNet,
      contribution: contributionUnit * quantity,
      foodCostPct: netUnitPrice > 0 ? (cost / netUnitPrice) * 100 : 0,
      marginPct: netUnitPrice > 0 ? (contributionUnit / netUnitPrice) * 100 : 0,
    };
  }
  function totals(items) {
    const list = items.map(metrics);
    const revenueNet = list.reduce((s, x) => s + x.revenueNet, 0);
    const totalCostNet = list.reduce((s, x) => s + x.totalCostNet, 0);
    const totalVariableNet = list.reduce((s, x) => s + x.totalVariableNet, 0);
    const db1 = revenueNet - totalCostNet;
    const contribution = revenueNet - totalVariableNet;
    const quantity = list.reduce((s, x) => s + x.quantity, 0);
    return {
      revenueNet,
      totalCostNet,
      totalVariableNet,
      db1,
      contribution,
      quantity,
      items: list.length,
      foodCostPct: revenueNet > 0 ? (totalCostNet / revenueNet) * 100 : 0,
      marginPct: revenueNet > 0 ? (contribution / revenueNet) * 100 : 0,
    };
  }
  function classify(items) {
    const list = items.map(metrics);
    if (!list.length) return { list: [], medianQuantity: 0, medianContribution: 0 };
    const medianQuantity = median(list.map((x) => x.quantity));
    const medianContribution = median(list.map((x) => x.contributionUnit));
    const classified = list.map((x) => {
      const highSales = x.quantity >= medianQuantity;
      const highContribution = x.contributionUnit >= medianContribution;
      return { ...x, quadrant: highSales ? (highContribution ? "star" : "runner") : highContribution ? "sleeper" : "loser" };
    });
    return { list: classified, medianQuantity, medianContribution };
  }
  function suggestedPrice(costNet, targetFoodCostPct, vat = 7) {
    const cost = finite(costNet),
      target = finite(targetFoodCostPct);
    if (cost < 0 || target <= 0 || target > 100 || ![0, 7, 19].includes(Number(vat))) return null;
    return (cost / (target / 100)) * (1 + Number(vat) / 100);
  }
  function parseNumberDE(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    const raw = String(value ?? "")
      .trim()
      .replace(/[€%\s\u00a0]/g, "");
    if (!raw) return NaN;
    let cleaned = raw;
    if (raw.includes(",") && raw.includes("."))
      cleaned = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
    else if (raw.includes(",")) cleaned = raw.replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) cleaned = raw.replace(/\./g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }
  function parseDelimited(text, delimiter) {
    const rows = [];
    let field = "",
      row = [],
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === delimiter && !quoted) {
        row.push(field);
        field = "";
      } else if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        if (row.some((x) => x.trim() !== "")) rows.push(row);
        row = [];
        field = "";
      } else field += c;
    }
    if (quoted) throw new Error("CSV enthält ein nicht geschlossenes Anführungszeichen.");
    row.push(field);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
    return rows;
  }
  function parseCSV(text) {
    const clean = String(text)
      .replace(/^\uFEFF/, "")
      .trim();
    if (!clean) throw new Error("Die CSV-Datei ist leer.");
    const headerLine = clean.split(/\r?\n/, 1)[0];
    const delimiter = (headerLine.match(/;/g) || []).length >= (headerLine.match(/,/g) || []).length ? ";" : ",";
    const rows = parseDelimited(clean, delimiter);
    if (rows.length < 2) throw new Error("CSV benötigt Kopfzeile und mindestens eine Datenzeile.");
    const norm = (s) =>
      String(s ?? "")
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    const hdr = rows[0].map(norm);
    const aliases = {
      name: ["produkt", "artikel", "name", "gericht", "produktname"],
      category: ["kategorie", "category", "gruppe", "warengruppe"],
      quantity: ["menge", "anzahl", "verkauft", "absatz", "quantity", "stuck", "stueck"],
      grossPrice: ["bruttopreis", "verkaufspreisbrutto", "preisbrutto", "vkbrutto", "grossprice", "verkaufspreis", "preis"],
      costNet: [
        "wareneinsatznetto",
        "wareneinsatz",
        "warenkosten",
        "einstandspreis",
        "costnet",
        "kostenproportion",
        "kosten",
        "wareneinsatzproportion",
      ],
      vat: ["mwst", "ust", "steuersatz", "vat", "steuer"],
    };
    const idx = {};
    for (const [key, als] of Object.entries(aliases)) idx[key] = hdr.findIndex((x) => als.includes(x));
    for (const key of ["name", "quantity", "grossPrice", "costNet"])
      if (idx[key] < 0)
        throw new Error(
          "Pflichtspalte fehlt: " + { name: "Produkt", quantity: "Menge", grossPrice: "Bruttopreis", costNet: "Wareneinsatz netto" }[key],
        );
    const items = [],
      errors = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((x) => !String(x).trim())) continue;
      const name = String(row[idx.name] ?? "").trim();
      const category = idx.category >= 0 ? String(row[idx.category] ?? "").trim() : "Sonstiges";
      const quantity = parseNumberDE(row[idx.quantity]);
      const grossPrice = parseNumberDE(row[idx.grossPrice]);
      const costNet = parseNumberDE(row[idx.costNet]);
      const vat = idx.vat < 0 || !String(row[idx.vat] ?? "").trim() ? 7 : parseNumberDE(row[idx.vat]);
      if (
        !name ||
        ![quantity, grossPrice, costNet, vat].every(Number.isFinite) ||
        !Number.isInteger(quantity) ||
        quantity < 0 ||
        grossPrice < 0 ||
        costNet < 0 ||
        ![0, 7, 19].includes(vat)
      ) {
        errors.push("Zeile " + (i + 1) + ": unvollständige oder ungültige Werte");
        continue;
      }
      items.push({
        id: "csv-" + i + "-" + Math.random().toString(36).slice(2, 8),
        name,
        category: category || "Sonstiges",
        quantity,
        grossPrice,
        costNet,
        vat,
      });
    }
    return { items, errors, delimiter };
  }
  function insights(items, targetPct = 30) {
    const classification = classify(items),
      t = totals(items),
      ranked = classification.list;
    const suggestions = [];
    const add = (level, title, detail, why) => suggestions.push({ level, title, detail, why });
    if (!ranked.length)
      return [
        {
          level: "info",
          title: "Noch keine Daten",
          detail: "Lege ein Produkt an oder importiere eine CSV-Datei.",
          why: "Ohne Produktdaten ist keine Analyse möglich.",
        },
      ];
    if (t.foodCostPct > targetPct) {
      add(
        "critical",
        "Wareneinsatz oberhalb des Zielwerts",
        `Aktueller gewichteter Wareneinsatz: ${round(t.foodCostPct, 1)} %. Dein Richtwert: ${round(targetPct, 1)} %. Prüfe zunächst die umsatzstärksten Artikel.`,
        "Gesamte Netto-Warenkosten geteilt durch gesamten Netto-Umsatz, gewichtet nach Mengen.",
      );
    }
    const losers = ranked.filter((x) => x.quadrant === "loser").sort((a, b) => a.contribution - b.contribution);
    if (losers.length) {
      const names = losers
        .slice(0, 3)
        .map((x) => x.name)
        .join(", ");
      add(
        "warning",
        `${losers.length} Artikel mit geringer Nachfrage und geringem Stück-DB`,
        `Prüfe Positionierung, Rezeptkosten oder Streichung: ${names}.`,
        "Unterhalb des Mengenmedians und unterhalb des Medians des Deckungsbeitrags je Stück.",
      );
    }
    const runners = ranked.filter((x) => x.quadrant === "runner").sort((a, b) => b.quantity - a.quantity);
    if (runners.length) {
      const x = runners[0];
      add(
        "warning",
        `${x.name}: hoher Absatz, niedriger Stück-DB`,
        `Bei ${x.quantity} Verkäufen beträgt der Stück-DB ${round(x.contributionUnit)} €. Kalkulation und Upsells prüfen.`,
        "Menge mindestens Median, Stück-DB unter Median.",
      );
    }
    const sleepers = ranked.filter((x) => x.quadrant === "sleeper").sort((a, b) => b.contributionUnit - a.contributionUnit);
    if (sleepers.length) {
      add(
        "opportunity",
        `Verkaufspotenzial bei ${sleepers[0].name}`,
        `Stück-DB: ${round(sleepers[0].contributionUnit)} €. Sichtbarkeit auf Karte und Empfehlung im Service testen.`,
        "Stück-DB mindestens Median, Menge unter Median.",
      );
    }
    const neg = ranked.filter((x) => x.contributionUnit < 0);
    if (neg.length) {
      add(
        "critical",
        `${neg.length} Artikel mit negativem Deckungsbeitrag`,
        `Sofort Preis, Kosten und Dateneingaben überprüfen: ${neg
          .slice(0, 3)
          .map((x) => x.name)
          .join(", ")}.`,
        "Netto-Verkaufspreis unter den direkten Netto-Warenkosten pro Portion.",
      );
    }
    if (!suggestions.length) {
      add(
        "good",
        "Keine offensichtlichen Auffälligkeiten",
        "Die aktuellen Produkte zeigen anhand der hinterlegten Werte keine Regelverletzung. Beobachte Mengen und Warenkosten weiter.",
        "Schwellwerte: gewichteter Wareneinsatz sowie Mengen- und Stück-DB-Median.",
      );
    }
    return suggestions.sort(
      (a, b) =>
        ({ critical: 0, warning: 1, opportunity: 2, good: 3, info: 4 })[a.level] -
        { critical: 0, warning: 1, opportunity: 2, good: 3, info: 4 }[b.level],
    );
  }

  // DB I = net sales price - recipe goods (including recipe waste).
  // DB II = DB I - packaging, directly variable labour, fees, other variable costs.
  function costBreakdown(item) {
    const d = item && item.costDetail;
    if (!d) {
      const goodsNet = Math.max(0, finite(item?.costNet));
      return {
        ingredientsNet: goodsNet,
        wasteNet: 0,
        goodsNet,
        packagingNet: 0,
        laborNet: 0,
        feesNet: 0,
        otherNet: 0,
        variableNet: goodsNet,
      };
    }
    const ingredientsNet = Math.max(0, finite(d.ingredientsNet));
    const wastePct = Math.max(0, Math.min(100, finite(d.wastePct)));
    const wasteNet = (ingredientsNet * wastePct) / 100;
    const goodsNet = ingredientsNet + wasteNet;
    const packagingNet = Math.max(0, finite(d.packagingNet));
    const laborNet = Math.max(0, finite(d.laborNet));
    const feesNet = Math.max(0, finite(d.feesNet));
    const otherNet = Math.max(0, finite(d.otherNet));
    return {
      ingredientsNet,
      wasteNet,
      goodsNet,
      packagingNet,
      laborNet,
      feesNet,
      otherNet,
      variableNet: goodsNet + packagingNet + laborNet + feesNet + otherNet,
    };
  }
  function saleMetrics(sale, product) {
    const cost = costBreakdown(product);
    const quantity = Math.max(0, finite(sale.quantity));
    const vat = Number(product.vat);
    const grossPrice = Math.max(0, finite(sale.grossPrice));
    const netPrice = grossPrice / (1 + vat / 100);
    return {
      ...sale,
      quantity,
      grossPrice,
      netPrice,
      revenueNet: quantity * netPrice,
      goodsTotal: quantity * cost.goodsNet,
      variableTotal: quantity * cost.variableNet,
      db1: quantity * (netPrice - cost.goodsNet),
      db2: quantity * (netPrice - cost.variableNet),
    };
  }
  function reportSales(sales, products, opts = {}) {
    const byId = new Map(products.map((p) => [String(p.id), p]));
    const list = sales
      .filter(
        (s) =>
          (!opts.outletId || s.outletId === opts.outletId) &&
          (!opts.month || s.month === opts.month) &&
          (!opts.productId || s.productId === opts.productId),
      )
      .map((s) => {
        const p = byId.get(String(s.productId));
        return p ? saleMetrics(s, p) : null;
      })
      .filter(Boolean);
    return {
      list,
      revenueNet: list.reduce((a, x) => a + x.revenueNet, 0),
      goodsNet: list.reduce((a, x) => a + x.goodsTotal, 0),
      variableNet: list.reduce((a, x) => a + x.variableTotal, 0),
      db1: list.reduce((a, x) => a + x.db1, 0),
      db2: list.reduce((a, x) => a + x.db2, 0),
      quantity: list.reduce((a, x) => a + x.quantity, 0),
    };
  }
  function addMonths(yyyyMM, delta) {
    const [y, m] = String(yyyyMM).split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return d.toISOString().slice(0, 7);
  }
  function lifecycle(sales, productId, launchMonth = "") {
    const groups = new Map();
    for (const x of sales) {
      if (String(x.productId) !== String(productId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(x.month))) continue;
      groups.set(x.month, (groups.get(x.month) || 0) + Math.max(0, finite(x.quantity)));
    }
    const months = [...groups.keys()].sort();
    if (months.length && /^\d{4}-(0[1-9]|1[0-2])$/.test(launchMonth)) {
      const [y, m] = launchMonth.split("-").map(Number),
        [ly, lm] = months.at(-1).split("-").map(Number);
      const monthsSinceLaunch = (ly - y) * 12 + (lm - m);
      if (monthsSinceLaunch >= 0 && monthsSinceLaunch <= 2)
        return {
          phase: "introduction",
          description: "Einführungsphase anhand des hinterlegten Startmonats; noch keine Trendbewertung",
          months: months.length,
          changePct: null,
          points: months.map((month) => ({ month, quantity: groups.get(month) })),
        };
    }
    if (months.length < 4)
      return {
        phase: "insufficient",
        description: "Mindestens 4 echte Verkaufsmonate erforderlich",
        months: months.length,
        changePct: null,
        points: months.map((month) => ({ month, quantity: groups.get(month) })),
      };
    const latest = months.at(-1),
      last4 = [-3, -2, -1, 0].map((d) => addMonths(latest, d));
    if (!last4.every((x) => groups.has(x)))
      return {
        phase: "incomplete",
        description: "In den letzten 4 Kalendermonaten fehlen Verkaufsdaten; 0 und fehlend sind nicht gleich",
        months: months.length,
        changePct: null,
        points: months.map((month) => ({ month, quantity: groups.get(month) })),
      };
    const before = (groups.get(last4[0]) + groups.get(last4[1])) / 2;
    const after = (groups.get(last4[2]) + groups.get(last4[3])) / 2;
    const changePct = before === 0 ? (after > 0 ? null : 0) : ((after - before) / before) * 100;
    const phase = changePct === null ? "insufficient" : changePct >= 20 ? "growth" : changePct <= -20 ? "decline" : "maturity";
    return {
      phase,
      changePct,
      months: months.length,
      latest,
      description: "Indikative Einordnung: Ø der letzten 2 Monate gegenüber den vorherigen 2 Monaten",
      points: months.map((month) => ({ month, quantity: groups.get(month) })),
    };
  }
  function marketComparison(ownGross, competitionGross, ownUnit, competitionUnit) {
    const own = finite(ownGross),
      other = finite(competitionGross);
    const comparable = Boolean(
      String(ownUnit || "").trim() &&
        String(ownUnit).trim().toLowerCase() ===
          String(competitionUnit || "")
            .trim()
            .toLowerCase(),
    );
    if (own <= 0 || other <= 0) return { comparable: false, difference: null, differencePct: null };
    return { comparable, difference: own - other, differencePct: ((own - other) / other) * 100 };
  }
  // Monthly cost pools: do not add material cost pool to the costs already deducted per sold product.
  // A full-cost price is a pricing model, NOT a true unit contribution margin.
  function monthlyCostModel(costs, salesRevenueNet) {
    const keys = ["energy", "payroll", "overhead", "goods"];
    const normalized = {};
    for (const k of keys) normalized[k] = Math.max(0, finite(costs?.[k]));
    const turnover = Math.max(0, finite(costs?.revenueOverrideNet) || finite(salesRevenueNet));
    const fixed = normalized.energy + normalized.payroll + normalized.overhead;
    const fixedRate = turnover > 0 ? fixed / turnover : null;
    const goodsRate = turnover > 0 ? normalized.goods / turnover : null;
    return { ...normalized, fixed, turnover, fixedRate, goodsRate, totalRate: turnover > 0 ? (fixed + normalized.goods) / turnover : null };
  }
  function targetPriceModel(product, monthlyCosts, targetProfitPct = 10) {
    const c = costBreakdown(product),
      model = monthlyCosts || {};
    const fixedRate = model.fixedRate;
    const targetRate = Math.max(0, finite(targetProfitPct)) / 100;
    const vat = [0, 7, 19].includes(Number(product.vat)) ? Number(product.vat) : 19;
    const gross = Math.max(0, finite(product.grossPrice));
    const net = gross / (1 + vat / 100);
    const leftover = fixedRate === null || fixedRate === undefined ? null : 1 - fixedRate - targetRate;
    const targetNet = leftover !== null && leftover > 0 ? c.variableNet / leftover : null;
    const targetGross = targetNet === null ? null : targetNet * (1 + vat / 100);
    const allocatedFixedNet = fixedRate === null ? null : net * fixedRate;
    return {
      gross,
      net,
      variableNet: c.variableNet,
      db1Net: net - c.goodsNet,
      db2Net: net - c.variableNet,
      fixedRate,
      targetRate,
      targetGross,
      targetNet,
      deltaGross: targetGross === null ? null : targetGross - gross,
      allocatedFixedNet,
      illustrativeResultNet: allocatedFixedNet === null ? null : net - c.variableNet - allocatedFixedNet,
      valid: targetGross !== null,
    };
  }
  function productActions(items) {
    const cl = classify(items);
    return cl.list
      .map((p) => {
        const rate = p.netUnitPrice > 0 ? p.variableNet / p.netUnitPrice : Infinity;
        const opts = {
          star: [
            "Sichtbarkeit halten und Preis-/Nachfragereaktion vorsichtig testen",
            "Kleine Preisanpassung nur mit Absatzkontrolle; Lieferfähigkeit sichern.",
          ],
          runner: [
            "Marge verbessern: Einkauf, Portionsgröße und Add-on-Angebote prüfen",
            "Zuerst Rezeptkosten prüfen; Preistest in kleiner Größenordnung durchführen.",
          ],
          sleeper: [
            "Aktiver im Service anbieten und auf der Karte sichtbarer machen",
            "Empfehlungssatz testen, Platzierung anpassen, Conversion nach 2 Wochen prüfen.",
          ],
          loser: [
            "Überarbeiten oder aus dem Sortiment nehmen",
            "Testphase mit neuer Positionierung; bei anhaltend geringer Nachfrage streichen.",
          ],
        };
        let [action, test] = opts[p.quadrant] || opts.loser;
        if (p.contributionUnit < 0) {
          action = "Verlustartikel: Einstand, Rezeptur und VK sofort korrigieren";
          test = "Jeder zusätzliche Verkauf senkt den Gesamt-DB II; erst Ursachen prüfen.";
        }
        return { ...p, variableRatePct: rate * 100, action, test };
      })
      .sort(
        (a, b) => ({ loser: 0, runner: 1, sleeper: 2, star: 3 })[a.quadrant] - { loser: 0, runner: 1, sleeper: 2, star: 3 }[b.quadrant],
      );
  }
  const FUNNEL_STEPS = [
    { id: "aperitif", label: "Aperitifs", short: "Aperitif" },
    { id: "water", label: "Wasserflaschen", short: "Wasser" },
    { id: "upgrades", label: "Upgrades", short: "Upgrades" },
    { id: "sides", label: "Beilagen", short: "Beilagen" },
    { id: "desserts", label: "Desserts", short: "Desserts" },
    { id: "coffee", label: "Kaffees", short: "Kaffee" },
  ];
  function funnelSummary(rows, assumptions, targetConversions, trafficLiftPct = 0) {
    const covers = rows.reduce((s, r) => s + Math.max(0, finite(r.covers)), 0);
    const byStep = {};
    let incrementalRevenueNet = 0,
      incrementalDB2 = 0;
    for (const { id, label } of FUNNEL_STEPS) {
      const sold = rows.reduce((s, r) => s + Math.max(0, finite(r[id])), 0);
      const currentPct = covers > 0 ? (sold / covers) * 100 : null;
      const targetPct = Math.max(0, Math.min(200, finite(targetConversions?.[id])));
      const projectedCovers = covers * (1 + Math.max(-100, finite(trafficLiftPct)) / 100);
      const projectedSold = (projectedCovers * targetPct) / 100;
      const diff = projectedSold - sold;
      const priceGross = Math.max(0, finite(assumptions?.[id]?.priceGross));
      const vat = [0, 7, 19].includes(Number(assumptions?.[id]?.vat)) ? Number(assumptions[id].vat) : 19;
      const variableNet = Math.max(0, finite(assumptions?.[id]?.variableNet));
      const priceNet = priceGross / (1 + vat / 100);
      const revenueDelta = diff * priceNet;
      const dbDelta = diff * (priceNet - variableNet);
      byStep[id] = {
        id,
        label,
        sold,
        covers,
        currentPct,
        targetPct,
        projectedSold,
        deltaUnits: diff,
        priceGross,
        priceNet,
        variableNet,
        revenueDelta,
        dbDelta,
      };
      incrementalRevenueNet += revenueDelta;
      incrementalDB2 += dbDelta;
    }
    return { covers, byStep, incrementalRevenueNet, incrementalDB2, trafficLiftPct };
  }
  function distanceKm(lat1, lon1, lat2, lon2) {
    const toR = Math.PI / 180,
      dlat = (lat2 - lat1) * toR,
      dlon = (lon2 - lon1) * toR;
    const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dlon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  return {
    round,
    median,
    metrics,
    totals,
    classify,
    suggestedPrice,
    parseNumberDE,
    parseDelimited,
    parseCSV,
    insights,
    costBreakdown,
    saleMetrics,
    reportSales,
    lifecycle,
    marketComparison,
    addMonths,
    monthlyCostModel,
    targetPriceModel,
    productActions,
    FUNNEL_STEPS,
    funnelSummary,
    distanceKm,
  };
});
