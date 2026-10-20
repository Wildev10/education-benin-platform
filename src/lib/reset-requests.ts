import { prisma } from "@/lib/prisma";
import { selectionUtilisateur } from "@/lib/utilisateurs-server";

export async function getDemandesEnAttente() {
  // Le compte complet : la demande doit pouvoir être traitée même si le compte
  // n'apparaît pas sur la page affichée de la liste des utilisateurs
  const demandes = await prisma.resetRequest.findMany({
    where: { traitee: false },
    include: { user: { select: selectionUtilisateur } },
    orderBy: { createdAt: "desc" },
  });
  return demandes.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    user: { ...d.user, createdAt: d.user.createdAt.toISOString() },
  }));
}

export function countDemandesEnAttente() {
  return prisma.resetRequest.count({ where: { traitee: false } });
}

export type DemandeReinitialisation = Awaited<ReturnType<typeof getDemandesEnAttente>>[number];
