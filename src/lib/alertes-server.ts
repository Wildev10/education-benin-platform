import { prisma } from "@/lib/prisma";
import { pageVide, paginer, type DemandePage, type PageResultats } from "@/lib/pagination";
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
  suiviDepuis: true,
  resolueLe: true,
  // Dernière étape du suivi : affichée dans les listes et les exports
  suivis: { select: { action: true, auteurNom: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
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

// Risque élevé d'abord ("eleve" < "moyen"), puis les plus récentes ; l'id
// départage les ex æquo pour que les pages ne se chevauchent pas.
const triAlertes = [{ niveauRisque: "asc" }, { createdAt: "desc" }, { id: "asc" }] as const;

/**
 * Toutes les alertes correspondant aux filtres, dans le périmètre du rôle
 * (exports PDF et Excel : jamais limités à une page).
 */
export async function rechercherAlertes(filtres: FiltresAlertes, portee: PorteeAlertes) {
  const where = construireWhereAlertes(filtres, portee);
  if (!where) return { total: 0, alertes: [] };

  const [total, alertes] = await Promise.all([
    prisma.alerte.count({ where }),
    prisma.alerte.findMany({ where, select: selectionAlerte, orderBy: [...triAlertes] }),
  ]);

  return { total, alertes };
}

/** Une page d'alertes ; le total ne compte que les alertes du périmètre. */
export async function rechercherAlertesPaginees(
  filtres: FiltresAlertes,
  portee: PorteeAlertes,
  demande: DemandePage
): Promise<PageResultats<AlerteFiltree>> {
  const where = construireWhereAlertes(filtres, portee);
  if (!where) return pageVide(demande.taille);

  return paginer(
    demande,
    () => prisma.alerte.count({ where }),
    (fenetre) => prisma.alerte.findMany({ where, select: selectionAlerte, orderBy: [...triAlertes], ...fenetre })
  );
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
