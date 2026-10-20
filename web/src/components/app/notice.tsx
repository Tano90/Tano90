import { Info, Lock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

const tones = {
  info: { cls: "border-info bg-info-subtle text-info", Icon: Info },
  warning: { cls: "border-warning bg-warning-subtle text-warning", Icon: TriangleAlert },
  locked: { cls: "border-border bg-surface-sunken text-text-muted", Icon: Lock },
} as const;

export function Notice({ tone = "info", children, className }: { tone?: keyof typeof tones; children: React.ReactNode; className?: string }) {
  const { cls, Icon } = tones[tone];
  return (
    <div role={tone === "warning" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-md border px-3 py-2", cls, className)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="text-text">{children}</div>
    </div>
  );
}

export function NoPermission({ what }: { what: string }) {
  return (
    <Notice tone="locked" className="max-w-xl">
      <p className="font-semibold">Kein Zugriff</p>
      <p className="text-text-muted">{what} Frag die Inhaberin oder den Inhaber nach einer passenden Rolle.</p>
    </Notice>
  );
}
