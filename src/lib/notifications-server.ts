import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  FENETRE_NOTIFICATIONS_MS,
  MAX_NOTIFICATIONS,
  type EtatNotifications,
  type NotificationAlerte,
} from "@/lib/notifications";

type Destinataire = { id: string; role: string; etablissementId: string | null };

/**
 * Alertes que l'utilisateur peut voir : toutes pour l'admin, celles de son
 * établissement pour le directeur et l'enseignant, aucune sans établissement.
 */
export function perimetreNotifications(user: Destinataire): Prisma.AlerteWhereInput | null {
  if (user.role === "admin") return {};
  if (!user.etablissementId) return null;
  return { etudiant: { etablissementId: user.etablissementId } };
}

const avecEleve = {
  etudiant: {
    select: {
      id: true,
      nom: true,
      prenom: true,
      niveau: true,
      etablissement: { select: { id: true, nom: true } },
    },
  },
} satisfies Prisma.AlerteInclude;

/**
 * Alertes actives créées ou aggravées (Moyen → Élevé) depuis 30 jours, les
 * plus récentes d'abord, et la dernière ouverture de la cloche par l'utilisateur.
 * Deux requêtes (créations, aggravations) : une alerte ancienne aggravée hier
 * passe ainsi avant une création d'avant-hier. Le périmètre s'applique aux deux.
 */
export async function getNotifications(
  user: Destinataire,
  maintenant: Date = new Date()
): Promise<EtatNotifications> {
  const perimetre = perimetreNotifications(user);
  if (!perimetre) return { notifications: [], vuesLe: null };

  const depuis = new Date(maintenant.getTime() - FENETRE_NOTIFICATIONS_MS);
  const [compte, creees, aggravees] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { notificationsVuesLe: true } }),
    prisma.alerte.findMany({
      where: { statut: "active", createdAt: { gte: depuis }, ...perimetre },
      include: avecEleve,
      orderBy: { createdAt: "desc" },
      take: MAX_NOTIFICATIONS,
    }),
    prisma.alerte.findMany({
      where: { statut: "active", niveauModifieLe: { gte: depuis }, ...perimetre },
      include: avecEleve,
      orderBy: { niveauModifieLe: "desc" },
      take: MAX_NOTIFICATIONS,
    }),
  ]);

  // Une entrée par alerte : son événement le plus récent (l'aggravation, s'il y en a une)
  const parId = new Map<string, NotificationAlerte>();
  for (const a of [...creees, ...aggravees]) {
    const aggravation = a.niveauModifieLe && a.niveauModifieLe >= depuis ? a.niveauModifieLe : null;
    parId.set(a.id, {
      id: a.id,
      type: a.type,
      niveauRisque: a.niveauRisque,
      createdAt: a.createdAt.toISOString(),
      evenement: aggravation ? "aggravee" : "creee",
      date: (aggravation ?? a.createdAt).toISOString(),
      // Seule aggravation possible : Moyen → Élevé (voir estAggravation)
      ...(aggravation ? { niveauPrecedent: "moyen" } : {}),
      etudiant: { id: a.etudiant.id, nom: a.etudiant.nom, prenom: a.etudiant.prenom, niveau: a.etudiant.niveau },
      etablissement: a.etudiant.etablissement,
    });
  }

  return {
    notifications: [...parId.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_NOTIFICATIONS),
    vuesLe: compte?.notificationsVuesLe?.toISOString() ?? null,
  };
}

/**
 * Enregistre l'ouverture de la cloche jusqu'à `jusquA` : la date du dernier
 * événement affiché, pour qu'une alerte arrivée entre l'affichage et ce clic
 * reste non lue. Jamais dans le futur, et jamais en arrière (un autre appareil
 * a pu enregistrer une date plus récente).
 */
export async function marquerNotificationsVues(
  userId: string,
  jusquA: Date,
  maintenant: Date = new Date()
): Promise<string | null> {
  const date = jusquA > maintenant ? maintenant : jusquA;
  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ notificationsVuesLe: null }, { notificationsVuesLe: { lt: date } }],
    },
    data: { notificationsVuesLe: date },
  });
  const compte = await prisma.user.findUnique({ where: { id: userId }, select: { notificationsVuesLe: true } });
  return compte?.notificationsVuesLe?.toISOString() ?? null;
}
