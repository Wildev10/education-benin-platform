import { jourIsoAuBenin } from "@/lib/dates";

/**
 * Année scolaire et trimestre d'une date, au Bénin. L'année commence en
 * septembre ; trimestres : septembre-décembre, janvier-mars, avril-août.
 * Sert de période proposée par défaut à la saisie (note, absence).
 */
export function periodeScolaireAuBenin(date: Date): { anneeScolaire: string; periode: string } {
  return periodeScolaireDuJour(jourIsoAuBenin(date));
}

/** Même calcul à partir d'un jour AAAA-MM-JJ (valeur d'un champ de date). */
export function periodeScolaireDuJour(jourIso: string): { anneeScolaire: string; periode: string } {
  const annee = Number(jourIso.slice(0, 4));
  const mois = Number(jourIso.slice(5, 7));
  const debut = mois >= 9 ? annee : annee - 1;
  const periode = mois >= 9 ? "Trimestre 1" : mois <= 3 ? "Trimestre 2" : "Trimestre 3";
  return { anneeScolaire: `${debut}-${debut + 1}`, periode };
}
