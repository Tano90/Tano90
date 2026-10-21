import { APP_NAME, APP_SHORT } from "@/lib/brand";
import { cn } from "@/lib/cn";

// The mark: three rising bars on a petrol tile (the leadership board: numbers that go up) and a saffron dot
// for the assistant. Drawn on a 32 grid so it stays crisp at 16 px (favicon) and scales to the 1024 px app icon.
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
      <rect x="7" y="17" width="4.5" height="8" rx="1.5" fill="var(--color-on-accent)" />
      <rect x="13.75" y="13" width="4.5" height="12" rx="1.5" fill="var(--color-on-accent)" />
      <rect x="20.5" y="9" width="4.5" height="16" rx="1.5" fill="var(--color-on-accent)" />
      <circle cx="24.5" cy="6.5" r="2.5" fill="var(--color-saffron)" />
    </svg>
  );
}

/** Mark plus "GLB AI Suite": the short name bold, the rest light. `tone="light"` for dark backgrounds. */
export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="sr-only">{APP_NAME}</span>
      <span aria-hidden className={cn("flex items-baseline gap-1.5 text-lg leading-none tracking-tight", tone === "light" ? "text-on-ink" : "text-text")}>
        <span className="font-extrabold">{APP_SHORT}</span>
        <span className={cn("text-sm font-semibold", tone === "light" ? "text-on-ink-muted" : "text-text-muted")}>{APP_NAME.slice(APP_SHORT.length).trim()}</span>
      </span>
    </span>
  );
}
