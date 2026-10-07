import { type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, className = "", ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
        {props.required && <span aria-hidden="true" className="ml-1 text-red-600">*</span>}
      </label>
      <input
        {...props}
        id={inputId}
        className={[
          "w-full rounded-lg border bg-surface px-4 py-2.5 text-ink",
          "placeholder:text-ink-secondary/50 transition",
          "focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark",
          "disabled:cursor-not-allowed disabled:bg-page disabled:opacity-70",
          error ? "border-red-400" : "border-border",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        aria-invalid={error ? "true" : undefined}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-ink-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
