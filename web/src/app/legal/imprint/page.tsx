// DRAFT. Required in Germany (§ 5 DDG). Fill in before launch; /replica-deploy checks this page.
export const metadata = { title: "Impressum" };

export default function ImprintPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl">Impressum</h1>
      <p className="mt-2 rounded-md border border-warning bg-warning-subtle p-3">Entwurf. Die Angaben des Anbieters fehlen noch und müssen vor dem Start eingetragen werden.</p>
      <p className="mt-4">[Name / Firma, Rechtsform, Vertretungsberechtigte]<br />[Anschrift]<br />[E-Mail, Telefon]<br />[Registergericht und -nummer, USt-IdNr.]</p>
    </main>
  );
}
