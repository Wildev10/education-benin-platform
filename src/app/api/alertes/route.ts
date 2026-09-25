import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const ordreNiveauxRisque: Record<string, number> = {
  eleve: 0,
  moyen: 1,
  eleve: 2,
};

export async function GET(request: Request) {
  const access = await requireRole(["admin", "enseignant"]);
  if (access instanceof Response) return access;

  try {
    const searchParams = new URL(request.url).searchParams;
    const statut = searchParams.get("statut");
    const niveauRisque = searchParams.get("niveauRisque");

    const alertes = await prisma.alerte.findMany({
      where: {
        ...(statut === "active" || statut === "traitee" ? { statut } : {}),
        ...(niveauRisque === "moyen" || niveauRisque === "eleve"
          ? { niveauRisque }
          : {}),
      },
      include: {
        etudiant: {
          include: { etablissement: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    alertes.sort(
      (a, b) =>
        (ordreNiveauxRisque[a.niveauRisque] ?? Number.MAX_SAFE_INTEGER) -
          (ordreNiveauxRisque[b.niveauRisque] ?? Number.MAX_SAFE_INTEGER) ||
        b.createdAt.getTime() - a.createdAt.getTime()
    );

    return NextResponse.json(alertes);
  } catch (error) {
    console.error("Erreur lors de la récupération des alertes", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les alertes" },
      { status: 500 }
    );
  }
}
