import { NoPermission } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { getDatevSetup } from "@/data/repo";
import { canManageTeam, requireSession } from "@/data/session";
import { DatevForm } from "./datev-form";

export const metadata = { title: "DATEV-Einstellungen" };

export default async function DatevSettingsPage() {
  const s = await requireSession();
  const back = { href: "/invoices", label: "Rechnungen" };
  if (!canManageTeam(s.role)) return (<><PageHeader title="DATEV-Einstellungen" back={back} /><NoPermission what="Die DATEV-Einstellungen ändern Inhaber und Admins." /></>);
  const setup = await getDatevSetup(s);
  return (
    <>
      <PageHeader title="DATEV-Einstellungen" back={back} description="Die Angaben bekommst du von deinem Steuerberater. Sie stehen im Kopf jeder Exportdatei und bestimmen die Konten." />
      <DatevForm settings={setup.settings} suppliers={setup.suppliers} />
    </>
  );
}
