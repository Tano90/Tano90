/**
 * One key per article number: EAN-8, UPC-A, EAN-13 and GTIN-14 of the same product differ only in leading
 * zeros, and scanners send whichever form the label or their settings give. Compare codes by this key.
 */
export function gtinKey(code: string) {
  const digits = code.replace(/\D/g, "");
  return digits.length > 0 && digits.length <= 14 ? digits.padStart(14, "0") : digits;
}
