"use client";

import { BarChart3, BedDouble, BookOpen, ChefHat, CookingPot, LayoutDashboard, Menu as MenuIcon, Package, ReceiptText, Settings, ShieldCheck, ShoppingCart, Truck, UtensilsCrossed, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";
import { Select } from "./field";

const NAV = [
  { href: "/app", label: "Übersicht", icon: LayoutDashboard },
  { href: "/ingredients", label: "Zutaten", icon: Package },
  { href: "/recipes", label: "Rezepte", icon: ChefHat },
  { href: "/menus", label: "Menüs", icon: UtensilsCrossed },
  { href: "/suppliers", label: "Lieferanten", icon: Truck },
  { href: "/orders", label: "Bestellungen", icon: ShoppingCart },
  { href: "/invoices", label: "Rechnungen", icon: ReceiptText },
  { href: "/stock", label: "Lager", icon: BookOpen },
  { href: "/production", label: "Zentralküche", icon: CookingPot },
  { href: "/analytics/pos", label: "Auswertungen", icon: BarChart3 },
  { href: "/haccp", label: "HACCP", icon: ShieldCheck },
  { href: "/housekeeping", label: "Housekeeping", icon: BedDouble },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

type Props = {
  outlets: { id: string; name: string }[];
  outletId: string;
  onOutletChange: (id: string) => void;
  /** Right side of the header: user name or a user menu. */
  user: React.ReactNode;
  children: React.ReactNode;
};

/** Sidebar navigation, header with the outlet switch, and a skip link. The sidebar becomes a drawer below lg. */
export function AppShell({ outlets, outletId, onOutletChange, user, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[var(--size-sidebar)_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-bg focus:p-2">
        Zum Inhalt springen
      </a>
      <nav
        aria-label="Hauptnavigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-(--size-sidebar) flex-col bg-nav-bg p-3 lg:static lg:flex",
          open ? "flex" : "hidden",
        )}
      >
        <div className="flex h-(--size-header) items-center justify-between px-2">
          <Logo tone="light" />
          <button type="button" className="text-nav-text lg:hidden" aria-label="Navigation schließen" onClick={() => setOpen(false)}>
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <ul className="mt-2 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href.split("/").slice(0, 2).join("/"));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex h-(--size-control-md) items-center gap-3 rounded-sm px-3 text-nav-text hover:bg-nav-item-active hover:text-nav-text-active",
                    active && "bg-nav-item-active font-semibold text-nav-text-active",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-(--size-header) items-center gap-3 border-b border-border bg-bg px-4">
          <button type="button" className="lg:hidden" aria-label="Navigation öffnen" aria-expanded={open} onClick={() => setOpen(true)}>
            <MenuIcon aria-hidden className="size-5" />
          </button>
          <label className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Outlet</span>
            <Select value={outletId} onChange={(e) => onOutletChange(e.target.value)} className="h-(--size-control-sm) w-48">
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </label>
          <div className="ml-auto">{user}</div>
        </header>
        <main id="main" className="mx-auto w-full max-w-(--size-content-max) flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
