/** Navigation du directeur, partagée entre son tableau de bord et les pages de l'espace enseignant. */
export const navDirecteur = [
  { href: "/directeur", label: "Tableau de bord", exact: true },
  { href: "/directeur/alertes", label: "Alertes" },
  { href: "/directeur/absences", label: "Absences" },
  { href: "/enseignant", label: "Élèves", exact: true },
  { href: "/enseignant/import", label: "Importer" },
  { href: "/enseignant/assistant", label: "Assistant" },
];
