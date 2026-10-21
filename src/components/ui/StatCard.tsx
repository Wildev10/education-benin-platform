import { type ReactNode } from "react";

type Tone = "default" | "brand" | "danger" | "warning" | "success";

const toneCls: Record<Tone, { card: string; value: string; label: string }> = {
  default: {
    card: "border-border bg-surface",
    value: "text-ink",
    label: "text-ink-secondary",
  },
  brand: {
    card: "border-brand/30 bg-brand-light",
    value: "text-ink",
    label: "text-brand-dark",
  },
  danger: {
    card: "border-red-200 bg-red-50",
    value: "text-red-950",
    label: "text-red-800",
  },
  warning: {
    card: "border-amber-200 bg-amber-50",
    value: "text-amber-950",
    label: "text-amber-900",
  },
  success: {
    card: "border-emerald-200 bg-emerald-50",
    value: "text-emerald-950",
    label: "text-emerald-900",
  },
};

interface StatCardProps {
  label: string;
  value: number | string;
  sublabel?: string;
  icon?: ReactNode;
  tone?: Tone;
}

export function StatCard({ label, value, sublabel, icon, tone = "default" }: StatCardProps) {
  const cls = toneCls[tone];

  return (
    <article className={`@container rounded-[14px] border p-5 shadow-sm ${cls.card}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-semibold ${cls.label}`}>{label}</p>
        {icon && (
          <span aria-hidden="true" className="shrink-0 opacity-60">
            {icon}
          </span>
        )}
      </div>
      {/* Taille selon la largeur de la carte (requête de conteneur), pour que le chiffre y tienne toujours */}
      <p className={`mt-3 text-2xl font-bold tabular-nums @[6.5rem]:text-3xl @[8rem]:text-4xl ${cls.value}`}>{value}</p>
      {sublabel && (
        <p className={`mt-1.5 text-sm font-medium ${cls.label}`}>{sublabel}</p>
      )}
    </article>
  );
}
