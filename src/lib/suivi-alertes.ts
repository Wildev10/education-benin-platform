/**
 * Suivi des alertes, sans accès à la base : statuts, transitions, actions,
 * validation de la saisie et suggestion de clôture. Utilisé par
 * POST /api/alertes/[id]/suivis, les fiches, les listes et les exports.
 *
 * Statut affiché, déduit de deux colonnes (aucune donnée à migrer) :
 * - `statut` "traitee"                 → Résolue ;
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
  resolue: "Résolue",
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
  reouverture: "Réouverture",
  // Étapes écrites par la détection (src/lib/detection-alerte.ts), sans auteur
  aggravation: "Aggravation détectée",
  reouverture_auto: "Réouverture automatique",
};

/** Auteur affiché des étapes écrites par la détection. */
export const AUTEUR_SYSTEME = "Système (détection automatique)";

/** Étape écrite par la détection quand une alerte existante s'aggrave (Moyen → Élevé). */
export function etapeAggravation(
  statutAvant: StatutSuivi,
  niveauPrecedent: string,
  niveau: string
): { auteurNom: string; action: string; commentaire: string; statutAvant: StatutSuivi; statutApres: StatutSuivi } {
  const libelle = (n: string) => (n === "eleve" ? "Élevé" : "Moyen");
  const rouverte = statutAvant === "resolue";
  return {
    auteurNom: AUTEUR_SYSTEME,
    action: rouverte ? "reouverture_auto" : "aggravation",
    commentaire: `Risque ${libelle(niveauPrecedent)} → ${libelle(niveau)}.${rouverte ? " L'alerte résolue est rouverte." : ""}`,
    statutAvant,
    statutApres: rouverte ? "nouvelle" : statutAvant,
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
};

/**
 * - suivre : Nouvelle ou En cours → En cours (ajoute une action) ;
 * - resoudre : Nouvelle ou En cours → Résolue ;
 * - rouvrir : Résolue → En cours (l'action enregistrée est « reouverture »).
 */
export type Transition = "suivre" | "resoudre" | "rouvrir";
export const TRANSITIONS: Transition[] = ["suivre", "resoudre", "rouvrir"];

export function statutApres(avant: StatutSuivi, transition: Transition): StatutSuivi | null {
  if (transition === "rouvrir") return avant === "resolue" ? "en_suivi" : null;
  if (avant === "resolue") return null;
  return transition === "suivre" ? "en_suivi" : "resolue";
}

export const COMMENTAIRE_MIN = 10;
export const COMMENTAIRE_MAX = 1000;

export type SaisieSuivi = { transition: Transition; action: string; commentaire: string };

/** Corps de POST /api/alertes/[id]/suivis : action et commentaire obligatoires. */
export function validerSaisieSuivi(corps: unknown): { ok: true; saisie: SaisieSuivi } | { ok: false; erreur: string } {
  const { transition, action, commentaire } = (corps ?? {}) as Record<string, unknown>;
  if (typeof transition !== "string" || !TRANSITIONS.includes(transition as Transition)) {
    return { ok: false, erreur: "Étape inconnue : suivre, resoudre ou rouvrir." };
  }
  const texte = typeof commentaire === "string" ? commentaire.trim() : "";
  if (texte.length < COMMENTAIRE_MIN) {
    return { ok: false, erreur: `Le commentaire est obligatoire (${COMMENTAIRE_MIN} caractères au moins).` };
  }
  if (texte.length > COMMENTAIRE_MAX) {
    return { ok: false, erreur: `Le commentaire ne peut pas dépasser ${COMMENTAIRE_MAX} caractères.` };
  }
  if (transition === "rouvrir") {
    return { ok: true, saisie: { transition, action: "reouverture", commentaire: texte } };
  }
  if (typeof action !== "string" || !ACTIONS_SUIVI.includes(action as ActionSuivi)) {
    return { ok: false, erreur: "Choisissez l'action menée : entretien, parents convoqués, soutien scolaire ou autre." };
  }
  return { ok: true, saisie: { transition: transition as Transition, action, commentaire: texte } };
}

/** Colonnes de l'alerte à écrire pour une transition (suiviDepuis gardé s'il existe). */
export function donneesTransition(
  transition: Transition,
  alerte: { suiviDepuis: Date | null },
  maintenant: Date
): { statut: "active" | "traitee"; suiviDepuis: Date | null; resolueLe: Date | null } {
  if (transition === "resoudre") return { statut: "traitee", suiviDepuis: alerte.suiviDepuis, resolueLe: maintenant };
  if (transition === "rouvrir") return { statut: "active", suiviDepuis: maintenant, resolueLe: null };
  return { statut: "active", suiviDepuis: alerte.suiviDepuis ?? maintenant, resolueLe: null };
}

// ── Suggestion de clôture ────────────────────────────────────────────────────

type PeriodeRef = { anneeScolaire: string; periode: string };

/**
 * Suggestion (jamais automatique) de résoudre une alerte ouverte :
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
    return `Assiduité rétablie : ${nombre} absence${nombre > 1 ? "s" : ""} injustifiée${nombre > 1 ? "s" : ""} au ${periodeEnCours.periode}. Vous pouvez résoudre l'alerte.`;
  }

  const comparaison = comparerMoyennes(notes);
  if (comparaison.etat === "sans_periode_precedente") return null;
  const recente = comparaison.periodeRecente;
  if (recente.noteCount < NOTES_MIN_COMPARAISON) return null;
  if (calculerNiveauAlerte(alerte.moyenneAvant, recente.moyenne) !== null) return null;
  return `Moyenne remontée à ${formaterNombre(recente.moyenne)} au ${recente.periode} (référence ${formaterNombre(alerte.moyenneAvant)}). Vous pouvez résoudre l'alerte.`;
}
