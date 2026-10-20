import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth-guard";
import { detecterAlerteAbsence } from "@/lib/detection-alerte";
import { prisma } from "@/lib/prisma";
import { construireWhereAbsences, lectureAbsences, rechercherAbsencesPaginees } from "@/lib/absences-server";
import { lireFiltresAbsences } from "@/lib/filtres-absences";
import { lirePagination, pageVide, paginationDemandee } from "@/lib/pagination";
import { introuvable, peutAccederEtudiant } from "@/lib/perimetre";

const MOTIFS_VALIDES = new Set(["injustifiee", "justifiee"]);
const PERIODES_VALIDES = new Set(["Trimestre 1", "Trimestre 2", "Trimestre 3"]);

/**
 * Filtres : etudiantId, periode, annee (ou anneeScolaire), motif, q,
 * etablissement (admin uniquement). Avec `page` ou `taille` : une page
 * { elements, total, page, taille, nbPages } ; sans : toutes les absences.
 */
export async function GET(request: Request) {
  const access = await requireRole(["admin", "enseignant", "directeur"]);
  if (access instanceof Response) return access;

  const sp = new URL(request.url).searchParams;
  const filtres = lireFiltresAbsences(sp);
  // Un compte sans établissement ne voit aucune absence (auparavant : toutes)
  const where = construireWhereAbsences(filtres, access.user);
  if (!where) return NextResponse.json(paginationDemandee(sp) ? pageVide(lirePagination(sp).taille) : []);

  try {
    if (paginationDemandee(sp)) {
      return NextResponse.json(await rechercherAbsencesPaginees(filtres, access.user, lirePagination(sp)));
    }
    const absences = await prisma.absence.findMany({ where, ...lectureAbsences });
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

    const etudiant = await prisma.etudiant.findUnique({
      where: { id: etudiantId },
      select: { id: true, etablissementId: true, nom: true, prenom: true },
    });
    if (!etudiant || !peutAccederEtudiant(access.user, etudiant)) {
      return introuvable("Étudiant introuvable.");
    }

    const absence = await prisma.absence.create({
      data: { etudiantId, date, motif, periode, anneeScolaire },
    });

    const alerteCreee = await detecterAlerteAbsence(etudiantId);

    await logAction({
      userId: access.user.id,
      action: "ABSENCE_CREEE",
      description: `Absence ${motif === "justifiee" ? "justifiée" : "injustifiée"} le ${date.toLocaleDateString("fr-FR")} pour ${etudiant.prenom} ${etudiant.nom}`,
      entityType: "absence",
      entityId: absence.id,
    });

    return NextResponse.json({ absence, alerteCreee }, { status: 201 });
  } catch (error) {
    console.error("Erreur POST absence", error);
    return NextResponse.json({ error: "Impossible de créer l'absence." }, { status: 500 });
  }
}
