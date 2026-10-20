/**
 * Navigation du directeur, partagée entre son tableau de bord et les pages de
 * l'espace enseignant. Pas d'import de notes : l'API le réserve à l'admin et à
 * l'enseignant (ROLES_IMPORT_NOTES).
 */
export const navDirecteur = [
  { href: "/directeur", label: "Tableau de bord", exact: true },
  { href: "/directeur/alertes", label: "Alertes" },
  { href: "/directeur/absences", label: "Absences" },
  { href: "/enseignant", label: "Élèves", exact: true },
  { href: "/enseignant/assistant", label: "Assistant" },
];
