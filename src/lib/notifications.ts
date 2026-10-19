/** Fenêtre de récupération des nouvelles alertes côté serveur. */
export const FENETRE_NOTIFICATIONS_MS = 5 * 60 * 1000;
/** Nombre d'alertes affichées dans le dropdown de la cloche. */
export const MAX_NOTIFICATIONS = 5;

export type NotificationAlerte = {
  id: string;
  type: string;
  niveauRisque: string;
  createdAt: string;
  etudiant: { id: string; nom: string; prenom: string; niveau: string };
  etablissement: { id: string; nom: string };
};

/** Fusionne les nouvelles alertes reçues avec celles déjà connues (dédoublonnage, tri, limite). */
export function fusionnerNotifications(
  existantes: NotificationAlerte[],
  nouvelles: NotificationAlerte[],
  max: number = MAX_NOTIFICATIONS
): NotificationAlerte[] {
  const parId = new Map<string, NotificationAlerte>();
  for (const n of [...existantes, ...nouvelles]) parId.set(n.id, n);
  return [...parId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, max);
}

/** Nombre d'alertes créées après la dernière ouverture du dropdown. */
export function compterNonLues(
  notifications: NotificationAlerte[],
  dernierVu: string | null
): number {
  if (!dernierVu) return notifications.length;
  return notifications.filter((n) => n.createdAt > dernierVu).length;
}
