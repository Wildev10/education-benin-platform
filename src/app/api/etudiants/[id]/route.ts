import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { introuvable, peutAccederEtudiant } from "@/lib/perimetre";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireRole(["admin", "enseignant", "directeur", "etudiant"]);
  if (access instanceof Response) return access;

  try {
    const { id } = await context.params;

    const etudiant = await prisma.etudiant.findUnique({
      where: { id },
      include: {
        etablissement: true,
        inscriptions: true,
        notes: true,
        alertes: true,
        absences: { orderBy: { date: "desc" } },
      },
    });

    // Hors périmètre (autre établissement, ou fiche d'un autre étudiant) = introuvable
    if (!etudiant || !peutAccederEtudiant(access.user, etudiant)) {
      return introuvable("Étudiant introuvable");
    }

    return NextResponse.json(etudiant);
  } catch (error) {
    console.error("Erreur lors de la récupération de l'étudiant", error);
    return NextResponse.json(
      { error: "Impossible de récupérer l'étudiant" },
      { status: 500 }
    );
  }
}
