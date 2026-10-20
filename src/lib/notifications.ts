/** Fenêtre de récupération des nouvelles alertes côté serveur. */
export const FENETRE_NOTIFICATIONS_MS = 5 * 60 * 1000;
/** Nombre d'alertes affichées dans le dropdown de la cloche. */
export const MAX_NOTIFICATIONS = 5;

/** Ce qui a déclenché la notification : une alerte créée, ou une alerte active aggravée. */
export type EvenementAlerte = "creee" | "aggravee";

export type NotificationAlerte = {
  id: string;
  type: string;
  niveauRisque: string;
  createdAt: string;
  /** Absents des notifications gardées en localStorage avant l'ajout des aggravations */
  evenement?: EvenementAlerte;
  /** Date de l'événement : création, ou aggravation */
  date?: string;
  /** Niveau avant l'aggravation (« moyen ») ; absent pour une création */
  niveauPrecedent?: string;
  etudiant: { id: string; nom: string; prenom: string; niveau: string };
  etablissement: { id: string; nom: string };
};

/** Date qui compte pour le tri et le lu/non lu : celle de l'événement, sinon la création. */
export function dateEvenement(n: NotificationAlerte): string {
  return n.date ?? n.createdAt;
}

/**
 * Fusionne les nouvelles alertes reçues avec celles déjà connues : une entrée
 * par alerte (son événement le plus récent : une aggravation remplace la
 * création), triées du plus récent au plus ancien, limitées à `max`.
 */
export function fusionnerNotifications(
  existantes: NotificationAlerte[],
  nouvelles: NotificationAlerte[],
  max: number = MAX_NOTIFICATIONS
): NotificationAlerte[] {
  const parId = new Map<string, NotificationAlerte>();
  for (const n of [...existantes, ...nouvelles]) {
    const connue = parId.get(n.id);
    if (!connue || dateEvenement(n) >= dateEvenement(connue)) parId.set(n.id, n);
  }
  return [...parId.values()]
    .sort((a, b) => dateEvenement(b).localeCompare(dateEvenement(a)))
    .slice(0, max);
}

/**
 * Nombre de notifications postérieures à la dernière ouverture du dropdown.
 * Une aggravation compte comme une nouvelle notification, même si la création
 * de l'alerte avait déjà été lue.
 */
export function compterNonLues(
  notifications: NotificationAlerte[],
  dernierVu: string | null
): number {
  return notifications.filter((n) => estNonLue(n, dernierVu)).length;
}

export function estNonLue(n: NotificationAlerte, dernierVu: string | null): boolean {
  return !dernierVu || dateEvenement(n) > dernierVu;
}
