const ACCUEIL_PAR_ROLE: Record<string, string> = {
  admin: "/admin",
  directeur: "/directeur",
  enseignant: "/enseignant",
  etudiant: "/etudiant",
};

/** Page d'accueil de l'espace d'un rôle ; null hors connexion ou pour un rôle inconnu. */
export function accueilDuRole(role: string | null | undefined): string | null {
  return (role && ACCUEIL_PAR_ROLE[role]) || null;
}
