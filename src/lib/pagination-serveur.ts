import { redirect } from "next/navigation";
import { avecPagination, urlListe, type PageResultats } from "@/lib/pagination";

type ParamsBruts = Record<string, string | string[] | undefined>;

function brut(params: ParamsBruts, cle: string): string | null {
  const valeur = params[cle];
  return (Array.isArray(valeur) ? valeur[0] : valeur) ?? null;
}

/**
 * Une page hors limites (page=999, page=-1, taille=7…) est ramenée à la page
 * valide la plus proche : on redirige vers l'URL corrigée, filtres conservés,
 * plutôt que d'afficher une erreur ou une page vide.
 */
export function corrigerUrlPagination(
  chemin: string,
  filtres: URLSearchParams,
  params: ParamsBruts,
  resultat: Pick<PageResultats<unknown>, "page" | "taille">
): void {
  const attendu = avecPagination(new URLSearchParams(), resultat.page, resultat.taille);
  if (brut(params, "page") !== attendu.get("page") || brut(params, "taille") !== attendu.get("taille")) {
    redirect(urlListe(chemin, filtres, resultat.taille, resultat.page));
  }
}
