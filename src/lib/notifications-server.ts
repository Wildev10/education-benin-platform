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
  responsable: { select: { id: true } },
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
 * Alertes actives créées ou aggravées (Moyen → Élevé) depuis 30 jours, et
 * celles dont le suivi a été confié à l'utilisateur par quelqu'un d'autre, les
 * plus récentes d'abord, avec la dernière ouverture de la cloche par l'utilisateur.
 * Une requête par événement : une alerte ancienne aggravée hier passe ainsi
 * avant une création d'avant-hier. Le périmètre s'applique à toutes.
 */
export async function getNotifications(
  user: Destinataire,
  maintenant: Date = new Date()
): Promise<EtatNotifications> {
  const perimetre = perimetreNotifications(user);
  if (!perimetre) return { notifications: [], vuesLe: null };

  const depuis = new Date(maintenant.getTime() - FENETRE_NOTIFICATIONS_MS);
  const [compte, creees, aggravees, confiees] = await Promise.all([
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
    // Désignations par une autre personne, encore valables (toujours responsable, alerte ouverte)
    prisma.suiviAlerte.findMany({
      where: {
        responsableId: user.id,
        createdAt: { gte: depuis },
        OR: [{ auteurId: null }, { auteurId: { not: user.id } }],
        alerte: { statut: "active", responsableId: user.id, ...perimetre },
      },
      select: { createdAt: true, auteurNom: true, alerte: { include: avecEleve } },
      orderBy: { createdAt: "desc" },
      take: MAX_NOTIFICATIONS,
    }),
  ]);

  type AlerteNotifiee = (typeof creees)[number];
  const entree = (a: AlerteNotifiee, evenement: NotificationAlerte["evenement"], date: Date, confiePar?: string): NotificationAlerte => ({
    id: a.id,
    type: a.type,
    niveauRisque: a.niveauRisque,
    periode: a.periode,
    anneeScolaire: a.anneeScolaire,
    createdAt: a.createdAt.toISOString(),
    evenement,
    date: date.toISOString(),
    // Seule aggravation possible : Moyen → Élevé (voir estAggravation)
    ...(evenement === "aggravee" ? { niveauPrecedent: "moyen" } : {}),
    ...(confiePar ? { confiePar } : {}),
    ...(a.responsable?.id === user.id ? { votreSuivi: true } : {}),
    etudiant: { id: a.etudiant.id, nom: a.etudiant.nom, prenom: a.etudiant.prenom, niveau: a.etudiant.niveau },
    etablissement: a.etudiant.etablissement,
  });

  // Une entrée par alerte : son événement le plus récent
  const parId = new Map<string, NotificationAlerte>();
  const garder = (n: NotificationAlerte) => {
    const deja = parId.get(n.id);
    if (!deja || n.date > deja.date) parId.set(n.id, n);
  };
  for (const a of [...creees, ...aggravees]) {
    const aggravation = a.niveauModifieLe && a.niveauModifieLe >= depuis ? a.niveauModifieLe : null;
    garder(entree(a, aggravation ? "aggravee" : "creee", aggravation ?? a.createdAt));
  }
  // La plus récente désignation de chaque alerte (triées de la plus récente à la plus ancienne)
  const vues = new Set<string>();
  for (const etape of confiees) {
    if (vues.has(etape.alerte.id)) continue;
    vues.add(etape.alerte.id);
    garder(entree(etape.alerte, "confiee", etape.createdAt, etape.auteurNom));
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
