import { ShellClient } from "@/components/app/shell-client";
import { listOutlets } from "@/data/repo";
import { currentOutletId, requireSession } from "@/data/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const outlets = await listOutlets(s);
  const outletId = await currentOutletId(s);
  return (
    <ShellClient outlets={outlets.map((o) => ({ id: o.id, name: o.name }))} outletId={outletId} user={{ name: s.name, role: s.role }}>
      {children}
    </ShellClient>
  );
}
