import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const access = await requireRole(["admin", "enseignant"]);
  if (access instanceof Response) return access;

  try {
    const etablissements = await prisma.etablissement.findMany();
    return NextResponse.json(etablissements);
  } catch (error) {
    console.error("Erreur lors de la récupération des établissements", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les établissements" },
      { status: 500 }
    );
  }
}
