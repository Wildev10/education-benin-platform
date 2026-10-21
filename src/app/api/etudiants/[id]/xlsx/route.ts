import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { periodeScolaireAuBenin } from "@/lib/annee-scolaire";
import { selectionnerAnneeExport } from "@/lib/annee-export";
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
        notes: { select: { matiere: true, valeur: true, periode: true, anneeScolaire: true } },
        absences: { select: { date: true, motif: true, periode: true, anneeScolaire: true } },
        alertes: { orderBy: { createdAt: "desc" } },
      },
    });

    // Hors périmètre = introuvable : on ne révèle pas l'existence de l'élève
    if (!etudiant || !peutAccederEtudiant(access.user, etudiant)) {
      return introuvable("Étudiant introuvable");
    }

    // Année scolaire en cours au Bénin ; sans note ou absence cette année,
    // le récapitulatif de l'année précédente (voir selectionnerAnneeExport)
    const { anneeScolaire } = periodeScolaireAuBenin(new Date());
    const genereLe = new Date();

    const classeur = classeurFicheEleve({
      etudiant,
      anneeScolaire,
      notes: selectionnerAnneeExport(etudiant.notes, anneeScolaire),
      absences: selectionnerAnneeExport(etudiant.absences, anneeScolaire),
      alertes: etudiant.alertes,
      genereLe,
    });
    return reponseXlsx(classeur, nomFichierFiche({ etudiant, genereLe }));
  } catch (error) {
    console.error("Erreur lors de la génération de la fiche Excel", error);
    return NextResponse.json({ error: "Impossible de générer le fichier Excel." }, { status: 500 });
  }
}
