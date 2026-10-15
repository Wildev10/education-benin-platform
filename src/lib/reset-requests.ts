import { prisma } from "@/lib/prisma";

export async function getDemandesEnAttente() {
  const demandes = await prisma.resetRequest.findMany({
    where: { traitee: false },
    include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  return demandes.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }));
}

export function countDemandesEnAttente() {
  return prisma.resetRequest.count({ where: { traitee: false } });
}

export type DemandeReinitialisation = Awaited<ReturnType<typeof getDemandesEnAttente>>[number];
