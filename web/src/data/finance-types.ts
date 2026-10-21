// Row and input types of supplier invoices (incl. e-invoices), shared by both data backends.

export type TaxLine = { rateBp: number; netCents: number; taxCents: number };
export type EInvoiceSave = {
  supplierId: string; number: string; date: string; netCents: number; grossCents: number; taxLines: TaxLine[];
  sellerVatId: string | null; document: string;
};
export type InvoiceListRow = {
  id: string; supplierId: string; supplierName: string; number: string; date: string;
  netCents: number; grossCents: number | null; taxLines: TaxLine[]; status: "unmatched" | "matched" | "mismatch" | "approved";
  source: "manual" | "einvoice"; orderId: string | null;
};
