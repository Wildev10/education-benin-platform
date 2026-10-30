/**
 * Suivi des alertes, sans accès à la base : statuts, transitions, actions,
 * validation de la saisie et suggestion de clôture. Utilisé par
 * POST /api/alertes/[id]/suivis, les fiches, les listes et les exports.
 *
 * Statut affiché, déduit de deux colonnes (aucune donnée à migrer) :
 * - `statut` "traitee"                 → Clôturée ;
 * - `statut` "active" + `suiviDepuis`  → En cours de suivi ;
 * - `statut` "active" sans suiviDepuis → Nouvelle.
 * "active" garde donc son sens d'alerte ouverte (compteurs, cloche, filtres).
 */
import { formaterNombre } from "@/lib/format";
import {
  calculerNiveauAlerte,
  calculerNiveauAlerteAbsence,
  comparerMoyennes,
  comparerPeriodes,
  NOTES_MIN_COMPARAISON,
} from "@/lib/regles-alerte";

export type StatutSuivi = "nouvelle" | "en_suivi" | "resolue";

export const LIBELLES_STATUT_SUIVI: Record<StatutSuivi, string> = {
  nouvelle: "Nouvelle",
  en_suivi: "En cours de suivi",
  resolue: "Clôturée",
};

export function statutSuivi(alerte: { statut: string; suiviDepuis?: Date | string | null }): StatutSuivi {
  if (alerte.statut !== "active") return "resolue";
  return alerte.suiviDepuis ? "en_suivi" : "nouvelle";
}

export function libelleStatut(alerte: { statut: string; suiviDepuis?: Date | string | null }): string {
  return LIBELLES_STATUT_SUIVI[statutSuivi(alerte)];
}

/** Actions que l'enseignant ou le directeur choisit à chaque étape. */
export const ACTIONS_SUIVI = ["entretien_eleve", "parents_convoques", "soutien_scolaire", "autre"] as const;
export type ActionSuivi = (typeof ACTIONS_SUIVI)[number];

export const LIBELLES_ACTION: Record<string, string> = {
  entretien_eleve: "Entretien avec l'élève",
  parents_convoques: "Parents convoqués",
  soutien_scolaire: "Soutien scolaire",
  autre: "Autre action",
  resolution: "Clôture",
  confie: "Suivi confié",
  reouverture: "Réouverture",
  // Étapes écrites par le système, sans auteur : détection (src/lib/detection-alerte.ts)
  // et changement d'établissement d'un responsable (src/lib/responsables-server.ts)
  aggravation: "Aggravation détectée",
  reouverture_auto: "Réouverture automatique",
  retrait_responsable: "Responsable retiré",
};

/** Motifs de clôture, choisis en un clic ; commentaire obligatoire pour « autre » seulement. */
export const MOTIFS_CLOTURE = ["situation_retablie", "suivi_externe", "erreur_saisie", "autre"] as const;
export type MotifCloture = (typeof MOTIFS_CLOTURE)[number];

export const LIBELLES_MOTIF: Record<string, string> = {
  situation_retablie: "Situation rétablie",
  suivi_externe: "Suivi fait en dehors de la plateforme",
  erreur_saisie: "Erreur de saisie",
  autre: "Autre",
};

/** Clôtures antérieures aux motifs : comptées à part dans le pilotage. */
export const LIBELLE_MOTIF_ABSENT = "Motif non renseigné";

/** Auteur affiché des étapes écrites par le système (détection, changement d'établissement). */
export const AUTEUR_SYSTEME = "Système";

/**
 * Étape écrite par la détection quand une alerte existante s'aggrave (Moyen → Élevé).
 * Clôturée : rouverte En cours de suivi avec son responsable s'il y en a un, sinon Nouvelle.
 */
export function etapeAggravation(
  statutAvant: StatutSuivi,
  niveauPrecedent: string,
  niveau: string,
  responsableNom: string | null = null
): { auteurNom: string; action: string; commentaire: string; statutAvant: StatutSuivi; statutApres: StatutSuivi } {
  const libelle = (n: string) => (n === "eleve" ? "Élevé" : "Moyen");
  const rouverte = statutAvant === "resolue";
  const reprise = rouverte && responsableNom ? ` L'alerte clôturée est rouverte, suivi repris par ${responsableNom}.` : rouverte ? " L'alerte clôturée est rouverte." : "";
  return {
    auteurNom: AUTEUR_SYSTEME,
    action: rouverte ? "reouverture_auto" : "aggravation",
    commentaire: `Risque ${libelle(niveauPrecedent)} → ${libelle(niveau)}.${reprise}`,
    statutAvant,
    statutApres: rouverte ? (responsableNom ? "en_suivi" : "nouvelle") : statutAvant,
  };
}

