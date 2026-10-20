import { PageHeader } from "@/components/app/page-header";
import { authMode, requireSession } from "@/data/session";
import { AccountActions } from "./account-actions";

export const metadata = { title: "Konto · Kitchen Ledger" };

export default async function AccountPage() {
  const s = await requireSession();
  return (
    <>
      <PageHeader title="Dein Konto" description={s.email} back={{ href: "/settings", label: "Einstellungen" }} />
      <AccountActions supabase={authMode() === "supabase"} isOwner={s.role === "owner"} />
    </>
  );
}
