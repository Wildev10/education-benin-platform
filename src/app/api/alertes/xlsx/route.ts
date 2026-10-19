import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { nomEtablissementFiltre, rechercherAlertes } from "@/lib/alertes-server";
import { decrireFiltres, lireFiltres, porteeAlertes } from "@/lib/filtres-alertes";
import { reponseXlsx } from "@/lib/excel/commun";
import { classeurAlertes, nomFichierAlertes } from "@/lib/excel/alertes";

/** Liste des alertes au format Excel : mêmes filtres et même périmètre que la page et le PDF. */
export async function GET(request: Request) {
  const access = await requireRole(["admin", "enseignant", "directeur"]);
  if (access instanceof Response) return access;

  try {
    const filtres = lireFiltres(new URL(request.url).searchParams);
    const portee = porteeAlertes(access.user);
    const [{ alertes }, nomFiltre, etablissementUtilisateur] = await Promise.all([
      rechercherAlertes(filtres, portee),
      nomEtablissementFiltre(filtres, portee),
      portee.type === "etablissement"
        ? prisma.etablissement.findUnique({ where: { id: portee.etablissementId }, select: { nom: true } })
        : Promise.resolve(null),
    ]);

    const etablissement =
      etablissementUtilisateur?.nom ?? nomFiltre ?? (portee.type === "toutes" ? "Tous les établissements" : "—");
    const genereLe = new Date();
    const classeur = classeurAlertes({
      alertes,
      etablissement,
      filtres: decrireFiltres(filtres, nomFiltre),
      genereLe,
    });
    return reponseXlsx(classeur, nomFichierAlertes(genereLe));
  } catch (error) {
    console.error("Erreur lors de la génération des alertes Excel", error);
    return NextResponse.json({ error: "Impossible de générer le fichier Excel." }, { status: 500 });
  }
}
