import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getHistorique, getHistoriquePagine } from "@/lib/historique";
import { lirePagination, paginationDemandee } from "@/lib/pagination";

/** Avec `page` ou `taille` : une page { elements, total, page, taille, nbPages } ; sans : les 100 dernières actions. */
export async function GET(request: Request) {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  try {
    const sp = new URL(request.url).searchParams;
    const filtres = { action: sp.get("action"), userId: sp.get("userId") ?? sp.get("utilisateur") };
    if (paginationDemandee(sp)) {
      return NextResponse.json(await getHistoriquePagine(filtres, lirePagination(sp)));
    }
    return NextResponse.json(await getHistorique(filtres));
  } catch (error) {
    console.error("Erreur GET historique", error);
    return NextResponse.json({ error: "Impossible de récupérer l'historique." }, { status: 500 });
  }
}
