import { paginer, type DemandePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export const selectionUtilisateur = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  role: true,
  etudiantId: true,
  etablissementId: true,
  etablissement: { select: { nom: true } },
  createdAt: true,
} as const;

/** Une page des comptes, du plus ancien au plus récent (réservé à l'admin). */
export function listerUtilisateursPagines(demande: DemandePage) {
  return paginer(
    demande,
    () => prisma.user.count(),
    (fenetre) =>
      prisma.user.findMany({
        select: selectionUtilisateur,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        ...fenetre,
      })
  );
}
