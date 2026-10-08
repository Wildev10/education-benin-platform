import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { detecterAlerteAbsence } from "@/lib/detection-alerte";
import { prisma } from "@/lib/prisma";

const MOTIFS_VALIDES = new Set(["injustifiee", "justifiee"]);
const PERIODES_VALIDES = new Set(["Trimestre 1", "Trimestre 2", "Trimestre 3"]);

export async function GET(request: Request) {
  const access = await requireRole(["admin", "enseignant", "directeur"]);
  if (access instanceof Response) return access;

  try {
    const sp = new URL(request.url).searchParams;
    const etudiantId = sp.get("etudiantId");
    const periode = sp.get("periode");
    const anneeScolaire = sp.get("anneeScolaire");
    const motif = sp.get("motif");

    const absences = await prisma.absence.findMany({
      where: {
        ...(etudiantId ? { etudiantId } : {}),
        ...(periode ? { periode } : {}),
        ...(anneeScolaire ? { anneeScolaire } : {}),
        ...(motif ? { motif } : {}),
        // Le directeur et l'enseignant ne voient que les absences de leur établissement.
        ...(access.user.role === "directeur" || access.user.role === "enseignant"
          ? { etudiant: { etablissementId: access.user.etablissementId ?? undefined } }
          : {}),
      },
      include: {
        etudiant: {
          select: { nom: true, prenom: true, etablissement: { select: { nom: true } } },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(absences);
  } catch (error) {
    console.error("Erreur GET absences", error);
    return NextResponse.json({ error: "Impossible de récupérer les absences." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await requireRole(["admin", "enseignant", "directeur"]);
  if (access instanceof Response) return access;

  try {
    const body = await request.json();
    const { etudiantId, date: dateStr, motif, periode, anneeScolaire } = body ?? {};

    if (!etudiantId || !dateStr || !motif || !periode || !anneeScolaire) {
      return NextResponse.json({ error: "Tous les champs sont obligatoires." }, { status: 400 });
    }
    if (!MOTIFS_VALIDES.has(motif)) {
      return NextResponse.json({ error: "Motif invalide. Valeurs acceptées : injustifiee, justifiee." }, { status: 400 });
    }
    if (!PERIODES_VALIDES.has(periode)) {
      return NextResponse.json({ error: "Période invalide." }, { status: 400 });
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Date invalide." }, { status: 400 });
    }
    if (date > new Date()) {
      return NextResponse.json({ error: "La date ne peut pas être dans le futur." }, { status: 400 });
    }

    const etudiant = await prisma.etudiant.findUnique({ where: { id: etudiantId }, select: { id: true, etablissementId: true } });
    if (!etudiant) {
      return NextResponse.json({ error: "Étudiant introuvable." }, { status: 404 });
    }

    if (
      (access.user.role === "directeur" || access.user.role === "enseignant") &&
      etudiant.etablissementId !== access.user.etablissementId
    ) {
      return NextResponse.json(
        { error: "Cet étudiant n'appartient pas à votre établissement." },
        { status: 403 }
      );
    }

    const absence = await prisma.absence.create({
      data: { etudiantId, date, motif, periode, anneeScolaire },
    });

    const alerteCreee = await detecterAlerteAbsence(etudiantId);

    return NextResponse.json({ absence, alerteCreee }, { status: 201 });
  } catch (error) {
    console.error("Erreur POST absence", error);
    return NextResponse.json({ error: "Impossible de créer l'absence." }, { status: 500 });
  }
}
