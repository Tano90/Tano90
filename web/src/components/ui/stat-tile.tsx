import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: string;
  /** e.g. "+2,1 Pp. ggü. Vorwoche". `good` decides the colour, not the sign: rising food cost is bad. */
  delta?: { text: string; direction: "up" | "down"; good: boolean };
  className?: string;
};

export function StatTile({ label, value, delta, className }: Props) {
  const Arrow = delta?.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cn("rounded-md border border-border bg-surface-raised p-4 shadow-card", className)}>
      <p className="text-xs font-normal text-text-muted">{label}</p>
      <p className="num mt-1 text-xl">{value}</p>
      {delta && (
        <p className={cn("mt-1 flex items-center gap-1 text-xs", delta.good ? "text-success" : "text-danger")}>
          <Arrow aria-hidden className="size-4" />
          {delta.text}
        </p>
      )}
    </div>
  );
}
