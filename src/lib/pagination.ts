// Pagination côté serveur des listes. Ce module n'importe rien du serveur : il
// sert aux pages, aux routes API et au composant client <Pagination>.

import { formaterNombre } from "@/lib/format";

export const TAILLES_PAGE = [20, 50, 100] as const;
export type TaillePage = (typeof TAILLES_PAGE)[number];
export const TAILLE_PAR_DEFAUT: TaillePage = 20;

/** Page et taille demandées dans l'URL, avant bornage. */
export type DemandePage = { page: number; taille: TaillePage };

export type PageResultats<T> = {
  elements: T[];
  total: number;
  /** Page réellement servie, toujours entre 1 et nbPages */
  page: number;
  taille: TaillePage;
  nbPages: number;
};

type ParamsEntree = URLSearchParams | Record<string, string | string[] | undefined>;

function lire(params: ParamsEntree, cle: string): string | undefined {
  const brut = params instanceof URLSearchParams ? params.get(cle) : params[cle];
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  return valeur?.trim() || undefined;
}

function estTaille(valeur: number): valeur is TaillePage {
  return (TAILLES_PAGE as readonly number[]).includes(valeur);
}

/** Plafond de la page lue dans l'URL : garde `skip` dans les entiers 32 bits de Prisma. */
const PAGE_MAX = 1_000_000;

/**
 * Lit `page` et `taille` dans l'URL. Une page absente, négative, nulle ou mal
 * formée vaut 1 ; une taille hors de 20, 50 ou 100 vaut 20. Une page trop
 * grande est ramenée à la dernière par `paginer`.
 */
export function lirePagination(params: ParamsEntree): DemandePage {
  const brutPage = lire(params, "page");
  const page = brutPage && /^\d+$/.test(brutPage) ? Math.min(Number(brutPage), PAGE_MAX) : 1;
  const taille = Number(lire(params, "taille"));
  return {
    page: page >= 1 ? page : 1,
    taille: estTaille(taille) ? taille : TAILLE_PAR_DEFAUT,
  };
}

/** L'appelant d'une route API a-t-il demandé une réponse paginée ? */
export function paginationDemandee(params: URLSearchParams): boolean {
  return params.has("page") || params.has("taille");
}

export function nombreDePages(total: number, taille: number): number {
  return Math.max(1, Math.ceil(total / taille));
}

/** Ramène une page hors limites (999, -1…) dans [1, nombre de pages]. */
export function bornerPage(page: number, total: number, taille: number): number {
  return Math.min(Math.max(1, Math.trunc(page) || 1), nombreDePages(total, taille));
}

/** Résultat sans aucun élément (compte sans périmètre) : rien n'est lu en base. */
export function pageVide<T>(taille: TaillePage): PageResultats<T> {
  return { elements: [], total: 0, page: 1, taille, nbPages: 1 };
}

/**
 * Compte puis lit une page. Le comptage et la lecture partent en parallèle ;
 * si la page demandée dépasse la dernière, on relit la dernière page valide.
 * Le filtre de périmètre doit déjà figurer dans les requêtes passées ici :
 * le total ne compte ainsi que ce que l'utilisateur a le droit de voir.
 */
export async function paginer<T>(
  demande: DemandePage,
  compter: () => Promise<number>,
  lireElements: (fenetre: { skip: number; take: number }) => Promise<T[]>
): Promise<PageResultats<T>> {
  const { taille } = demande;
  const fenetre = (page: number) => ({ skip: (page - 1) * taille, take: taille });

  const [total, premiers] = await Promise.all([compter(), lireElements(fenetre(demande.page))]);
  const page = bornerPage(demande.page, total, taille);
  const elements = page === demande.page ? premiers : await lireElements(fenetre(page));

  return { elements, total, page, taille, nbPages: nombreDePages(total, taille) };
}

/**
 * Ajoute page et taille à des paramètres de filtres, sans les valeurs par
 * défaut (page 1, taille 20) pour garder des URL courtes.
 */
export function avecPagination(filtres: URLSearchParams, page: number, taille: TaillePage): URLSearchParams {
  const params = new URLSearchParams(filtres);
  params.delete("page");
  params.delete("taille");
  if (page > 1) params.set("page", String(page));
  if (taille !== TAILLE_PAR_DEFAUT) params.set("taille", String(taille));
  return params;
}

/** URL d'une liste : un changement de filtre revient à la page 1 en gardant la taille. */
export function urlListe(chemin: string, filtres: URLSearchParams, taille: TaillePage, page = 1): string {
  const requete = avecPagination(filtres, page, taille).toString();
  return requete ? `${chemin}?${requete}` : chemin;
}


/** « 1–20 sur 143 » (aucun résultat : « 0 sur 0 »). */
export function libellePlage({ page, taille, total }: { page: number; taille: number; total: number }): string {
  if (total === 0) return "0 sur 0";
  const debut = (page - 1) * taille + 1;
  const fin = Math.min(page * taille, total);
  return `${formaterNombre(debut, 0)}–${formaterNombre(fin, 0)} sur ${formaterNombre(total, 0)}`;
}

/**
 * Numéros à afficher : la première et la dernière page, la page courante et
 * ses voisines, des points de suspension pour les trous de plus d'une page.
 * Ex. page 6 sur 12 → [1, "…", 5, 6, 7, "…", 12].
 */
export function numerosDePages(page: number, nbPages: number): (number | "…")[] {
  if (nbPages <= 7) return Array.from({ length: nbPages }, (_, i) => i + 1);

  const affiches = new Set([1, nbPages, page - 1, page, page + 1]);
  // Près d'un bord, on montre un bloc de 5 pages plutôt qu'un trou d'une seule page
  if (page <= 4) [2, 3, 4, 5].forEach((n) => affiches.add(n));
  if (page >= nbPages - 3) [nbPages - 4, nbPages - 3, nbPages - 2, nbPages - 1].forEach((n) => affiches.add(n));

  const tries = [...affiches].filter((n) => n >= 1 && n <= nbPages).sort((a, b) => a - b);
  const resultat: (number | "…")[] = [];
  for (const n of tries) {
    const precedent = resultat.at(-1);
    if (typeof precedent === "number" && n - precedent > 1) resultat.push("…");
    resultat.push(n);
  }
  return resultat;
}
