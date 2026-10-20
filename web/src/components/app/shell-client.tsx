"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setOutlet, signOut } from "@/app/actions";
import { AppShell } from "@/components/ui/app-shell";
import type { Role } from "@/data/types";

const ROLE_LABEL: Record<Role, string> = { owner: "Inhaber", admin: "Admin", chef: "Küchenleitung", outlet_staff: "Team" };

type Props = {
  outlets: { id: string; name: string }[];
  outletId: string;
  user: { name: string; role: Role };
  children: React.ReactNode;
};

export function ShellClient({ outlets, outletId, user, children }: Props) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <AppShell
      outlets={outlets}
      outletId={outletId}
      onOutletChange={(id) =>
        start(async () => {
          await setOutlet(id);
          router.refresh();
        })
      }
      user={
        <div className="flex items-center gap-3">
          <span className="hidden text-right sm:block">
            <span className="block text-sm">{user.name}</span>
            <span className="block text-xs font-normal text-text-muted">{ROLE_LABEL[user.role]}</span>
          </span>
          <form action={signOut}>
            <button type="submit" aria-label="Abmelden" className="inline-flex size-(--size-control-sm) items-center justify-center rounded-sm hover:bg-row-hover">
              <LogOut aria-hidden className="size-4" />
            </button>
          </form>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
