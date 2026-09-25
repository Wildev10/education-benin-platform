import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { detecterAlerte } from "@/lib/detection-alerte";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const access = await requireRole(["admin", "enseignant", "etudiant"]);
  if (access instanceof Response) return access;

  try {
    const searchParams = new URL(request.url).searchParams;
    const matiere = searchParams.get("matiere");
    const periode = searchParams.get("periode");
    const etudiantId =
      access.user.role === "etudiant"
        ? access.user.etudiantId
        : searchParams.get("etudiantId");

    if (access.user.role === "etudiant" && !etudiantId) {
      return NextResponse.json(
        { error: "Aucun étudiant associé à ce compte" },
        { status: 403 }
      );
    }

    const notes = await prisma.note.findMany({
      where: {
        ...(etudiantId ? { etudiantId } : {}),
        ...(matiere ? { matiere } : {}),
        ...(periode ? { periode } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Erreur lors de la récupération des notes", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les notes" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const access = await requireRole(["admin", "enseignant"]);
  if (access instanceof Response) return access;

  try {
    const body = await request.json();
    const requiredFields = [
      "etudiantId",
      "matiere",
      "valeur",
      "periode",
      "anneeScolaire",
    ];
    const missingField = requiredFields.find(
      (field) =>
        body[field] === undefined ||
        body[field] === null ||
        (typeof body[field] === "string" && body[field].trim() === "")
    );

    if (missingField) {
      return NextResponse.json(
        { error: `Le champ ${missingField} est obligatoire` },
        { status: 400 }
      );
    }

    if (
      typeof body.valeur !== "number" ||
      !Number.isFinite(body.valeur) ||
      body.valeur < 0 ||
      body.valeur > 20
    ) {
      return NextResponse.json(
        { error: "La valeur doit être un nombre compris entre 0 et 20" },
        { status: 400 }
      );
    }

    const note = await prisma.note.create({
      data: {
        etudiantId: body.etudiantId.trim(),
        matiere: body.matiere.trim(),
        valeur: body.valeur,
        periode: body.periode.trim(),
        anneeScolaire: body.anneeScolaire.trim(),
      },
    });

    const alerteCreee = await detecterAlerte(note.etudiantId);

    return NextResponse.json({ ...note, alerteCreee }, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de la note", error);
    return NextResponse.json(
      { error: "Impossible de créer la note" },
      { status: 500 }
    );
  }
}
