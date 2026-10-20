import { NoPermission } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { listMembers, listOutlets } from "@/data/repo";
import { canManageTeam, requireSession } from "@/data/session";
import { TeamAdmin } from "./team-admin";

export const metadata = { title: "Outlets & Team" };

export default async function TeamPage() {
  const s = await requireSession();
  if (!canManageTeam(s.role)) {
    return (
      <>
        <PageHeader title="Outlets & Team" back={{ href: "/settings", label: "Einstellungen" }} />
        <NoPermission what="Standorte und Teammitglieder können nur Inhaber und Admins verwalten." />
      </>
    );
  }
  const [members, outlets] = await Promise.all([listMembers(s), listOutlets(s)]);
  return (
    <>
      <PageHeader title="Outlets & Team" description="Wer in welchem Outlet arbeitet und was er darf." back={{ href: "/settings", label: "Einstellungen" }} />
      <TeamAdmin members={members} outlets={outlets.map((o) => ({ id: o.id, name: o.name, isCentralKitchen: o.isCentralKitchen }))} me={{ userId: s.userId, role: s.role }} />
    </>
  );
}
