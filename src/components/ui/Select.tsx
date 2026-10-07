import { type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Select({ label, error, hint, id, className = "", children, ...props }: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-semibold text-ink">
        {label}
        {props.required && <span aria-hidden="true" className="ml-1 text-red-600">*</span>}
      </label>
      <select
        {...props}
        id={selectId}
        className={[
          "w-full rounded-lg border bg-surface px-3 py-2.5 text-ink",
          "transition focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark",
          "disabled:cursor-not-allowed disabled:bg-page disabled:opacity-70",
          error ? "border-red-400" : "border-border",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
        aria-invalid={error ? "true" : undefined}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={`${selectId}-hint`} className="text-xs text-ink-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${selectId}-error`} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
