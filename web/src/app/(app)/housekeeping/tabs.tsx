"use client";

import { BedDouble, CalendarDays, LayoutDashboard, Shirt, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/housekeeping/dashboard", label: "Übersicht", icon: LayoutDashboard, manager: true },
  { href: "/housekeeping", label: "Zimmer", icon: BedDouble, manager: false },
  { href: "/housekeeping/belegung", label: "Belegung", icon: CalendarDays, manager: true },
  { href: "/housekeeping/waesche", label: "Wäsche", icon: Shirt, manager: false },
  { href: "/housekeeping/dienstplan", label: "Dienstplan", icon: Users, manager: false },
];

export function HkTabs({ manager }: { manager: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Housekeeping" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.filter((t) => manager || !t.manager).map(({ href, label, icon: Icon }) => {
        const active = path === href;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("-mb-px inline-flex h-(--size-control-md) items-center gap-1.5 border-b-2 px-3 whitespace-nowrap",
              active ? "border-accent font-semibold text-text" : "border-transparent text-text-muted hover:text-text")}>
            <Icon aria-hidden className="size-4" />{label}
          </Link>
        );
      })}
    </nav>
  );
}
