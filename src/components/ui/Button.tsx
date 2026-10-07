import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const variantCls: Record<Variant, string> = {
  primary:
    "bg-brand text-ink hover:bg-brand-dark hover:text-surface focus-visible:ring-brand-dark",
  secondary:
    "bg-ink text-surface hover:bg-ink-secondary focus-visible:ring-ink",
  outline:
    "border border-border bg-surface text-ink-secondary hover:border-brand hover:bg-brand-light hover:text-ink focus-visible:ring-brand-dark",
  danger:
    "border border-red-200 bg-surface text-red-700 hover:border-red-300 hover:bg-red-50 focus-visible:ring-red-500",
  ghost:
    "bg-transparent text-ink-secondary hover:bg-page hover:text-ink focus-visible:ring-brand-dark",
};

const sizeCls: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantCls[variant],
        sizeCls[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}