/** Une étape de l'historique, telle qu'affichée sur la fiche. */
export type EtapeSuivi = {
  id: string;
  auteurNom: string;
  action: string;
  commentaire: string;
  statutAvant: string;
  statutApres: string;
  createdAt: string;
  /** Clôture : motif choisi */
  motifCloture: string | null;
  /** Désignation : personne à qui le suivi est confié */
  responsableNom: string | null;
};

/**
 * - suivre : Nouvelle ou En cours → En cours (ajoute une action, désigne le responsable s'il n'y en a pas) ;
 * - resoudre : Nouvelle ou En cours → Clôturée, avec un motif (sans action ni responsable) ;
 * - rouvrir : Clôturée → En cours (l'action enregistrée est « reouverture ») ;
 * - confier : En cours → En cours, avec un autre responsable.
 */
export type Transition = "suivre" | "resoudre" | "rouvrir" | "confier";
export const TRANSITIONS: Transition[] = ["suivre", "resoudre", "rouvrir", "confier"];

export function statutApres(avant: StatutSuivi, transition: Transition): StatutSuivi | null {
  if (transition === "rouvrir") return avant === "resolue" ? "en_suivi" : null;
  if (transition === "confier") return avant === "en_suivi" ? "en_suivi" : null;
  if (avant === "resolue") return null;
  return transition === "suivre" ? "en_suivi" : "resolue";
}

/**
 * Responsable après l'étape : suivre et rouvrir gardent celui de l'alerte (ou
 * désignent celui choisi, par défaut l'auteur) ; confier prend celui choisi ;
 * resoudre ne change rien.
 */
export function responsableApres(
  transition: Transition,
  choisi: string | null,
  actuel: string | null,
  auteurId: string
): string | null {
  if (transition === "resoudre") return actuel;
  if (transition === "confier") return choisi;
  return choisi ?? actuel ?? auteurId;
}

export const COMMENTAIRE_MIN = 10;
export const COMMENTAIRE_MAX = 1000;

export type SaisieSuivi = {
  transition: Transition;
  action: string;
  /** Chaîne vide quand le commentaire est facultatif et absent */
  commentaire: string;
  motifCloture: MotifCloture | null;
  /** Responsable choisi (suivre, confier) ; null : par défaut */
  responsableId: string | null;
};

const ERREUR_COMMENTAIRE = `Le commentaire est obligatoire (${COMMENTAIRE_MIN} caractères au moins).`;

/**
 * Corps de POST /api/alertes/[id]/suivis :
 * - suivre : action et commentaire obligatoires, responsable facultatif ;
 * - resoudre : motif obligatoire, commentaire facultatif sauf pour « autre » ;
 * - rouvrir : commentaire obligatoire ;
 * - confier : responsable obligatoire, commentaire facultatif.
 */
export function validerSaisieSuivi(corps: unknown): { ok: true; saisie: SaisieSuivi } | { ok: false; erreur: string } {
  const { transition, action, commentaire, motifCloture, responsableId } = (corps ?? {}) as Record<string, unknown>;
  if (typeof transition !== "string" || !TRANSITIONS.includes(transition as Transition)) {
    return { ok: false, erreur: "Étape inconnue : suivre, resoudre, rouvrir ou confier." };
  }
  const texte = typeof commentaire === "string" ? commentaire.trim() : "";
  if (texte.length > COMMENTAIRE_MAX) {
    return { ok: false, erreur: `Le commentaire ne peut pas dépasser ${COMMENTAIRE_MAX} caractères.` };
  }
  const responsable = typeof responsableId === "string" && responsableId.trim() ? responsableId.trim() : null;
  const saisie = (s: Omit<SaisieSuivi, "transition">) => ({ ok: true as const, saisie: { transition: transition as Transition, ...s } });

  if (transition === "resoudre") {
    if (typeof motifCloture !== "string" || !MOTIFS_CLOTURE.includes(motifCloture as MotifCloture)) {
      return { ok: false, erreur: "Choisissez le motif de clôture." };
    }
    if (motifCloture === "autre" && texte.length < COMMENTAIRE_MIN) {
      return { ok: false, erreur: `Pour le motif « Autre », le commentaire est obligatoire (${COMMENTAIRE_MIN} caractères au moins).` };
    }
    return saisie({ action: "resolution", commentaire: texte, motifCloture: motifCloture as MotifCloture, responsableId: null });
  }
  if (transition === "confier") {
    if (!responsable) return { ok: false, erreur: "Choisissez la personne à qui confier le suivi." };
    return saisie({ action: "confie", commentaire: texte, motifCloture: null, responsableId: responsable });
  }
  if (texte.length < COMMENTAIRE_MIN) return { ok: false, erreur: ERREUR_COMMENTAIRE };
  if (transition === "rouvrir") {
    return saisie({ action: "reouverture", commentaire: texte, motifCloture: null, responsableId: null });
  }
  if (typeof action !== "string" || !ACTIONS_SUIVI.includes(action as ActionSuivi)) {
    return { ok: false, erreur: "Choisissez l'action menée : entretien, parents convoqués, soutien scolaire ou autre." };
  }
  return saisie({ action, commentaire: texte, motifCloture: null, responsableId: responsable });
}

