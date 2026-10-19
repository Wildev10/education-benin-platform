import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { introuvable, peutAccederEtablissement } from "@/lib/perimetre";
import { reponseXlsx } from "@/lib/excel/commun";
import { anneeDeReference, classeurEleves, lignesEleves, nomFichierEleves } from "@/lib/excel/eleves";

type RouteContext = { params: Promise<{ id: string }> };

/** Liste des élèves d'un établissement : admin pour tous, directeur et enseignant pour le leur. */
export async function GET(_request: Request, context: RouteContext) {
  const access = await requireRole(["admin", "enseignant", "directeur"]);
  if (access instanceof Response) return access;

  try {
    const { id } = await context.params;
    // Contrôle avant toute lecture : un autre établissement est « introuvable »
    if (!peutAccederEtablissement(access.user, id)) return introuvable("Établissement introuvable");

    const etablissement = await prisma.etablissement.findUnique({
      where: { id },
      select: {
        nom: true,
        etudiants: {
          select: {
            nom: true,
            prenom: true,
            niveau: true,
            notes: { select: { valeur: true, periode: true, anneeScolaire: true } },
            absences: { where: { motif: "injustifiee" }, select: { anneeScolaire: true } },
            alertes: { where: { statut: "active" }, select: { niveauRisque: true } },
          },
        },
      },
    });
    if (!etablissement) return introuvable("Établissement introuvable");

    const eleves = etablissement.etudiants.map((e) => ({
      ...e,
      absencesInjustifiees: e.absences,
      alertesActives: e.alertes,
    }));
    const annee = anneeDeReference(eleves);
    const genereLe = new Date();
    const classeur = classeurEleves({
      etablissement: etablissement.nom,
      annee,
      lignes: lignesEleves(eleves, annee),
      genereLe,
    });
    return reponseXlsx(classeur, nomFichierEleves(etablissement.nom, genereLe));
  } catch (error) {
    console.error("Erreur lors de la génération de la liste des élèves Excel", error);
    return NextResponse.json({ error: "Impossible de générer le fichier Excel." }, { status: 500 });
  }
}
