import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { rechercherAlertes } from "@/lib/alertes-server";
import { lireFiltres, porteeAlertes } from "@/lib/filtres-alertes";

/**
 * Filtres (query params) : niveau, type, statut (active par défaut), du, au,
 * etablissement (admin uniquement), q. Directeur et enseignant restent
 * limités à leur établissement quoi que contienne l'URL.
 */
export async function GET(request: Request) {
  const access = await requireRole(["admin", "enseignant", "directeur"]);
  if (access instanceof Response) return access;

  try {
    const filtres = lireFiltres(new URL(request.url).searchParams);
    const { alertes } = await rechercherAlertes(filtres, porteeAlertes(access.user));
    return NextResponse.json(alertes);
  } catch (error) {
    console.error("Erreur lors de la récupération des alertes", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les alertes" },
      { status: 500 }
    );
  }
}
