"use client";

import { cloneElement, forwardRef, isValidElement, useId } from "react";
import { cn } from "@/lib/cn";

export const controlClass = cn(
  "h-(--size-control-md) w-full rounded-sm border border-border-input bg-bg px-3 text-sm text-text",
  "placeholder:text-text-subtle",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted",
  "aria-invalid:border-danger aria-invalid:border-2",
);

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Hide the label visually but keep it for screen readers (table cells). */
  hideLabel?: boolean;
  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
};

/** Label, hint and error wired to one control by id and aria attributes. */
export function Field({ label, hint, error, required, hideLabel, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        required,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={cn("text-xs text-text", hideLabel && "sr-only")}>
        {label}
        {required && <span aria-hidden className="text-danger"> *</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs font-normal text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(controlClass, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlClass, "h-auto min-h-24 py-2", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(controlClass, "pr-8", className)} {...props}>
      {children}
    </select>
  );
});
