// Row and input types of supplier invoices (incl. e-invoices) and the DATEV settings, shared by both data backends.
import type { DatevSettings } from "@/domain/datev";

export type TaxLine = { rateBp: number; netCents: number; taxCents: number };
export type EInvoiceSave = {
  supplierId: string; number: string; date: string; netCents: number; grossCents: number; taxLines: TaxLine[];
  sellerVatId: string | null; document: string;
};
export type InvoiceListRow = {
  id: string; supplierId: string; supplierName: string; creditor: number | null; number: string; date: string;
  netCents: number; grossCents: number | null; taxLines: TaxLine[]; status: "unmatched" | "matched" | "mismatch" | "approved";
  source: "manual" | "einvoice"; orderId: string | null;
};
export type DatevSetup = { settings: DatevSettings | null; suppliers: { id: string; name: string; creditor: number | null }[]; defaultVatBp: number };
