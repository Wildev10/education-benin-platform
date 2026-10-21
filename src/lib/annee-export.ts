/**
 * Année retenue par les exports de la fiche élève (PDF, Excel) : l'année
 * scolaire en cours au Bénin. Sans aucun élément cette année (début d'année),
 * le récapitulatif de l'année précédente, avec son année bien indiquée.
 */

export type AnneeExport<T> = {
  /** Année scolaire en cours au Bénin */
  anneeEnCours: string;
  /** Éléments de l'année en cours */
  enCours: T[];
  /** Année précédente : seulement si l'année en cours est vide et qu'elle a des éléments */
  precedente: { anneeScolaire: string; elements: T[] } | null;
};

/** « 2026-2027 » → « 2025-2026 » */
export function anneeScolairePrecedente(annee: string): string {
  const debut = Number.parseInt(annee, 10);
  return `${debut - 1}-${debut}`;
}

export function selectionnerAnneeExport<T extends { anneeScolaire: string }>(
  elements: T[],
  anneeEnCours: string
): AnneeExport<T> {
  const enCours = elements.filter((e) => e.anneeScolaire === anneeEnCours);
  if (enCours.length > 0) return { anneeEnCours, enCours, precedente: null };
  const anneeScolaire = anneeScolairePrecedente(anneeEnCours);
  const precedents = elements.filter((e) => e.anneeScolaire === anneeScolaire);
  return { anneeEnCours, enCours, precedente: precedents.length ? { anneeScolaire, elements: precedents } : null };
}

/** « Aucune note pour l'année 2026-2027 pour l'instant. » */
export function messageAucun(type: "note" | "absence", annee: string): string {
  return `Aucune ${type} pour l'année ${annee} pour l'instant.`;
}

/** Titre du récapitulatif de l'année précédente. */
export function titreRecapitulatif(annee: string): string {
  return `Récapitulatif de l'année ${annee}`;
}
