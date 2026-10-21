import { formaterBaisse, formaterNombre } from "@/lib/format";
import { libellePeriode } from "@/lib/notes-trimestres";
import { LIBELLES_NIVEAU, NOTES_MIN_COMPARAISON, type ComparaisonNotes } from "@/lib/regles-alerte";

/** Alerte créée ou aggravée par une saisie, telle que la renvoient POST /api/notes et /api/absences. */
export type AlerteSaisie = {
  id: string;
  type: string;
  issue: "creee" | "mise_a_jour";
  niveauRisque: string;
  niveauPrecedent: string | null;
  reactivee: boolean;
  statut: string;
  periode: string;
  anneeScolaire: string | null;
  moyenneAvant: number;
  moyenneApres: number;
  ecartPourcent: number;
  createdAt: string;
};

export type MessageSaisie = { alerte: boolean; titre: string; detail: string };

const niveau = (code: string | null) => (code ? LIBELLES_NIVEAU[code] ?? code : "");

/**
 * Message affiché à l'enseignant après une saisie : l'alerte déclenchée ou
 * aggravée, avec son niveau et l'élève, sinon la confirmation, sans alerte.
 */
export function messageSaisie(
  saisie: "note" | "absence",
  eleve: { prenom: string; nom: string },
  alerte: AlerteSaisie | null,
  resume: string
): MessageSaisie {
  if (!alerte) {
    return {
      alerte: false,
      titre: saisie === "note" ? "Note enregistrée" : "Absence enregistrée",
      detail: `${resume} Aucune alerte.`,
    };
  }

  const nom = `${eleve.prenom} ${eleve.nom}`;
  const titre =
    alerte.issue === "creee"
      ? `Alerte déclenchée : niveau ${niveau(alerte.niveauRisque)} pour ${nom}`
      : `Alerte ${alerte.reactivee ? "réactivée et aggravée" : "aggravée"} : ${niveau(alerte.niveauPrecedent)} → ${niveau(alerte.niveauRisque)} pour ${nom}`;
  const periode = libellePeriode(alerte.periode, alerte.anneeScolaire);
  const constat =
    alerte.type === "absences"
      ? `${alerte.moyenneApres} absences injustifiées en ${periode}.`
      : `Moyenne ${formaterNombre(alerte.moyenneAvant)} → ${formaterNombre(alerte.moyenneApres)} en ${periode} (${formaterBaisse(alerte.ecartPourcent)} par rapport à la période précédente).`;
  return { alerte: true, titre, detail: `${resume} ${constat}` };
}

/**
 * Pourquoi la baisse des notes n'est pas encore surveillée : sans cette
 * mention, « Aucune alerte » laisserait croire que tout va bien.
 */
export function texteComparaison(comparaison: ComparaisonNotes): string | null {
  if (comparaison.etat === "sans_periode_precedente") {
    return "Pas encore de période de comparaison pour les notes. Les absences restent suivies.";
  }
  if (comparaison.etat === "notes_insuffisantes") {
    const { periode, anneeScolaire, noteCount } = comparaison.periodeRecente;
    return `Notes comparées à partir de ${NOTES_MIN_COMPARAISON} notes en ${libellePeriode(periode, anneeScolaire)} (${noteCount} pour l'instant). Les absences restent suivies.`;
  }
  return null;
}
