import { describe, expect, it } from "vitest";
import { type DatevSettings, STANDARD_ACCOUNTS, datevExtf, fiscalYearStart } from "./datev";

const st: DatevSettings = { consultantNumber: 29098, clientNumber: 55003, chart: "03", accountLength: 4, fiscalYearStartMonth: 1, defaultCreditor: 70000, accounts: STANDARD_ACCOUNTS["03"] };
const at = new Date("2026-10-21T08:30:00.123Z");

describe("datevExtf", () => {
  it("writes the EXTF header, the column line and one booking per VAT rate", () => {
    const { csv, bookings, estimated } = datevExtf({
      settings: st, from: "2026-10-01", to: "2026-10-31", createdAt: at, defaultVatBp: 700,
      invoices: [{ number: "RE-2026-1042", date: "2026-10-20", supplierName: 'Frischehof "Lindner"; GmbH', creditor: 70001, netCents: 7480, taxLines: [{ rateBp: 700, netCents: 6280, taxCents: 440 }, { rateBp: 1900, netCents: 1200, taxCents: 228 }] }],
    });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"EXTF";700;21;"Buchungsstapel";13;20261021083000123;;"RE";"Mirepa";"";29098;55003;20260101;4;20261001;20261031;"Eingangsrechnungen 2026-10-01";"";1;0;0;"EUR";;"";;;"03";;;"";""');
    expect(lines[1]).toMatch(/^"Umsatz \(ohne Soll\/Haben-Kz\)";"Soll\/Haben-Kennzeichen";/);
    expect(lines[2]).toBe('67,20;"S";"EUR";;;"";3300;70001;"";2010;"RE-2026-1042";"";;"Frischehof ""Lindner"" GmbH"');
    expect(lines[3]).toBe('14,28;"S";"EUR";;;"";3400;70001;"";2010;"RE-2026-1042";"";;"Frischehof ""Lindner"" GmbH"');
    expect(bookings).toBe(2);
    expect(estimated).toEqual([]);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("books typed invoices with the default rate and says so; uses the default creditor", () => {
    const r = datevExtf({ settings: st, from: "2026-10-01", to: "2026-10-31", createdAt: at, defaultVatBp: 700, invoices: [{ number: "4711/A", date: "2026-10-05", supplierName: "Molkerei", creditor: null, netCents: 10000, taxLines: [] }] });
    expect(r.csv.split("\r\n")[2]).toBe('107,00;"S";"EUR";;;"";3300;70000;"";0510;"4711/A";"";;"Molkerei"');
    expect(r.estimated).toEqual(["4711/A"]);
  });

  it("refuses a period across fiscal years and rates without an account", () => {
    expect(() => datevExtf({ settings: st, from: "2026-12-01", to: "2027-01-31", createdAt: at, defaultVatBp: 700, invoices: [] })).toThrow(/einem Wirtschaftsjahr/);
    expect(() => datevExtf({ settings: st, from: "2026-10-01", to: "2026-10-31", createdAt: at, defaultVatBp: 700, invoices: [{ number: "1", date: "2026-10-02", supplierName: "X", creditor: null, netCents: 100, taxLines: [{ rateBp: 1000, netCents: 100, taxCents: 10 }] }] })).toThrow(/10 % Umsatzsteuer ist kein Sachkonto/);
  });

  it("fiscal year start", () => {
    expect(fiscalYearStart("2026-03-15", 7)).toBe("20250701");
    expect(fiscalYearStart("2026-08-15", 7)).toBe("20260701");
  });
});
