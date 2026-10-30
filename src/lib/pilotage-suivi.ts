import { prisma } from "@/lib/prisma";
import { LIBELLE_MOTIF_ABSENT, LIBELLES_MOTIF, MOTIFS_CLOTURE } from "@/lib/suivi-alertes";

/** Pilotage national du suivi des alertes (tableau de bord admin, consultation seule). */
export type PilotageSuivi = {
  nouvelles: number;
  enSuivi: number;
  /** Alertes de l'année scolaire en cours clôturées */
  resolues: number;
  /** Délai moyen, en jours, entre la détection et la première action d'une personne ; null : aucune action */
  delaiMoyenJours: number | null;
  /** Répartition des motifs de clôture des alertes clôturées de l'année, la plus fréquente en tête */
  motifs: { motif: string; libelle: string; total: number }[];
};

/** Un motif par ligne, dans l'ordre des motifs, puis « non renseigné » (clôtures d'avant les motifs). */
export function repartitionMotifs(groupes: { motifCloture: string | null; total: number }[]): PilotageSuivi["motifs"] {
  const parMotif = new Map(groupes.map((g) => [g.motifCloture ?? "", g.total]));
  return [...MOTIFS_CLOTURE, ""]
    .map((motif) => ({
      motif: motif || "non_renseigne",
      libelle: motif ? LIBELLES_MOTIF[motif] : LIBELLE_MOTIF_ABSENT,
      total: parMotif.get(motif) ?? 0,
    }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total);
}

const JOUR_MS = 24 * 60 * 60 * 1000;
// Étapes sans action d'une personne : système, ou simple désignation du responsable
const ACTIONS_SYSTEME = ["aggravation", "reouverture_auto", "retrait_responsable", "confie"];

/** Moyenne des délais de prise en charge, en jours, arrondie au dixième. */
export function delaiMoyenJours(alertes: { createdAt: Date; premiereAction: Date }[]): number | null {
  if (alertes.length === 0) return null;
  const total = alertes.reduce((somme, a) => somme + Math.max(0, a.premiereAction.getTime() - a.createdAt.getTime()), 0);
  return Math.round((total / alertes.length / JOUR_MS) * 10) / 10;
}

export async function pilotageSuivi(anneeScolaire: string): Promise<PilotageSuivi> {
  const [nouvelles, enSuivi, resolues, prisesEnCharge, groupesMotifs] = await Promise.all([
    prisma.alerte.count({ where: { statut: "active", suiviDepuis: null } }),
    prisma.alerte.count({ where: { statut: "active", suiviDepuis: { not: null } } }),
    prisma.alerte.count({ where: { statut: "traitee", anneeScolaire } }),
    // Première étape écrite par une personne (pas par la détection) ; le compte
    // de l'auteur a pu être supprimé depuis, d'où le filtre sur l'action
    prisma.alerte.findMany({
      where: { anneeScolaire, suivis: { some: { action: { notIn: ACTIONS_SYSTEME } } } },
      select: {
        createdAt: true,
        suivis: { where: { action: { notIn: ACTIONS_SYSTEME } }, orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } },
      },
    }),
    prisma.alerte.groupBy({ by: ["motifCloture"], where: { statut: "traitee", anneeScolaire }, _count: { _all: true } }),
  ]);
  return {
    nouvelles,
    enSuivi,
    resolues,
    delaiMoyenJours: delaiMoyenJours(
      prisesEnCharge.flatMap((a) => (a.suivis[0] ? [{ createdAt: a.createdAt, premiereAction: a.suivis[0].createdAt }] : []))
    ),
    motifs: repartitionMotifs(groupesMotifs.map((g) => ({ motifCloture: g.motifCloture, total: g._count._all }))),
  };
}
