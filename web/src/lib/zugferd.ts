// Gets the invoice XML out of an upload: an XML file as is, or the XML embedded in a ZUGFeRD / Factur-X PDF.
// Runs in the browser (DecompressionStream for the PDF's compressed streams); nothing leaves the device until saved.

async function inflate(bytes: Uint8Array): Promise<string | null> {
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new TextDecoder("utf-8").decode(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

const INVOICE = /<(?:[\w-]+:)?(?:CrossIndustryInvoice|Invoice|CreditNote)[\s>]/;

export async function invoiceXmlFromFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 5));
  if (head !== "%PDF-") return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
  const latin = new TextDecoder("latin1").decode(bytes);
  for (let at = latin.indexOf("stream"); at !== -1; at = latin.indexOf("stream", at + 6)) {
    if (latin.slice(at - 3, at) === "end") continue;
    let start = at + 6;
    if (latin[start] === "\r") start++;
    if (latin[start] === "\n") start++;
    const end = latin.indexOf("endstream", start);
    if (end === -1) break;
    const dict = latin.slice(latin.lastIndexOf("<<", at), at);
    let stop = end;
    while (stop > start && (latin[stop - 1] === "\n" || latin[stop - 1] === "\r")) stop--;
    const chunk = bytes.subarray(start, stop);
    const text = /\/FlateDecode/.test(dict) ? await inflate(chunk) : new TextDecoder("utf-8").decode(chunk);
    if (text && INVOICE.test(text)) return text.slice(text.indexOf("<")).replace(/^﻿/, "");
    at = end;
  }
  throw new Error("In dieser PDF ist keine E-Rechnung eingebettet. ZUGFeRD- oder Factur-X-PDFs enthalten sie; eine normale PDF-Rechnung bitte als XML beim Lieferanten anfordern.");
}
