import { prisma } from "@/lib/prisma";
import {
  construireWhereAlertes,
  type FiltresAlertes,
  type PorteeAlertes,
} from "@/lib/filtres-alertes";

const selectionAlerte = {
  id: true,
  type: true,
  niveauRisque: true,
  statut: true,
  periode: true,
  anneeScolaire: true,
  moyenneAvant: true,
  moyenneApres: true,
  ecartPourcent: true,
  createdAt: true,
  etudiant: {
    select: {
      id: true,
      nom: true,
      prenom: true,
      niveau: true,
      etablissement: { select: { id: true, nom: true, departement: true } },
    },
  },
} as const;

/**
 * Alertes correspondant aux filtres, dans le périmètre du rôle.
 * Tri : risque élevé d'abord ("eleve" < "moyen"), puis les plus récentes.
 */
export async function rechercherAlertes(
  filtres: FiltresAlertes,
  portee: PorteeAlertes,
  { limite }: { limite?: number } = {}
) {
  const where = construireWhereAlertes(filtres, portee);
  if (!where) return { total: 0, alertes: [] };

  const [total, alertes] = await Promise.all([
    prisma.alerte.count({ where }),
    prisma.alerte.findMany({
      where,
      select: selectionAlerte,
      orderBy: [{ niveauRisque: "asc" }, { createdAt: "desc" }],
      ...(limite ? { take: limite } : {}),
    }),
  ]);

  return { total, alertes };
}

export type AlerteFiltree = Awaited<ReturnType<typeof rechercherAlertes>>["alertes"][number];

/** Nom de l'établissement filtré par l'admin (pour les libellés), ou undefined. */
export async function nomEtablissementFiltre(filtres: FiltresAlertes, portee: PorteeAlertes) {
  if (portee.type !== "toutes" || !filtres.etablissement) return undefined;
  const etab = await prisma.etablissement.findUnique({
    where: { id: filtres.etablissement },
    select: { nom: true },
  });
  return etab?.nom;
}
