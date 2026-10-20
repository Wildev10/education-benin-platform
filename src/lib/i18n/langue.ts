/**
 * Langues des pages publiques (accueil et connexion). Le reste de
 * l'application reste en français. Chaque langue a ses propres adresses
 * (« / » et « /en », « /login » et « /en/login ») : c'est ce qui donne un sens
 * aux balises hreflang. Le cookie ne fait que mémoriser le choix.
 */

export const LANGUES = ["fr", "en"] as const;
export type Langue = (typeof LANGUES)[number];
export const LANGUE_PAR_DEFAUT: Langue = "fr";

/** Cookie qui mémorise le choix fait avec le sélecteur. */
export const COOKIE_LANGUE = "langue";
export const DUREE_COOKIE_LANGUE_S = 365 * 24 * 60 * 60;
/** Paramètre d'URL du sélecteur : enregistre le choix puis redirige vers l'adresse propre. */
export const PARAMETRE_LANGUE = "langue";

export type PagePublique = "accueil" | "connexion";

export const CHEMINS: Record<PagePublique, Record<Langue, string>> = {
  accueil: { fr: "/", en: "/en" },
  connexion: { fr: "/login", en: "/en/login" },
};

export function estLangue(valeur: unknown): valeur is Langue {
  return typeof valeur === "string" && (LANGUES as readonly string[]).includes(valeur);
}

/** La page publique et la langue d'une adresse ; null pour toute autre page (toujours en français). */
export function pagePublique(chemin: string): { page: PagePublique; langue: Langue } | null {
  for (const [page, chemins] of Object.entries(CHEMINS) as [PagePublique, Record<Langue, string>][]) {
    for (const langue of LANGUES) {
      if (chemins[langue] === chemin) return { page, langue };
    }
  }
  return null;
}

/** Langue d'affichage d'une adresse : celle de la page publique, sinon le français. */
export function langueDuChemin(chemin: string): Langue {
  return pagePublique(chemin)?.langue ?? LANGUE_PAR_DEFAUT;
}

/** Lien du sélecteur vers la même page dans une autre langue (passe par le proxy, qui pose le cookie). */
export function lienChangementLangue(page: PagePublique, langue: Langue): string {
  return `${CHEMINS[page][langue]}?${PARAMETRE_LANGUE}=${langue}`;
}
