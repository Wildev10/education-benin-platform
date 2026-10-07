import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { detecterAlerteAbsence } from "@/lib/detection-alerte";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireRole(["admin", "enseignant"]);
  if (access instanceof Response) return access;

  const { id } = await context.params;

  try {
    const absence = await prisma.absence.findUnique({ where: { id }, select: { etudiantId: true } });
    if (!absence) {
      return NextResponse.json({ error: "Absence introuvable." }, { status: 404 });
    }

    await prisma.absence.delete({ where: { id } });

    // Recalcule l'alerte après suppression
    await detecterAlerteAbsence(absence.etudiantId);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Erreur DELETE absence", error);
    return NextResponse.json({ error: "Impossible de supprimer l'absence." }, { status: 500 });
  }
}
