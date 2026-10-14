import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { dateIso } from "@/lib/pdf/commun";
import { RapportAlertesPdf } from "@/lib/pdf/rapport-alertes";

export async function GET() {
  const access = await requireRole(["admin"]);
  if (access instanceof Response) return access;

  try {
    const alertes = await prisma.alerte.findMany({
      where: { statut: "active" },
      select: {
        niveauRisque: true,
        periode: true,
        moyenneApres: true,
        ecartPourcent: true,
        etudiant: {
          select: {
            nom: true,
            prenom: true,
            niveau: true,
            etablissement: { select: { id: true, nom: true, departement: true } },
          },
        },
      },
    });

    const genereLe = new Date();
    const pdf = await renderToBuffer(RapportAlertesPdf({ alertes, genereLe }));

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="alertes-actives-${dateIso(genereLe)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erreur lors de la génération du rapport d'alertes PDF", error);
    return NextResponse.json({ error: "Impossible de générer le rapport PDF." }, { status: 500 });
  }
}
