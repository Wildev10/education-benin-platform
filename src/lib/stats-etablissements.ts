import { prisma } from "@/lib/prisma";

type AlerteActive = { niveauRisque: string; etudiant: { etablissementId: string } };

/**
 * Statistiques par établissement. `alertesActives` : les alertes actives déjà
 * chargées par l'appelant (tableau de bord), pour ne pas les relire en base.
 */
export async function getStatsEtablissements(alertesActives?: Promise<AlerteActive[]>) {
  const [etablissements, alertes, moyennesParEtudiant] = await Promise.all([
    prisma.etablissement.findMany({
      select: {
        id: true,
        nom: true,
        departement: true,
        etudiants: { select: { id: true } },
      },
    }),
    alertesActives ??
      prisma.alerte.findMany({
        where: { statut: "active" },
        select: { niveauRisque: true, etudiant: { select: { etablissementId: true } } },
      }),
    prisma.note.groupBy({ by: ["etudiantId"], _avg: { valeur: true } }),
  ]);

  const moyenneEtudiant = new Map(moyennesParEtudiant.map((m) => [m.etudiantId, m._avg.valeur]));

  return etablissements
    .map(({ etudiants, ...etablissement }) => {
      const alertesEtab = alertes.filter((a) => a.etudiant.etablissementId === etablissement.id);
      const moyennes = etudiants
        .map((e) => moyenneEtudiant.get(e.id))
        .filter((m): m is number => typeof m === "number");
      const nbEtudiants = etudiants.length;

      return {
        ...etablissement,
        nbEtudiants,
        nbAlertesActives: alertesEtab.length,
        nbAlertesElevees: alertesEtab.filter((a) => a.niveauRisque === "eleve").length,
        moyenneGenerale: moyennes.length
          ? round(moyennes.reduce((s, m) => s + m, 0) / moyennes.length, 2)
          : null,
        tauxAlerte: nbEtudiants ? round((alertesEtab.length / nbEtudiants) * 100, 1) : 0,
      };
    })
    .sort((a, b) => b.tauxAlerte - a.tauxAlerte || b.nbAlertesActives - a.nbAlertesActives);
}

function round(value: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export type StatsEtablissement = Awaited<ReturnType<typeof getStatsEtablissements>>[number];
