import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireRole(["admin", "enseignant"]);
  if (access instanceof Response) return access;

  try {
    const body = await request.json();
    if (body.statut !== "traitee") {
      return NextResponse.json(
        { error: "Le statut doit être \"traitee\"" },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const alerteExistante = await prisma.alerte.findUnique({
      where: { id },
      include: { etudiant: { select: { nom: true, prenom: true } } },
    });
    if (!alerteExistante) {
      return NextResponse.json(
        { error: "Alerte introuvable" },
        { status: 404 }
      );
    }

    const alerte = await prisma.alerte.update({
      where: { id },
      data: { statut: "traitee" },
    });

    await logAction({
      userId: access.user.id,
      action: "ALERTE_TRAITEE",
      description: `Alerte traitée pour ${alerteExistante.etudiant.prenom} ${alerteExistante.etudiant.nom}`,
      entityType: "alerte",
      entityId: alerte.id,
    });

    return NextResponse.json(alerte);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'alerte", error);
    return NextResponse.json(
      { error: "Impossible de mettre à jour l'alerte" },
      { status: 500 }
    );
  }
}
