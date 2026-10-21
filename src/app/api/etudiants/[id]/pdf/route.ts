import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth-guard";
import { periodeScolaireAuBenin } from "@/lib/annee-scolaire";
import { selectionnerAnneeExport } from "@/lib/annee-export";
import { prisma } from "@/lib/prisma";
import { introuvable, peutAccederEtudiant } from "@/lib/perimetre";
import { slugFichier } from "@/lib/pdf/commun";
import { FicheEtudiantPdf } from "@/lib/pdf/fiche-etudiant";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireRole(["admin", "enseignant", "directeur"]);
  if (access instanceof Response) return access;

  try {
    const { id } = await context.params;
    const etudiant = await prisma.etudiant.findUnique({
      where: { id },
      include: {
        etablissement: true,
        notes: { select: { matiere: true, valeur: true, periode: true, anneeScolaire: true } },
        absences: { select: { motif: true, periode: true, anneeScolaire: true } },
        alertes: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!etudiant || !peutAccederEtudiant(access.user, etudiant)) {
      return introuvable("Étudiant introuvable");
    }

    // Année scolaire en cours au Bénin ; sans note ou absence cette année,
    // le récapitulatif de l'année précédente (voir selectionnerAnneeExport)
    const { anneeScolaire } = periodeScolaireAuBenin(new Date());

    const pdf = await renderToBuffer(
      FicheEtudiantPdf({
        etudiant,
        anneeScolaire,
        notes: selectionnerAnneeExport(etudiant.notes, anneeScolaire),
        absences: selectionnerAnneeExport(etudiant.absences, anneeScolaire),
        alertes: etudiant.alertes,
        genereLe: new Date(),
      })
    );

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fiche-${slugFichier(etudiant.nom, etudiant.prenom)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erreur lors de la génération de la fiche PDF", error);
    return NextResponse.json({ error: "Impossible de générer la fiche PDF." }, { status: 500 });
  }
}
