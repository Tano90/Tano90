import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-surface-sunken text-text",
  accent: "bg-accent-subtle text-accent",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex h-6 items-center gap-1 rounded-pill px-2 text-xs whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}

const PO_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Entwurf", tone: "neutral" },
  ordered: { label: "Bestellt", tone: "info" },
  partially_delivered: { label: "Teilweise geliefert", tone: "warning" },
  delivered: { label: "Geliefert", tone: "success" },
  cancelled: { label: "Storniert", tone: "danger" },
};

export function OrderStatusBadge({ status }: { status: keyof typeof PO_STATUS | string }) {
  const s = PO_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
