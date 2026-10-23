import { useSyncExternalStore } from "react";
import { abonnerPreferences, lirePreferences, preferencesServeur } from "@/lib/preferences-accessibilite";

/**
 * Couleurs des graphiques (Recharts). Elles sont passées en attributs SVG, que
 * les variables CSS du mode contraste élevé n'atteignent pas : d'où une
 * seconde palette, assombrie, choisie selon la préférence de l'utilisateur.
 * En contraste élevé, les textes atteignent 7:1 sur le blanc et les barres,
 * traits et repères au moins 4,5:1.
 */
export type CouleursGraphique = {
  grille: string;
  axe: string;
  libelle: string;
  valeur: string;
  trait: string;
  pointActif: string;
  seuil: string;
  opaciteSeuil: number;
  survol: string;
  bordureInfobulle: string;
  /** Moyennes : au moins 12, de 10 à 12, sous 10 */
  bon: string;
  moyen: string;
  faible: string;
};

export const COULEURS_GRAPHIQUE: CouleursGraphique = {
  grille: "#E5E5E5",
  axe: "#6B6B6B",
  libelle: "#404040",
  valeur: "#0A0A0A",
  trait: "#F97316",
  pointActif: "#C2410C",
  seuil: "#B91C1C",
  opaciteSeuil: 0.5,
  survol: "#FFF7ED",
  bordureInfobulle: "#E5E5E5",
  bon: "#10B981",
  moyen: "#F97316",
  faible: "#DC2626",
};

export const COULEURS_GRAPHIQUE_CONTRASTE: CouleursGraphique = {
  grille: "#8C8C8C",
  axe: "#333333",
  libelle: "#000000",
  valeur: "#000000",
  trait: "#8A2C0D",
  pointActif: "#000000",
  seuil: "#991B1B",
  opaciteSeuil: 1,
  survol: "#FFF7ED",
  bordureInfobulle: "#000000",
  bon: "#065F46",
  moyen: "#B45309",
  faible: "#991B1B",
};

export function useCouleursGraphique(): CouleursGraphique {
  const { contrasteEleve } = useSyncExternalStore(abonnerPreferences, lirePreferences, preferencesServeur);
  return contrasteEleve ? COULEURS_GRAPHIQUE_CONTRASTE : COULEURS_GRAPHIQUE;
}
