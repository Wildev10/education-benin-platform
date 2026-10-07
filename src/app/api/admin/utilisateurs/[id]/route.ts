import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  const { id } = await context.params;

  if (access.user.id === id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte." },
      { status: 403 }
    );
  }

  try {
    const utilisateur = await prisma.user.findUnique({ where: { id } });
    if (!utilisateur) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Erreur DELETE utilisateur", error);
    return NextResponse.json({ error: "Impossible de supprimer l'utilisateur." }, { status: 500 });
  }
}
