/** Fuseau de toutes les dates et heures affichées (serveur, navigateur, PDF, Excel). */
export const FUSEAU_BENIN = "Africa/Porto-Novo";

const formatJourIso = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU_BENIN });

/** Jour au Bénin, au format AAAA-MM-JJ (valeur d'un champ de date, nom de fichier…). */
export function jourIsoAuBenin(date: Date): string {
  return formatJourIso.format(date);
}

/**
 * Minuit UTC du jour calendaire au Bénin. C'est la convention des dates sans
 * heure (absences, dates de naissance) et ce qu'il faut écrire dans une cellule
 * de date Excel, qu'un tableur affiche sans tenir compte du fuseau.
 */
export function jourAuBenin(date: Date): Date {
  return new Date(`${jourIsoAuBenin(date)}T00:00:00Z`);
}
