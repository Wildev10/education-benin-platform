/** Alertes listées dans la cloche : créées ou aggravées depuis 30 jours au plus. */
export const FENETRE_NOTIFICATIONS_JOURS = 30;
export const FENETRE_NOTIFICATIONS_MS = FENETRE_NOTIFICATIONS_JOURS * 24 * 60 * 60 * 1000;
/** Nombre d'alertes renvoyées à la cloche (les plus récentes). */
export const MAX_NOTIFICATIONS = 20;

/**
 * Ce qui a déclenché la notification : une alerte créée, aggravée, ou dont le
 * suivi vient d'être confié à l'utilisateur par quelqu'un d'autre.
 */
export type EvenementAlerte = "creee" | "aggravee" | "confiee";

export type NotificationAlerte = {
  id: string;
  type: string;
  niveauRisque: string;
  periode: string;
  /** Absente des anciennes alertes */
  anneeScolaire: string | null;
  createdAt: string;
  evenement: EvenementAlerte;
  /** Date de l'événement : création, aggravation ou désignation */
  date: string;
  /** Niveau avant l'aggravation (« moyen ») ; absent pour une création */
  niveauPrecedent?: string;
  /** Suivi confié : la personne qui l'a confié */
  confiePar?: string;
  /** L'utilisateur est le responsable du suivi de cette alerte */
  votreSuivi?: boolean;
  etudiant: { id: string; nom: string; prenom: string; niveau: string };
  etablissement: { id: string; nom: string };
};

/**
 * Réponse de GET /api/notifications/alertes. vuesLe : dernière ouverture de la
 * cloche, enregistrée pour l'utilisateur (donc la même sur tous ses appareils).
 */
export type EtatNotifications = { notifications: NotificationAlerte[]; vuesLe: string | null };

/**
 * Une notification est non lue si son événement (création, ou aggravation)
 * suit la dernière ouverture de la cloche. Une aggravation redevient donc non lue.
 */
export function estNonLue(n: NotificationAlerte, vuesLe: string | null): boolean {
  return !vuesLe || n.date > vuesLe;
}

export function compterNonLues(notifications: NotificationAlerte[], vuesLe: string | null): number {
  return notifications.filter((n) => estNonLue(n, vuesLe)).length;
}
