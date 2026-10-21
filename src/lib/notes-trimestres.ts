/**
 * Regroupement des notes et des absences par année scolaire puis par trimestre,
 * partagé par l'espace étudiant et les fiches élèves : deux années ne sont
 * jamais mélangées (le trimestre 1 de 2025-2026 n'est pas celui de 2026-2027).
 */

export const TRIMESTRES = ["Trimestre 1", "Trimestre 2", "Trimestre 3"] as const;

export type PeriodeScolaire = { anneeScolaire: string; periode: string };

export type NoteTrimestre = { id: string; matiere: string; valeur: number; periode: string; anneeScolaire: string };

export type GroupeTrimestre<N extends NoteTrimestre = NoteTrimestre> = {
  anneeScolaire: string;
  periode: string;
  notes: N[];
  /** null quand le trimestre n'a aucune note */
  moyenne: number | null;
};

export type GroupeAnnee<N extends NoteTrimestre = NoteTrimestre> = {
  anneeScolaire: string;
  /** Moyenne de toutes les notes de l'année ; null sans note */
  moyenne: number | null;
  trimestres: GroupeTrimestre<N>[];
};

/** Identifiant d'un trimestre d'une année donnée (ouverture de l'accordéon). */
export function cleTrimestre({ anneeScolaire, periode }: PeriodeScolaire): string {
  return `${anneeScolaire}::${periode}`;
}

export function moyenneNotes(notes: { valeur: number }[]): number | null {
  if (notes.length === 0) return null;
  return notes.reduce((total, note) => total + note.valeur, 0) / notes.length;
}

/**
 * Années qui ont des éléments, plus l'année en cours (même vide, pour y saisir
 * et pour que son trimestre puisse être ouvert), de la plus récente à la plus ancienne.
 */
export function anneesAffichees(elements: { anneeScolaire: string }[], anneeEnCours: string): string[] {
  return [...new Set([anneeEnCours, ...elements.map((e) => e.anneeScolaire)])].sort((a, b) => b.localeCompare(a));
}

/** Éléments (absences…) par année, la plus récente d'abord, puis par trimestre dans l'ordre. */
export function grouperParAnnee<E extends PeriodeScolaire>(
  elements: E[],
  anneeEnCours: string
): { anneeScolaire: string; trimestres: { periode: string; elements: E[] }[] }[] {
  return anneesAffichees(elements, anneeEnCours).map((anneeScolaire) => ({
    anneeScolaire,
    trimestres: TRIMESTRES.map((periode) => ({
      periode,
      elements: elements.filter((e) => e.anneeScolaire === anneeScolaire && e.periode === periode),
    })),
  }));
}

/** Notes par année (la plus récente d'abord) puis par trimestre, avec les moyennes. */
export function grouperNotesParAnnee<N extends NoteTrimestre>(notes: N[], anneeEnCours: string): GroupeAnnee<N>[] {
  return grouperParAnnee(notes, anneeEnCours).map(({ anneeScolaire, trimestres }) => {
    const groupes = trimestres.map(({ periode, elements }) => ({
      anneeScolaire,
      periode,
      notes: elements,
      moyenne: moyenneNotes(elements),
    }));
    return { anneeScolaire, moyenne: moyenneNotes(groupes.flatMap((g) => g.notes)), trimestres: groupes };
  });
}

/** Moyenne de chaque trimestre qui a des notes, dans l'ordre chronologique (graphiques). */
export function moyennesChronologiques(notes: NoteTrimestre[]): (PeriodeScolaire & { moyenne: number })[] {
  const annees = [...new Set(notes.map((n) => n.anneeScolaire))].sort();
  return annees.flatMap((anneeScolaire) =>
    TRIMESTRES.flatMap((periode) => {
      const moyenne = moyenneNotes(notes.filter((n) => n.anneeScolaire === anneeScolaire && n.periode === periode));
      return moyenne === null ? [] : [{ anneeScolaire, periode, moyenne }];
    })
  );
}

/** Espace insécable : « Trimestre » et son numéro ne sont jamais séparés. */
const INSECABLE = " ";

/**
 * Libellé unique d'une période, partout (pages, cloche, messages, PDF, Excel) :
 * « Trimestre 1 · 2026-2027 ». Le point médian sépare le numéro du trimestre
 * de l'année, qui ne peuvent plus se lire « 12026 ». Une seule coupure de ligne
 * possible, avant le point : en place réduite, l'année passe à la ligne
 * (« Trimestre 1 », puis « · 2026-2027 »), jamais « Trimestre » seul.
 * La période seule pour une ancienne alerte sans année.
 */
export function libellePeriode(periode: string, anneeScolaire: string | null | undefined): string {
  const trimestre = periode.replace(" ", INSECABLE);
  return anneeScolaire ? `${trimestre} ·${INSECABLE}${anneeScolaire}` : trimestre;
}

/**
 * Libellé court d'un point de graphique : « T1 », ou « T1 · 25-26 » quand les
 * points couvrent plusieurs années (sinon deux « T1 » se suivraient).
 */
export function libelleCourt({ anneeScolaire, periode }: PeriodeScolaire, plusieursAnnees: boolean): string {
  const trimestre = periode.replace("Trimestre ", "T");
  return plusieursAnnees ? `${trimestre} ·${INSECABLE}${anneeScolaire.replace(/\d{2}(\d{2})-\d{2}(\d{2})/, "$1-$2")}` : trimestre;
}
