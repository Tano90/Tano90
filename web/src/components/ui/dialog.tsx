"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

type DialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

/** Modal with focus trap, Esc to close and focus returned to the trigger (Radix). */
export function Dialog({ open, onOpenChange, trigger, title, description, children, footer, className }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-text/40" />
        <RadixDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col",
            "rounded-lg bg-surface-raised shadow-pop",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-4">
            <div>
              <RadixDialog.Title className="text-lg">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-text-muted">{description}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Schließen">
                <X aria-hidden className="size-4" />
              </Button>
            </RadixDialog.Close>
          </div>
          {children && <div className="overflow-y-auto p-4">{children}</div>}
          {footer && <div className="flex justify-end gap-2 border-t border-border p-4">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

type ConfirmProps = Omit<DialogProps, "children" | "footer"> & {
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
};

/** Confirmation for destructive or final steps (archive, close a count, send an order). Cancel gets focus first. */
export function ConfirmDialog({ confirmLabel, danger, loading, onConfirm, ...props }: ConfirmProps) {
  return (
    <Dialog
      {...props}
      footer={
        <>
          <RadixDialog.Close asChild>
            <Button variant="secondary" autoFocus>
              Abbrechen
            </Button>
          </RadixDialog.Close>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
