import { IconeAlerte, IconeValide } from "@/components/ui/Icones";
import { statutSuivi } from "@/lib/suivi-alertes";
type BadgeVariant =
  | "risk-eleve"
  | "risk-moyen"
  | "status-nouvelle"
  | "status-en-suivi"
  | "status-resolue"
  | "role-admin"
  | "role-enseignant"
  | "role-etudiant"
  | "role-directeur"
  | "neutral";

const variantCls: Record<BadgeVariant, string> = {
  "risk-eleve": "border-red-300 bg-red-50 text-red-900",
  "risk-moyen": "border-amber-300 bg-amber-50 text-amber-950",
  "status-nouvelle": "border-red-300 bg-red-50 text-red-900",
  "status-en-suivi": "border-blue-300 bg-blue-50 text-blue-900",
  "status-resolue": "border-emerald-300 bg-emerald-50 text-emerald-900",
  "role-admin": "border-red-300 bg-red-50 text-red-800",
  "role-enseignant": "border-emerald-300 bg-emerald-50 text-emerald-800",
  "role-etudiant": "border-blue-300 bg-blue-50 text-blue-800",
  "role-directeur": "border-purple-300 bg-purple-50 text-purple-800",
  neutral: "border-border bg-page text-ink-secondary",
};

/** Icône au trait devant le libellé (décorative : le texte dit déjà le niveau ou le statut) */
const prefix: Partial<Record<BadgeVariant, typeof IconeAlerte>> = {
  "risk-eleve": IconeAlerte,
  "risk-moyen": IconeAlerte,
  "status-resolue": IconeValide,
};

const labels: Record<BadgeVariant, string> = {
  "risk-eleve": "Élevé",
  "risk-moyen": "Moyen",
  "status-nouvelle": "Nouvelle",
  "status-en-suivi": "En cours de suivi",
  "status-resolue": "Résolue",
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
  const Icone = prefix[variant];
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
      {Icone && <Icone taille={12} />}
      {children ?? defaultLabel}
    </span>
  );
}

export function riskVariant(niveau: string): BadgeVariant {
  return niveau === "eleve" ? "risk-eleve" : "risk-moyen";
}

/** Badge du statut de suivi (Nouvelle, En cours de suivi, Résolue), libellé compris. */
export function statusVariant(alerte: { statut: string; suiviDepuis?: Date | string | null }): BadgeVariant {
  const variantes = { nouvelle: "status-nouvelle", en_suivi: "status-en-suivi", resolue: "status-resolue" } as const;
  return variantes[statutSuivi(alerte)];
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
