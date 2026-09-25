import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const access = await requireRole(["admin", "enseignant"]);
  if (access instanceof Response) return access;

  try {
    const searchParams = new URL(request.url).searchParams;
    const etablissementId = searchParams.get("etablissementId");
    const niveau = searchParams.get("niveau");
    const skip = parseNonNegativeInteger(searchParams.get("skip"), 0);
    const take = parsePositiveInteger(searchParams.get("take"), 50);

    const etudiants = await prisma.etudiant.findMany({
      where: {
        ...(etablissementId ? { etablissementId } : {}),
        ...(niveau ? { niveau } : {}),
      },
      include: { etablissement: true },
      skip,
      take,
    });

    return NextResponse.json(etudiants);
  } catch (error) {
    console.error("Erreur lors de la récupération des étudiants", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les étudiants" },
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
      "nom",
      "prenom",
      "dateNaissance",
      "sexe",
      "etablissementId",
      "niveau",
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

    const dateNaissance = new Date(body.dateNaissance);
    if (Number.isNaN(dateNaissance.getTime())) {
      return NextResponse.json(
        { error: "Le champ dateNaissance doit être une date ISO valide" },
        { status: 400 }
      );
    }

    const etudiant = await prisma.etudiant.create({
      data: {
        nom: body.nom.trim(),
        prenom: body.prenom.trim(),
        dateNaissance,
        sexe: body.sexe.trim(),
        etablissementId: body.etablissementId.trim(),
        niveau: body.niveau.trim(),
      },
    });

    return NextResponse.json(etudiant, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de l'étudiant", error);
    return NextResponse.json(
      { error: "Impossible de créer l'étudiant" },
      { status: 500 }
    );
  }
}

function parseNonNegativeInteger(value: string | null, fallback: number) {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  return Number(value);
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return parsed > 0 ? parsed : fallback;
}
