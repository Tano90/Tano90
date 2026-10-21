// CSV as spreadsheets in German locales write it: semicolon or comma, quotes, a byte order mark.

/** Splits one CSV line, honouring quotes. */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** The separator the header line uses most: semicolon (German Excel) or comma. */
export const csvSeparator = (header: string) => ((header.match(/;/g)?.length ?? 0) >= (header.match(/,/g)?.length ?? 0) ? ";" : ",");

/** Whole file to rows of cells. */
export function csvTable(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const sep = csvSeparator(lines[0] ?? "");
  return lines.map((l) => splitCsvLine(l, sep));
}
