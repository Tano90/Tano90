import { AccessBanner } from "@/components/app/access-banner";
import { ShellClient } from "@/components/app/shell-client";
import { getBilling, listOutlets } from "@/data/repo";
import { canManageBilling, currentOutletId, requireSession } from "@/data/session";
import { accessOf } from "@/domain/access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const [outlets, outletId, billing] = await Promise.all([listOutlets(s), currentOutletId(s), getBilling(s)]);
  return (
    <ShellClient outlets={outlets.map((o) => ({ id: o.id, name: o.name }))} outletId={outletId} user={{ name: s.name, role: s.role }}>
      <AccessBanner access={accessOf(billing)} canBill={canManageBilling(s.role)} />
      {children}
    </ShellClient>
  );
}
