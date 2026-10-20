import type { Prisma } from "@prisma/client";
import type { FiltresAbsences } from "@/lib/filtres-absences";
import { pageVide, paginer, type DemandePage, type PageResultats } from "@/lib/pagination";
import { filtreEtudiantsAccessibles } from "@/lib/perimetre";
import { prisma } from "@/lib/prisma";

type Utilisateur = { role: string; etablissementId: string | null; etudiantId: string | null };

/**
 * Clause Prisma des absences. Le périmètre du rôle porte sur l'élève et
 * l'emporte sur le filtre établissement de l'URL. null : aucun résultat
 * possible (compte sans établissement).
 */
export function construireWhereAbsences(
  filtres: FiltresAbsences,
  user: Utilisateur
): Prisma.AbsenceWhereInput | null {
  const perimetre = filtreEtudiantsAccessibles(user);
  if (!perimetre) return null;

  const etudiant: Prisma.EtudiantWhereInput = {};
  const mots = filtres.q?.split(/\s+/).filter(Boolean) ?? [];
  if (mots.length > 0) {
    etudiant.AND = mots.map((mot) => ({
      OR: [
        { nom: { contains: mot, mode: "insensitive" as const } },
        { prenom: { contains: mot, mode: "insensitive" as const } },
      ],
    }));
  }
  if (user.role === "admin" && filtres.etablissement) etudiant.etablissementId = filtres.etablissement;

  return {
    ...(filtres.etudiantId ? { etudiantId: filtres.etudiantId } : {}),
    ...(filtres.periode ? { periode: filtres.periode } : {}),
    ...(filtres.annee ? { anneeScolaire: filtres.annee } : {}),
    ...(filtres.motif ? { motif: filtres.motif } : {}),
    // Le directeur et l'enseignant ne voient que les absences de leur établissement.
    etudiant: { ...etudiant, ...perimetre },
  };
}

export const lectureAbsences = {
  include: {
    etudiant: {
      select: { id: true, nom: true, prenom: true, niveau: true, etablissement: { select: { nom: true } } },
    },
  },
  orderBy: [{ date: "desc" }, { id: "asc" }],
} satisfies Omit<Prisma.AbsenceFindManyArgs, "where">;

export type AbsenceListe = Prisma.AbsenceGetPayload<typeof lectureAbsences>;

/** Une page d'absences, les plus récentes d'abord ; le total ne compte que le périmètre. */
export async function rechercherAbsencesPaginees(
  filtres: FiltresAbsences,
  user: Utilisateur,
  demande: DemandePage
): Promise<PageResultats<AbsenceListe>> {
  const where = construireWhereAbsences(filtres, user);
  if (!where) return pageVide(demande.taille);

  return paginer(
    demande,
    () => prisma.absence.count({ where }),
    (fenetre) => prisma.absence.findMany({ where, ...lectureAbsences, ...fenetre })
  );
}

/** Années scolaires présentes dans le périmètre, pour le filtre (la plus récente d'abord). */
export async function anneesAbsences(user: Utilisateur): Promise<string[]> {
  const perimetre = filtreEtudiantsAccessibles(user);
  if (!perimetre) return [];
  const lignes = await prisma.absence.findMany({
    where: { etudiant: perimetre },
    distinct: ["anneeScolaire"],
    select: { anneeScolaire: true },
    orderBy: { anneeScolaire: "desc" },
  });
  return lignes.map((l) => l.anneeScolaire);
}
