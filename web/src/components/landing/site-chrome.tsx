import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { APP_NAME } from "@/lib/brand";

/** Header and footer of the public pages besides the start page (legal pages). */
export function SiteHeader() {
  return (
    <header className="relative mx-auto flex max-w-(--size-content-max) items-center justify-between px-4 py-5 lg:px-8">
      <Link href="/" aria-label={`${APP_NAME} Startseite`}><Logo /></Link>
      <nav aria-label="Konto" className="flex items-center gap-5">
        <Link href="/#funktionen" className="hidden font-semibold text-text-muted hover:text-text md:inline">Funktionen</Link>
        <Link href="/#preise" className="hidden font-semibold text-text-muted hover:text-text md:inline">Preise</Link>
        <Link href="/suite" className="font-semibold hover:underline">Anmelden</Link>
        <Link href="/suite" className="hidden h-(--size-control-md) items-center rounded-pill bg-accent px-4 font-bold text-on-accent hover:bg-accent-hover sm:inline-flex">
          Kostenlos starten
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink text-on-ink-muted">
      <div className="mx-auto flex max-w-(--size-content-max) flex-col gap-4 px-4 py-8 text-xs font-normal sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:px-8">
        <span className="flex items-center gap-3"><Logo tone="light" /> <span>© {APP_NAME}</span></span>
        <nav aria-label="Rechtliches" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/legal/privacy" className="hover:text-on-ink hover:underline">Datenschutz</Link>
          <Link href="/legal/terms" className="hover:text-on-ink hover:underline">Nutzungsbedingungen</Link>
          <Link href="/legal/dpa" className="hover:text-on-ink hover:underline">Auftragsverarbeitung</Link>
          <Link href="/legal/imprint" className="hover:text-on-ink hover:underline">Impressum</Link>
        </nav>
      </div>
    </footer>
  );
}
