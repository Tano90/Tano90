"use client";

import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

/** Polite live region; errors stay until dismissed so they are not missed. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!bg-surface-raised !text-text !border-border !shadow-pop !rounded-md !font-sans",
          description: "!text-text-muted",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
        },
      }}
    />
  );
}
