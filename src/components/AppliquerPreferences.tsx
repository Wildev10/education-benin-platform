"use client";

import { useEffect, useSyncExternalStore } from "react";
import { abonnerPreferences, lirePreferences, preferencesServeur } from "@/lib/preferences-accessibilite";

/**
 * Applique les préférences d'accessibilité (contraste élevé, taille du texte) à
 * toutes les pages, y compris celles qui n'affichent pas les commandes (page 404).
 */
export function AppliquerPreferences() {
  const { contrasteEleve, taille } = useSyncExternalStore(abonnerPreferences, lirePreferences, preferencesServeur);
  useEffect(() => {
    document.documentElement.dataset.theme = contrasteEleve ? "high-contrast" : "default";
    document.documentElement.dataset.fontSize = taille;
  }, [contrasteEleve, taille]);
  return null;
}
