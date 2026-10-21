/**
 * Règles de détection du décrochage, sans accès à la base : utilisées par
 * src/lib/detection-alerte.ts (saisie, import CSV) et par la fiche élève.
 */

const ordrePeriodes: Record<string, number> = {
  "Trimestre 1": 1,
  "Trimestre 2": 2,
  "Trimestre 3": 3,
};

/** Notes nécessaires dans la période la plus récente avant de la comparer. */
export const NOTES_MIN_COMPARAISON = 2;

const SEUIL_MOYEN = 5;
const SEUIL_ELEVE = 10;

export const LIBELLES_NIVEAU: Record<string, string> = { moyen: "Moyen", eleve: "Élevé" };

export type MoyennePeriode = {
  anneeScolaire: string;
  periode: string;
  moyenne: number;
  noteCount: number;
};

export type ComparaisonNotes =
  /** Une seule période avec des notes (nouvel élève) : rien à comparer. */
  | { etat: "sans_periode_precedente" }
  /** La période la plus récente n'a pas encore assez de notes. */
  | { etat: "notes_insuffisantes"; periodeRecente: MoyennePeriode }
  | {
      etat: "comparee";
      periodeAvant: MoyennePeriode;
      periodeRecente: MoyennePeriode;
      ecartPourcent: number;
      niveauRisque: "eleve" | "moyen" | null;
    };

export function calculerNiveauAlerte(
  moyenneAvant: number,
  moyenneApres: number
): "eleve" | "moyen" | null {
  if (moyenneAvant <= 0) return null;
  const ecartPourcent = ((moyenneAvant - moyenneApres) / moyenneAvant) * 100;
  if (ecartPourcent >= 20 && moyenneApres < 10) return "eleve";
  if (ecartPourcent >= 15) return "moyen";
  return null;
}

export function calculerNiveauAlerteAbsence(
  nbAbsencesInjustifiees: number
): "eleve" | "moyen" | null {
  if (nbAbsencesInjustifiees >= SEUIL_ELEVE) return "eleve";
  if (nbAbsencesInjustifiees >= SEUIL_MOYEN) return "moyen";
  return null;
}

/** Tri chronologique : année scolaire, puis trimestre. */
export function comparerPeriodes(
  a: { anneeScolaire: string; periode: string },
  b: { anneeScolaire: string; periode: string }
): number {
  const anneeA = Number.parseInt(a.anneeScolaire, 10);
  const anneeB = Number.parseInt(b.anneeScolaire, 10);
  if (anneeA !== anneeB) return anneeA - anneeB;
  return (ordrePeriodes[a.periode] ?? Number.MAX_SAFE_INTEGER) - (ordrePeriodes[b.periode] ?? Number.MAX_SAFE_INTEGER);
}

/**
 * Compare la moyenne des deux périodes les plus récentes de l'élève. La plus
 * récente doit avoir au moins NOTES_MIN_COMPARAISON notes : une seule note en
 * début de trimestre ne suffit pas à conclure à une baisse.
 */
export function comparerMoyennes(
  notes: { valeur: number; periode: string; anneeScolaire: string }[]
): ComparaisonNotes {
  const parPeriode = new Map<string, MoyennePeriode>();
  for (const note of notes) {
    const cle = `${note.anneeScolaire}::${note.periode}`;
    const groupe = parPeriode.get(cle);
    if (groupe) {
      groupe.moyenne = (groupe.moyenne * groupe.noteCount + note.valeur) / (groupe.noteCount + 1);
      groupe.noteCount += 1;
    } else {
      parPeriode.set(cle, { anneeScolaire: note.anneeScolaire, periode: note.periode, moyenne: note.valeur, noteCount: 1 });
    }
  }

  const periodes = [...parPeriode.values()].sort(comparerPeriodes);
  if (periodes.length < 2) return { etat: "sans_periode_precedente" };

  const periodeAvant = periodes[periodes.length - 2];
  const periodeRecente = periodes[periodes.length - 1];
  if (periodeRecente.noteCount < NOTES_MIN_COMPARAISON) return { etat: "notes_insuffisantes", periodeRecente };

  const ecartPourcent =
    periodeAvant.moyenne > 0 ? ((periodeAvant.moyenne - periodeRecente.moyenne) / periodeAvant.moyenne) * 100 : 0;
  return {
    etat: "comparee",
    periodeAvant,
    periodeRecente,
    ecartPourcent,
    niveauRisque: calculerNiveauAlerte(periodeAvant.moyenne, periodeRecente.moyenne),
  };
}

/**
 * Absences injustifiées de la période la plus récente qui en compte, et le
 * niveau correspondant. null : aucune absence injustifiée.
 */
export function compterAbsencesRecentes(
  absences: { periode: string; anneeScolaire: string }[]
): { periode: string; anneeScolaire: string; count: number; niveauRisque: "eleve" | "moyen" | null } | null {
  const compteurs = new Map<string, { periode: string; anneeScolaire: string; count: number }>();
  for (const a of absences) {
    const cle = `${a.anneeScolaire}::${a.periode}`;
    const entree = compteurs.get(cle);
    if (entree) entree.count++;
    else compteurs.set(cle, { periode: a.periode, anneeScolaire: a.anneeScolaire, count: 1 });
  }
  const cible = [...compteurs.values()].sort(comparerPeriodes).at(-1);
  return cible ? { ...cible, niveauRisque: calculerNiveauAlerteAbsence(cible.count) } : null;
}

const RANG_NIVEAU: Record<string, number> = { moyen: 1, eleve: 2 };

/**
 * Le nouveau niveau dépasse celui de l'alerte existante (Moyen → Élevé). Seul
 * cas où une alerte existante est modifiée : un niveau égal ou en baisse ne
 * change rien. Une alerte traitée qui s'aggrave est réactivée.
 */
export function estAggravation(alerte: { niveauRisque: string }, nouveauNiveau: string): boolean {
  return (
    alerte.niveauRisque in RANG_NIVEAU &&
    (RANG_NIVEAU[nouveauNiveau] ?? 0) > RANG_NIVEAU[alerte.niveauRisque]
  );
}
