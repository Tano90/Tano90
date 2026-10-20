import Link from "next/link";
import { NoPermission } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { getLibrary } from "@/data/repo";
import { canManageTeam, requireSession } from "@/data/session";
import { LibraryForm } from "./library-form";

export const metadata = { title: "Einstellungen · Kitchen Ledger" };

export default async function SettingsPage() {
  const s = await requireSession();
  const lib = await getLibrary();
  return (
    <>
      <PageHeader title="Einstellungen" description={<>Gilt für alle Outlets. Standorte und Team verwaltest du unter <Link className="text-accent underline" href="/settings/team">Outlets & Team</Link>.</>} />
      {canManageTeam(s.role) ? <LibraryForm library={lib} /> : <NoPermission what="Die Einstellungen des Betriebs können nur Inhaber und Admins ändern." />}
    </>
  );
}
