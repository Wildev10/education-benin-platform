/** Nom affiché d'un compte : « Arsène Kpadonou » (le nom seul si le prénom manque). */
export function nomComplet(prenom: string | null | undefined, nom: string): string {
  return [prenom?.trim(), nom.trim()].filter(Boolean).join(" ");
}

/**
 * Initiales de l'avatar : première lettre du premier et du dernier mot
 * (« Arsène Kpadonou » → « AK », « Jean Marc Dossou » → « JD »), une seule
 * lettre pour un nom d'un mot. Un tiret garde le prénom composé entier.
 */
export function initiales(nomAffiche: string): string {
  const mots = nomAffiche.split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "";
  const premiere = (mot: string) => Array.from(mot)[0] ?? "";
  const lettres = mots.length === 1 ? premiere(mots[0]) : premiere(mots[0]) + premiere(mots[mots.length - 1]);
  return lettres.toLocaleUpperCase("fr-FR");
}
