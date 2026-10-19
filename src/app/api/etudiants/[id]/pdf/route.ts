import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth-guard";
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
        inscriptions: { select: { anneeScolaire: true } },
        notes: { select: { matiere: true, valeur: true, periode: true, anneeScolaire: true } },
        absences: { select: { motif: true, periode: true, anneeScolaire: true } },
        alertes: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!etudiant || !peutAccederEtudiant(access.user, etudiant)) {
      return introuvable("Étudiant introuvable");
    }

    const annees = [
      ...etudiant.inscriptions.map((i) => i.anneeScolaire),
      ...etudiant.notes.map((n) => n.anneeScolaire),
    ].sort();
    const anneeScolaire = annees.at(-1) ?? "—";

    const pdf = await renderToBuffer(
      FicheEtudiantPdf({
        etudiant,
        anneeScolaire,
        notes: etudiant.notes.filter((n) => n.anneeScolaire === anneeScolaire),
        absences: etudiant.absences.filter((a) => a.anneeScolaire === anneeScolaire),
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
