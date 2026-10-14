import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getStatsEtablissements } from "@/lib/stats-etablissements";

export async function GET() {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  try {
    return NextResponse.json(await getStatsEtablissements());
  } catch (error) {
    console.error("Erreur GET stats établissements", error);
    return NextResponse.json(
      { error: "Impossible de calculer les statistiques des établissements." },
      { status: 500 }
    );
  }
}
