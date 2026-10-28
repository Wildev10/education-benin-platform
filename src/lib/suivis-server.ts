/** Champs d'une étape de suivi envoyés aux fiches (sans l'identifiant de l'auteur). */
export const selectionSuivi = {
  id: true,
  auteurNom: true,
  action: true,
  commentaire: true,
  statutAvant: true,
  statutApres: true,
  createdAt: true,
} as const;

/** Historique d'une alerte, du plus ancien au plus récent. */
export const inclureSuivis = { suivis: { select: selectionSuivi, orderBy: { createdAt: "asc" as const } } };
