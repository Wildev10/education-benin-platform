import { prisma } from "@/lib/prisma";
import { FENETRE_NOTIFICATIONS_MS, dateEvenement, type NotificationAlerte } from "@/lib/notifications";

/**
 * Alertes actives créées ou aggravées (Moyen → Élevé) dans les 5 dernières minutes.
 * etablissementId : restreint à un établissement (directeur) ; null = toutes (admin).
 * Le périmètre s'applique aux deux cas : il est hors du OR.
 */
export async function getAlertesRecentes(
  etablissementId: string | null,
  maintenant: Date = new Date()
): Promise<NotificationAlerte[]> {
  const depuis = new Date(maintenant.getTime() - FENETRE_NOTIFICATIONS_MS);
  const alertes = await prisma.alerte.findMany({
    where: {
      statut: "active",
      OR: [{ createdAt: { gte: depuis } }, { niveauModifieLe: { gte: depuis } }],
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

  return alertes
    .map((a): NotificationAlerte => {
      // Aggravée dans la fenêtre : c'est l'événement le plus récent de l'alerte
      const aggravation = a.niveauModifieLe && a.niveauModifieLe >= depuis ? a.niveauModifieLe : null;
      const aggravee = aggravation !== null;
      return {
        id: a.id,
        type: a.type,
        niveauRisque: a.niveauRisque,
        createdAt: a.createdAt.toISOString(),
        evenement: aggravee ? "aggravee" : "creee",
        date: (aggravation ?? a.createdAt).toISOString(),
        // Seule aggravation possible : Moyen → Élevé (voir estAggravation)
        ...(aggravee ? { niveauPrecedent: "moyen" } : {}),
        etudiant: {
          id: a.etudiant.id,
          nom: a.etudiant.nom,
          prenom: a.etudiant.prenom,
          niveau: a.etudiant.niveau,
        },
        etablissement: a.etudiant.etablissement,
      };
    })
    .sort((a, b) => dateEvenement(b).localeCompare(dateEvenement(a)));
}
