import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FiltresEleves } from "@/lib/filtres-eleves";
import { pageVide, paginer, type DemandePage, type PageResultats } from "@/lib/pagination";
import { filtreEtudiantsAccessibles } from "@/lib/perimetre";

type Utilisateur = { role: string; etablissementId: string | null; etudiantId: string | null };

/**
 * Clause Prisma de la liste des élèves. Le périmètre du rôle est appliqué en
 * dernier et l'emporte sur le filtre établissement de l'URL. null : aucun
 * résultat possible (compte sans établissement).
 */
export function construireWhereEleves(
  filtres: FiltresEleves,
  user: Utilisateur
): Prisma.EtudiantWhereInput | null {
  const perimetre = filtreEtudiantsAccessibles(user);
  if (!perimetre) return null;

  const where: Prisma.EtudiantWhereInput = {};
  if (user.role === "admin" && filtres.etablissement) where.etablissementId = filtres.etablissement;
  if (filtres.niveau) where.niveau = filtres.niveau;

  // Chaque mot doit se retrouver dans le nom ou le prénom (« elwin rau » trouve Elwin Rau)
  const mots = filtres.q?.split(/\s+/).filter(Boolean) ?? [];
  if (mots.length > 0) {
    where.AND = mots.map((mot) => ({
      OR: [
        { nom: { contains: mot, mode: "insensitive" as const } },
        { prenom: { contains: mot, mode: "insensitive" as const } },
      ],
    }));
  }

  return { ...where, ...perimetre };
}

const selectionEleve = {
  id: true,
  nom: true,
  prenom: true,
  niveau: true,
  etablissement: { select: { id: true, nom: true } },
  _count: { select: { alertes: { where: { statut: "active" } } } },
} as const;

/** Une page d'élèves, triée par nom ; le total ne compte que les élèves du périmètre. */
export async function rechercherElevesPagines(
  filtres: FiltresEleves,
  user: Utilisateur,
  demande: DemandePage
): Promise<PageResultats<EleveListe>> {
  const where = construireWhereEleves(filtres, user);
  if (!where) return pageVide(demande.taille);

  return paginer(
    demande,
    () => prisma.etudiant.count({ where }),
    async (fenetre) => {
      const eleves = await prisma.etudiant.findMany({
        where,
        select: selectionEleve,
        orderBy: [{ nom: "asc" }, { prenom: "asc" }, { id: "asc" }],
        ...fenetre,
      });
      return eleves.map(({ _count, ...eleve }) => ({ ...eleve, alerteActive: _count.alertes > 0 }));
    }
  );
}

export type EleveListe = {
  id: string;
  nom: string;
  prenom: string;
  niveau: string;
  etablissement: { id: string; nom: string };
  alerteActive: boolean;
};
