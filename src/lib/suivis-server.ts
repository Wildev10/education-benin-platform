/** Champs d'une étape de suivi envoyés aux fiches (sans l'identifiant de l'auteur). */
export const selectionSuivi = {
  id: true,
  auteurNom: true,
  action: true,
  commentaire: true,
  statutAvant: true,
  statutApres: true,
  createdAt: true,
  motifCloture: true,
  responsableNom: true,
} as const;

/** Responsable affiché d'une alerte (nom seul, jamais l'adresse). */
export const selectionResponsable = { responsable: { select: { id: true, nom: true, prenom: true } } } as const;

/** Historique d'une alerte, du plus ancien au plus récent. */
export const inclureSuivis = { suivis: { select: selectionSuivi, orderBy: { createdAt: "asc" as const } } };
