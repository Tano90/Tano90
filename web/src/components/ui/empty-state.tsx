import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
  /** Use "h1" when the empty state is the whole page (e.g. not found). */
  as?: "p" | "h1" | "h2";
};

export function EmptyState({ icon: Icon, title, body, action, className, as: Title = "p" }: Props) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      <Icon aria-hidden className="size-8 text-text-subtle" />
      <Title className="text-base font-semibold">{title}</Title>
      {body && <p className="max-w-sm text-text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
