import type { Alerte } from "@/generated/prisma/client";
import type { AlerteSaisie } from "@/lib/message-saisie";
import { prisma } from "@/lib/prisma";
import { comparerMoyennes, compterAbsencesRecentes, estAggravation } from "@/lib/regles-alerte";
import { nomComplet } from "@/lib/nom-utilisateur";
import { etapeAggravation, statutSuivi } from "@/lib/suivi-alertes";

// Règles pures, réexportées pour les appels existants
export {
  calculerNiveauAlerte,
  calculerNiveauAlerteAbsence,
  comparerMoyennes,
  estAggravation,
  NOTES_MIN_COMPARAISON,
} from "@/lib/regles-alerte";

export type TypeAlerte = "baisse_moyenne" | "absences";

export type DetailDetection = {
  issue: "creee" | "mise_a_jour";
  type: TypeAlerte;
  /** Alerte créée ou modifiée (absente en simulation) */
  alerte?: Alerte;
  alerteId?: string;
  /** Niveau avant une aggravation ; absent pour une création */
  niveauPrecedent?: string;
  /** L'alerte aggravée était résolue : elle est rouverte (Nouvelle) */
  reactivee: boolean;
  periode: string;
  anneeScolaire: string;
  niveauRisque: string;
  /** Notes : moyennes des deux périodes. Absences : 0, puis le nombre d'absences injustifiées. */
  moyenneAvant: number;
  moyenneApres: number;
  ecartPourcent: number;
};

/** Forme renvoyée au navigateur après une saisie (message et liste des alertes de la fiche). */
export function alerteSaisie(detail: DetailDetection | null): AlerteSaisie | null {
  if (!detail?.alerte) return null;
  const { alerte } = detail;
  return {
    id: alerte.id,
    type: alerte.type,
    issue: detail.issue,
    niveauRisque: alerte.niveauRisque,
    niveauPrecedent: detail.niveauPrecedent ?? null,
    reactivee: detail.reactivee,
    statut: alerte.statut,
    suiviDepuis: alerte.suiviDepuis?.toISOString() ?? null,
    periode: alerte.periode,
    anneeScolaire: alerte.anneeScolaire,
    moyenneAvant: alerte.moyenneAvant,
    moyenneApres: alerte.moyenneApres,
    ecartPourcent: alerte.ecartPourcent,
    createdAt: alerte.createdAt.toISOString(),
  };
}

type Constat =Omit<DetailDetection, "issue" | "alerte" | "alerteId" | "niveauPrecedent" | "reactivee">;

/**
 * Une seule alerte par élève, type, période et année scolaire, quel que soit
 * son statut (les anciennes alertes sans année comptent pour toute année).
 * Elle est créée, ou aggravée (Moyen → Élevé, rouverte si elle était résolue,
 * avec une date d'aggravation qui notifie la cloche). Niveau égal ou en baisse : rien.
 */
async function enregistrer(etudiantId: string, constat: Constat, simulation: boolean): Promise<DetailDetection | null> {
  const existante = await prisma.alerte.findFirst({
    where: {
      etudiantId,
      type: constat.type,
      periode: constat.periode,
      OR: [{ anneeScolaire: constat.anneeScolaire }, { anneeScolaire: null }],
    },
    orderBy: { createdAt: "desc" },
    include: { responsable: { select: { nom: true, prenom: true } } },
  });

  if (existante) {
    if (!estAggravation(existante, constat.niveauRisque)) return null;
    // Résolue : rouverte En cours de suivi avec son responsable (prévenu par la
    // cloche), ou en Nouvelle sans responsable. En cours de suivi : le suivi continue.
    // L'étape est écrite dans la même requête que la mise à jour.
    const rouverte = existante.statut !== "active";
    const responsableNom = existante.responsable ? nomComplet(existante.responsable.prenom, existante.responsable.nom) : null;
    const etape = etapeAggravation(statutSuivi(existante), existante.niveauRisque, constat.niveauRisque, responsableNom);
    const maintenant = new Date();
    const alerte = simulation
      ? undefined
      : await prisma.alerte.update({
          where: { id: existante.id },
          data: {
            niveauRisque: constat.niveauRisque,
            moyenneApres: constat.moyenneApres,
            ecartPourcent: constat.ecartPourcent,
            statut: "active",
            niveauModifieLe: maintenant,
            ...(rouverte ? { suiviDepuis: responsableNom ? maintenant : null, resolueLe: null, motifCloture: null } : {}),
            suivis: { create: etape },
          },
        });
    return {
      issue: "mise_a_jour",
      ...constat,
      alerte,
      alerteId: existante.id,
      niveauPrecedent: existante.niveauRisque,
      reactivee: existante.statut !== "active",
    };
  }

  const alerte = simulation
    ? undefined
    : await prisma.alerte.create({ data: { etudiantId, ...constat, statut: "active" } });
  return { issue: "creee", ...constat, alerte, alerteId: alerte?.id, reactivee: false };
}

/** Baisse de moyenne entre les deux dernières périodes (voir comparerMoyennes). */
export async function detecterAlerte(etudiantId: string): Promise<DetailDetection | null> {
  return analyserAlerte(etudiantId);
}

// En mode simulation, rien n'est écrit : la fonction décrit ce qu'elle ferait.
export async function analyserAlerte(
  etudiantId: string,
  simulation = false
): Promise<DetailDetection | null> {
  const notes = await prisma.note.findMany({
    where: { etudiantId },
    select: { valeur: true, periode: true, anneeScolaire: true },
  });

  const comparaison = comparerMoyennes(notes);
  if (comparaison.etat !== "comparee" || !comparaison.niveauRisque) return null;
  const { periodeAvant, periodeRecente, ecartPourcent, niveauRisque } = comparaison;

  return enregistrer(
    etudiantId,
    {
      type: "baisse_moyenne",
      niveauRisque,
      moyenneAvant: periodeAvant.moyenne,
      moyenneApres: periodeRecente.moyenne,
      ecartPourcent,
      periode: periodeRecente.periode,
      anneeScolaire: periodeRecente.anneeScolaire,
    },
    simulation
  );
}

/** Absences injustifiées de la période la plus récente qui en compte (5 : Moyen, 10 : Élevé). */
export async function detecterAlerteAbsence(etudiantId: string): Promise<DetailDetection | null> {
  const absences = await prisma.absence.findMany({
    where: { etudiantId, motif: "injustifiee" },
    select: { periode: true, anneeScolaire: true },
  });

  const recentes = compterAbsencesRecentes(absences);
  if (!recentes?.niveauRisque) return null;

  return enregistrer(
    etudiantId,
    {
      type: "absences",
      niveauRisque: recentes.niveauRisque,
      moyenneAvant: 0,
      moyenneApres: recentes.count,
      ecartPourcent: 0,
      periode: recentes.periode,
      anneeScolaire: recentes.anneeScolaire,
    },
    false
  );
}
