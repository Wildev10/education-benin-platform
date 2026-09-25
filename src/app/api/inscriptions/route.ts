import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const access = await requireRole(["admin", "enseignant"]);
  if (access instanceof Response) return access;

  try {
    const searchParams = new URL(request.url).searchParams;
    const etudiantId = searchParams.get("etudiantId");
    const anneeScolaire = searchParams.get("anneeScolaire");

    const inscriptions = await prisma.inscription.findMany({
      where: {
        ...(etudiantId ? { etudiantId } : {}),
        ...(anneeScolaire ? { anneeScolaire } : {}),
      },
    });

    return NextResponse.json(inscriptions);
  } catch (error) {
    console.error("Erreur lors de la récupération des inscriptions", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les inscriptions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  try {
    const body = await request.json();
    const requiredFields = [
      "etudiantId",
      "anneeScolaire",
      "niveau",
      "statut",
    ];
    const missingField = requiredFields.find(
      (field) => typeof body[field] !== "string" || body[field].trim() === ""
    );

    if (missingField) {
      return NextResponse.json(
        { error: `Le champ ${missingField} est obligatoire` },
        { status: 400 }
      );
    }

    const inscription = await prisma.inscription.create({
      data: {
        etudiantId: body.etudiantId.trim(),
        anneeScolaire: body.anneeScolaire.trim(),
        niveau: body.niveau.trim(),
        statut: body.statut.trim(),
      },
    });

    return NextResponse.json(inscription, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de l'inscription", error);
    return NextResponse.json(
      { error: "Impossible de créer l'inscription" },
      { status: 500 }
    );
  }
}
