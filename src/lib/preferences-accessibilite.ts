/**
 * Préférences d'accessibilité (contraste élevé, taille du texte), gardées dans
 * localStorage et lues avec useSyncExternalStore. Le serveur ne les connaît
 * pas : il rend les valeurs par défaut, puis le navigateur relit les siennes.
 */

export type TaillePolice = "normal" | "large" | "x-large";
export type PreferencesAccessibilite = { contrasteEleve: boolean; taille: TaillePolice };

const CLE_CONTRASTE = "accessibility-contrast";
const CLE_TAILLE = "accessibility-font-size";
const EVENEMENT = "preferences-accessibilite";

export const PREFERENCES_PAR_DEFAUT: PreferencesAccessibilite = { contrasteEleve: false, taille: "normal" };

function lireCle(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null; // stockage bloqué (navigation privée stricte…)
  }
}

// useSyncExternalStore exige le même objet tant que rien n'a changé
let dernierBrut = "";
let dernieres = PREFERENCES_PAR_DEFAUT;
// Stockage bloqué : la préférence ne vaut que pour la page en cours
let enMemoire: PreferencesAccessibilite | null = null;

export function lirePreferences(): PreferencesAccessibilite {
  if (enMemoire) return enMemoire;
  const contraste = lireCle(CLE_CONTRASTE);
  const taille = lireCle(CLE_TAILLE);
  const brut = `${contraste}|${taille}`;
  if (brut !== dernierBrut) {
    dernierBrut = brut;
    dernieres = {
      contrasteEleve: contraste === "high",
      taille: taille === "large" || taille === "x-large" ? taille : "normal",
    };
  }
  return dernieres;
}

export function preferencesServeur(): PreferencesAccessibilite {
  return PREFERENCES_PAR_DEFAUT;
}

export function abonnerPreferences(rappel: () => void): () => void {
  window.addEventListener(EVENEMENT, rappel);
  return () => window.removeEventListener(EVENEMENT, rappel);
}

export function enregistrerPreferences(preferences: PreferencesAccessibilite): void {
  try {
    localStorage.setItem(CLE_CONTRASTE, preferences.contrasteEleve ? "high" : "default");
    localStorage.setItem(CLE_TAILLE, preferences.taille);
  } catch {
    enMemoire = { ...preferences };
  }
  window.dispatchEvent(new Event(EVENEMENT));
}
