"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export const Tabs = RadixTabs.Root;

export function TabList({ className, ...props }: RadixTabs.TabsListProps) {
  return <RadixTabs.List className={cn("flex gap-1 overflow-x-auto border-b border-border", className)} {...props} />;
}

type TabProps = RadixTabs.TabsTriggerProps & { warning?: string };

/** A tab with an optional warning ("2 Zutaten ohne Preis") shown as an icon and announced via title. */
export function Tab({ className, children, warning, ...props }: TabProps) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "-mb-px inline-flex h-(--size-control-md) items-center gap-1.5 border-b-2 border-transparent px-3 whitespace-nowrap text-text-muted",
        "hover:text-text data-[state=active]:border-accent data-[state=active]:font-semibold data-[state=active]:text-text",
        className,
      )}
      {...props}
    >
      {children}
      {warning && (
        <>
          <AlertCircle aria-hidden className="size-4 text-warning" />
          <span className="sr-only">({warning})</span>
        </>
      )}
    </RadixTabs.Trigger>
  );
}

export function TabPanel({ className, ...props }: RadixTabs.TabsContentProps) {
  return <RadixTabs.Content className={cn("pt-4 focus-visible:outline-offset-4", className)} {...props} />;
}
