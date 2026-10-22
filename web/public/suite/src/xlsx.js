/* Minimal Excel writer (.xlsx, Office Open XML) without external libraries.
   Numbers stay numbers (Excel shows them with the reader's locale, i. e. a decimal comma in German Excel).
   Text cells are inline strings; formulas are never written, so a cell starting with "=" stays text. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GLBXlsx = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  // style ids, see styles() below
  const STYLE = { text: 0, bold: 1, eur: 2, pct: 3, int: 4, num: 5, title: 6, head: 7 };
  const xml = (s) =>
    String(s ?? "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const colName = (i) => {
    let s = "";
    for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  };
  function cell(c, r, i) {
    if (c == null || c === "") return "";
    const o = typeof c === "object" ? c : { v: c };
    const ref = colName(i) + (r + 1),
      s = STYLE[o.style] ?? (typeof o.v === "number" ? STYLE.num : STYLE.text);
    if (typeof o.v === "number" && Number.isFinite(o.v)) return `<c r="${ref}" s="${s}"><v>${o.v}</v></c>`;
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(o.v)}</t></is></c>`;
  }
  function sheetXML(sheet) {
    const widths = sheet.widths || [];
    const cols = widths.length
      ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
      : "";
    const freeze =
      sheet.freezeRow != null
        ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRow}" topLeftCell="A${sheet.freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
        : "";
    const rows = sheet.rows.map((row, r) => `<row r="${r + 1}">${row.map((c, i) => cell(c, r, i)).join("")}</row>`).join("");
    const filter = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${rows}</sheetData>${filter}</worksheet>`;
  }
  const styles = () =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="0.0\\ &quot;%&quot;"/><numFmt numFmtId="166" formatCode="#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9F6F3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  function workbook(sheets) {
    const names = sheets.map((s, i) =>
      xml(
        String(s.name || "Tabelle" + (i + 1))
          .replace(/[\\/?*[\]:]/g, " ")
          .slice(0, 31),
      ),
    );
    return {
      "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      "xl/styles.xml": styles(),
      ...Object.fromEntries(sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXML(s)])),
    };
  }

  // ZIP container, entries stored without compression (valid for .xlsx, no library needed).
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (b) => {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  function zip(files) {
    const enc = new TextEncoder(),
      parts = [],
      central = [];
    let offset = 0;
    const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff],
      u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    // fixed timestamp 2026-01-01 00:00 keeps the file reproducible
    const time = 0,
      date = ((2026 - 1980) << 9) | (1 << 5) | 1;
    for (const [name, text] of Object.entries(files)) {
      const data = enc.encode(text),
        fname = enc.encode(name),
        crc = crc32(data);
      const common = [
        ...u16(20),
        ...u16(0x0800),
        ...u16(0),
        ...u16(time),
        ...u16(date),
        ...u32(crc),
        ...u32(data.length),
        ...u32(data.length),
        ...u16(fname.length),
        ...u16(0),
      ];
      const local = Uint8Array.from([...u32(0x04034b50), ...common]);
      parts.push(local, fname, data);
      central.push(
        Uint8Array.from([...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]),
        fname,
      );
      offset += local.length + fname.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0),
      count = Object.keys(files).length;
    const end = Uint8Array.from([
      ...u32(0x06054b50),
      ...u16(0),
      ...u16(0),
      ...u16(count),
      ...u16(count),
      ...u32(cdSize),
      ...u32(offset),
      ...u16(0),
    ]);
    const all = [...parts, ...central, end],
      out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let p = 0;
    for (const b of all) {
      out.set(b, p);
      p += b.length;
    }
    return out;
  }
  const build = (sheets) => zip(workbook(sheets));

  /* A report workbook: sheet "Bericht" names what the numbers are (selection, period, units, basis),
     sheet "Daten" holds only the table with a filter row. cols: [{label, unit, style, value}] */
  function report({ title, meta = [], cols, rows, notes = [] }) {
    const head = cols.map((c) => ({ v: c.unit ? `${c.label} (${c.unit})` : c.label, style: "head" }));
    const body = rows.map((r) =>
      cols.map((c) => {
        const v = typeof c.value === "function" ? c.value(r) : r[c.value];
        return { v: typeof v === "number" && !Number.isFinite(v) ? "" : v, style: typeof v === "number" ? c.style || "num" : "text" };
      }),
    );
    const widths = cols.map((c, i) =>
      Math.min(48, Math.max(10, String(head[i].v).length + 2, ...body.map((r) => String(r[i].v ?? "").length + 2))),
    );
    const info = [
      [{ v: title, style: "title" }],
      [],
      ...meta.map(([k, v]) => [{ v: k, style: "bold" }, { v }]),
      ...(notes.length ? [[], [{ v: "Hinweise", style: "bold" }], ...notes.map((n) => [{ v: n }])] : []),
      [],
      head,
      ...body,
    ];
    const ref = `A1:${colName(cols.length - 1)}${rows.length + 1}`;
    return build([
      { name: "Bericht", rows: info, widths: [Math.max(26, widths[0] || 0), Math.max(30, widths[1] || 0), ...widths.slice(2)] },
      { name: "Daten", rows: [head, ...body], widths, freezeRow: 1, autoFilter: ref },
    ]);
  }
  return { build, report, colName };
});
