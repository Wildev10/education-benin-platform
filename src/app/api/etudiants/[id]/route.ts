import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireRole(["admin", "enseignant", "etudiant"]);
  if (access instanceof Response) return access;

  try {
    const { id } = await context.params;

    if (
      access.user.role === "etudiant" &&
      access.user.etudiantId !== id
    ) {
      return NextResponse.json(
        { error: "Vous ne pouvez consulter que votre propre fiche" },
        { status: 403 }
      );
    }

    const etudiant = await prisma.etudiant.findUnique({
      where: { id },
      include: {
        etablissement: true,
        inscriptions: true,
        notes: true,
        alertes: true,
      },
    });

    if (!etudiant) {
      return NextResponse.json(
        { error: "Étudiant introuvable" },
        { status: 404 }
      );
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
