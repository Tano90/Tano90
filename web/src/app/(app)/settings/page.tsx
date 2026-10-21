import { Download } from "lucide-react";
import Link from "next/link";
import { NoPermission } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { getLibrary } from "@/data/repo";
import { canManageTeam, requireSession } from "@/data/session";
import { isOperator } from "@/lib/operator";
import { LibraryForm } from "./library-form";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const s = await requireSession();
  const lib = await getLibrary(s);
  return (
    <>
      <PageHeader title="Einstellungen" description={<>Gilt für alle Outlets. Außerdem: <Link className="text-accent underline" href="/settings/team">Outlets & Team</Link> · <Link className="text-accent underline" href="/settings/billing">Abo & Rechnungen</Link> · <Link className="text-accent underline" href="/settings/account">Dein Konto</Link>{isOperator(s) && <> · <Link className="text-accent underline" href="/admin/leads">Anfragen</Link></>}</>} />
      {canManageTeam(s.role) ? <LibraryForm library={lib} /> : <NoPermission what="Die Einstellungen des Betriebs können nur Inhaber und Admins ändern." />}
      {canManageTeam(s.role) && (
        <section aria-labelledby="export-h" className="mt-10 flex max-w-(--size-form-max) flex-col gap-2">
          <h2 id="export-h" className="text-lg">Daten exportieren</h2>
          <p className="text-text-muted">Alle Daten des Betriebs in einer Datei (JSON): Zutaten, Rezepte, Lieferanten, Bestellungen, Bestände, Buchungen, HACCP und Team. Für eigene Sicherungen oder einen Umzug; geht auch, wenn die Testphase vorbei ist.</p>
          <p>
            <a href="/api/export" download className="inline-flex h-(--size-control-md) items-center gap-2 rounded-sm border border-border-input bg-bg px-4 font-semibold hover:bg-row-hover">
              <Download aria-hidden className="size-4" /> Alle Daten herunterladen
            </a>
          </p>
        </section>
      )}
    </>
  );
}
