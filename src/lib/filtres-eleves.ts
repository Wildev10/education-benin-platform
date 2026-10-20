// Filtres de la liste des élèves, partagés entre le formulaire (client) et les
// requêtes (eleves-server.ts). Aucune dépendance serveur ici.

export const NIVEAUX = ["Seconde C", "Première D", "Terminale D"];

export type FiltresEleves = {
  /** Réservé à l'admin : ignoré pour les autres rôles */
  etablissement?: string;
  niveau?: string;
  /** Recherche sur le nom ou le prénom */
  q?: string;
};

type ParamsEntree = URLSearchParams | Record<string, string | string[] | undefined>;

function lire(params: ParamsEntree, cle: string): string | undefined {
  const brut = params instanceof URLSearchParams ? params.get(cle) : params[cle];
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  return valeur?.trim() || undefined;
}

/** Lit les filtres depuis l'URL (`search` et `etablissementId` : anciens noms de l'API). */
export function lireFiltresEleves(params: ParamsEntree): FiltresEleves {
  const niveau = lire(params, "niveau");
  return {
    etablissement: lire(params, "etablissement") ?? lire(params, "etablissementId"),
    niveau: niveau && NIVEAUX.includes(niveau) ? niveau : undefined,
    q: (lire(params, "q") ?? lire(params, "search"))?.slice(0, 100),
  };
}

export function filtresElevesVersParams(filtres: FiltresEleves): URLSearchParams {
  const params = new URLSearchParams();
  if (filtres.etablissement) params.set("etablissement", filtres.etablissement);
  if (filtres.niveau) params.set("niveau", filtres.niveau);
  if (filtres.q) params.set("q", filtres.q);
  return params;
}
