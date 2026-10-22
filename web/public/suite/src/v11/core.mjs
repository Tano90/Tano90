/** Pure GLB v1.0 application logic. No DOM, storage or network access.
 * Taken over from GLB AI Suite v1.1 RC1 (web/suite-v11-original/public/core.mjs). Changes are bug fixes, each marked
 * with "Integration:"; calculation definitions are unchanged. */
export const ROLES = {
  financial: new Set(["owner", "editor", "restaurant_manager", "general_manager"]),
  inventory: new Set(["owner", "editor", "restaurant_manager", "general_manager", "kitchen_lead", "kitchen_staff"]),
};
// Integration: three number sources are kept apart.
// numberDE   – German text and CSV cells: "1.234,56", "1,5", "1.234" (= 1234), "0.001" (= 0,001; a group may not start with 0)
// numberInput – values of <input type="number">: the browser always delivers a dot as decimal separator ("1.234" = 1,234)
// The v1.1 package read "0.001" as 1 and treated number-field values like German text.
export function numberDE(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const s = String(value ?? "")
    .trim()
    .replace(/\s|\u00a0|€/g, "");
  if (!s) return NaN;
  if (!/^[-+]?[\d.,]+$/.test(s)) return NaN;
  let n = s;
  const commas = (n.match(/,/g) || []).length,
    dots = (n.match(/\./g) || []).length;
  if (commas && dots) n = n.lastIndexOf(",") > n.lastIndexOf(".") ? n.replaceAll(".", "").replace(",", ".") : n.replaceAll(",", "");
  else if (commas === 1) n = n.replace(",", ".");
  else if (commas > 1) n = /^[-+]?[1-9]\d{0,2}(,\d{3})+$/.test(n) ? n.replaceAll(",", "") : "x";
  else if (/^[-+]?[1-9]\d{0,2}(\.\d{3})+$/.test(n)) n = n.replaceAll(".", "");
  else if (dots > 1) n = "x";
  return n === "x" ? NaN : Number(n);
}
export function numberInput(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const s = String(value ?? "").trim();
  return s === "" || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? NaN : Number(s);
}
export const money = (n) => {
  const c = Math.round((Number(n) || 0) * 100) / 100; // no "−0,00 €" for tiny negative rests
  return (c === 0 ? 0 : c).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
};
export const percent = (n) =>
  Number.isFinite(n) ? `${n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` : "—";
