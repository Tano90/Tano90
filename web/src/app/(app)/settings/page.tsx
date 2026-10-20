import Link from "next/link";
import { NoPermission } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { getLibrary } from "@/data/repo";
import { canManageTeam, requireSession } from "@/data/session";
import { LibraryForm } from "./library-form";

export const metadata = { title: "Einstellungen · Kitchen Ledger" };

export default async function SettingsPage() {
  const s = await requireSession();
  const lib = await getLibrary(s);
  return (
    <>
      <PageHeader title="Einstellungen" description={<>Gilt für alle Outlets. Außerdem: <Link className="text-accent underline" href="/settings/team">Outlets & Team</Link> · <Link className="text-accent underline" href="/settings/billing">Abo & Rechnungen</Link> · <Link className="text-accent underline" href="/settings/account">Dein Konto</Link></>} />
      {canManageTeam(s.role) ? <LibraryForm library={lib} /> : <NoPermission what="Die Einstellungen des Betriebs können nur Inhaber und Admins ändern." />}
    </>
  );
}
