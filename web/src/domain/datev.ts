// Supplier invoices as a DATEV "Buchungsstapel" in the DATEV format (EXTF, version 700), for the accountant to import.
// One booking per invoice and VAT rate: expense account (an automatic "Wareneingang x % Vorsteuer" account, so DATEV
// splits off the input tax) in debit, creditor account in credit, gross amount. Pure, so it can be tested byte by byte.

export type DatevSettings = {
  consultantNumber: number; clientNumber: number; chart: "03" | "04"; accountLength: number;
  fiscalYearStartMonth: number; defaultCreditor: number;
  /** VAT rate in basis points → expense account. */
  accounts: Record<string, number>;
};

/** Usual "Wareneingang" accounts with automatic input tax in SKR 03 and SKR 04. The accountant may use others. */
export const STANDARD_ACCOUNTS: Record<DatevSettings["chart"], Record<string, number>> = {
  "03": { "0": 3200, "700": 3300, "1900": 3400 },
  "04": { "0": 5200, "700": 5300, "1900": 5400 },
};

export type DatevInvoice = {
  number: string; date: string; supplierName: string; creditor: number | null;
  netCents: number; taxLines: { rateBp: number; netCents: number; taxCents: number }[];
};

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const amount = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const ymd = (d: string) => d.replace(/-/g, "");
// DATEV allows these characters in Belegfeld 1; everything else is replaced.
const docField = (s: string) => s.replace(/[^A-Za-z0-9$&%*+\-/]/g, "-").slice(0, 36);
const text = (s: string) => s.replace(/[\r\n;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

export function fiscalYearStart(day: string, startMonth: number): string {
  const [y, m] = day.split("-").map(Number);
  const year = m >= startMonth ? y : y - 1;
  return `${year}${String(startMonth).padStart(2, "0")}01`;
}

const COLUMNS = ["Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext"];

/**
 * Builds the file. Invoices without a VAT split (typed by hand, only a net total) are booked with `defaultVatBp`
 * and listed in `estimated`, so the person exporting can tell the accountant.
 */
export function datevExtf(input: { settings: DatevSettings; from: string; to: string; createdAt: Date; invoices: DatevInvoice[]; defaultVatBp: number }) {
  const { settings: st, from, to, invoices } = input;
  const fyStart = fiscalYearStart(from, st.fiscalYearStartMonth);
  if (fiscalYearStart(to, st.fiscalYearStartMonth) !== fyStart) throw new Error("Der Zeitraum muss in einem Wirtschaftsjahr liegen (DATEV-Vorgabe).");
  const created = input.createdAt.toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
  const header = [
    q("EXTF"), 700, 21, q("Buchungsstapel"), 13, created, "", q("RE"), q("Mirepa"), q(""), st.consultantNumber, st.clientNumber, fyStart,
    st.accountLength, ymd(from), ymd(to), q(`Eingangsrechnungen ${from} bis ${to}`.slice(0, 30).trim()), q(""), 1, 0, 0, q("EUR"), "", q(""), "", "", q(st.chart), "", "", q(""), q(""),
  ].join(";");
  const rows: string[] = [];
  const estimated: string[] = [];
  const missingAccount = new Set<number>();
  for (const inv of [...invoices].sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))) {
    let lines = inv.taxLines.filter((l) => l.netCents + l.taxCents !== 0);
    if (!lines.length) {
      estimated.push(inv.number);
      lines = [{ rateBp: input.defaultVatBp, netCents: inv.netCents, taxCents: Math.round((inv.netCents * input.defaultVatBp) / 10000) }];
    }
    for (const l of lines) {
      const account = st.accounts[String(l.rateBp)];
      if (!account) { missingAccount.add(l.rateBp); continue; }
      const gross = l.netCents + l.taxCents;
      const [, mm, dd] = inv.date.split("-");
      rows.push([
        amount(Math.abs(gross)), q(gross >= 0 ? "S" : "H"), q("EUR"), "", "", q(""), account, inv.creditor ?? st.defaultCreditor, q(""),
        `${dd}${mm}`, q(docField(inv.number)), q(""), "", q(text(inv.supplierName)),
      ].join(";"));
    }
  }
  if (missingAccount.size) throw new Error(`Für ${[...missingAccount].map((b) => `${b / 100} %`).join(", ")} Umsatzsteuer ist kein Sachkonto hinterlegt.`);
  return { csv: [header, COLUMNS.map(q).join(";"), ...rows].join("\r\n") + "\r\n", bookings: rows.length, estimated };
}