export const norm = (s) =>
  String(s ?? "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("de-DE");
export function parseCSV(input) {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";
  const records = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell.trim() === "") quoted = true;
      else if (quoted) quoted = false;
      else cell += c;
    } else if (c === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((x) => x !== "")) records.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Unvollständig geschlossene Anführungszeichen in CSV.");
  row.push(cell.trim());
  if (row.some((x) => x !== "")) records.push(row);
  if (!records.length) throw Error("CSV-Datei enthält keine Daten.");
  const headers = records.shift().map((x) => norm(x).replace(/[^a-z0-9äöüß]/g, ""));
  return records.map((fields, index) => ({
    lineNo: index + 2,
    values: Object.fromEntries(headers.map((k, j) => [k, fields[j] ?? ""])),
  }));
}
export function rowsFromCSV(csv, products, outlets, fileHash, fileName = "Import.csv") {
  const rows = parseCSV(csv);
  const errors = [],
    valid = [];
  const pMap = new Map(products.map((p) => [norm(p.name), p]));
  const oMap = new Map(outlets.map((o) => [norm(o.name), o]));
  const seenInFile = new Set();
  const required = ["produkt", "outlet", "monat", "menge", "bruttopreis"];
  if (rows.length === 0) return { valid: [], errors: ["CSV hat keine Datenzeilen."] };
  for (const row of rows) {
    const v = row.values,
      line = row.lineNo;
    const missing = required.filter((k) => !(k in v));
    if (missing.length) {
      errors.push(`Spalte(n) fehlen: ${missing.join(", ")}. Erwartet: Produkt;Outlet;Monat;Menge;Bruttopreis.`);
      break;
    }
    const p = pMap.get(norm(v.produkt)),
      o = oMap.get(norm(v.outlet));
    const month = (v.monat || "").trim();
    const quantity = numberDE(v.menge),
      price = numberDE(v.bruttopreis);
    if (!p) {
      errors.push(`Zeile ${line}: Artikel „${v.produkt}“ nicht im Artikelstamm.`);
      continue;
    }
    if (!o) {
      errors.push(`Zeile ${line}: Outlet „${v.outlet}“ nicht angelegt.`);
      continue;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      errors.push(`Zeile ${line}: Monat muss JJJJ-MM sein.`);
      continue;
    }
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1e8) {
      errors.push(`Zeile ${line}: Menge ungültig.`);
      continue;
    }
    if (!Number.isFinite(price) || price < 0 || price > 1e7) {
      errors.push(`Zeile ${line}: Bruttopreis ungültig.`);
      continue;
    }
    const key = `${fileHash}:${line}`;
    if (seenInFile.has(key)) {
      errors.push(`Zeile ${line}: doppelte CSV-Zeile.`);
      continue;
    }
    seenInFile.add(key);
    valid.push({
      id: key,
      product_id: p.id,
      outlet_id: o.id,
      product_name: p.name,
      outlet_name: o.name,
      month: `${month}-01`,
      quantity,
      unit_price_gross: price,
      unit_cost_net: p.unit_cost_net ?? null,
      vat_percent: p.vat_percent ?? 7,
      source_hash: fileHash,
      line_no: line,
      file_name: fileName,
    });
  }
  return { valid, errors };
}
export async function sha256(content) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function calculateSales(sales, products, selectedOutlet = "all") {
  const map = new Map(products.map((x) => [x.id, x]));
  const subset = sales.filter((s) => selectedOutlet === "all" || s.outlet_id === selectedOutlet);
  let gross = 0,
    net = 0,
    cost = 0,
    knownNet = 0,
    qty = 0,
    missingCost = 0;
  const byProduct = new Map(),
    byMonth = new Map();
  for (const s of subset) {
    const n = Number(s.quantity) || 0,
      price = Number(s.unit_price_gross) || 0;
    const prod = map.get(s.product_id);
    const vat = Number(s.vat_percent ?? prod?.vat_percent ?? 7);
    const netRevenue = (n * price) / (1 + vat / 100);
    const amount = n * price;
    const unitCost = s.unit_cost_net != null ? Number(s.unit_cost_net) : null;
    const hasCost = unitCost !== null && Number.isFinite(unitCost);
    gross += amount;
    net += netRevenue;
    qty += n;
    if (hasCost) {
      cost += n * unitCost;
      knownNet += netRevenue;
    } else missingCost++;
    const existing = byProduct.get(s.product_id) || {
      id: s.product_id,
      name: prod?.name ?? s.product_name ?? "Unbekannt",
      qty: 0,
      gross: 0,
      net: 0,
      cost: 0,
      knownNet: 0,
      missingCost: 0,
    };
    existing.qty += n;
    existing.gross += amount;
    existing.net += netRevenue;
    if (hasCost) {
      existing.cost += n * unitCost;
      existing.knownNet += netRevenue;
    } else existing.missingCost++;
    byProduct.set(s.product_id, existing);
    const m = String(s.month).slice(0, 7);
    byMonth.set(m, (byMonth.get(m) || 0) + amount);
  }
  const productsArr = [...byProduct.values()].map((x) => ({
    ...x,
    margin: x.knownNet > 0 && x.missingCost === 0 ? x.net - x.cost : null,
  }));
  const eligible = productsArr.filter((x) => x.margin !== null);
  for (const x of productsArr) x.unitMargin = x.margin === null || x.qty === 0 ? null : x.margin / x.qty;
  const median = (list) => {
    const q = [...list].sort((a, b) => a - b);
    return q.length ? (q[Math.floor((q.length - 1) / 2)] + q[Math.floor(q.length / 2)]) / 2 : 0;
  };
  const volumeMed = median(eligible.map((x) => x.qty)),
    marginMed = median(eligible.map((x) => x.unitMargin ?? 0));
  for (const x of productsArr) {
    x.classification =
      x.margin === null
        ? "WE fehlt"
        : x.qty >= volumeMed
          ? x.unitMargin >= marginMed
            ? "Star"
            : "Renner"
          : x.unitMargin >= marginMed
            ? "Puzzle"
            : "Penner";
  }
  return {
    gross,
    net,
    cost,
    knownNet,
    quantity: qty,
    missingCost,
    margin: missingCost ? null : net - cost,
    foodCostPct: knownNet > 0 ? (cost / knownNet) * 100 : null,
    products: productsArr.sort((a, b) => b.gross - a.gross),
    months: [...byMonth].sort((a, b) => a[0].localeCompare(b[0])).map(([month, value]) => ({ month, value })),
    rows: subset.length,
  };
}
export function suggestActions(stats, inventory, tasks) {
  const notes = [];
  const shortages = inventory.filter((x) => Number(x.stock) <= Number(x.reorder_point));
  if (shortages.length)
    notes.push({
      level: "warning",
      title: `${shortages.length} Bestandsposition(en) unter Mindestbestand`,
      detail: "Bestellvorschlag prüfen, bevor es zu Fehlmengen kommt.",
      target: "inventory",
    });
  if (stats.missingCost)
    notes.push({
      level: "warning",
      title: `Für ${stats.missingCost} Verkaufszeilen fehlt der Wareneinsatz`,
      detail: "Ohne reale Kosten sind Deckungsbeitrag und Renner/Penner-Einstufung unvollständig.",
      target: "menu",
    });
  const losers = stats.products.filter((x) => x.classification === "Penner").slice(0, 3);
  if (losers.length)
    notes.push({
      level: "insight",
      title: `${losers.length} schwache Artikel prüfen`,
      detail: `Unter anderem: ${losers.map((x) => x.name).join(", ")}. Rezeptur, Preis oder Platzierung prüfen.`,
      target: "menu",
    });
  const open = tasks.filter((t) => t.status !== "done");
  if (open.length > 5)
    notes.push({
      level: "insight",
      title: `${open.length} offene Maßnahmen`,
      detail: "Verantwortlichkeiten und Fälligkeiten im Team-Center priorisieren.",
      target: "tasks",
    });
  if (!notes.length)
    notes.push({
      level: "ok",
      title: "Keine regelbasierten Warnsignale",
      detail: "Weitere Empfehlungen entstehen mit mehr Import-, Kosten- und Bestandsdaten.",
      target: "sales",
    });
  return notes;
}
export function csvExport(rows, fields) {
  // Integration: text that a spreadsheet would run as a formula gets a leading apostrophe; numbers stay numbers.
  const escaped = (val) => {
    const t = String(val ?? "");
    return `"${(typeof val === "string" && /^\s*[=+@\-\t\r]/.test(t) && !/^\s*-?\d/.test(t) ? "'" + t : t).replaceAll('"', '""')}"`;
  };
  return [fields.map(escaped).join(";"), ...rows.map((row) => fields.map((f) => escaped(row[f])).join(";"))].join("\r\n");
}
