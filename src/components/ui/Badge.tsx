type BadgeVariant =
  | "risk-eleve"
  | "risk-moyen"
  | "status-active"
  | "status-traitee"
  | "role-admin"
  | "role-enseignant"
  | "role-etudiant"
  | "role-directeur"
  | "neutral";

const variantCls: Record<BadgeVariant, string> = {
  "risk-eleve": "border-red-300 bg-red-50 text-red-900",
  "risk-moyen": "border-amber-300 bg-amber-50 text-amber-950",
  "status-active": "border-red-300 bg-red-50 text-red-900",
  "status-traitee": "border-emerald-300 bg-emerald-50 text-emerald-900",
  "role-admin": "border-red-300 bg-red-50 text-red-800",
  "role-enseignant": "border-emerald-300 bg-emerald-50 text-emerald-800",
  "role-etudiant": "border-blue-300 bg-blue-50 text-blue-800",
  "role-directeur": "border-purple-300 bg-purple-50 text-purple-800",
  neutral: "border-border bg-page text-ink-secondary",
};

const prefix: Partial<Record<BadgeVariant, string>> = {
  "risk-eleve": "⚠",
  "risk-moyen": "⚠",
  "status-traitee": "✓",
};

const labels: Record<BadgeVariant, string> = {
  "risk-eleve": "Élevé",
  "risk-moyen": "Moyen",
  "status-active": "Active",
  "status-traitee": "Traitée",
  "role-admin": "Admin",
  "role-enseignant": "Enseignant",
  "role-etudiant": "Étudiant",
  "role-directeur": "Directeur",
  neutral: "",
};

export function Badge({
  variant,
  children,
  className = "",
}: {
  variant: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}) {
  const icon = prefix[variant];
  const defaultLabel = labels[variant];

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        variantCls[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children ?? defaultLabel}
    </span>
  );
}

export function riskVariant(niveau: string): BadgeVariant {
  return niveau === "eleve" ? "risk-eleve" : "risk-moyen";
}

export function statusVariant(statut: string): BadgeVariant {
  return statut === "active" ? "status-active" : "status-traitee";
}

export function roleVariant(role: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    admin: "role-admin",
    enseignant: "role-enseignant",
    etudiant: "role-etudiant",
    directeur: "role-directeur",
  };
  return map[role] ?? "neutral";
}
