// Email texts, written for this product. Plain text first; the HTML is the same content, lightly formatted.
import { formatCents, formatQty } from "./format";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const wrap = (body: string) =>
  `<!doctype html><html lang="de"><body style="font-family:system-ui,sans-serif;color:#14171c;line-height:1.5;max-width:640px;margin:0 auto;padding:16px">${body}</body></html>`;

export function orderMail(o: {
  libraryName: string; outletName: string; supplierName: string; customerNumber: string | null; orderNumber: string;
  expectedDeliveryDate: string | null; note: string | null; lines: { name: string; packageLabel: string; quantityPacks: number; unitPriceCents: number }[];
}) {
  const date = o.expectedDeliveryDate ? new Intl.DateTimeFormat("de-DE", { dateStyle: "full" }).format(new Date(o.expectedDeliveryDate)) : null;
  const total = o.lines.reduce((s, l) => s + l.quantityPacks * l.unitPriceCents, 0);
  const subject = `Bestellung ${o.orderNumber} – ${o.libraryName}, ${o.outletName}`;
  const text = [
    `Guten Tag,`,
    ``,
    `bitte liefern Sie an ${o.libraryName}, ${o.outletName}${date ? ` am ${date}` : ""}:`,
    ``,
    ...o.lines.map((l) => `- ${formatQty(l.quantityPacks)} × ${l.packageLabel} ${l.name.split(",")[0]} (je ${formatCents(l.unitPriceCents)} netto)`),
    ``,
    `Summe netto laut unseren Preisen: ${formatCents(total)}`,
    o.customerNumber ? `Unsere Kundennummer: ${o.customerNumber}` : null,
    o.note ? `\nHinweis: ${o.note}` : null,
    ``,
    `Bestellnummer ${o.orderNumber}. Bitte geben Sie sie auf Lieferschein und Rechnung an.`,
    `Rückfragen beantworten Sie einfach direkt auf diese E-Mail.`,
  ].filter((x) => x !== null).join("\n");
  const html = wrap(`
    <p>Guten Tag,</p>
    <p>bitte liefern Sie an <strong>${esc(o.libraryName)}, ${esc(o.outletName)}</strong>${date ? ` am <strong>${esc(date)}</strong>` : ""}:</p>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr><th align="left" style="border-bottom:1px solid #e3e6ea;padding:4px">Artikel</th><th align="right" style="border-bottom:1px solid #e3e6ea;padding:4px">Menge</th><th align="right" style="border-bottom:1px solid #e3e6ea;padding:4px">Preis netto</th></tr></thead>
      <tbody>${o.lines.map((l) => `<tr><td style="padding:4px">${esc(l.name)}</td><td align="right" style="padding:4px">${esc(formatQty(l.quantityPacks))} × ${esc(l.packageLabel)}</td><td align="right" style="padding:4px">${esc(formatCents(l.unitPriceCents))}</td></tr>`).join("")}</tbody>
    </table>
    <p>Summe netto laut unseren Preisen: <strong>${esc(formatCents(total))}</strong></p>
    ${o.customerNumber ? `<p>Unsere Kundennummer: ${esc(o.customerNumber)}</p>` : ""}
    ${o.note ? `<p>Hinweis: ${esc(o.note)}</p>` : ""}
    <p>Bestellnummer <strong>${esc(o.orderNumber)}</strong>. Bitte geben Sie sie auf Lieferschein und Rechnung an. Rückfragen beantworten Sie einfach direkt auf diese E-Mail.</p>`);
  return { subject, text, html };
}

export function invitationMail(i: { libraryName: string; inviterName: string; link: string; roleLabel: string }) {
  const subject = `${i.inviterName} lädt dich zu ${i.libraryName} ein`;
  const text = `Hallo,\n\n${i.inviterName} hat dich als ${i.roleLabel} zu ${i.libraryName} eingeladen.\n\nEinladung annehmen: ${i.link}\n\nDer Link gilt 7 Tage. Wenn du damit nichts anfangen kannst, ignoriere diese E-Mail einfach.`;
  const html = wrap(`<p>Hallo,</p><p>${esc(i.inviterName)} hat dich als <strong>${esc(i.roleLabel)}</strong> zu <strong>${esc(i.libraryName)}</strong> eingeladen.</p><p><a href="${esc(i.link)}" style="display:inline-block;background:#2f5bea;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Einladung annehmen</a></p><p style="color:#5b6470">Der Link gilt 7 Tage. Wenn du damit nichts anfangen kannst, ignoriere diese E-Mail einfach.</p>`);
  return { subject, text, html };
}

export function lowStockMail(a: { outletName: string; link: string; items: { name: string; onHand: string; min: string }[] }) {
  const subject = `${a.items.length} Artikel unter Mindestbestand – ${a.outletName}`;
  const text = `In ${a.outletName} sind diese Artikel unter dem Mindestbestand:\n\n${a.items.map((i) => `- ${i.name}: ${i.onHand} (Minimum ${i.min})`).join("\n")}\n\nJetzt bestellen: ${a.link}`;
  const html = wrap(`<p>In <strong>${esc(a.outletName)}</strong> sind diese Artikel unter dem Mindestbestand:</p><ul>${a.items.map((i) => `<li>${esc(i.name)}: ${esc(i.onHand)} (Minimum ${esc(i.min)})</li>`).join("")}</ul><p><a href="${esc(a.link)}">Jetzt bestellen</a></p>`);
  return { subject, text, html };
}
