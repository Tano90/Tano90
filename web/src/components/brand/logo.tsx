import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/cn";

// The mark: five diced cubes forming an "M" on an aubergine tile; the middle one is the carrot of the mirepoix.
// Drawn on a 32 grid so it stays crisp at 16 px (favicon) and scales to the 1024 px app icon.
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
      <rect x="6" y="9" width="6" height="6" rx="1.5" fill="var(--color-on-accent)" />
      <rect x="6" y="17" width="6" height="6" rx="1.5" fill="var(--color-on-accent)" />
      <rect x="13" y="12" width="6" height="6" rx="1.5" fill="var(--color-saffron)" transform="rotate(8 16 15)" />
      <rect x="20" y="9" width="6" height="6" rx="1.5" fill="var(--color-on-accent)" />
      <rect x="20" y="17" width="6" height="6" rx="1.5" fill="var(--color-on-accent)" />
    </svg>
  );
}

/** Mark plus the name in lower case, tight like a stamp. `tone="light"` for dark backgrounds. */
export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className={cn("text-lg font-extrabold tracking-tight lowercase", tone === "light" ? "text-on-ink" : "text-text")}>{APP_NAME}</span>
    </span>
  );
}
