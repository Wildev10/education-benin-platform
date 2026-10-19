import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { introuvable, peutAccederEtudiant } from "@/lib/perimetre";
import { reponseXlsx } from "@/lib/excel/commun";
import { classeurFicheEleve, nomFichierFiche } from "@/lib/excel/fiche-eleve";

type RouteContext = { params: Promise<{ id: string }> };

/** Fiche élève au format Excel : mêmes règles que le PDF, et l'étudiant pour sa propre fiche. */
export async function GET(_request: Request, context: RouteContext) {
  const access = await requireRole(["admin", "enseignant", "directeur", "etudiant"]);
  if (access instanceof Response) return access;

  try {
    const { id } = await context.params;
    const etudiant = await prisma.etudiant.findUnique({
      where: { id },
      include: {
        etablissement: true,
        inscriptions: { select: { anneeScolaire: true } },
        notes: { select: { matiere: true, valeur: true, periode: true, anneeScolaire: true } },
        absences: { select: { date: true, motif: true, periode: true, anneeScolaire: true } },
        alertes: { orderBy: { createdAt: "desc" } },
      },
    });

    // Hors périmètre = introuvable : on ne révèle pas l'existence de l'élève
    if (!etudiant || !peutAccederEtudiant(access.user, etudiant)) {
      return introuvable("Étudiant introuvable");
    }

    const annees = [
      ...etudiant.inscriptions.map((i) => i.anneeScolaire),
      ...etudiant.notes.map((n) => n.anneeScolaire),
    ].sort();
    const anneeScolaire = annees.at(-1) ?? "—";
    const genereLe = new Date();

    const classeur = classeurFicheEleve({
      etudiant,
      anneeScolaire,
      notes: etudiant.notes.filter((n) => n.anneeScolaire === anneeScolaire),
      absences: etudiant.absences.filter((a) => a.anneeScolaire === anneeScolaire),
      alertes: etudiant.alertes,
      genereLe,
    });
    return reponseXlsx(classeur, nomFichierFiche({ etudiant, genereLe }));
  } catch (error) {
    console.error("Erreur lors de la génération de la fiche Excel", error);
    return NextResponse.json({ error: "Impossible de générer le fichier Excel." }, { status: 500 });
  }
}
