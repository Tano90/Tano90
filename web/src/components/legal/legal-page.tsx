import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { FIELD_LABELS, LEGAL_DATE, OPERATOR, type OperatorField, missingOperatorFields } from "@/lib/legal";

/** An operator detail, or a visible gap that says which detail is missing. */
export function Op({ field }: { field: OperatorField }) {
  const v = OPERATOR[field];
  if (v?.trim()) return <>{v}</>;
  return <mark className="rounded-sm bg-warning-subtle px-1 text-warning">[fehlt: {FIELD_LABELS[field]}]</mark>;
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const missing = missingOperatorFields();
  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold">{APP_NAME}</Link>
        <nav aria-label="Rechtliches" className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm">
          <Link href="/legal/imprint" className="hover:underline">Impressum</Link>
          <Link href="/legal/privacy" className="hover:underline">Datenschutz</Link>
          <Link href="/legal/terms" className="hover:underline">Nutzungsbedingungen</Link>
          <Link href="/legal/dpa" className="hover:underline">Auftragsverarbeitung</Link>
        </nav>
      </header>
      <main className="legal mx-auto max-w-3xl px-4 pb-16">
        <h1 className="text-xl">{title}</h1>
        <p className="mt-1 text-xs text-text-muted">Stand: {LEGAL_DATE}</p>
        {missing.length > 0 && (
          <p role="note" className="mt-4 rounded-md border border-warning bg-warning-subtle p-3">
            Noch nicht vollständig: {missing.length} Angaben des Betreibers fehlen (markiert mit „fehlt“). Diese Seite ist erst
            nach dem Ausfüllen und einer rechtlichen Prüfung für den Start bereit.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}

const slug = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = slug(title);
  return (
    <section aria-labelledby={id} className="mt-8 flex flex-col gap-3">
      <h2 id={id} className="text-lg">{title}</h2>
      {children}
    </section>
  );
}
