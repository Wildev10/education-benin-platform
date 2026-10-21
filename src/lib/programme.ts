// Classes et matières de l'enseignement secondaire général au Bénin. Source
// unique pour les filtres, la saisie, l'import, les exports et le seed.

/** Classes de la 6ème à la Terminale, dans l'ordre (séries à partir de la Seconde). */
export const NIVEAUX = [
  "6ème",
  "5ème",
  "4ème",
  "3ème",
  "Seconde A",
  "Seconde B",
  "Seconde C",
  "Seconde D",
  "Première A1",
  "Première A2",
  "Première B",
  "Première C",
  "Première D",
  "Terminale A1",
  "Terminale A2",
  "Terminale B",
  "Terminale C",
  "Terminale D",
];

/** Toutes les matières, dans l'ordre d'affichage des fiches et des exports. */
export const MATIERES = [
  "Mathématiques",
  "PCT",
  "SVT",
  "Français",
  "Anglais",
  "Espagnol",
  "Allemand",
  "Histoire-Géographie",
  "Philosophie",
  "Économie",
  "EPS",
];

const TRONC_COMMUN = ["Mathématiques", "PCT", "SVT", "Français", "Anglais", "Histoire-Géographie", "EPS"];

/**
 * Matières enseignées dans une classe : tronc commun, deuxième langue
 * (Espagnol ou Allemand) dès la 4ème, Philosophie en Première et Terminale,
 * Économie en série B. Classe inconnue : toutes les matières.
 */
export function matieresDuNiveau(niveau: string | undefined): string[] {
  if (!niveau || !NIVEAUX.includes(niveau)) return MATIERES;
  const liste = new Set(TRONC_COMMUN);
  if (!["6ème", "5ème"].includes(niveau)) {
    liste.add("Espagnol");
    liste.add("Allemand");
  }
  if (niveau.startsWith("Première") || niveau.startsWith("Terminale")) liste.add("Philosophie");
  if (niveau.endsWith(" B")) liste.add("Économie");
  return MATIERES.filter((m) => liste.has(m));
}

/** Tri des matières selon MATIERES ; les inconnues (anciennes données) à la fin, par ordre alphabétique. */
export function comparerMatieres(a: string, b: string): number {
  const ia = MATIERES.indexOf(a);
  const ib = MATIERES.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b, "fr");
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}
