import { type ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-dark">
            {eyebrow}
          </p>
        )}
        <h1
          className={[
            "font-semibold tracking-tight text-ink",
            eyebrow ? "mt-2" : "",
            "text-3xl sm:text-4xl",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-lg leading-8 text-ink-secondary">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
