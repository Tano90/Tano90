import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

const variants = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-bg text-text border border-border-input hover:bg-row-hover",
  ghost: "bg-transparent text-text hover:bg-row-hover",
  danger: "bg-danger text-on-danger hover:opacity-90",
} as const;

const sizes = {
  sm: "h-(--size-control-sm) px-3 gap-1.5",
  md: "h-(--size-control-md) px-4 gap-2",
  lg: "h-(--size-control-lg) px-6 gap-2 text-base",
  icon: "size-(--size-control-md) justify-center",
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm font-semibold whitespace-nowrap",
        "transition-colors duration-(--duration-fast) ease-(--ease-standard)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});
