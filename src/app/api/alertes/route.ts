import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { rechercherAlertes, rechercherAlertesPaginees } from "@/lib/alertes-server";
import { lireFiltres, porteeAlertes } from "@/lib/filtres-alertes";
import { lirePagination, paginationDemandee } from "@/lib/pagination";

/**
 * Filtres (query params) : niveau, type, statut (active par défaut), du, au,
 * etablissement (admin uniquement), q. Directeur et enseignant restent
 * limités à leur établissement quoi que contienne l'URL.
 *
 * Avec `page` ou `taille` (20, 50, 100) : une page { elements, total, page,
 * taille, nbPages }. Sans : la liste complète, comme auparavant.
 */
export async function GET(request: Request) {
  const access = await requireRole(["admin", "enseignant", "directeur"]);
  if (access instanceof Response) return access;

  try {
    const params = new URL(request.url).searchParams;
    const filtres = lireFiltres(params);
    const portee = porteeAlertes(access.user);

    if (paginationDemandee(params)) {
      return NextResponse.json(await rechercherAlertesPaginees(filtres, portee, lirePagination(params)));
    }
    const { alertes } = await rechercherAlertes(filtres, portee);
    return NextResponse.json(alertes);
  } catch (error) {
    console.error("Erreur lors de la récupération des alertes", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les alertes" },
      { status: 500 }
    );
  }
}
