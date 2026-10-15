import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  try {
    const { id } = await context.params;
    const { count } = await prisma.resetRequest.updateMany({ where: { id }, data: { traitee: true } });
    if (count === 0) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    return NextResponse.json({ id, traitee: true });
  } catch (error) {
    console.error("Erreur PATCH reset-request", error);
    return NextResponse.json({ error: "Impossible de traiter la demande." }, { status: 500 });
  }
}
