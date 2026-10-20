/** Regroupement des notes par trimestre, partagé par l'espace étudiant et les fiches élèves. */

export const TRIMESTRES = ["Trimestre 1", "Trimestre 2", "Trimestre 3"] as const;

export type NoteTrimestre = { id: string; matiere: string; valeur: number; periode: string };

export type GroupeTrimestre<N extends NoteTrimestre = NoteTrimestre> = {
  periode: string;
  notes: N[];
  /** null quand le trimestre n'a aucune note */
  moyenne: number | null;
};

export function moyenneNotes(notes: { valeur: number }[]): number | null {
  if (notes.length === 0) return null;
  return notes.reduce((total, note) => total + note.valeur, 0) / notes.length;
}

/** Les trois trimestres dans l'ordre, chacun avec ses notes et sa moyenne. */
export function grouperNotesParTrimestre<N extends NoteTrimestre>(notes: N[]): GroupeTrimestre<N>[] {
  return TRIMESTRES.map((periode) => {
    const duTrimestre = notes.filter((note) => note.periode === periode);
    return { periode, notes: duTrimestre, moyenne: moyenneNotes(duTrimestre) };
  });
}

/**
 * Trimestre ouvert par défaut : le plus récent qui a des notes. Sans aucune
 * note, le dernier trimestre (son panneau affiche « Aucune note »).
 */
export function trimestreOuvertParDefaut(groupes: { periode: string; notes: unknown[] }[]): string | null {
  const avecNotes = groupes.filter((groupe) => groupe.notes.length > 0);
  return (avecNotes.at(-1) ?? groupes.at(-1))?.periode ?? null;
}
