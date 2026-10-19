import { prisma } from "@/lib/prisma";
import { FENETRE_NOTIFICATIONS_MS, type NotificationAlerte } from "@/lib/notifications";

/**
 * Alertes actives créées dans les 5 dernières minutes.
 * etablissementId : restreint à un établissement (directeur) ; null = toutes (admin).
 */
export async function getAlertesRecentes(
  etablissementId: string | null,
  maintenant: Date = new Date()
): Promise<NotificationAlerte[]> {
  const alertes = await prisma.alerte.findMany({
    where: {
      statut: "active",
      createdAt: { gte: new Date(maintenant.getTime() - FENETRE_NOTIFICATIONS_MS) },
      ...(etablissementId ? { etudiant: { etablissementId } } : {}),
    },
    include: {
      etudiant: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          niveau: true,
          etablissement: { select: { id: true, nom: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return alertes.map((a) => ({
    id: a.id,
    type: a.type,
    niveauRisque: a.niveauRisque,
    createdAt: a.createdAt.toISOString(),
    etudiant: {
      id: a.etudiant.id,
      nom: a.etudiant.nom,
      prenom: a.etudiant.prenom,
      niveau: a.etudiant.niveau,
    },
    etablissement: a.etudiant.etablissement,
  }));
}