/** Colonnes de l'alerte à écrire pour une transition (suiviDepuis gardé s'il existe). */
export function donneesTransition(
  transition: Transition,
  alerte: { suiviDepuis: Date | null },
  maintenant: Date,
  motifCloture: MotifCloture | null = null
): { statut: "active" | "traitee"; suiviDepuis: Date | null; resolueLe: Date | null; motifCloture: MotifCloture | null } {
  if (transition === "resoudre") return { statut: "traitee", suiviDepuis: alerte.suiviDepuis, resolueLe: maintenant, motifCloture };
  if (transition === "rouvrir") return { statut: "active", suiviDepuis: maintenant, resolueLe: null, motifCloture: null };
  return { statut: "active", suiviDepuis: alerte.suiviDepuis ?? maintenant, resolueLe: null, motifCloture: null };
}

// ── Suggestion de clôture ────────────────────────────────────────────────────

type PeriodeRef = { anneeScolaire: string; periode: string };

/**
 * Suggestion (jamais automatique) de clôturer une alerte ouverte :
 * - notes : la moyenne de la période la plus récente (au moins
 *   NOTES_MIN_COMPARAISON notes) ne déclencherait plus d'alerte par rapport à
 *   la moyenne de référence de l'alerte ;
 * - absences : une période plus récente que celle de l'alerte est en cours, et
 *   ses absences injustifiées restent sous le seuil.
 * null : rien à suggérer.
 */
export function suggestionCloture(
  alerte: { type: string; statut: string; moyenneAvant: number; periode: string; anneeScolaire: string | null },
  notes: { valeur: number; periode: string; anneeScolaire: string }[],
  absences: { motif: string; periode: string; anneeScolaire: string }[],
  periodeEnCours: PeriodeRef
): string | null {
  if (alerte.statut !== "active") return null;

  if (alerte.type === "absences") {
    const periodeAlerte = { periode: alerte.periode, anneeScolaire: alerte.anneeScolaire ?? periodeEnCours.anneeScolaire };
    if (comparerPeriodes(periodeEnCours, periodeAlerte) <= 0) return null;
    const nombre = absences.filter(
      (a) => a.motif === "injustifiee" && a.periode === periodeEnCours.periode && a.anneeScolaire === periodeEnCours.anneeScolaire
    ).length;
    if (calculerNiveauAlerteAbsence(nombre) !== null) return null;
    return `Assiduité rétablie : ${nombre} absence${nombre > 1 ? "s" : ""} injustifiée${nombre > 1 ? "s" : ""} au ${periodeEnCours.periode}. Vous pouvez clôturer l'alerte.`;
  }

  const comparaison = comparerMoyennes(notes);
  if (comparaison.etat === "sans_periode_precedente") return null;
  const recente = comparaison.periodeRecente;
  if (recente.noteCount < NOTES_MIN_COMPARAISON) return null;
  if (calculerNiveauAlerte(alerte.moyenneAvant, recente.moyenne) !== null) return null;
  return `Moyenne remontée à ${formaterNombre(recente.moyenne)} au ${recente.periode} (référence ${formaterNombre(alerte.moyenneAvant)}). Vous pouvez clôturer l'alerte.`;
}
