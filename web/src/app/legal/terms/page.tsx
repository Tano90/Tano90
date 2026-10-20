// DRAFT. To be written and reviewed before launch (/replica-deploy checks this).
export const metadata = { title: "Nutzungsbedingungen" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl">Nutzungsbedingungen</h1>
      <p className="mt-2 rounded-md border border-warning bg-warning-subtle p-3">Entwurf. Die Nutzungsbedingungen werden vor dem Start ergänzt und rechtlich geprüft.</p>
      <p className="mt-4">Allergen- und Nährwertangaben berechnet die Software aus den Daten, die du eingibst. Für die Richtigkeit der Kennzeichnung gegenüber Gästen bleibt der Betrieb verantwortlich.</p>
    </main>
  );
}
