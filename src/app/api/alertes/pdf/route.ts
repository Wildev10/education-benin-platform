import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth-guard";
import { nomEtablissementFiltre, rechercherAlertes } from "@/lib/alertes-server";
import { decrireFiltres, lireFiltres, porteeAlertes } from "@/lib/filtres-alertes";
import { dateIso } from "@/lib/pdf/commun";
import { RapportAlertesPdf } from "@/lib/pdf/rapport-alertes";

/** Export PDF des alertes : mêmes filtres et même périmètre que la page des alertes. */
export async function GET(request: Request) {
  const access = await requireRole(["admin", "enseignant", "directeur"]);
  if (access instanceof Response) return access;

  try {
    const filtres = lireFiltres(new URL(request.url).searchParams);
    const portee = porteeAlertes(access.user);
    const [{ alertes }, nomEtablissement] = await Promise.all([
      rechercherAlertes(filtres, portee),
      nomEtablissementFiltre(filtres, portee),
    ]);

    const genereLe = new Date();
    const pdf = await renderToBuffer(
      RapportAlertesPdf({
        alertes,
        genereLe,
        statut: filtres.statut,
        filtres: decrireFiltres(filtres, nomEtablissement),
      })
    );

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="alertes-${dateIso(genereLe)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erreur lors de la génération du rapport d'alertes PDF", error);
    return NextResponse.json({ error: "Impossible de générer le rapport PDF." }, { status: 500 });
  }
}
